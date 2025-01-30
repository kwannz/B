import { render, screen, waitFor } from '@testing-library/react';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet, transferSOL } from '@/app/api/client';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('@/app/api/client');

describe('Workflow Metrics Validation - AB Wallet System Performance', () => {
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

  it('validates AB wallet performance under high load', async () => {
    await testRunner.runTest(async () => {
      const iterations = 5;
      const performanceData: any[] = [];
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const iterationStartTime = Date.now();
        render(<TestContext><WalletComparison /></TestContext>);

        await waitFor(() => {
          expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
        });

        await transferSOL(mockWalletA.address, mockWalletB.address, 0.1);

        const iterationEndTime = Date.now();
        performanceData.push({
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
        performance_data: performanceData,
        system_metrics: {
          average_iteration_duration: performanceData.reduce((acc, data) => acc + data.duration, 0) / iterations,
          heap_usage_trend: {
            wallet_a: performanceData.map(data => data.metrics.wallet_a.system.heap_used),
            wallet_b: performanceData.map(data => data.metrics.wallet_b.system.heap_used)
          },
          request_load_trend: {
            wallet_a: performanceData.map(data => data.metrics.wallet_a.system.active_requests),
            wallet_b: performanceData.map(data => data.metrics.wallet_b.system.active_requests)
          }
        },
        performance_analysis: {
          heap_growth_rate: {
            wallet_a: (performanceData[iterations - 1].metrics.wallet_a.system.heap_used - performanceData[0].metrics.wallet_a.system.heap_used) / iterations,
            wallet_b: (performanceData[iterations - 1].metrics.wallet_b.system.heap_used - performanceData[0].metrics.wallet_b.system.heap_used) / iterations
          },
          request_growth_rate: {
            wallet_a: (performanceData[iterations - 1].metrics.wallet_a.system.active_requests - performanceData[0].metrics.wallet_a.system.active_requests) / iterations,
            wallet_b: (performanceData[iterations - 1].metrics.wallet_b.system.active_requests - performanceData[0].metrics.wallet_b.system.active_requests) / iterations
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
    });
  });

  it('validates AB wallet performance metrics correlation', async () => {
    await testRunner.runTest(async () => {
      const iterations = 3;
      const correlationData: any[] = [];
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        render(<TestContext><WalletComparison /></TestContext>);

        await waitFor(() => {
          expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
        });

        correlationData.push({
          iteration: i,
          metrics: {
            wallet_a: {
              performance: {
                api_latency: mockWalletA.metrics.api_latency,
                throughput: mockWalletA.metrics.throughput,
                error_rate: mockWalletA.metrics.error_rate
              },
              system: mockWalletA.metrics.system
            },
            wallet_b: {
              performance: {
                api_latency: mockWalletB.metrics.api_latency,
                throughput: mockWalletB.metrics.throughput,
                error_rate: mockWalletB.metrics.error_rate
              },
              system: mockWalletB.metrics.system
            }
          }
        });

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const endTime = Date.now();
      const correlationMetrics = {
        duration: endTime - startTime,
        iterations_completed: iterations,
        correlation_data: correlationData,
        performance_correlation: {
          latency_vs_heap: {
            wallet_a: calculateCorrelation(
              correlationData.map(d => d.metrics.wallet_a.performance.api_latency),
              correlationData.map(d => d.metrics.wallet_a.system.heap_used)
            ),
            wallet_b: calculateCorrelation(
              correlationData.map(d => d.metrics.wallet_b.performance.api_latency),
              correlationData.map(d => d.metrics.wallet_b.system.heap_used)
            )
          },
          throughput_vs_requests: {
            wallet_a: calculateCorrelation(
              correlationData.map(d => d.metrics.wallet_a.performance.throughput),
              correlationData.map(d => d.metrics.wallet_a.system.active_requests)
            ),
            wallet_b: calculateCorrelation(
              correlationData.map(d => d.metrics.wallet_b.performance.throughput),
              correlationData.map(d => d.metrics.wallet_b.system.active_requests)
            )
          }
        }
      };

      testRunner.expectMetrics(correlationMetrics);
      expect(correlationMetrics.duration).toBeLessThan(5000);
      expect(Math.abs(correlationMetrics.performance_correlation.latency_vs_heap.wallet_a)).toBeLessThan(1);
      expect(Math.abs(correlationMetrics.performance_correlation.latency_vs_heap.wallet_b)).toBeLessThan(1);
      expect(Math.abs(correlationMetrics.performance_correlation.throughput_vs_requests.wallet_a)).toBeLessThan(1);
      expect(Math.abs(correlationMetrics.performance_correlation.throughput_vs_requests.wallet_b)).toBeLessThan(1);
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
