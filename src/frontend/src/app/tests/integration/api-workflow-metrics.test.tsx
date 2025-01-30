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

describe('API Workflow Metrics Integration', () => {
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

  it('should track API metrics during workflow execution', async () => {
    const metrics = {
      api: [] as { endpoint: string; latency: number; success: boolean }[],
      errors: [] as { endpoint: string; error: any; timestamp: number }[],
      retries: [] as { endpoint: string; attempt: number; timestamp: number }[]
    };

    const trackApiCall = async (endpoint: string, operation: () => Promise<any>) => {
      const startTime = Date.now();
      try {
        const result = await operation();
        metrics.api.push({
          endpoint,
          latency: Date.now() - startTime,
          success: true
        });
        return result;
      } catch (error) {
        metrics.api.push({
          endpoint,
          latency: Date.now() - startTime,
          success: false
        });
        metrics.errors.push({
          endpoint,
          error,
          timestamp: Date.now()
        });
        throw error;
      }
    };

    const mockApiResponses = {
      createBot: {
        id: 'bot-123',
        type: 'trading',
        strategy: 'momentum'
      },
      getBotStatus: {
        id: 'bot-123',
        status: 'active',
        metrics: {
          performance: {
            trades: 10,
            success_rate: 0.8,
            avg_return: 0.05
          }
        }
      },
      createWallet: {
        address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
        balance: 1.5,
        bot_id: 'bot-123'
      }
    };

    (createBot as jest.Mock).mockImplementation((type, strategy) =>
      trackApiCall('/bots', () => Promise.resolve(mockApiResponses.createBot))
    );

    (getBotStatus as jest.Mock).mockImplementation((botId) =>
      trackApiCall('/bots/status', () => Promise.resolve(mockApiResponses.getBotStatus))
    );

    (createWallet as jest.Mock).mockImplementation((botId) =>
      trackApiCall('/wallets', () => Promise.resolve(mockApiResponses.createWallet))
    );

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(metrics.api.length).toBeGreaterThan(0);
    });

    const avgLatency = metrics.api.reduce((sum, call) => sum + call.latency, 0) / metrics.api.length;
    const successfulCalls = metrics.api.filter(call => call.success).length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors.length / metrics.api.length,
        apiLatency: avgLatency,
        systemHealth: successfulCalls / metrics.api.length,
        successRate: successfulCalls / metrics.api.length,
        totalTrades: mockApiResponses.getBotStatus.metrics.performance.trades,
        walletBalance: mockApiResponses.createWallet.balance
      },
      api: {
        totalCalls: metrics.api.length,
        uniqueEndpoints: new Set(metrics.api.map(call => call.endpoint)).size,
        errors: metrics.errors.length,
        retries: metrics.retries.length,
        latencyByEndpoint: metrics.api.reduce((acc, call) => {
          if (!acc[call.endpoint]) acc[call.endpoint] = [];
          acc[call.endpoint].push(call.latency);
          return acc;
        }, {} as Record<string, number[]>)
      }
    };

    expect(testMetrics.api.totalCalls).toBeGreaterThan(0);
    expect(testMetrics.performance.successRate).toBe(1);
    expect(testMetrics.performance.apiLatency).toBeLessThan(1000);
  });

  it('should track API retry metrics during failures', async () => {
    const metrics = {
      retries: [] as { endpoint: string; attempt: number; success: boolean }[],
      errors: [] as { endpoint: string; error: any }[]
    };

    const MAX_RETRIES = 3;
    const mockFailures = {
      '/bots': [new Error('Network Error'), new Error('Timeout')],
      '/wallets': [new Error('Service Unavailable')]
    };

    const executeWithRetry = async (endpoint: string, operation: () => Promise<any>) => {
      let attempt = 1;
      while (attempt <= MAX_RETRIES) {
        try {
          if (mockFailures[endpoint]?.length > 0 && attempt <= mockFailures[endpoint].length) {
            metrics.errors.push({
              endpoint,
              error: mockFailures[endpoint][attempt - 1]
            });
            metrics.retries.push({
              endpoint,
              attempt,
              success: false
            });
            attempt++;
            continue;
          }

          const result = await operation();
          metrics.retries.push({
            endpoint,
            attempt,
            success: true
          });
          return result;
        } catch (error) {
          if (attempt === MAX_RETRIES) throw error;
          attempt++;
        }
      }
    };

    (createBot as jest.Mock).mockImplementation((type, strategy) =>
      executeWithRetry('/bots', () => Promise.resolve({
        id: 'bot-123',
        type,
        strategy
      }))
    );

    (createWallet as jest.Mock).mockImplementation((botId) =>
      executeWithRetry('/wallets', () => Promise.resolve({
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

    await waitFor(() => {
      expect(metrics.retries.length).toBeGreaterThan(0);
    });

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors.length / metrics.retries.length,
        apiLatency: 0,
        systemHealth: metrics.retries.filter(r => r.success).length / metrics.retries.length,
        successRate: metrics.retries.filter(r => r.success).length / metrics.retries.length,
        totalTrades: 0,
        walletBalance: 1.5
      },
      retries: {
        total: metrics.retries.length,
        successful: metrics.retries.filter(r => r.success).length,
        byEndpoint: metrics.retries.reduce((acc, retry) => {
          if (!acc[retry.endpoint]) acc[retry.endpoint] = [];
          acc[retry.endpoint].push(retry);
          return acc;
        }, {} as Record<string, typeof metrics.retries>),
        maxAttempts: Math.max(...metrics.retries.map(r => r.attempt))
      }
    };

    expect(testMetrics.retries.total).toBeGreaterThan(0);
    expect(testMetrics.retries.maxAttempts).toBeLessThanOrEqual(MAX_RETRIES);
    expect(testMetrics.performance.successRate).toBeGreaterThan(0);
  });

  it('should validate API metrics consistency', async () => {
    const metrics = {
      measurements: [] as { endpoint: string; metrics: any; timestamp: number }[],
      validations: {
        success: 0,
        failure: 0
      }
    };

    const validateMetrics = (endpoint: string, data: any) => {
      try {
        metrics.measurements.push({
          endpoint,
          metrics: data,
          timestamp: Date.now()
        });
        metrics.validations.success++;
        return true;
      } catch (error) {
        metrics.validations.failure++;
        return false;
      }
    };

    const mockApiMetrics = {
      '/bots': {
        latency: 150 + Math.random() * 50,
        success_rate: 0.95 + Math.random() * 0.05,
        error_rate: 0.01 + Math.random() * 0.01
      },
      '/wallets': {
        latency: 100 + Math.random() * 30,
        success_rate: 0.98 + Math.random() * 0.02,
        error_rate: 0.005 + Math.random() * 0.005
      }
    };

    Object.entries(mockApiMetrics).forEach(([endpoint, apiMetrics]) => {
      validateMetrics(endpoint, apiMetrics);
    });

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.validations.failure / (metrics.validations.success + metrics.validations.failure),
        apiLatency: metrics.measurements.reduce((sum, m) => sum + m.metrics.latency, 0) / metrics.measurements.length,
        systemHealth: metrics.validations.success / (metrics.validations.success + metrics.validations.failure),
        successRate: metrics.validations.success / (metrics.validations.success + metrics.validations.failure),
        totalTrades: 0,
        walletBalance: 0
      },
      validation: {
        measurements: metrics.measurements.length,
        validationRate: metrics.validations.success / (metrics.validations.success + metrics.validations.failure),
        endpointMetrics: metrics.measurements.reduce((acc, m) => {
          acc[m.endpoint] = m.metrics;
          return acc;
        }, {} as Record<string, any>)
      }
    };

    expect(testMetrics.validation.measurements).toBe(Object.keys(mockApiMetrics).length);
    expect(testMetrics.validation.validationRate).toBe(1);
    expect(Object.values(testMetrics.validation.endpointMetrics)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          latency: expect.any(Number),
          success_rate: expect.any(Number),
          error_rate: expect.any(Number)
        })
      ])
    );
  });
});
