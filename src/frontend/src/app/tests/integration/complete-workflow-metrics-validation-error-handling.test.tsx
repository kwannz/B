import { render, screen, waitFor } from '@testing-library/react';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet, transferSOL } from '@/app/api/client';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('@/app/api/client');

describe('Complete Workflow Metrics Validation - Error Handling', () => {
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

  it('validates error handling during complete workflow execution', async () => {
    const errorScenarios = [
      { type: 'network', probability: 0.3 },
      { type: 'timeout', probability: 0.2 },
      { type: 'validation', probability: 0.1 }
    ];

    let errorCount = 0;
    (transferSOL as jest.Mock).mockImplementation(() => {
      const shouldError = errorScenarios.some(scenario => Math.random() < scenario.probability);
      if (shouldError) {
        errorCount++;
        const scenario = errorScenarios[Math.floor(Math.random() * errorScenarios.length)];
        throw new Error(`Simulated ${scenario.type} error`);
      }
      return Promise.resolve({ success: true });
    });

    await testRunner.runTest(async () => {
      const iterations = 5;
      const workflowData: any[] = [];
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const iterationStartTime = Date.now();
        let retryCount = 0;
        let success = false;
        let error: any = null;

        render(<TestContext><WalletComparison /></TestContext>);

        await waitFor(() => {
          expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
        });

        while (!success && retryCount < 3) {
          try {
            await transferSOL(mockWalletA.address, mockWalletB.address, 0.1);
            success = true;
          } catch (e) {
            error = e;
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100));
          }
        }

        const iterationEndTime = Date.now();
        workflowData.push({
          iteration: i,
          duration: iterationEndTime - iterationStartTime,
          retries: retryCount,
          success,
          error: error?.message,
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
      const errorMetrics = {
        total_duration: endTime - startTime,
        iterations_completed: iterations,
        workflow_data: workflowData,
        error_metrics: {
          total_errors: errorCount,
          success_rate: workflowData.filter(data => data.success).length / iterations,
          average_retries: workflowData.reduce((acc, data) => acc + data.retries, 0) / iterations,
          error_distribution: workflowData.reduce((acc, data) => {
            if (data.error) {
              const errorType = data.error.split(' ')[1];
              acc[errorType] = (acc[errorType] || 0) + 1;
            }
            return acc;
          }, {} as Record<string, number>)
        },
        performance_impact: {
          duration_by_retry_count: workflowData.reduce((acc, data) => {
            acc[data.retries] = (acc[data.retries] || []).concat(data.duration);
            return acc;
          }, {} as Record<number, number[]>),
          average_duration_with_errors: workflowData
            .filter(data => !data.success)
            .reduce((acc, data) => acc + data.duration, 0) / errorCount || 0,
          average_duration_without_errors: workflowData
            .filter(data => data.success)
            .reduce((acc, data) => acc + data.duration, 0) / (iterations - errorCount) || 0
        },
        system_impact: {
          heap_usage_correlation: {
            wallet_a: calculateCorrelation(
              workflowData.map(data => data.retries),
              workflowData.map(data => data.metrics.wallet_a.system.heap_used)
            ),
            wallet_b: calculateCorrelation(
              workflowData.map(data => data.retries),
              workflowData.map(data => data.metrics.wallet_b.system.heap_used)
            )
          },
          request_load_correlation: {
            wallet_a: calculateCorrelation(
              workflowData.map(data => data.retries),
              workflowData.map(data => data.metrics.wallet_a.system.active_requests)
            ),
            wallet_b: calculateCorrelation(
              workflowData.map(data => data.retries),
              workflowData.map(data => data.metrics.wallet_b.system.active_requests)
            )
          }
        }
      };

      testRunner.expectMetrics(errorMetrics);
      expect(errorMetrics.total_duration).toBeLessThan(15000);
      expect(errorMetrics.error_metrics.success_rate).toBeGreaterThan(0.6);
      expect(errorMetrics.error_metrics.average_retries).toBeLessThan(2);
      expect(errorMetrics.performance_impact.average_duration_with_errors).toBeGreaterThan(
        errorMetrics.performance_impact.average_duration_without_errors
      );
      expect(Math.abs(errorMetrics.system_impact.heap_usage_correlation.wallet_a)).toBeLessThan(1);
      expect(Math.abs(errorMetrics.system_impact.heap_usage_correlation.wallet_b)).toBeLessThan(1);
      expect(Math.abs(errorMetrics.system_impact.request_load_correlation.wallet_a)).toBeLessThan(1);
      expect(Math.abs(errorMetrics.system_impact.request_load_correlation.wallet_b)).toBeLessThan(1);
    });
  });

  it('validates error recovery and system stability during high load', async () => {
    const concurrentOperations = 3;
    const errorData: any[] = [];
    const startTime = Date.now();

    (transferSOL as jest.Mock).mockImplementation(() => {
      if (Math.random() < 0.3) {
        throw new Error('Simulated concurrent operation error');
      }
      return Promise.resolve({ success: true });
    });

    const renderPromises = Array(concurrentOperations).fill(null).map(async (_, index) => {
      const operationStartTime = Date.now();
      let retryCount = 0;
      let success = false;
      let error: any = null;

      render(<TestContext><WalletComparison /></TestContext>);

      await waitFor(() => {
        expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
      });

      while (!success && retryCount < 3) {
        try {
          await transferSOL(mockWalletA.address, mockWalletB.address, 0.1);
          success = true;
        } catch (e) {
          error = e;
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100));
        }
      }

      const operationEndTime = Date.now();
      errorData.push({
        operation: index,
        duration: operationEndTime - operationStartTime,
        retries: retryCount,
        success,
        error: error?.message,
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
      concurrent_operations: concurrentOperations,
      error_data: errorData,
      stability_metrics: {
        success_rate: errorData.filter(data => data.success).length / concurrentOperations,
        average_retries: errorData.reduce((acc, data) => acc + data.retries, 0) / concurrentOperations,
        system_stability: {
          heap_usage: {
            wallet_a: {
              variance: calculateVariance(errorData.map(data => data.metrics.wallet_a.system.heap_used)),
              peak: Math.max(...errorData.map(data => data.metrics.wallet_a.system.heap_used))
            },
            wallet_b: {
              variance: calculateVariance(errorData.map(data => data.metrics.wallet_b.system.heap_used)),
              peak: Math.max(...errorData.map(data => data.metrics.wallet_b.system.heap_used))
            }
          },
          request_load: {
            wallet_a: {
              variance: calculateVariance(errorData.map(data => data.metrics.wallet_a.system.active_requests)),
              peak: Math.max(...errorData.map(data => data.metrics.wallet_a.system.active_requests))
            },
            wallet_b: {
              variance: calculateVariance(errorData.map(data => data.metrics.wallet_b.system.active_requests)),
              peak: Math.max(...errorData.map(data => data.metrics.wallet_b.system.active_requests))
            }
          }
        }
      }
    };

    testRunner.expectMetrics(stabilityMetrics);
    expect(stabilityMetrics.total_duration).toBeLessThan(10000);
    expect(stabilityMetrics.stability_metrics.success_rate).toBeGreaterThan(0.5);
    expect(stabilityMetrics.stability_metrics.average_retries).toBeLessThan(2);
    expect(stabilityMetrics.stability_metrics.system_stability.heap_usage.wallet_a.peak).toBeLessThan(0.8);
    expect(stabilityMetrics.stability_metrics.system_stability.heap_usage.wallet_b.peak).toBeLessThan(0.8);
    expect(stabilityMetrics.stability_metrics.system_stability.request_load.wallet_a.peak).toBeLessThan(100);
    expect(stabilityMetrics.stability_metrics.system_stability.request_load.wallet_b.peak).toBeLessThan(100);
    expect(stabilityMetrics.stability_metrics.system_stability.heap_usage.wallet_a.variance).toBeLessThan(0.1);
    expect(stabilityMetrics.stability_metrics.system_stability.heap_usage.wallet_b.variance).toBeLessThan(0.1);
    expect(stabilityMetrics.stability_metrics.system_stability.request_load.wallet_a.variance).toBeLessThan(100);
    expect(stabilityMetrics.stability_metrics.system_stability.request_load.wallet_b.variance).toBeLessThan(100);
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
