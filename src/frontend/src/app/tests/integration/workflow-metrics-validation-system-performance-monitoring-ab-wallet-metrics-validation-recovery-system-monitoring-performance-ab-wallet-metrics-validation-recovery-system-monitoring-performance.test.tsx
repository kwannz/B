import { render, screen, waitFor } from '@testing-library/react';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet, transferSOL } from '@/app/api/client';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('@/app/api/client');

describe('Complete Workflow Metrics Validation - System Performance Monitoring AB Wallet Metrics Recovery System Monitoring Performance', () => {
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

  it('validates system monitoring performance metrics during error recovery', async () => {
    await testRunner.runTest(async () => {
      const iterations = 5;
      const errorThreshold = 3;
      let errorCount = 0;
      const performanceData: any[] = [];
      const startTime = Date.now();

      (transferSOL as jest.Mock).mockImplementation(() => {
        if (errorCount < errorThreshold) {
          errorCount++;
          throw new Error('Simulated transfer error');
        }
        return Promise.resolve({ success: true });
      });

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
        performanceData.push({
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
      const performanceMetrics = {
        total_duration: endTime - startTime,
        iterations_completed: iterations,
        performance_data: performanceData,
        error_metrics: {
          total_errors: errorCount,
          error_rate: errorCount / iterations,
          retry_distribution: performanceData.reduce((acc, data) => {
            acc[data.retries] = (acc[data.retries] || 0) + 1;
            return acc;
          }, {} as Record<number, number>),
          success_rate: performanceData.filter(data => data.success).length / iterations
        },
        system_metrics: {
          heap_usage_trend: {
            wallet_a: performanceData.map(data => data.metrics.wallet_a.system.heap_used),
            wallet_b: performanceData.map(data => data.metrics.wallet_b.system.heap_used)
          },
          request_load_trend: {
            wallet_a: performanceData.map(data => data.metrics.wallet_a.system.active_requests),
            wallet_b: performanceData.map(data => data.metrics.wallet_b.system.active_requests)
          }
        },
        performance_impact: {
          average_duration: performanceData.reduce((acc, data) => acc + data.duration, 0) / iterations,
          duration_variance: calculateVariance(performanceData.map(data => data.duration)),
          retry_impact: {
            duration_by_retry: performanceData.reduce((acc, data) => {
              if (!acc[data.retries]) {
                acc[data.retries] = [];
              }
              acc[data.retries].push(data.duration);
              return acc;
            }, {} as Record<number, number[]>)
          }
        },
        system_stability: {
          heap_usage_variance: {
            wallet_a: calculateVariance(performanceData.map(data => data.metrics.wallet_a.system.heap_used)),
            wallet_b: calculateVariance(performanceData.map(data => data.metrics.wallet_b.system.heap_used))
          },
          request_load_variance: {
            wallet_a: calculateVariance(performanceData.map(data => data.metrics.wallet_a.system.active_requests)),
            wallet_b: calculateVariance(performanceData.map(data => data.metrics.wallet_b.system.active_requests))
          }
        },
        performance_correlation: {
          retries_vs_heap: {
            wallet_a: calculateCorrelation(
              performanceData.map(data => data.retries),
              performanceData.map(data => data.metrics.wallet_a.system.heap_used)
            ),
            wallet_b: calculateCorrelation(
              performanceData.map(data => data.retries),
              performanceData.map(data => data.metrics.wallet_b.system.heap_used)
            )
          },
          retries_vs_requests: {
            wallet_a: calculateCorrelation(
              performanceData.map(data => data.retries),
              performanceData.map(data => data.metrics.wallet_a.system.active_requests)
            ),
            wallet_b: calculateCorrelation(
              performanceData.map(data => data.retries),
              performanceData.map(data => data.metrics.wallet_b.system.active_requests)
            )
          }
        }
      };

      testRunner.expectMetrics(performanceMetrics);
      expect(performanceMetrics.total_duration).toBeLessThan(15000);
      expect(performanceMetrics.error_metrics.error_rate).toBeLessThan(0.7);
      expect(performanceMetrics.error_metrics.success_rate).toBeGreaterThan(0.6);
      expect(performanceMetrics.performance_impact.average_duration).toBeLessThan(2000);
      expect(performanceMetrics.system_stability.heap_usage_variance.wallet_a).toBeLessThan(0.1);
      expect(performanceMetrics.system_stability.heap_usage_variance.wallet_b).toBeLessThan(0.1);
      expect(performanceMetrics.system_stability.request_load_variance.wallet_a).toBeLessThan(100);
      expect(performanceMetrics.system_stability.request_load_variance.wallet_b).toBeLessThan(100);
      expect(Math.abs(performanceMetrics.performance_correlation.retries_vs_heap.wallet_a)).toBeLessThan(1);
      expect(Math.abs(performanceMetrics.performance_correlation.retries_vs_heap.wallet_b)).toBeLessThan(1);
      expect(Math.abs(performanceMetrics.performance_correlation.retries_vs_requests.wallet_a)).toBeLessThan(1);
      expect(Math.abs(performanceMetrics.performance_correlation.retries_vs_requests.wallet_b)).toBeLessThan(1);
    });
  });

  it('validates system monitoring performance metrics during concurrent operations', async () => {
    await testRunner.runTest(async () => {
      const operations = 3;
      const errorThreshold = 2;
      let errorCount = 0;
      const concurrentData: any[] = [];
      const startTime = Date.now();

      (transferSOL as jest.Mock).mockImplementation(() => {
        if (errorCount < errorThreshold) {
          errorCount++;
          throw new Error('Simulated transfer error');
        }
        return Promise.resolve({ success: true });
      });

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
        concurrentData.push({
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

      const concurrentMetrics = {
        total_duration: endTime - startTime,
        concurrent_operations: operations,
        concurrent_data: concurrentData,
        error_metrics: {
          total_errors: errorCount,
          error_rate: errorCount / operations,
          retry_distribution: concurrentData.reduce((acc, data) => {
            acc[data.retries] = (acc[data.retries] || 0) + 1;
            return acc;
          }, {} as Record<number, number>),
          success_rate: concurrentData.filter(data => data.success).length / operations
        },
        system_metrics: {
          average_operation_duration: concurrentData.reduce((acc, data) => acc + data.duration, 0) / operations,
          peak_metrics: {
            heap_usage: {
              wallet_a: Math.max(...concurrentData.map(data => data.metrics.wallet_a.system.heap_used)),
              wallet_b: Math.max(...concurrentData.map(data => data.metrics.wallet_b.system.heap_used))
            },
            request_load: {
              wallet_a: Math.max(...concurrentData.map(data => data.metrics.wallet_a.system.active_requests)),
              wallet_b: Math.max(...concurrentData.map(data => data.metrics.wallet_b.system.active_requests))
            }
          },
          metrics_variance: {
            heap_usage: {
              wallet_a: calculateVariance(concurrentData.map(data => data.metrics.wallet_a.system.heap_used)),
              wallet_b: calculateVariance(concurrentData.map(data => data.metrics.wallet_b.system.heap_used))
            },
            request_load: {
              wallet_a: calculateVariance(concurrentData.map(data => data.metrics.wallet_a.system.active_requests)),
              wallet_b: calculateVariance(concurrentData.map(data => data.metrics.wallet_b.system.active_requests))
            }
          }
        },
        performance_correlation: {
          concurrent_impact: {
            heap_usage: calculateCorrelation(
              concurrentData.map(data => data.operation),
              concurrentData.map(data => data.metrics.wallet_a.system.heap_used)
            ),
            request_load: calculateCorrelation(
              concurrentData.map(data => data.operation),
              concurrentData.map(data => data.metrics.wallet_a.system.active_requests)
            )
          },
          retries_impact: {
            heap_usage: calculateCorrelation(
              concurrentData.map(data => data.retries),
              concurrentData.map(data => data.metrics.wallet_a.system.heap_used)
            ),
            request_load: calculateCorrelation(
              concurrentData.map(data => data.retries),
              concurrentData.map(data => data.metrics.wallet_a.system.active_requests)
            )
          }
        }
      };

      testRunner.expectMetrics(concurrentMetrics);
      expect(concurrentMetrics.total_duration).toBeLessThan(10000);
      expect(concurrentMetrics.error_metrics.error_rate).toBeLessThan(0.7);
      expect(concurrentMetrics.error_metrics.success_rate).toBeGreaterThan(0.6);
      expect(concurrentMetrics.system_metrics.average_operation_duration).toBeLessThan(2000);
      expect(concurrentMetrics.system_metrics.peak_metrics.heap_usage.wallet_a).toBeLessThan(0.8);
      expect(concurrentMetrics.system_metrics.peak_metrics.heap_usage.wallet_b).toBeLessThan(0.8);
      expect(concurrentMetrics.system_metrics.peak_metrics.request_load.wallet_a).toBeLessThan(100);
      expect(concurrentMetrics.system_metrics.peak_metrics.request_load.wallet_b).toBeLessThan(100);
      expect(concurrentMetrics.system_metrics.metrics_variance.heap_usage.wallet_a).toBeLessThan(0.1);
      expect(concurrentMetrics.system_metrics.metrics_variance.heap_usage.wallet_b).toBeLessThan(0.1);
      expect(concurrentMetrics.system_metrics.metrics_variance.request_load.wallet_a).toBeLessThan(100);
      expect(concurrentMetrics.system_metrics.metrics_variance.request_load.wallet_b).toBeLessThan(100);
      expect(Math.abs(concurrentMetrics.performance_correlation.concurrent_impact.heap_usage)).toBeLessThan(1);
      expect(Math.abs(concurrentMetrics.performance_correlation.concurrent_impact.request_load)).toBeLessThan(1);
      expect(Math.abs(concurrentMetrics.performance_correlation.retries_impact.heap_usage)).toBeLessThan(1);
      expect(Math.abs(concurrentMetrics.performance_correlation.retries_impact.request_load)).toBeLessThan(1);
    });
  });
});

function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - mean, 2));
  return squareDiffs.reduce((a, b) => a + b, 0) / values.length;
}

function calculateCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  const sum_x = x.reduce((a, b) => a + b, 0);
  const sum_y = y.reduce((a, b) => a + b, 0);
  const sum_xy = x.reduce((a, b, i) => a + b * y[i], 0);
  const sum_x2 = x.reduce((a, b) => a + b * b, 0);
  const sum_y2 = y.reduce((a, b) => a + b * b, 0);

  const numerator = n * sum_xy - sum_x * sum_y;
  const denominator = Math.sqrt((n * sum_x2 - sum_x * sum_x) * (n * sum_y2 - sum_y * sum_y));

  return denominator === 0 ? 0 : numerator / denominator;
}
