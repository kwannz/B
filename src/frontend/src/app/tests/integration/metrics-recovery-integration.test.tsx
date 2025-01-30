import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import { useDebugStore } from '@/app/stores/debugStore';
import { TestMetrics } from '../types/test.types';
import TradingDashboard from '@/app/trading-dashboard/page';
import WalletComparison from '@/app/wallet-comparison/page';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/api/client');
jest.mock('@/app/stores/debugStore');

describe('Metrics Recovery Integration', () => {
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

  it('should track metrics during API error recovery', async () => {
    const mockResponses = [
      Promise.reject(new Error('Network Error')),
      Promise.resolve({
        id: 'bot-123',
        status: 'active',
        metrics: {
          total_volume: 1000,
          profit_loss: 0.5,
          active_positions: 2
        }
      })
    ];

    let callCount = 0;
    (getBotStatus as jest.Mock).mockImplementation(() => mockResponses[callCount++]);

    const metrics = {
      attempts: 0,
      recoveries: 0,
      errors: 0,
      latencies: [] as number[]
    };

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    const startTime = Date.now();
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
      metrics.errors++;
      metrics.attempts++;
      metrics.latencies.push(Date.now() - startTime);
    });

    const retryButton = screen.getByRole('button', { name: /retry/i });
    const retryStart = Date.now();
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText(/active/i)).toBeInTheDocument();
      metrics.recoveries++;
      metrics.latencies.push(Date.now() - retryStart);
    });

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / (metrics.attempts + metrics.recoveries),
        apiLatency: metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length,
        systemHealth: metrics.recoveries / (metrics.errors + metrics.recoveries),
        successRate: metrics.recoveries / (metrics.attempts + metrics.recoveries),
        totalTrades: 0,
        walletBalance: 0
      },
      recovery: {
        attempts: metrics.attempts,
        successfulRecoveries: metrics.recoveries,
        avgRecoveryTime: metrics.latencies[1] - metrics.latencies[0],
        recoveryRate: metrics.recoveries / metrics.attempts
      }
    };

    expect(testMetrics.recovery.successfulRecoveries).toBe(1);
    expect(testMetrics.performance.systemHealth).toBeGreaterThan(0);
    expect(testMetrics.recovery.recoveryRate).toBe(1);
  });

  it('should track metrics during multiple error recoveries', async () => {
    const mockResponses = [
      Promise.reject(new Error('Network Error')),
      Promise.reject(new Error('Timeout')),
      Promise.resolve({
        id: 'bot-123',
        status: 'active',
        metrics: {
          total_volume: 1000,
          profit_loss: 0.5,
          active_positions: 2
        }
      })
    ];

    let callCount = 0;
    (getBotStatus as jest.Mock).mockImplementation(() => mockResponses[callCount++]);

    const metrics = {
      attempts: 0,
      recoveries: 0,
      errors: 0,
      latencies: [] as number[]
    };

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    // First error
    const startTime = Date.now();
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
      metrics.errors++;
      metrics.attempts++;
      metrics.latencies.push(Date.now() - startTime);
    });

    // First retry
    const retry1Start = Date.now();
    const retryButton1 = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton1);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
      metrics.errors++;
      metrics.attempts++;
      metrics.latencies.push(Date.now() - retry1Start);
    });

    // Second retry
    const retry2Start = Date.now();
    const retryButton2 = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton2);

    await waitFor(() => {
      expect(screen.getByText(/active/i)).toBeInTheDocument();
      metrics.recoveries++;
      metrics.latencies.push(Date.now() - retry2Start);
    });

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / (metrics.attempts + metrics.recoveries),
        apiLatency: metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length,
        systemHealth: metrics.recoveries / (metrics.errors + metrics.recoveries),
        successRate: metrics.recoveries / (metrics.attempts + metrics.recoveries),
        totalTrades: 0,
        walletBalance: 0
      },
      recovery: {
        attempts: metrics.attempts,
        successfulRecoveries: metrics.recoveries,
        avgRecoveryTime: (metrics.latencies[2] - metrics.latencies[0]) / 2,
        recoveryRate: metrics.recoveries / metrics.attempts
      }
    };

    expect(testMetrics.recovery.attempts).toBe(2);
    expect(testMetrics.recovery.successfulRecoveries).toBe(1);
    expect(testMetrics.performance.errorRate).toBeGreaterThan(0.5);
    expect(testMetrics.recovery.recoveryRate).toBe(0.5);
  });

  it('should validate system health metrics during recovery', async () => {
    const startTime = Date.now();
    const metrics = {
      checks: [] as { timestamp: number; status: string; latency: number }[],
      errors: 0,
      recoveries: 0
    };

    const mockResponses = [
      Promise.reject(new Error('Service Unavailable')),
      Promise.resolve({
        id: 'bot-123',
        status: 'degraded',
        health: 0.7
      }),
      Promise.resolve({
        id: 'bot-123',
        status: 'active',
        health: 1.0
      })
    ];

    let callCount = 0;
    (getBotStatus as jest.Mock).mockImplementation(() => {
      const response = mockResponses[callCount++];
      const checkStart = Date.now();
      return response.then(
        (result) => {
          metrics.checks.push({
            timestamp: Date.now(),
            status: result.status,
            latency: Date.now() - checkStart
          });
          if (result.status === 'active') {
            metrics.recoveries++;
          }
          return result;
        },
        (error) => {
          metrics.checks.push({
            timestamp: Date.now(),
            status: 'error',
            latency: Date.now() - checkStart
          });
          metrics.errors++;
          throw error;
        }
      );
    });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    // Initial error
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });

    // First recovery attempt
    const retryButton1 = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton1);

    await waitFor(() => {
      expect(screen.getByText(/degraded/i)).toBeInTheDocument();
    });

    // Final recovery attempt
    const retryButton2 = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton2);

    await waitFor(() => {
      expect(screen.getByText(/active/i)).toBeInTheDocument();
    });

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / metrics.checks.length,
        apiLatency: metrics.checks.reduce((sum, check) => sum + check.latency, 0) / metrics.checks.length,
        systemHealth: metrics.recoveries / metrics.checks.length,
        successRate: (metrics.checks.length - metrics.errors) / metrics.checks.length,
        totalTrades: 0,
        walletBalance: 0
      },
      health: {
        checks: metrics.checks.length,
        avgLatency: metrics.checks.reduce((sum, check) => sum + check.latency, 0) / metrics.checks.length,
        uptime: (Date.now() - startTime) / 1000,
        recoveryTime: metrics.checks[metrics.checks.length - 1].timestamp - metrics.checks[0].timestamp,
        finalStatus: metrics.checks[metrics.checks.length - 1].status
      }
    };

    expect(testMetrics.health.checks).toBe(3);
    expect(testMetrics.health.finalStatus).toBe('active');
    expect(testMetrics.performance.systemHealth).toBeGreaterThan(0);
    expect(testMetrics.performance.errorRate).toBeLessThan(0.5);
  });
});
