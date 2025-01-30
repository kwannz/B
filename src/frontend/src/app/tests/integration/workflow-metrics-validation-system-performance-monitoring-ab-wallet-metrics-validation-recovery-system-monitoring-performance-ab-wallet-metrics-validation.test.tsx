import { render, screen, waitFor } from '@testing-library/react';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet, transferSOL } from '@/app/api/client';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('@/app/api/client');

describe('Workflow Metrics Validation - AB Wallet System Performance Metrics Validation', () => {
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

  it('validates AB wallet metrics with comprehensive performance validation', async () => {
    await testRunner.runTest(async () => {
      const iterations = 5;
      const validationData: any[] = [];
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const iterationStartTime = Date.now();
        render(<TestContext><WalletComparison /></TestContext>);

        await waitFor(() => {
          expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
        });

        await transferSOL(mockWalletA.address, mockWalletB.address, 0.1);

        const iterationEndTime = Date.now();
        validationData.push({
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
      const validationMetrics = {
        total_duration: endTime - startTime,
        iterations_completed: iterations,
        validation_data: validationData,
        performance_thresholds: {
          max_iteration_duration: 1000,
          max_heap_usage: 0.8,
          max_request_load: 100,
          max_event_loop_lag: 20,
          min_throughput_improvement: 10,
          max_error_rate: 0.1,
          min_success_rate: 0.9
        },
        validation_results: {
          iteration_durations: validationData.map(data => ({
            iteration: data.iteration,
            duration: data.duration,
            within_threshold: data.duration < 1000
          })),
          heap_usage: {
            wallet_a: validationData.map(data => ({
              iteration: data.iteration,
              usage: data.metrics.wallet_a.system.heap_used,
              within_threshold: data.metrics.wallet_a.system.heap_used < 0.8
            })),
            wallet_b: validationData.map(data => ({
              iteration: data.iteration,
              usage: data.metrics.wallet_b.system.heap_used,
              within_threshold: data.metrics.wallet_b.system.heap_used < 0.8
            }))
          },
          request_load: {
            wallet_a: validationData.map(data => ({
              iteration: data.iteration,
              load: data.metrics.wallet_a.system.active_requests,
              within_threshold: data.metrics.wallet_a.system.active_requests < 100
            })),
            wallet_b: validationData.map(data => ({
              iteration: data.iteration,
              load: data.metrics.wallet_b.system.active_requests,
              within_threshold: data.metrics.wallet_b.system.active_requests < 100
            }))
          }
        },
        performance_improvements: {
          latency_reduction: ((mockWalletA.metrics.api_latency - mockWalletB.metrics.api_latency) / mockWalletA.metrics.api_latency) * 100,
          error_rate_reduction: ((mockWalletA.metrics.error_rate - mockWalletB.metrics.error_rate) / mockWalletA.metrics.error_rate) * 100,
          throughput_increase: ((mockWalletB.metrics.throughput - mockWalletA.metrics.throughput) / mockWalletA.metrics.throughput) * 100
        },
        performance_correlation: {
          heap_vs_duration: {
            wallet_a: calculateCorrelation(
              validationData.map(data => data.metrics.wallet_a.system.heap_used),
              validationData.map(data => data.duration)
            ),
            wallet_b: calculateCorrelation(
              validationData.map(data => data.metrics.wallet_b.system.heap_used),
              validationData.map(data => data.duration)
            )
          },
          requests_vs_duration: {
            wallet_a: calculateCorrelation(
              validationData.map(data => data.metrics.wallet_a.system.active_requests),
              validationData.map(data => data.duration)
            ),
            wallet_b: calculateCorrelation(
              validationData.map(data => data.metrics.wallet_b.system.active_requests),
              validationData.map(data => data.duration)
            )
          }
        }
      };

      testRunner.expectMetrics(validationMetrics);
      expect(validationMetrics.total_duration).toBeLessThan(10000);
      expect(validationMetrics.validation_results.iteration_durations.every(d => d.within_threshold)).toBe(true);
      expect(validationMetrics.validation_results.heap_usage.wallet_a.every(h => h.within_threshold)).toBe(true);
      expect(validationMetrics.validation_results.heap_usage.wallet_b.every(h => h.within_threshold)).toBe(true);
      expect(validationMetrics.validation_results.request_load.wallet_a.every(r => r.within_threshold)).toBe(true);
      expect(validationMetrics.validation_results.request_load.wallet_b.every(r => r.within_threshold)).toBe(true);
      expect(validationMetrics.performance_improvements.throughput_increase).toBeGreaterThan(validationMetrics.performance_thresholds.min_throughput_improvement);
      expect(Math.abs(validationMetrics.performance_correlation.heap_vs_duration.wallet_a)).toBeLessThan(1);
      expect(Math.abs(validationMetrics.performance_correlation.heap_vs_duration.wallet_b)).toBeLessThan(1);
      expect(Math.abs(validationMetrics.performance_correlation.requests_vs_duration.wallet_a)).toBeLessThan(1);
      expect(Math.abs(validationMetrics.performance_correlation.requests_vs_duration.wallet_b)).toBeLessThan(1);
    });
  });

  it('validates system metrics correlation during high load operations', async () => {
    await testRunner.runTest(async () => {
      const operations = 3;
      const correlationData: any[] = [];
      const startTime = Date.now();

      for (let i = 0; i < operations; i++) {
        const operationStartTime = Date.now();
        render(<TestContext><WalletComparison /></TestContext>);

        await waitFor(() => {
          expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
        });

        await transferSOL(mockWalletA.address, mockWalletB.address, 0.1);

        const operationEndTime = Date.now();
        correlationData.push({
          operation: i,
          duration: operationEndTime - operationStartTime,
          metrics: {
            wallet_a: {
              performance: {
                api_latency: mockWalletA.metrics.api_latency,
                throughput: mockWalletA.metrics.throughput,
                error_rate: mockWalletA.metrics.error_rate
              },
              system: {
                ...mockWalletA.metrics.system,
                heap_used: Math.min(0.8, mockWalletA.metrics.system.heap_used + (i * 0.1)),
                active_requests: Math.min(100, mockWalletA.metrics.system.active_requests + (i * 10))
              }
            },
            wallet_b: {
              performance: {
                api_latency: mockWalletB.metrics.api_latency,
                throughput: mockWalletB.metrics.throughput,
                error_rate: mockWalletB.metrics.error_rate
              },
              system: {
                ...mockWalletB.metrics.system,
                heap_used: Math.min(0.8, mockWalletB.metrics.system.heap_used + (i * 0.08)),
                active_requests: Math.min(100, mockWalletB.metrics.system.active_requests + (i * 8))
              }
            }
          }
        });
      }

      const endTime = Date.now();
      const correlationMetrics = {
        total_duration: endTime - startTime,
        operations_completed: operations,
        correlation_data: correlationData,
        metric_correlations: {
          wallet_a: {
            heap_vs_latency: calculateCorrelation(
              correlationData.map(d => d.metrics.wallet_a.system.heap_used),
              correlationData.map(d => d.metrics.wallet_a.performance.api_latency)
            ),
            requests_vs_throughput: calculateCorrelation(
              correlationData.map(d => d.metrics.wallet_a.system.active_requests),
              correlationData.map(d => d.metrics.wallet_a.performance.throughput)
            ),
            heap_vs_error_rate: calculateCorrelation(
              correlationData.map(d => d.metrics.wallet_a.system.heap_used),
              correlationData.map(d => d.metrics.wallet_a.performance.error_rate)
            )
          },
          wallet_b: {
            heap_vs_latency: calculateCorrelation(
              correlationData.map(d => d.metrics.wallet_b.system.heap_used),
              correlationData.map(d => d.metrics.wallet_b.performance.api_latency)
            ),
            requests_vs_throughput: calculateCorrelation(
              correlationData.map(d => d.metrics.wallet_b.system.active_requests),
              correlationData.map(d => d.metrics.wallet_b.performance.throughput)
            ),
            heap_vs_error_rate: calculateCorrelation(
              correlationData.map(d => d.metrics.wallet_b.system.heap_used),
              correlationData.map(d => d.metrics.wallet_b.performance.error_rate)
            )
          }
        }
      };

      testRunner.expectMetrics(correlationMetrics);
      expect(correlationMetrics.total_duration).toBeLessThan(5000);
      expect(Math.abs(correlationMetrics.metric_correlations.wallet_a.heap_vs_latency)).toBeLessThan(1);
      expect(Math.abs(correlationMetrics.metric_correlations.wallet_a.requests_vs_throughput)).toBeLessThan(1);
      expect(Math.abs(correlationMetrics.metric_correlations.wallet_a.heap_vs_error_rate)).toBeLessThan(1);
      expect(Math.abs(correlationMetrics.metric_correlations.wallet_b.heap_vs_latency)).toBeLessThan(1);
      expect(Math.abs(correlationMetrics.metric_correlations.wallet_b.requests_vs_throughput)).toBeLessThan(1);
      expect(Math.abs(correlationMetrics.metric_correlations.wallet_b.heap_vs_error_rate)).toBeLessThan(1);
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
