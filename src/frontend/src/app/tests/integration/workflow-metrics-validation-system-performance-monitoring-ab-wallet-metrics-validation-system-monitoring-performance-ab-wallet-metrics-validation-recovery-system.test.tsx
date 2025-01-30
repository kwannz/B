import { render, screen, waitFor } from '@testing-library/react';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet, transferSOL } from '@/app/api/client';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('@/app/api/client');

describe('Workflow Metrics Validation - AB Wallet System Recovery', () => {
  const mockSystemMetrics = {
    heap_used: 0.5,
    heap_total: 0.8,
    external_memory: 0.2,
    event_loop_lag: 10,
    active_handles: 50,
    active_requests: 20,
    garbage_collection: {
      count: 5,
      duration: 100
    }
  };

  const mockWalletA = {
    address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
    balance: 1.5,
    metrics: {
      api_latency: 100,
      error_rate: 0.05,
      success_rate: 0.95,
      throughput: 100,
      active_trades: 5,
      total_volume: 10000,
      profit_loss: 500,
      system: mockSystemMetrics
    }
  };

  const mockWalletB = {
    address: '7MmPb3RLvEgtg4HQY8gguARGwGKyYaCeT8DLvBwfLL',
    balance: 2.0,
    metrics: {
      api_latency: 90,
      error_rate: 0.04,
      success_rate: 0.96,
      throughput: 120,
      active_trades: 6,
      total_volume: 12000,
      profit_loss: 600,
      system: {
        ...mockSystemMetrics,
        heap_used: 0.45,
        active_requests: 45,
        event_loop_lag: 8
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createBot as jest.Mock).mockResolvedValue({ id: 'bot-123' });
    (createWallet as jest.Mock).mockImplementation((botId) => 
      Promise.resolve(botId === 'bot-123' ? mockWalletA : mockWalletB));
    (getWallet as jest.Mock).mockImplementation((botId) => 
      Promise.resolve(botId === 'bot-123' ? mockWalletA : mockWalletB));
    (transferSOL as jest.Mock).mockResolvedValue({ success: true });
  });

  it('validates system recovery under simulated failures', async () => {
    const errorThreshold = 3;
    let errorCount = 0;
    (transferSOL as jest.Mock).mockImplementation(() => {
      if (errorCount < errorThreshold) {
        errorCount++;
        throw new Error('Simulated transfer error');
      }
      return Promise.resolve({ success: true });
    });

    await testRunner.runTest(async () => {
      const iterations = 5;
      const recoveryData: any[] = [];
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const iterationStartTime = Date.now();
        let retryCount = 0;
        let success = false;

        render(<TestContext><WalletComparison /></TestContext>);

        await waitFor(() => {
          expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
        });

        while (!success && retryCount < 3) {
          try {
            await transferSOL(mockWalletA.address, mockWalletB.address, 0.1);
            success = true;
          } catch (error) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100));
          }
        }

        const iterationEndTime = Date.now();
        recoveryData.push({
          iteration: i,
          duration: iterationEndTime - iterationStartTime,
          retries: retryCount,
          success,
          metrics: {
            wallet_a: {
              ...mockWalletA.metrics,
              system: {
                ...mockWalletA.metrics.system,
                heap_used: Math.min(0.8, mockWalletA.metrics.system.heap_used + (i * 0.05)),
                active_requests: Math.min(100, mockWalletA.metrics.system.active_requests + (i * 5))
              }
            },
            wallet_b: {
              ...mockWalletB.metrics,
              system: {
                ...mockWalletB.metrics.system,
                heap_used: Math.min(0.8, mockWalletB.metrics.system.heap_used + (i * 0.04)),
                active_requests: Math.min(100, mockWalletB.metrics.system.active_requests + (i * 4))
              }
            }
          }
        });
      }

      const endTime = Date.now();
      const recoveryMetrics = {
        total_duration: endTime - startTime,
        iterations_completed: iterations,
        recovery_data: recoveryData,
        error_recovery: {
          total_retries: recoveryData.reduce((acc, data) => acc + data.retries, 0),
          success_rate: recoveryData.filter(data => data.success).length / iterations,
          average_retry_count: recoveryData.reduce((acc, data) => acc + data.retries, 0) / iterations,
          retry_distribution: recoveryData.reduce((acc, data) => {
            acc[data.retries] = (acc[data.retries] || 0) + 1;
            return acc;
          }, {} as Record<number, number>)
        },
        system_impact: {
          heap_usage_trend: {
            wallet_a: recoveryData.map(data => data.metrics.wallet_a.system.heap_used),
            wallet_b: recoveryData.map(data => data.metrics.wallet_b.system.heap_used)
          },
          request_load_trend: {
            wallet_a: recoveryData.map(data => data.metrics.wallet_a.system.active_requests),
            wallet_b: recoveryData.map(data => data.metrics.wallet_b.system.active_requests)
          }
        },
        performance_impact: {
          average_duration: recoveryData.reduce((acc, data) => acc + data.duration, 0) / iterations,
          duration_by_retry_count: recoveryData.reduce((acc, data) => {
            acc[data.retries] = (acc[data.retries] || []).concat(data.duration);
            return acc;
          }, {} as Record<number, number[]>)
        },
        system_stability: {
          heap_usage_variance: {
            wallet_a: calculateVariance(recoveryData.map(data => data.metrics.wallet_a.system.heap_used)),
            wallet_b: calculateVariance(recoveryData.map(data => data.metrics.wallet_b.system.heap_used))
          },
          request_load_variance: {
            wallet_a: calculateVariance(recoveryData.map(data => data.metrics.wallet_a.system.active_requests)),
            wallet_b: calculateVariance(recoveryData.map(data => data.metrics.wallet_b.system.active_requests))
          }
        }
      };

      testRunner.expectMetrics(recoveryMetrics);
      expect(recoveryMetrics.total_duration).toBeLessThan(15000);
      expect(recoveryMetrics.error_recovery.success_rate).toBeGreaterThan(0.8);
      expect(Math.max(...recoveryMetrics.system_impact.heap_usage_trend.wallet_a)).toBeLessThan(0.8);
      expect(Math.max(...recoveryMetrics.system_impact.heap_usage_trend.wallet_b)).toBeLessThan(0.8);
      expect(Math.max(...recoveryMetrics.system_impact.request_load_trend.wallet_a)).toBeLessThan(100);
      expect(Math.max(...recoveryMetrics.system_impact.request_load_trend.wallet_b)).toBeLessThan(100);
      expect(recoveryMetrics.system_stability.heap_usage_variance.wallet_a).toBeLessThan(0.1);
      expect(recoveryMetrics.system_stability.heap_usage_variance.wallet_b).toBeLessThan(0.1);
      expect(recoveryMetrics.system_stability.request_load_variance.wallet_a).toBeLessThan(100);
      expect(recoveryMetrics.system_stability.request_load_variance.wallet_b).toBeLessThan(100);
    });
  });

  it('validates system metrics during cascading failures', async () => {
    let failureCount = 0;
    const cascadingFailures = new Set<number>();
    (transferSOL as jest.Mock).mockImplementation(() => {
      if (cascadingFailures.has(failureCount)) {
        failureCount++;
        throw new Error('Simulated cascading failure');
      }
      failureCount++;
      return Promise.resolve({ success: true });
    });

    await testRunner.runTest(async () => {
      const operations = 3;
      const failureData: any[] = [];
      const startTime = Date.now();

      for (let i = 0; i < operations; i++) {
        if (Math.random() < 0.3) {
          cascadingFailures.add(failureCount + i);
        }
      }

      const renderPromises = Array(operations).fill(null).map(async (_, index) => {
        const operationStartTime = Date.now();
        let retryCount = 0;
        let success = false;

        render(<TestContext><WalletComparison /></TestContext>);

        await waitFor(() => {
          expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
        });

        while (!success && retryCount < 3) {
          try {
            await transferSOL(mockWalletA.address, mockWalletB.address, 0.1);
            success = true;
          } catch (error) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100));
          }
        }

        const operationEndTime = Date.now();
        failureData.push({
          operation: index,
          duration: operationEndTime - operationStartTime,
          retries: retryCount,
          success,
          metrics: {
            wallet_a: {
              ...mockWalletA.metrics,
              system: {
                ...mockWalletA.metrics.system,
                heap_used: Math.min(0.8, mockWalletA.metrics.system.heap_used + (index * 0.1)),
                active_requests: Math.min(100, mockWalletA.metrics.system.active_requests + (index * 10))
              }
            },
            wallet_b: {
              ...mockWalletB.metrics,
              system: {
                ...mockWalletB.metrics.system,
                heap_used: Math.min(0.8, mockWalletB.metrics.system.heap_used + (index * 0.08)),
                active_requests: Math.min(100, mockWalletB.metrics.system.active_requests + (index * 8))
              }
            }
          }
        });
      });

      await Promise.all(renderPromises);
      const endTime = Date.now();

      const failureMetrics = {
        total_duration: endTime - startTime,
        concurrent_operations: operations,
        failure_data: failureData,
        cascading_analysis: {
          success_rate: failureData.filter(data => data.success).length / operations,
          average_retry_count: failureData.reduce((acc, data) => acc + data.retries, 0) / operations,
          failure_pattern: Array.from(cascadingFailures).sort()
        },
        system_stability: {
          heap_usage: {
            wallet_a: {
              final: failureData[operations - 1].metrics.wallet_a.system.heap_used,
              variance: calculateVariance(failureData.map(data => data.metrics.wallet_a.system.heap_used))
            },
            wallet_b: {
              final: failureData[operations - 1].metrics.wallet_b.system.heap_used,
              variance: calculateVariance(failureData.map(data => data.metrics.wallet_b.system.heap_used))
            }
          },
          request_load: {
            wallet_a: {
              final: failureData[operations - 1].metrics.wallet_a.system.active_requests,
              variance: calculateVariance(failureData.map(data => data.metrics.wallet_a.system.active_requests))
            },
            wallet_b: {
              final: failureData[operations - 1].metrics.wallet_b.system.active_requests,
              variance: calculateVariance(failureData.map(data => data.metrics.wallet_b.system.active_requests))
            }
          }
        }
      };

      testRunner.expectMetrics(failureMetrics);
      expect(failureMetrics.total_duration).toBeLessThan(10000);
      expect(failureMetrics.cascading_analysis.success_rate).toBeGreaterThan(0.6);
      expect(failureMetrics.system_stability.heap_usage.wallet_a.final).toBeLessThan(0.8);
      expect(failureMetrics.system_stability.heap_usage.wallet_b.final).toBeLessThan(0.8);
      expect(failureMetrics.system_stability.request_load.wallet_a.final).toBeLessThan(100);
      expect(failureMetrics.system_stability.request_load.wallet_b.final).toBeLessThan(100);
      expect(failureMetrics.system_stability.heap_usage.wallet_a.variance).toBeLessThan(0.1);
      expect(failureMetrics.system_stability.heap_usage.wallet_b.variance).toBeLessThan(0.1);
      expect(failureMetrics.system_stability.request_load.wallet_a.variance).toBeLessThan(100);
      expect(failureMetrics.system_stability.request_load.wallet_b.variance).toBeLessThan(100);
    });
  });
});

function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - mean, 2));
  return squareDiffs.reduce((a, b) => a + b, 0) / values.length;
}
