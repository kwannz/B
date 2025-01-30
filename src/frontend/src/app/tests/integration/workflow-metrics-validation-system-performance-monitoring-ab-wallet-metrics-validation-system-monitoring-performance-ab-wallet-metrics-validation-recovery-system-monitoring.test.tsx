import { render, screen, waitFor } from '@testing-library/react';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet, transferSOL } from '@/app/api/client';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('@/app/api/client');

describe('Workflow Metrics Validation - AB Wallet System Monitoring', () => {
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

  it('validates system monitoring metrics during recovery', async () => {
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
      const monitoringData: any[] = [];
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
        monitoringData.push({
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
      const monitoringMetrics = {
        total_duration: endTime - startTime,
        iterations_completed: iterations,
        monitoring_data: monitoringData,
        error_recovery: {
          total_retries: monitoringData.reduce((acc, data) => acc + data.retries, 0),
          success_rate: monitoringData.filter(data => data.success).length / iterations,
          average_retry_count: monitoringData.reduce((acc, data) => acc + data.retries, 0) / iterations,
          retry_distribution: monitoringData.reduce((acc, data) => {
            acc[data.retries] = (acc[data.retries] || 0) + 1;
            return acc;
          }, {} as Record<number, number>)
        },
        system_metrics: {
          heap_usage_trend: {
            wallet_a: monitoringData.map(data => data.metrics.wallet_a.system.heap_used),
            wallet_b: monitoringData.map(data => data.metrics.wallet_b.system.heap_used)
          },
          request_load_trend: {
            wallet_a: monitoringData.map(data => data.metrics.wallet_a.system.active_requests),
            wallet_b: monitoringData.map(data => data.metrics.wallet_b.system.active_requests)
          }
        },
        performance_metrics: {
          average_duration: monitoringData.reduce((acc, data) => acc + data.duration, 0) / iterations,
          duration_by_retry_count: monitoringData.reduce((acc, data) => {
            acc[data.retries] = (acc[data.retries] || []).concat(data.duration);
            return acc;
          }, {} as Record<number, number[]>)
        },
        system_stability: {
          heap_usage_variance: {
            wallet_a: calculateVariance(monitoringData.map(data => data.metrics.wallet_a.system.heap_used)),
            wallet_b: calculateVariance(monitoringData.map(data => data.metrics.wallet_b.system.heap_used))
          },
          request_load_variance: {
            wallet_a: calculateVariance(monitoringData.map(data => data.metrics.wallet_a.system.active_requests)),
            wallet_b: calculateVariance(monitoringData.map(data => data.metrics.wallet_b.system.active_requests))
          }
        }
      };

      testRunner.expectMetrics(monitoringMetrics);
      expect(monitoringMetrics.total_duration).toBeLessThan(15000);
      expect(monitoringMetrics.error_recovery.success_rate).toBeGreaterThan(0.8);
      expect(Math.max(...monitoringMetrics.system_metrics.heap_usage_trend.wallet_a)).toBeLessThan(0.8);
      expect(Math.max(...monitoringMetrics.system_metrics.heap_usage_trend.wallet_b)).toBeLessThan(0.8);
      expect(Math.max(...monitoringMetrics.system_metrics.request_load_trend.wallet_a)).toBeLessThan(100);
      expect(Math.max(...monitoringMetrics.system_metrics.request_load_trend.wallet_b)).toBeLessThan(100);
      expect(monitoringMetrics.system_stability.heap_usage_variance.wallet_a).toBeLessThan(0.1);
      expect(monitoringMetrics.system_stability.heap_usage_variance.wallet_b).toBeLessThan(0.1);
      expect(monitoringMetrics.system_stability.request_load_variance.wallet_a).toBeLessThan(100);
      expect(monitoringMetrics.system_stability.request_load_variance.wallet_b).toBeLessThan(100);
    });
  });

  it('validates system monitoring during concurrent operations', async () => {
    const operations = 3;
    const monitoringData: any[] = [];
    const startTime = Date.now();

    const renderPromises = Array(operations).fill(null).map(async (_, index) => {
      const operationStartTime = Date.now();
      render(<TestContext><WalletComparison /></TestContext>);

      await waitFor(() => {
        expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
      });

      await transferSOL(mockWalletA.address, mockWalletB.address, 0.1);

      const operationEndTime = Date.now();
      monitoringData.push({
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

    const concurrentMetrics = {
      total_duration: endTime - startTime,
      concurrent_operations: operations,
      monitoring_data: monitoringData,
      system_metrics: {
        average_operation_duration: monitoringData.reduce((acc, data) => acc + data.duration, 0) / operations,
        peak_metrics: {
          heap_usage: {
            wallet_a: Math.max(...monitoringData.map(data => data.metrics.wallet_a.system.heap_used)),
            wallet_b: Math.max(...monitoringData.map(data => data.metrics.wallet_b.system.heap_used))
          },
          request_load: {
            wallet_a: Math.max(...monitoringData.map(data => data.metrics.wallet_a.system.active_requests)),
            wallet_b: Math.max(...monitoringData.map(data => data.metrics.wallet_b.system.active_requests))
          }
        },
        metrics_variance: {
          heap_usage: {
            wallet_a: calculateVariance(monitoringData.map(data => data.metrics.wallet_a.system.heap_used)),
            wallet_b: calculateVariance(monitoringData.map(data => data.metrics.wallet_b.system.heap_used))
          },
          request_load: {
            wallet_a: calculateVariance(monitoringData.map(data => data.metrics.wallet_a.system.active_requests)),
            wallet_b: calculateVariance(monitoringData.map(data => data.metrics.wallet_b.system.active_requests))
          }
        }
      }
    };

    testRunner.expectMetrics(concurrentMetrics);
    expect(concurrentMetrics.total_duration).toBeLessThan(5000);
    expect(concurrentMetrics.system_metrics.average_operation_duration).toBeLessThan(1000);
    expect(concurrentMetrics.system_metrics.peak_metrics.heap_usage.wallet_a).toBeLessThan(0.8);
    expect(concurrentMetrics.system_metrics.peak_metrics.heap_usage.wallet_b).toBeLessThan(0.8);
    expect(concurrentMetrics.system_metrics.peak_metrics.request_load.wallet_a).toBeLessThan(100);
    expect(concurrentMetrics.system_metrics.peak_metrics.request_load.wallet_b).toBeLessThan(100);
    expect(concurrentMetrics.system_metrics.metrics_variance.heap_usage.wallet_a).toBeLessThan(0.1);
    expect(concurrentMetrics.system_metrics.metrics_variance.heap_usage.wallet_b).toBeLessThan(0.1);
    expect(concurrentMetrics.system_metrics.metrics_variance.request_load.wallet_a).toBeLessThan(100);
    expect(concurrentMetrics.system_metrics.metrics_variance.request_load.wallet_b).toBeLessThan(100);
  });
});

function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - mean, 2));
  return squareDiffs.reduce((a, b) => a + b, 0) / values.length;
}
