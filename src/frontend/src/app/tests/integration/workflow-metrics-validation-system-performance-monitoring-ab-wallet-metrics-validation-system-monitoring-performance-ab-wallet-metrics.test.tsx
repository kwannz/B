import { render, screen, waitFor } from '@testing-library/react';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet, transferSOL } from '@/app/api/client';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('@/app/api/client');

describe('Workflow Metrics Validation - AB Wallet System Performance Metrics', () => {
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

  it('validates comprehensive AB wallet metrics under load', async () => {
    await testRunner.runTest(async () => {
      const iterations = 5;
      const metricsData: any[] = [];
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const iterationStartTime = Date.now();
        render(<TestContext><WalletComparison /></TestContext>);

        await waitFor(() => {
          expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
        });

        await transferSOL(mockWalletA.address, mockWalletB.address, 0.1);

        const iterationEndTime = Date.now();
        metricsData.push({
          iteration: i,
          duration: iterationEndTime - iterationStartTime,
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
        metrics_data: metricsData,
        system_metrics: {
          average_iteration_duration: metricsData.reduce((acc, data) => acc + data.duration, 0) / iterations,
          heap_usage_trend: {
            wallet_a: metricsData.map(data => data.metrics.wallet_a.system.heap_used),
            wallet_b: metricsData.map(data => data.metrics.wallet_b.system.heap_used)
          },
          request_load_trend: {
            wallet_a: metricsData.map(data => data.metrics.wallet_a.system.active_requests),
            wallet_b: metricsData.map(data => data.metrics.wallet_b.system.active_requests)
          }
        },
        performance_analysis: {
          heap_growth_rate: {
            wallet_a: (metricsData[iterations - 1].metrics.wallet_a.system.heap_used - metricsData[0].metrics.wallet_a.system.heap_used) / iterations,
            wallet_b: (metricsData[iterations - 1].metrics.wallet_b.system.heap_used - metricsData[0].metrics.wallet_b.system.heap_used) / iterations
          },
          request_growth_rate: {
            wallet_a: (metricsData[iterations - 1].metrics.wallet_a.system.active_requests - metricsData[0].metrics.wallet_a.system.active_requests) / iterations,
            wallet_b: (metricsData[iterations - 1].metrics.wallet_b.system.active_requests - metricsData[0].metrics.wallet_b.system.active_requests) / iterations
          }
        },
        metrics_correlation: {
          heap_vs_requests: {
            wallet_a: calculateCorrelation(
              metricsData.map(data => data.metrics.wallet_a.system.heap_used),
              metricsData.map(data => data.metrics.wallet_a.system.active_requests)
            ),
            wallet_b: calculateCorrelation(
              metricsData.map(data => data.metrics.wallet_b.system.heap_used),
              metricsData.map(data => data.metrics.wallet_b.system.active_requests)
            )
          },
          performance_vs_load: {
            wallet_a: calculateCorrelation(
              metricsData.map(data => data.duration),
              metricsData.map(data => data.metrics.wallet_a.system.active_requests)
            ),
            wallet_b: calculateCorrelation(
              metricsData.map(data => data.duration),
              metricsData.map(data => data.metrics.wallet_b.system.active_requests)
            )
          }
        }
      };

      testRunner.expectMetrics(performanceMetrics);
      expect(performanceMetrics.total_duration).toBeLessThan(10000);
      expect(performanceMetrics.system_metrics.average_iteration_duration).toBeLessThan(1000);
      expect(performanceMetrics.performance_analysis.heap_growth_rate.wallet_a).toBeLessThan(0.1);
      expect(performanceMetrics.performance_analysis.heap_growth_rate.wallet_b).toBeLessThan(0.1);
      expect(performanceMetrics.performance_analysis.request_growth_rate.wallet_a).toBeLessThan(20);
      expect(performanceMetrics.performance_analysis.request_growth_rate.wallet_b).toBeLessThan(20);
      expect(Math.abs(performanceMetrics.metrics_correlation.heap_vs_requests.wallet_a)).toBeLessThan(1);
      expect(Math.abs(performanceMetrics.metrics_correlation.heap_vs_requests.wallet_b)).toBeLessThan(1);
      expect(Math.abs(performanceMetrics.metrics_correlation.performance_vs_load.wallet_a)).toBeLessThan(1);
      expect(Math.abs(performanceMetrics.metrics_correlation.performance_vs_load.wallet_b)).toBeLessThan(1);
    });
  });

  it('validates system metrics stability during concurrent operations', async () => {
    await testRunner.runTest(async () => {
      const operations = 3;
      const operationsData: any[] = [];
      const startTime = Date.now();

      const renderPromises = Array(operations).fill(null).map(async (_, index) => {
        const operationStartTime = Date.now();
        render(<TestContext><WalletComparison /></TestContext>);

        await waitFor(() => {
          expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
        });

        await transferSOL(mockWalletA.address, mockWalletB.address, 0.1);

        const operationEndTime = Date.now();
        operationsData.push({
          operation: index,
          duration: operationEndTime - operationStartTime,
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

      const stabilityMetrics = {
        total_duration: endTime - startTime,
        concurrent_operations: operations,
        operations_data: operationsData,
        stability_analysis: {
          average_operation_duration: operationsData.reduce((acc, op) => acc + op.duration, 0) / operations,
          peak_metrics: {
            heap_usage: {
              wallet_a: Math.max(...operationsData.map(op => op.metrics.wallet_a.system.heap_used)),
              wallet_b: Math.max(...operationsData.map(op => op.metrics.wallet_b.system.heap_used))
            },
            request_load: {
              wallet_a: Math.max(...operationsData.map(op => op.metrics.wallet_a.system.active_requests)),
              wallet_b: Math.max(...operationsData.map(op => op.metrics.wallet_b.system.active_requests))
            }
          },
          metrics_variance: {
            heap_usage: {
              wallet_a: calculateVariance(operationsData.map(op => op.metrics.wallet_a.system.heap_used)),
              wallet_b: calculateVariance(operationsData.map(op => op.metrics.wallet_b.system.heap_used))
            },
            request_load: {
              wallet_a: calculateVariance(operationsData.map(op => op.metrics.wallet_a.system.active_requests)),
              wallet_b: calculateVariance(operationsData.map(op => op.metrics.wallet_b.system.active_requests))
            }
          }
        }
      };

      testRunner.expectMetrics(stabilityMetrics);
      expect(stabilityMetrics.total_duration).toBeLessThan(5000);
      expect(stabilityMetrics.stability_analysis.average_operation_duration).toBeLessThan(1000);
      expect(stabilityMetrics.stability_analysis.peak_metrics.heap_usage.wallet_a).toBeLessThan(0.8);
      expect(stabilityMetrics.stability_analysis.peak_metrics.heap_usage.wallet_b).toBeLessThan(0.8);
      expect(stabilityMetrics.stability_analysis.peak_metrics.request_load.wallet_a).toBeLessThan(100);
      expect(stabilityMetrics.stability_analysis.peak_metrics.request_load.wallet_b).toBeLessThan(100);
      expect(stabilityMetrics.stability_analysis.metrics_variance.heap_usage.wallet_a).toBeLessThan(0.1);
      expect(stabilityMetrics.stability_analysis.metrics_variance.heap_usage.wallet_b).toBeLessThan(0.1);
      expect(stabilityMetrics.stability_analysis.metrics_variance.request_load.wallet_a).toBeLessThan(100);
      expect(stabilityMetrics.stability_analysis.metrics_variance.request_load.wallet_b).toBeLessThan(100);
    });
  });
});

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

function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - mean, 2));
  return squareDiffs.reduce((a, b) => a + b, 0) / values.length;
}
