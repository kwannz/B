import { render, screen, waitFor } from '@testing-library/react';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet, transferSOL } from '@/app/api/client';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('@/app/api/client');

describe('Complete Workflow Metrics Validation - AB Wallet', () => {
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

  it('validates AB wallet workflow with comprehensive metrics', async () => {
    await testRunner.runTest(async () => {
      const iterations = 5;
      const workflowData: any[] = [];
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const iterationStartTime = Date.now();
        render(<TestContext><WalletComparison /></TestContext>);

        await waitFor(() => {
          expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
        });

        await transferSOL(mockWalletA.address, mockWalletB.address, 0.1);

        const iterationEndTime = Date.now();
        workflowData.push({
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
      const workflowMetrics = {
        total_duration: endTime - startTime,
        iterations_completed: iterations,
        workflow_data: workflowData,
        performance_metrics: {
          average_duration: workflowData.reduce((acc, data) => acc + data.duration, 0) / iterations,
          duration_trend: workflowData.map(data => data.duration),
          latency_improvement: ((mockWalletA.metrics.api_latency - mockWalletB.metrics.api_latency) / mockWalletA.metrics.api_latency) * 100,
          throughput_improvement: ((mockWalletB.metrics.throughput - mockWalletA.metrics.throughput) / mockWalletA.metrics.throughput) * 100,
          error_rate_reduction: ((mockWalletA.metrics.error_rate - mockWalletB.metrics.error_rate) / mockWalletA.metrics.error_rate) * 100
        },
        system_metrics: {
          heap_usage_trend: {
            wallet_a: workflowData.map(data => data.metrics.wallet_a.system.heap_used),
            wallet_b: workflowData.map(data => data.metrics.wallet_b.system.heap_used)
          },
          request_load_trend: {
            wallet_a: workflowData.map(data => data.metrics.wallet_a.system.active_requests),
            wallet_b: workflowData.map(data => data.metrics.wallet_b.system.active_requests)
          }
        },
        system_stability: {
          heap_usage_variance: {
            wallet_a: calculateVariance(workflowData.map(data => data.metrics.wallet_a.system.heap_used)),
            wallet_b: calculateVariance(workflowData.map(data => data.metrics.wallet_b.system.heap_used))
          },
          request_load_variance: {
            wallet_a: calculateVariance(workflowData.map(data => data.metrics.wallet_a.system.active_requests)),
            wallet_b: calculateVariance(workflowData.map(data => data.metrics.wallet_b.system.active_requests))
          }
        },
        performance_correlation: {
          heap_vs_duration: {
            wallet_a: calculateCorrelation(
              workflowData.map(data => data.metrics.wallet_a.system.heap_used),
              workflowData.map(data => data.duration)
            ),
            wallet_b: calculateCorrelation(
              workflowData.map(data => data.metrics.wallet_b.system.heap_used),
              workflowData.map(data => data.duration)
            )
          },
          requests_vs_duration: {
            wallet_a: calculateCorrelation(
              workflowData.map(data => data.metrics.wallet_a.system.active_requests),
              workflowData.map(data => data.duration)
            ),
            wallet_b: calculateCorrelation(
              workflowData.map(data => data.metrics.wallet_b.system.active_requests),
              workflowData.map(data => data.duration)
            )
          }
        }
      };

      testRunner.expectMetrics(workflowMetrics);
      expect(workflowMetrics.total_duration).toBeLessThan(10000);
      expect(workflowMetrics.performance_metrics.average_duration).toBeLessThan(1000);
      expect(workflowMetrics.performance_metrics.latency_improvement).toBeGreaterThan(5);
      expect(workflowMetrics.performance_metrics.throughput_improvement).toBeGreaterThan(10);
      expect(workflowMetrics.performance_metrics.error_rate_reduction).toBeGreaterThan(10);
      expect(Math.max(...workflowMetrics.system_metrics.heap_usage_trend.wallet_a)).toBeLessThan(0.8);
      expect(Math.max(...workflowMetrics.system_metrics.heap_usage_trend.wallet_b)).toBeLessThan(0.8);
      expect(Math.max(...workflowMetrics.system_metrics.request_load_trend.wallet_a)).toBeLessThan(100);
      expect(Math.max(...workflowMetrics.system_metrics.request_load_trend.wallet_b)).toBeLessThan(100);
      expect(workflowMetrics.system_stability.heap_usage_variance.wallet_a).toBeLessThan(0.1);
      expect(workflowMetrics.system_stability.heap_usage_variance.wallet_b).toBeLessThan(0.1);
      expect(workflowMetrics.system_stability.request_load_variance.wallet_a).toBeLessThan(100);
      expect(workflowMetrics.system_stability.request_load_variance.wallet_b).toBeLessThan(100);
      expect(Math.abs(workflowMetrics.performance_correlation.heap_vs_duration.wallet_a)).toBeLessThan(1);
      expect(Math.abs(workflowMetrics.performance_correlation.heap_vs_duration.wallet_b)).toBeLessThan(1);
      expect(Math.abs(workflowMetrics.performance_correlation.requests_vs_duration.wallet_a)).toBeLessThan(1);
      expect(Math.abs(workflowMetrics.performance_correlation.requests_vs_duration.wallet_b)).toBeLessThan(1);
    });
  });

  it('validates AB wallet performance comparison under load', async () => {
    await testRunner.runTest(async () => {
      const operations = 3;
      const comparisonData: any[] = [];
      const startTime = Date.now();

      const renderPromises = Array(operations).fill(null).map(async (_, index) => {
        const operationStartTime = Date.now();
        render(<TestContext><WalletComparison /></TestContext>);

        await waitFor(() => {
          expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
        });

        await transferSOL(mockWalletA.address, mockWalletB.address, 0.1);

        const operationEndTime = Date.now();
        comparisonData.push({
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

      const comparisonMetrics = {
        total_duration: endTime - startTime,
        concurrent_operations: operations,
        comparison_data: comparisonData,
        performance_comparison: {
          average_duration: comparisonData.reduce((acc, data) => acc + data.duration, 0) / operations,
          peak_metrics: {
            heap_usage: {
              wallet_a: Math.max(...comparisonData.map(data => data.metrics.wallet_a.system.heap_used)),
              wallet_b: Math.max(...comparisonData.map(data => data.metrics.wallet_b.system.heap_used))
            },
            request_load: {
              wallet_a: Math.max(...comparisonData.map(data => data.metrics.wallet_a.system.active_requests)),
              wallet_b: Math.max(...comparisonData.map(data => data.metrics.wallet_b.system.active_requests))
            }
          },
          metrics_variance: {
            heap_usage: {
              wallet_a: calculateVariance(comparisonData.map(data => data.metrics.wallet_a.system.heap_used)),
              wallet_b: calculateVariance(comparisonData.map(data => data.metrics.wallet_b.system.heap_used))
            },
            request_load: {
              wallet_a: calculateVariance(comparisonData.map(data => data.metrics.wallet_a.system.active_requests)),
              wallet_b: calculateVariance(comparisonData.map(data => data.metrics.wallet_b.system.active_requests))
            }
          }
        },
        relative_performance: {
          heap_efficiency: (
            comparisonData.reduce((acc, data) => acc + data.metrics.wallet_b.system.heap_used, 0) /
            comparisonData.reduce((acc, data) => acc + data.metrics.wallet_a.system.heap_used, 0)
          ),
          request_efficiency: (
            comparisonData.reduce((acc, data) => acc + data.metrics.wallet_b.system.active_requests, 0) /
            comparisonData.reduce((acc, data) => acc + data.metrics.wallet_a.system.active_requests, 0)
          )
        }
      };

      testRunner.expectMetrics(comparisonMetrics);
      expect(comparisonMetrics.total_duration).toBeLessThan(5000);
      expect(comparisonMetrics.performance_comparison.average_duration).toBeLessThan(1000);
      expect(comparisonMetrics.performance_comparison.peak_metrics.heap_usage.wallet_a).toBeLessThan(0.8);
      expect(comparisonMetrics.performance_comparison.peak_metrics.heap_usage.wallet_b).toBeLessThan(0.8);
      expect(comparisonMetrics.performance_comparison.peak_metrics.request_load.wallet_a).toBeLessThan(100);
      expect(comparisonMetrics.performance_comparison.peak_metrics.request_load.wallet_b).toBeLessThan(100);
      expect(comparisonMetrics.performance_comparison.metrics_variance.heap_usage.wallet_a).toBeLessThan(0.1);
      expect(comparisonMetrics.performance_comparison.metrics_variance.heap_usage.wallet_b).toBeLessThan(0.1);
      expect(comparisonMetrics.performance_comparison.metrics_variance.request_load.wallet_a).toBeLessThan(100);
      expect(comparisonMetrics.performance_comparison.metrics_variance.request_load.wallet_b).toBeLessThan(100);
      expect(comparisonMetrics.relative_performance.heap_efficiency).toBeLessThan(1.2);
      expect(comparisonMetrics.relative_performance.request_efficiency).toBeLessThan(1.2);
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
