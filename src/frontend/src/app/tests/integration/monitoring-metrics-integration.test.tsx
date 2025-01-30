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

describe('Monitoring Dashboard Metrics Integration', () => {
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

  it('should track monitoring dashboard performance metrics', async () => {
    const metrics = {
      dashboardUpdates: [] as { timestamp: number; metrics: any }[],
      errors: 0,
      successes: 0,
      latencies: [] as number[]
    };

    const mockDashboardData = [
      {
        system: {
          cpu_usage: 45,
          memory_usage: 60,
          network_latency: 150,
          error_rate: 0.01
        },
        trading: {
          active_bots: 3,
          total_volume: 1000,
          profit_loss: 0.5,
          active_positions: 2
        }
      },
      {
        system: {
          cpu_usage: 50,
          memory_usage: 65,
          network_latency: 160,
          error_rate: 0.02
        },
        trading: {
          active_bots: 4,
          total_volume: 1200,
          profit_loss: 0.7,
          active_positions: 3
        }
      }
    ];

    let updateCount = 0;
    (getBotStatus as jest.Mock).mockImplementation(() => {
      const startTime = Date.now();
      return Promise.resolve({
        id: 'bot-123',
        status: 'active',
        metrics: mockDashboardData[updateCount++ % mockDashboardData.length]
      })
        .then(result => {
          metrics.dashboardUpdates.push({
            timestamp: Date.now(),
            metrics: result.metrics
          });
          metrics.latencies.push(Date.now() - startTime);
          metrics.successes++;
          return result;
        })
        .catch(error => {
          metrics.errors++;
          throw error;
        });
    });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    // Initial metrics
    await waitFor(() => {
      expect(screen.getByText(/45%/)).toBeInTheDocument();
      expect(screen.getByText(/1000/)).toBeInTheDocument();
    });

    // Updated metrics
    await waitFor(() => {
      expect(screen.getByText(/50%/)).toBeInTheDocument();
      expect(screen.getByText(/1200/)).toBeInTheDocument();
    });

    const avgLatency = metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / (metrics.errors + metrics.successes),
        apiLatency: avgLatency,
        systemHealth: metrics.successes / (metrics.errors + metrics.successes),
        successRate: metrics.successes / (metrics.errors + metrics.successes),
        totalTrades: mockDashboardData[1].trading.active_positions,
        walletBalance: 0
      },
      monitoring: {
        updates: metrics.dashboardUpdates.length,
        avgLatency,
        systemMetrics: {
          avgCpuUsage: metrics.dashboardUpdates.reduce((sum, update) => 
            sum + update.metrics.system.cpu_usage, 0) / metrics.dashboardUpdates.length,
          avgMemoryUsage: metrics.dashboardUpdates.reduce((sum, update) => 
            sum + update.metrics.system.memory_usage, 0) / metrics.dashboardUpdates.length,
          avgNetworkLatency: metrics.dashboardUpdates.reduce((sum, update) => 
            sum + update.metrics.system.network_latency, 0) / metrics.dashboardUpdates.length
        }
      }
    };

    expect(testMetrics.monitoring.updates).toBeGreaterThan(0);
    expect(testMetrics.performance.successRate).toBe(1);
    expect(testMetrics.monitoring.systemMetrics.avgCpuUsage).toBeLessThan(80);
  });

  it('should track monitoring metrics during error recovery', async () => {
    const metrics = {
      recoveryAttempts: [] as { timestamp: number; success: boolean }[],
      errors: 0,
      recoveries: 0
    };

    const mockResponses = [
      Promise.reject(new Error('Monitoring Service Unavailable')),
      Promise.resolve({
        id: 'bot-123',
        status: 'degraded',
        metrics: {
          system: {
            cpu_usage: 85,
            memory_usage: 80,
            network_latency: 300,
            error_rate: 0.15
          }
        }
      }),
      Promise.resolve({
        id: 'bot-123',
        status: 'active',
        metrics: {
          system: {
            cpu_usage: 45,
            memory_usage: 60,
            network_latency: 150,
            error_rate: 0.01
          }
        }
      })
    ];

    let responseIndex = 0;
    (getBotStatus as jest.Mock).mockImplementation(() => {
      const attempt = mockResponses[responseIndex++];
      metrics.recoveryAttempts.push({
        timestamp: Date.now(),
        success: attempt instanceof Promise && !(attempt instanceof Error)
      });
      return attempt;
    });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    // Initial error
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
      metrics.errors++;
    });

    // First recovery attempt
    const retryButton1 = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton1);

    await waitFor(() => {
      expect(screen.getByText(/degraded/i)).toBeInTheDocument();
      expect(screen.getByText(/85%/)).toBeInTheDocument();
    });

    // Final recovery attempt
    const retryButton2 = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton2);

    await waitFor(() => {
      expect(screen.getByText(/active/i)).toBeInTheDocument();
      expect(screen.getByText(/45%/)).toBeInTheDocument();
      metrics.recoveries++;
    });

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / metrics.recoveryAttempts.length,
        apiLatency: 0,
        systemHealth: metrics.recoveries / metrics.recoveryAttempts.length,
        successRate: metrics.recoveries / metrics.recoveryAttempts.length,
        totalTrades: 0,
        walletBalance: 0
      },
      recovery: {
        attempts: metrics.recoveryAttempts.length,
        successfulRecoveries: metrics.recoveries,
        timeToRecover: metrics.recoveryAttempts[metrics.recoveryAttempts.length - 1].timestamp - 
                      metrics.recoveryAttempts[0].timestamp,
        recoveryRate: metrics.recoveries / metrics.errors
      }
    };

    expect(testMetrics.recovery.attempts).toBeGreaterThan(0);
    expect(testMetrics.recovery.successfulRecoveries).toBe(1);
    expect(testMetrics.performance.systemHealth).toBeGreaterThan(0);
  });

  it('should validate monitoring metrics accuracy', async () => {
    const metrics = {
      measurements: [] as { timestamp: number; metrics: any }[],
      validations: {
        success: 0,
        failure: 0
      }
    };

    const validateMetrics = (data: any) => {
      try {
        expect(data.system.cpu_usage).toBeDefined();
        expect(data.system.memory_usage).toBeDefined();
        expect(data.system.network_latency).toBeDefined();
        expect(data.system.error_rate).toBeDefined();
        metrics.validations.success++;
        return true;
      } catch (error) {
        metrics.validations.failure++;
        return false;
      }
    };

    (getBotStatus as jest.Mock).mockImplementation(() => {
      const data = {
        id: 'bot-123',
        status: 'active',
        metrics: {
          system: {
            cpu_usage: 45,
            memory_usage: 60,
            network_latency: 150,
            error_rate: 0.01
          }
        }
      };

      metrics.measurements.push({
        timestamp: Date.now(),
        metrics: data.metrics
      });

      validateMetrics(data.metrics);
      return Promise.resolve(data);
    });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(metrics.measurements.length).toBeGreaterThan(0);
    });

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.validations.failure / 
                  (metrics.validations.success + metrics.validations.failure),
        apiLatency: 0,
        systemHealth: metrics.validations.success / 
                     (metrics.validations.success + metrics.validations.failure),
        successRate: metrics.validations.success / 
                    (metrics.validations.success + metrics.validations.failure),
        totalTrades: 0,
        walletBalance: 0
      },
      validation: {
        measurements: metrics.measurements.length,
        validationRate: metrics.validations.success / 
                       (metrics.validations.success + metrics.validations.failure),
        metricsConsistency: metrics.measurements.every(m => 
          m.metrics.system.cpu_usage >= 0 && 
          m.metrics.system.cpu_usage <= 100 &&
          m.metrics.system.memory_usage >= 0 && 
          m.metrics.system.memory_usage <= 100 &&
          m.metrics.system.network_latency >= 0 &&
          m.metrics.system.error_rate >= 0 && 
          m.metrics.system.error_rate <= 1
        )
      }
    };

    expect(testMetrics.validation.measurements).toBeGreaterThan(0);
    expect(testMetrics.validation.validationRate).toBe(1);
    expect(testMetrics.validation.metricsConsistency).toBe(true);
  });
});
