import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import { useDebugStore } from '@/app/stores/debugStore';
import { TestMetrics } from '../types/test.types';
import TradingDashboard from '@/app/trading-dashboard/page';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/api/client');
jest.mock('@/app/stores/debugStore');

describe('API Gateway Metrics Integration', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn()
  };

  const mockWallet = {
    connected: true,
    connecting: false,
    publicKey: { toString: () => '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK' },
    connect: jest.fn(),
    disconnect: jest.fn(),
    signTransaction: jest.fn(),
    signAllTransactions: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useWallet as jest.Mock).mockReturnValue(mockWallet);
  });

  it('should track API gateway performance metrics', async () => {
    const metrics = {
      requests: [] as { endpoint: string; latency: number; success: boolean }[],
      errors: 0,
      successes: 0
    };

    const trackApiCall = async (endpoint: string, apiCall: () => Promise<any>) => {
      const startTime = Date.now();
      try {
        const result = await apiCall();
        metrics.requests.push({
          endpoint,
          latency: Date.now() - startTime,
          success: true
        });
        metrics.successes++;
        return result;
      } catch (error) {
        metrics.requests.push({
          endpoint,
          latency: Date.now() - startTime,
          success: false
        });
        metrics.errors++;
        throw error;
      }
    };

    (createBot as jest.Mock).mockImplementation((type, strategy) =>
      trackApiCall('/bots', () => Promise.resolve({
        id: 'bot-123',
        type,
        strategy
      }))
    );

    (getBotStatus as jest.Mock).mockImplementation((botId) =>
      trackApiCall('/bots/status', () => Promise.resolve({
        id: botId,
        status: 'active',
        metrics: {
          performance: {
            cpu_usage: 45,
            memory_usage: 60,
            latency: 150
          }
        }
      }))
    );

    (createWallet as jest.Mock).mockImplementation((botId) =>
      trackApiCall('/wallets', () => Promise.resolve({
        address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
        balance: 1.5,
        bot_id: botId
      }))
    );

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    // Wait for initial API calls
    await waitFor(() => {
      expect(metrics.requests.length).toBeGreaterThan(0);
    });

    const avgLatency = metrics.requests.reduce((sum, req) => sum + req.latency, 0) / metrics.requests.length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / metrics.requests.length,
        apiLatency: avgLatency,
        systemHealth: metrics.successes / metrics.requests.length,
        successRate: metrics.successes / metrics.requests.length,
        totalTrades: 0,
        walletBalance: 1.5
      },
      api: {
        totalRequests: metrics.requests.length,
        avgLatency,
        endpoints: metrics.requests.map(req => req.endpoint),
        successRate: metrics.successes / metrics.requests.length
      }
    };

    expect(testMetrics.api.totalRequests).toBeGreaterThan(0);
    expect(testMetrics.performance.successRate).toBe(1);
    expect(testMetrics.api.avgLatency).toBeLessThan(1000);
  });

  it('should track API error recovery metrics', async () => {
    const metrics = {
      attempts: [] as { endpoint: string; attempt: number; success: boolean }[],
      errors: 0,
      recoveries: 0
    };

    const mockFailures = {
      '/bots/status': 2,
      '/wallets': 1
    };

    const attemptApiCall = async (endpoint: string, apiCall: () => Promise<any>) => {
      const attempts = metrics.attempts.filter(a => a.endpoint === endpoint).length;
      const shouldFail = attempts < (mockFailures[endpoint] || 0);

      try {
        if (shouldFail) {
          metrics.attempts.push({
            endpoint,
            attempt: attempts + 1,
            success: false
          });
          metrics.errors++;
          throw new Error('API Error');
        }

        const result = await apiCall();
        metrics.attempts.push({
          endpoint,
          attempt: attempts + 1,
          success: true
        });
        if (attempts > 0) metrics.recoveries++;
        return result;
      } catch (error) {
        throw error;
      }
    };

    (getBotStatus as jest.Mock).mockImplementation((botId) =>
      attemptApiCall('/bots/status', () => Promise.resolve({
        id: botId,
        status: 'active',
        metrics: {
          performance: {
            cpu_usage: 45,
            memory_usage: 60,
            latency: 150
          }
        }
      }))
    );

    (createWallet as jest.Mock).mockImplementation((botId) =>
      attemptApiCall('/wallets', () => Promise.resolve({
        address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
        balance: 1.5,
        bot_id: botId
      }))
    );

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    // Initial failures
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });

    // Retry until success
    const retryButton = screen.getByRole('button', { name: /retry/i });
    for (let i = 0; i < Math.max(...Object.values(mockFailures)); i++) {
      fireEvent.click(retryButton);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    await waitFor(() => {
      expect(screen.getByText(/active/i)).toBeInTheDocument();
    });

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / metrics.attempts.length,
        apiLatency: 0,
        systemHealth: metrics.recoveries / metrics.errors,
        successRate: metrics.recoveries / metrics.attempts.length,
        totalTrades: 0,
        walletBalance: 1.5
      },
      recovery: {
        totalAttempts: metrics.attempts.length,
        successfulRecoveries: metrics.recoveries,
        failedAttempts: metrics.errors,
        recoveryRate: metrics.recoveries / metrics.errors
      }
    };

    expect(testMetrics.recovery.totalAttempts).toBeGreaterThan(0);
    expect(testMetrics.recovery.successfulRecoveries).toBeGreaterThan(0);
    expect(testMetrics.performance.systemHealth).toBeGreaterThan(0);
  });

  it('should validate API response metrics', async () => {
    const metrics = {
      responses: [] as { endpoint: string; size: number; timestamp: number }[],
      validations: {
        success: 0,
        failure: 0
      }
    };

    const validateApiResponse = (endpoint: string, response: any) => {
      try {
        metrics.responses.push({
          endpoint,
          size: JSON.stringify(response).length,
          timestamp: Date.now()
        });

        if (endpoint === '/bots/status') {
          expect(response).toHaveProperty('id');
          expect(response).toHaveProperty('status');
          expect(response).toHaveProperty('metrics.performance');
        } else if (endpoint === '/wallets') {
          expect(response).toHaveProperty('address');
          expect(response).toHaveProperty('balance');
          expect(response).toHaveProperty('bot_id');
        }

        metrics.validations.success++;
        return true;
      } catch (error) {
        metrics.validations.failure++;
        return false;
      }
    };

    (getBotStatus as jest.Mock).mockImplementation((botId) =>
      Promise.resolve({
        id: botId,
        status: 'active',
        metrics: {
          performance: {
            cpu_usage: 45,
            memory_usage: 60,
            latency: 150
          }
        }
      }).then(response => {
        validateApiResponse('/bots/status', response);
        return response;
      })
    );

    (createWallet as jest.Mock).mockImplementation((botId) =>
      Promise.resolve({
        address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
        balance: 1.5,
        bot_id: botId
      }).then(response => {
        validateApiResponse('/wallets', response);
        return response;
      })
    );

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(metrics.responses.length).toBeGreaterThan(0);
    });

    const avgResponseSize = metrics.responses.reduce((sum, res) => sum + res.size, 0) / metrics.responses.length;
    const responseTimeGaps = metrics.responses
      .slice(1)
      .map((res, i) => res.timestamp - metrics.responses[i].timestamp);
    const avgTimeGap = responseTimeGaps.reduce((sum, gap) => sum + gap, 0) / responseTimeGaps.length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.validations.failure / (metrics.validations.success + metrics.validations.failure),
        apiLatency: avgTimeGap,
        systemHealth: metrics.validations.success / (metrics.validations.success + metrics.validations.failure),
        successRate: metrics.validations.success / (metrics.validations.success + metrics.validations.failure),
        totalTrades: 0,
        walletBalance: 1.5
      },
      validation: {
        totalResponses: metrics.responses.length,
        avgResponseSize,
        validationRate: metrics.validations.success / (metrics.validations.success + metrics.validations.failure),
        endpoints: [...new Set(metrics.responses.map(r => r.endpoint))]
      }
    };

    expect(testMetrics.validation.totalResponses).toBeGreaterThan(0);
    expect(testMetrics.validation.validationRate).toBe(1);
    expect(testMetrics.performance.apiLatency).toBeGreaterThan(0);
  });
});
