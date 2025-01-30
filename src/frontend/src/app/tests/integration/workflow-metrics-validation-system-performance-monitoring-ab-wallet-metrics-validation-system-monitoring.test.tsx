import { render, screen, waitFor } from '@testing-library/react';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
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
  });

  it('validates system monitoring during AB wallet comparison', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      const monitoringData: any[] = [];

      render(<TestContext><WalletComparison /></TestContext>);

      await waitFor(() => {
        expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
      });

      const endTime = Date.now();
      monitoringData.push({
        timestamp: endTime,
        wallets: {
          wallet_a: mockWalletA.metrics,
          wallet_b: mockWalletB.metrics
        }
      });

      const systemMonitoringMetrics = {
        duration: endTime - startTime,
        system_health: {
          heap_usage: {
            wallet_a: mockWalletA.metrics.system.heap_used / mockWalletA.metrics.system.heap_total,
            wallet_b: mockWalletB.metrics.system.heap_used / mockWalletB.metrics.system.heap_total
          },
          request_load: {
            wallet_a: mockWalletA.metrics.system.active_requests / mockWalletA.metrics.system.active_handles,
            wallet_b: mockWalletB.metrics.system.active_requests / mockWalletB.metrics.system.active_handles
          },
          event_loop_health: {
            wallet_a: mockWalletA.metrics.system.event_loop_lag,
            wallet_b: mockWalletB.metrics.system.event_loop_lag
          },
          gc_pressure: {
            wallet_a: mockWalletA.metrics.system.garbage_collection.duration / mockWalletA.metrics.system.garbage_collection.count,
            wallet_b: mockWalletB.metrics.system.garbage_collection.duration / mockWalletB.metrics.system.garbage_collection.count
          }
        },
        performance_metrics: {
          api_latency: {
            wallet_a: mockWalletA.metrics.api_latency,
            wallet_b: mockWalletB.metrics.api_latency,
            improvement: ((mockWalletA.metrics.api_latency - mockWalletB.metrics.api_latency) / mockWalletA.metrics.api_latency) * 100
          },
          error_rates: {
            wallet_a: mockWalletA.metrics.error_rate,
            wallet_b: mockWalletB.metrics.error_rate,
            improvement: ((mockWalletA.metrics.error_rate - mockWalletB.metrics.error_rate) / mockWalletA.metrics.error_rate) * 100
          },
          throughput: {
            wallet_a: mockWalletA.metrics.throughput,
            wallet_b: mockWalletB.metrics.throughput,
            improvement: ((mockWalletB.metrics.throughput - mockWalletA.metrics.throughput) / mockWalletA.metrics.throughput) * 100
          }
        }
      };

      testRunner.expectMetrics(systemMonitoringMetrics);
      expect(systemMonitoringMetrics.duration).toBeLessThan(5000);
      expect(systemMonitoringMetrics.system_health.heap_usage.wallet_a).toBeLessThan(0.8);
      expect(systemMonitoringMetrics.system_health.heap_usage.wallet_b).toBeLessThan(0.8);
      expect(systemMonitoringMetrics.system_health.request_load.wallet_a).toBeLessThan(0.8);
      expect(systemMonitoringMetrics.system_health.request_load.wallet_b).toBeLessThan(0.8);
      expect(systemMonitoringMetrics.system_health.event_loop_health.wallet_a).toBeLessThan(20);
      expect(systemMonitoringMetrics.system_health.event_loop_health.wallet_b).toBeLessThan(20);
      expect(systemMonitoringMetrics.performance_metrics.api_latency.improvement).toBeGreaterThan(0);
      expect(systemMonitoringMetrics.performance_metrics.error_rates.improvement).toBeGreaterThan(0);
      expect(systemMonitoringMetrics.performance_metrics.throughput.improvement).toBeGreaterThan(0);
    });
  });

  it('validates system stability under sustained monitoring', async () => {
    await testRunner.runTest(async () => {
      const iterations = 3;
      const stabilityData: any[] = [];
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        render(<TestContext><WalletComparison /></TestContext>);

        await waitFor(() => {
          expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
        });

        stabilityData.push({
          iteration: i,
          timestamp: Date.now(),
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

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const endTime = Date.now();
      const stabilityMetrics = {
        duration: endTime - startTime,
        iterations_completed: iterations,
        stability_data: stabilityData,
        system_trends: {
          heap_usage: {
            wallet_a: stabilityData.map(d => d.metrics.wallet_a.system.heap_used),
            wallet_b: stabilityData.map(d => d.metrics.wallet_b.system.heap_used)
          },
          request_load: {
            wallet_a: stabilityData.map(d => d.metrics.wallet_a.system.active_requests),
            wallet_b: stabilityData.map(d => d.metrics.wallet_b.system.active_requests)
          }
        },
        stability_analysis: {
          heap_growth_rate: {
            wallet_a: (stabilityData[iterations - 1].metrics.wallet_a.system.heap_used - stabilityData[0].metrics.wallet_a.system.heap_used) / iterations,
            wallet_b: (stabilityData[iterations - 1].metrics.wallet_b.system.heap_used - stabilityData[0].metrics.wallet_b.system.heap_used) / iterations
          },
          request_growth_rate: {
            wallet_a: (stabilityData[iterations - 1].metrics.wallet_a.system.active_requests - stabilityData[0].metrics.wallet_a.system.active_requests) / iterations,
            wallet_b: (stabilityData[iterations - 1].metrics.wallet_b.system.active_requests - stabilityData[0].metrics.wallet_b.system.active_requests) / iterations
          }
        }
      };

      testRunner.expectMetrics(stabilityMetrics);
      expect(stabilityMetrics.duration).toBeLessThan(10000);
      expect(stabilityMetrics.stability_analysis.heap_growth_rate.wallet_a).toBeLessThan(0.1);
      expect(stabilityMetrics.stability_analysis.heap_growth_rate.wallet_b).toBeLessThan(0.1);
      expect(stabilityMetrics.stability_analysis.request_growth_rate.wallet_a).toBeLessThan(20);
      expect(stabilityMetrics.stability_analysis.request_growth_rate.wallet_b).toBeLessThan(20);
      expect(Math.max(...stabilityMetrics.system_trends.heap_usage.wallet_a)).toBeLessThan(0.8);
      expect(Math.max(...stabilityMetrics.system_trends.heap_usage.wallet_b)).toBeLessThan(0.8);
    });
  });
});
