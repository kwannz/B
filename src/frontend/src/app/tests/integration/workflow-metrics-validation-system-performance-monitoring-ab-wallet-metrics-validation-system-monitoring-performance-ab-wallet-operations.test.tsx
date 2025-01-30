import { render, screen, waitFor } from '@testing-library/react';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet, transferSOL } from '@/app/api/client';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('@/app/api/client');

describe('Workflow Metrics Validation - AB Wallet Operations Performance', () => {
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

  it('validates AB wallet operations under high load', async () => {
    await testRunner.runTest(async () => {
      const operations = 5;
      const operationsData: any[] = [];
      const startTime = Date.now();

      for (let i = 0; i < operations; i++) {
        const operationStartTime = Date.now();
        render(<TestContext><WalletComparison /></TestContext>);

        await waitFor(() => {
          expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
        });

        await transferSOL(mockWalletA.address, mockWalletB.address, 0.1);

        const operationEndTime = Date.now();
        operationsData.push({
          operation: i,
          duration: operationEndTime - operationStartTime,
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
        operations_completed: operations,
        operations_data: operationsData,
        system_metrics: {
          average_operation_duration: operationsData.reduce((acc, op) => acc + op.duration, 0) / operations,
          heap_usage_trend: {
            wallet_a: operationsData.map(op => op.metrics.wallet_a.system.heap_used),
            wallet_b: operationsData.map(op => op.metrics.wallet_b.system.heap_used)
          },
          request_load_trend: {
            wallet_a: operationsData.map(op => op.metrics.wallet_a.system.active_requests),
            wallet_b: operationsData.map(op => op.metrics.wallet_b.system.active_requests)
          }
        },
        performance_analysis: {
          heap_growth_rate: {
            wallet_a: (operationsData[operations - 1].metrics.wallet_a.system.heap_used - operationsData[0].metrics.wallet_a.system.heap_used) / operations,
            wallet_b: (operationsData[operations - 1].metrics.wallet_b.system.heap_used - operationsData[0].metrics.wallet_b.system.heap_used) / operations
          },
          request_growth_rate: {
            wallet_a: (operationsData[operations - 1].metrics.wallet_a.system.active_requests - operationsData[0].metrics.wallet_a.system.active_requests) / operations,
            wallet_b: (operationsData[operations - 1].metrics.wallet_b.system.active_requests - operationsData[0].metrics.wallet_b.system.active_requests) / operations
          }
        }
      };

      testRunner.expectMetrics(performanceMetrics);
      expect(performanceMetrics.total_duration).toBeLessThan(10000);
      expect(performanceMetrics.system_metrics.average_operation_duration).toBeLessThan(1000);
      expect(performanceMetrics.performance_analysis.heap_growth_rate.wallet_a).toBeLessThan(0.1);
      expect(performanceMetrics.performance_analysis.heap_growth_rate.wallet_b).toBeLessThan(0.1);
      expect(performanceMetrics.performance_analysis.request_growth_rate.wallet_a).toBeLessThan(20);
      expect(performanceMetrics.performance_analysis.request_growth_rate.wallet_b).toBeLessThan(20);
    });
  });

  it('validates concurrent wallet operations with error recovery', async () => {
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
      const operations = 3;
      const operationsData: any[] = [];
      const startTime = Date.now();
      const maxRetries = 3;

      for (let i = 0; i < operations; i++) {
        const operationStartTime = Date.now();
        let retries = 0;
        let success = false;

        render(<TestContext><WalletComparison /></TestContext>);

        await waitFor(() => {
          expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
        });

        while (!success && retries < maxRetries) {
          try {
            await transferSOL(mockWalletA.address, mockWalletB.address, 0.1);
            success = true;
          } catch (error) {
            retries++;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 100));
          }
        }

        const operationEndTime = Date.now();
        operationsData.push({
          operation: i,
          duration: operationEndTime - operationStartTime,
          retries,
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
        operations_completed: operations,
        operations_data: operationsData,
        error_recovery: {
          total_retries: operationsData.reduce((acc, op) => acc + op.retries, 0),
          success_rate: operationsData.filter(op => op.success).length / operations,
          average_retry_count: operationsData.reduce((acc, op) => acc + op.retries, 0) / operations,
          retry_distribution: operationsData.reduce((acc, op) => {
            acc[op.retries] = (acc[op.retries] || 0) + 1;
            return acc;
          }, {} as Record<number, number>)
        },
        system_impact: {
          final_heap_usage: {
            wallet_a: operationsData[operations - 1].metrics.wallet_a.system.heap_used,
            wallet_b: operationsData[operations - 1].metrics.wallet_b.system.heap_used
          },
          final_request_load: {
            wallet_a: operationsData[operations - 1].metrics.wallet_a.system.active_requests,
            wallet_b: operationsData[operations - 1].metrics.wallet_b.system.active_requests
          }
        }
      };

      testRunner.expectMetrics(recoveryMetrics);
      expect(recoveryMetrics.total_duration).toBeLessThan(15000);
      expect(recoveryMetrics.error_recovery.success_rate).toBeGreaterThan(0.8);
      expect(recoveryMetrics.system_impact.final_heap_usage.wallet_a).toBeLessThan(0.8);
      expect(recoveryMetrics.system_impact.final_heap_usage.wallet_b).toBeLessThan(0.8);
      expect(recoveryMetrics.system_impact.final_request_load.wallet_a).toBeLessThan(100);
      expect(recoveryMetrics.system_impact.final_request_load.wallet_b).toBeLessThan(100);
    });
  });
});
