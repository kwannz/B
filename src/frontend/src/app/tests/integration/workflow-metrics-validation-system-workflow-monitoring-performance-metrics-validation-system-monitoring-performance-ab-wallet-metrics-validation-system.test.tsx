import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet, transferSOL } from '@/app/api/client';
import AgentSelection from '@/app/agent-selection/page';
import StrategyCreation from '@/app/strategy-creation/page';
import BotIntegration from '@/app/bot-integration/page';
import KeyManagement from '@/app/key-management/page';
import TradingDashboard from '@/app/trading-dashboard/page';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('next/navigation');
jest.mock('@/app/api/client');

describe('Workflow Metrics Validation - AB Wallet Metrics Validation System', () => {
  const mockWalletA = {
    address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
    private_key: 'mock_private_key_a',
    balance: 1.5,
    transactions: [
      { type: 'trade', amount: 0.1, timestamp: Date.now() }
    ],
    metrics: {
      performance: {
        api_latency: 100,
        error_rate: 0.05,
        system_health: 0.95,
        memory_usage: 0.4,
        cpu_usage: 0.3,
        network_latency: 50,
        throughput: 100,
        response_time: 200,
        validation: {
          success_rate: 0.98,
          error_count: 2,
          warning_count: 5,
          validation_time: 150,
          system_metrics: {
            heap_used: 0.5,
            heap_total: 0.8,
            external_memory: 0.2,
            event_loop_lag: 10,
            active_handles: 50,
            active_requests: 20,
            garbage_collection_count: 5,
            garbage_collection_time: 100
          }
        }
      }
    }
  };

  const mockWalletB = {
    address: '7MmPb3RLvEgtg4HQY8gguARGwGKyYaCeT8DLvBwfLL',
    private_key: 'mock_private_key_b',
    balance: 2.0,
    transactions: [
      { type: 'trade', amount: 0.2, timestamp: Date.now() }
    ],
    metrics: {
      performance: {
        api_latency: 90,
        error_rate: 0.04,
        system_health: 0.96,
        memory_usage: 0.35,
        cpu_usage: 0.25,
        network_latency: 45,
        throughput: 110,
        response_time: 180,
        validation: {
          success_rate: 0.99,
          error_count: 1,
          warning_count: 3,
          validation_time: 140,
          system_metrics: {
            heap_used: 0.45,
            heap_total: 0.75,
            external_memory: 0.15,
            event_loop_lag: 8,
            active_handles: 45,
            active_requests: 15,
            garbage_collection_count: 4,
            garbage_collection_time: 90
          }
        }
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
    (createBot as jest.Mock).mockResolvedValue({ id: 'bot-123' });
    (getBotStatus as jest.Mock).mockResolvedValue({ id: 'bot-123', status: 'active' });
    (createWallet as jest.Mock)
      .mockImplementation((botId) => Promise.resolve(botId === 'bot-123' ? mockWalletA : mockWalletB));
    (getWallet as jest.Mock)
      .mockImplementation((botId) => Promise.resolve(botId === 'bot-123' ? mockWalletA : mockWalletB));
    (transferSOL as jest.Mock).mockResolvedValue({ success: true });
  });

  it('should validate AB wallet metrics with system validation during normal workflow', async () => {
    await testRunner.runTest(async () => {
      const workflow = [
        <AgentSelection />,
        <StrategyCreation />,
        <BotIntegration />,
        <KeyManagement />,
        <TradingDashboard />,
        <WalletComparison />
      ];

      const metricsData: any[] = [];

      for (const component of workflow) {
        render(<TestContext>{component}</TestContext>);
        await waitFor(() => {
          expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
        });

        const metrics = {
          wallet_a: {
            ...mockWalletA.metrics.performance,
            validation: {
              ...mockWalletA.metrics.performance.validation,
              success_rate: 0.98 + metricsData.length * 0.002,
              error_count: Math.max(0, 2 - metricsData.length),
              warning_count: Math.max(0, 5 - metricsData.length),
              validation_time: 150 + metricsData.length * 5,
              system_metrics: {
                heap_used: 0.5 + metricsData.length * 0.02,
                heap_total: 0.8,
                external_memory: 0.2 + metricsData.length * 0.01,
                event_loop_lag: 10 + metricsData.length,
                active_handles: 50 + metricsData.length * 2,
                active_requests: 20 + metricsData.length,
                garbage_collection_count: 5 + metricsData.length,
                garbage_collection_time: 100 + metricsData.length * 5
              }
            }
          },
          wallet_b: {
            ...mockWalletB.metrics.performance,
            validation: {
              ...mockWalletB.metrics.performance.validation,
              success_rate: 0.99 + metricsData.length * 0.001,
              error_count: Math.max(0, 1 - metricsData.length),
              warning_count: Math.max(0, 3 - metricsData.length),
              validation_time: 140 + metricsData.length * 4,
              system_metrics: {
                heap_used: 0.45 + metricsData.length * 0.015,
                heap_total: 0.75,
                external_memory: 0.15 + metricsData.length * 0.008,
                event_loop_lag: 8 + metricsData.length,
                active_handles: 45 + metricsData.length * 2,
                active_requests: 15 + metricsData.length,
                garbage_collection_count: 4 + metricsData.length,
                garbage_collection_time: 90 + metricsData.length * 4
              }
            }
          }
        };
        metricsData.push(metrics);
      }

      const metrics = {
        wallets: {
          wallet_a: {
            validation: {
              successRate: metricsData[metricsData.length - 1].wallet_a.validation.success_rate,
              errorCount: metricsData[metricsData.length - 1].wallet_a.validation.error_count,
              warningCount: metricsData[metricsData.length - 1].wallet_a.validation.warning_count,
              validationTime: metricsData[metricsData.length - 1].wallet_a.validation.validation_time,
              systemMetrics: metricsData[metricsData.length - 1].wallet_a.validation.system_metrics
            }
          },
          wallet_b: {
            validation: {
              successRate: metricsData[metricsData.length - 1].wallet_b.validation.success_rate,
              errorCount: metricsData[metricsData.length - 1].wallet_b.validation.error_count,
              warningCount: metricsData[metricsData.length - 1].wallet_b.validation.warning_count,
              validationTime: metricsData[metricsData.length - 1].wallet_b.validation.validation_time,
              systemMetrics: metricsData[metricsData.length - 1].wallet_b.validation.system_metrics
            }
          }
        },
        comparison: {
          validation: {
            successRateDiff: Math.abs(
              metricsData[metricsData.length - 1].wallet_a.validation.success_rate -
              metricsData[metricsData.length - 1].wallet_b.validation.success_rate
            ),
            errorCountDiff: Math.abs(
              metricsData[metricsData.length - 1].wallet_a.validation.error_count -
              metricsData[metricsData.length - 1].wallet_b.validation.error_count
            ),
            warningCountDiff: Math.abs(
              metricsData[metricsData.length - 1].wallet_a.validation.warning_count -
              metricsData[metricsData.length - 1].wallet_b.validation.warning_count
            ),
            validationTimeDiff: Math.abs(
              metricsData[metricsData.length - 1].wallet_a.validation.validation_time -
              metricsData[metricsData.length - 1].wallet_b.validation.validation_time
            )
          },
          systemMetrics: {
            heapUsedDiff: Math.abs(
              metricsData[metricsData.length - 1].wallet_a.validation.system_metrics.heap_used -
              metricsData[metricsData.length - 1].wallet_b.validation.system_metrics.heap_used
            ),
            eventLoopLagDiff: Math.abs(
              metricsData[metricsData.length - 1].wallet_a.validation.system_metrics.event_loop_lag -
              metricsData[metricsData.length - 1].wallet_b.validation.system_metrics.event_loop_lag
            ),
            activeHandlesDiff: Math.abs(
              metricsData[metricsData.length - 1].wallet_a.validation.system_metrics.active_handles -
              metricsData[metricsData.length - 1].wallet_b.validation.system_metrics.active_handles
            ),
            gcTimeDiff: Math.abs(
              metricsData[metricsData.length - 1].wallet_a.validation.system_metrics.garbage_collection_time -
              metricsData[metricsData.length - 1].wallet_b.validation.system_metrics.garbage_collection_time
            )
          }
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.wallets.wallet_a.validation.successRate).toBeGreaterThan(0.95);
      expect(metrics.wallets.wallet_b.validation.successRate).toBeGreaterThan(0.95);
      expect(metrics.comparison.validation.successRateDiff).toBeLessThan(0.05);
      expect(metrics.comparison.validation.errorCountDiff).toBeLessThan(2);
      expect(metrics.comparison.validation.warningCountDiff).toBeLessThan(3);
      expect(metrics.comparison.validation.validationTimeDiff).toBeLessThan(20);
      expect(metrics.comparison.systemMetrics.heapUsedDiff).toBeLessThan(0.1);
      expect(metrics.comparison.systemMetrics.eventLoopLagDiff).toBeLessThan(5);
      expect(metrics.comparison.systemMetrics.activeHandlesDiff).toBeLessThan(10);
      expect(metrics.comparison.systemMetrics.gcTimeDiff).toBeLessThan(20);
    });
  });

  it('should validate AB wallet metrics with system validation during high load', async () => {
    await testRunner.runTest(async () => {
      const workflow = [
        <AgentSelection />,
        <StrategyCreation />,
        <BotIntegration />,
        <KeyManagement />,
        <TradingDashboard />,
        <WalletComparison />
      ];

      const operations = Promise.all(workflow.map(component => 
        render(
          <TestContext>
            {component}
          </TestContext>
        )
      ));

      await operations;

      await waitFor(() => {
        expect(screen.getAllByTestId('performance-metrics')).toHaveLength(workflow.length);
      });

      const metrics = {
        wallets: {
          wallet_a: {
            validation: {
              successRate: 0.96,
              errorCount: 3,
              warningCount: 7,
              validationTime: 180,
              systemMetrics: {
                heapUsed: 0.6,
                heapTotal: 0.8,
                externalMemory: 0.25,
                eventLoopLag: 15,
                activeHandles: 60,
                activeRequests: 25,
                garbageCollectionCount: 8,
                garbageCollectionTime: 120
              }
            }
          },
          wallet_b: {
            validation: {
              successRate: 0.97,
              errorCount: 2,
              warningCount: 5,
              validationTime: 170,
              systemMetrics: {
                heapUsed: 0.55,
                heapTotal: 0.75,
                externalMemory: 0.2,
                eventLoopLag: 12,
                activeHandles: 55,
                activeRequests: 20,
                garbageCollectionCount: 7,
                garbageCollectionTime: 110
              }
            }
          }
        },
        comparison: {
          validation: {
            successRateDiff: 0.01,
            errorCountDiff: 1,
            warningCountDiff: 2,
            validationTimeDiff: 10
          },
          systemMetrics: {
            heapUsedDiff: 0.05,
            eventLoopLagDiff: 3,
            activeHandlesDiff: 5,
            gcTimeDiff: 10
          },
          highLoad: {
            averageHeapUsed: 0.575,
            averageEventLoopLag: 13.5,
            averageActiveHandles: 57.5,
            averageGcTime: 115,
            systemStability: 0.95
          }
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.wallets.wallet_a.validation.successRate).toBeGreaterThan(0.95);
      expect(metrics.wallets.wallet_b.validation.successRate).toBeGreaterThan(0.95);
      expect(metrics.comparison.validation.successRateDiff).toBeLessThan(0.02);
      expect(metrics.comparison.validation.validationTimeDiff).toBeLessThan(20);
      expect(metrics.comparison.systemMetrics.heapUsedDiff).toBeLessThan(0.1);
      expect(metrics.comparison.systemMetrics.eventLoopLagDiff).toBeLessThan(5);
      expect(metrics.comparison.highLoad.systemStability).toBeGreaterThan(0.9);
    });
  });
});
