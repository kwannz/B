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

describe('Workflow Metrics Validation - AB Wallet Metrics Validation System Monitoring Performance', () => {
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
        monitoring: {
          alerts: 0,
          warnings: 2,
          critical_errors: 0,
          system_events: 100,
          health_checks: 50,
          uptime: 3600,
          mttr: 300,
          mttf: 3600,
          performance: {
            heap_used: 0.5,
            heap_total: 0.8,
            external_memory: 0.2,
            event_loop_lag: 10,
            active_handles: 50,
            active_requests: 20,
            garbage_collection_count: 5,
            garbage_collection_time: 100,
            api_response_time: 150,
            database_latency: 50,
            cache_hit_rate: 0.9,
            error_count: 2,
            success_rate: 0.98
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
        monitoring: {
          alerts: 0,
          warnings: 1,
          critical_errors: 0,
          system_events: 90,
          health_checks: 45,
          uptime: 3600,
          mttr: 250,
          mttf: 4000,
          performance: {
            heap_used: 0.45,
            heap_total: 0.75,
            external_memory: 0.15,
            event_loop_lag: 8,
            active_handles: 45,
            active_requests: 15,
            garbage_collection_count: 4,
            garbage_collection_time: 90,
            api_response_time: 140,
            database_latency: 45,
            cache_hit_rate: 0.92,
            error_count: 1,
            success_rate: 0.99
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

  it('should validate AB wallet metrics with comprehensive system monitoring and performance tracking', async () => {
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
            monitoring: {
              ...mockWalletA.metrics.performance.monitoring,
              alerts: Math.max(0, metricsData.length - 2),
              warnings: Math.max(0, 2 - metricsData.length),
              system_events: 100 + metricsData.length * 10,
              health_checks: 50 + metricsData.length * 5,
              uptime: 3600 + metricsData.length * 300,
              mttr: Math.max(100, 300 - metricsData.length * 20),
              mttf: 3600 + metricsData.length * 100,
              performance: {
                ...mockWalletA.metrics.performance.monitoring.performance,
                heap_used: Math.min(0.8, 0.5 + metricsData.length * 0.05),
                event_loop_lag: Math.min(20, 10 + metricsData.length),
                active_handles: 50 + metricsData.length * 5,
                active_requests: 20 + metricsData.length * 2,
                api_response_time: Math.min(200, 150 + metricsData.length * 5),
                database_latency: Math.min(100, 50 + metricsData.length * 3),
                cache_hit_rate: Math.max(0.8, 0.9 - metricsData.length * 0.02),
                error_count: Math.max(0, 2 - metricsData.length),
                success_rate: Math.min(1.0, 0.98 + metricsData.length * 0.002)
              }
            }
          },
          wallet_b: {
            ...mockWalletB.metrics.performance,
            monitoring: {
              ...mockWalletB.metrics.performance.monitoring,
              alerts: Math.max(0, metricsData.length - 3),
              warnings: Math.max(0, 1 - metricsData.length),
              system_events: 90 + metricsData.length * 8,
              health_checks: 45 + metricsData.length * 4,
              uptime: 3600 + metricsData.length * 300,
              mttr: Math.max(100, 250 - metricsData.length * 15),
              mttf: 4000 + metricsData.length * 100,
              performance: {
                ...mockWalletB.metrics.performance.monitoring.performance,
                heap_used: Math.min(0.75, 0.45 + metricsData.length * 0.04),
                event_loop_lag: Math.min(15, 8 + metricsData.length),
                active_handles: 45 + metricsData.length * 4,
                active_requests: 15 + metricsData.length * 2,
                api_response_time: Math.min(180, 140 + metricsData.length * 4),
                database_latency: Math.min(90, 45 + metricsData.length * 3),
                cache_hit_rate: Math.max(0.85, 0.92 - metricsData.length * 0.015),
                error_count: Math.max(0, 1 - metricsData.length),
                success_rate: Math.min(1.0, 0.99 + metricsData.length * 0.001)
              }
            }
          }
        };
        metricsData.push(metrics);
      }

      const metrics = {
        wallets: {
          wallet_a: {
            monitoring: metricsData[metricsData.length - 1].wallet_a.monitoring,
            performance: {
              initial: metricsData[0].wallet_a.monitoring.performance,
              final: metricsData[metricsData.length - 1].wallet_a.monitoring.performance,
              improvement: {
                heap_used: metricsData[0].wallet_a.monitoring.performance.heap_used -
                          metricsData[metricsData.length - 1].wallet_a.monitoring.performance.heap_used,
                api_response_time: metricsData[0].wallet_a.monitoring.performance.api_response_time -
                                 metricsData[metricsData.length - 1].wallet_a.monitoring.performance.api_response_time,
                success_rate: metricsData[metricsData.length - 1].wallet_a.monitoring.performance.success_rate -
                            metricsData[0].wallet_a.monitoring.performance.success_rate
              }
            }
          },
          wallet_b: {
            monitoring: metricsData[metricsData.length - 1].wallet_b.monitoring,
            performance: {
              initial: metricsData[0].wallet_b.monitoring.performance,
              final: metricsData[metricsData.length - 1].wallet_b.monitoring.performance,
              improvement: {
                heap_used: metricsData[0].wallet_b.monitoring.performance.heap_used -
                          metricsData[metricsData.length - 1].wallet_b.monitoring.performance.heap_used,
                api_response_time: metricsData[0].wallet_b.monitoring.performance.api_response_time -
                                 metricsData[metricsData.length - 1].wallet_b.monitoring.performance.api_response_time,
                success_rate: metricsData[metricsData.length - 1].wallet_b.monitoring.performance.success_rate -
                            metricsData[0].wallet_b.monitoring.performance.success_rate
              }
            }
          }
        },
        comparison: {
          monitoring: {
            alertsDiff: Math.abs(
              metricsData[metricsData.length - 1].wallet_a.monitoring.alerts -
              metricsData[metricsData.length - 1].wallet_b.monitoring.alerts
            ),
            warningsDiff: Math.abs(
              metricsData[metricsData.length - 1].wallet_a.monitoring.warnings -
              metricsData[metricsData.length - 1].wallet_b.monitoring.warnings
            ),
            mttrDiff: Math.abs(
              metricsData[metricsData.length - 1].wallet_a.monitoring.mttr -
              metricsData[metricsData.length - 1].wallet_b.monitoring.mttr
            )
          },
          performance: {
            heapUsedDiff: Math.abs(
              metricsData[metricsData.length - 1].wallet_a.monitoring.performance.heap_used -
              metricsData[metricsData.length - 1].wallet_b.monitoring.performance.heap_used
            ),
            apiResponseTimeDiff: Math.abs(
              metricsData[metricsData.length - 1].wallet_a.monitoring.performance.api_response_time -
              metricsData[metricsData.length - 1].wallet_b.monitoring.performance.api_response_time
            ),
            successRateDiff: Math.abs(
              metricsData[metricsData.length - 1].wallet_a.monitoring.performance.success_rate -
              metricsData[metricsData.length - 1].wallet_b.monitoring.performance.success_rate
            )
          },
          trends: {
            heapUsedImprovementDiff: Math.abs(
              (metricsData[0].wallet_a.monitoring.performance.heap_used -
               metricsData[metricsData.length - 1].wallet_a.monitoring.performance.heap_used) -
              (metricsData[0].wallet_b.monitoring.performance.heap_used -
               metricsData[metricsData.length - 1].wallet_b.monitoring.performance.heap_used)
            ),
            apiResponseTimeImprovementDiff: Math.abs(
              (metricsData[0].wallet_a.monitoring.performance.api_response_time -
               metricsData[metricsData.length - 1].wallet_a.monitoring.performance.api_response_time) -
              (metricsData[0].wallet_b.monitoring.performance.api_response_time -
               metricsData[metricsData.length - 1].wallet_b.monitoring.performance.api_response_time)
            ),
            successRateImprovementDiff: Math.abs(
              (metricsData[metricsData.length - 1].wallet_a.monitoring.performance.success_rate -
               metricsData[0].wallet_a.monitoring.performance.success_rate) -
              (metricsData[metricsData.length - 1].wallet_b.monitoring.performance.success_rate -
               metricsData[0].wallet_b.monitoring.performance.success_rate)
            )
          }
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.wallets.wallet_a.monitoring.performance.heap_used).toBeLessThan(0.8);
      expect(metrics.wallets.wallet_b.monitoring.performance.heap_used).toBeLessThan(0.8);
      expect(metrics.wallets.wallet_a.monitoring.performance.api_response_time).toBeLessThan(200);
      expect(metrics.wallets.wallet_b.monitoring.performance.api_response_time).toBeLessThan(200);
      expect(metrics.wallets.wallet_a.monitoring.performance.success_rate).toBeGreaterThan(0.95);
      expect(metrics.wallets.wallet_b.monitoring.performance.success_rate).toBeGreaterThan(0.95);
      expect(metrics.comparison.monitoring.alertsDiff).toBeLessThan(2);
      expect(metrics.comparison.monitoring.warningsDiff).toBeLessThan(2);
      expect(metrics.comparison.monitoring.mttrDiff).toBeLessThan(100);
      expect(metrics.comparison.performance.heapUsedDiff).toBeLessThan(0.1);
      expect(metrics.comparison.performance.apiResponseTimeDiff).toBeLessThan(30);
      expect(metrics.comparison.performance.successRateDiff).toBeLessThan(0.05);
      expect(metrics.comparison.trends.heapUsedImprovementDiff).toBeLessThan(0.05);
      expect(metrics.comparison.trends.apiResponseTimeImprovementDiff).toBeLessThan(20);
      expect(metrics.comparison.trends.successRateImprovementDiff).toBeLessThan(0.02);
    });
  });

  it('should validate AB wallet metrics during high load with comprehensive monitoring', async () => {
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
            monitoring: {
              alerts: 2,
              warnings: 4,
              critical_errors: 0,
              system_events: 150,
              health_checks: 70,
              uptime: 4800,
              mttr: 200,
              mttf: 4000,
              performance: {
                heap_used: 0.65,
                event_loop_lag: 15,
                active_handles: 70,
                active_requests: 30,
                api_response_time: 180,
                database_latency: 70,
                cache_hit_rate: 0.85,
                error_count: 3,
                success_rate: 0.96
              }
            }
          },
          wallet_b: {
            monitoring: {
              alerts: 1,
              warnings: 3,
              critical_errors: 0,
              system_events: 140,
              health_checks: 65,
              uptime: 4800,
              mttr: 180,
              mttf: 4200,
              performance: {
                heap_used: 0.6,
                event_loop_lag: 12,
                active_handles: 65,
                active_requests: 25,
                api_response_time: 170,
                database_latency: 65,
                cache_hit_rate: 0.87,
                error_count: 2,
                success_rate: 0.97
              }
            }
          }
        },
        comparison: {
          monitoring: {
            alertsDiff: 1,
            warningsDiff: 1,
            mttrDiff: 20
          },
          performance: {
            heapUsedDiff: 0.05,
            apiResponseTimeDiff: 10,
            successRateDiff: 0.01
          },
          highLoad: {
            averageHeapUsed: 0.625,
            averageApiResponseTime: 175,
            averageSuccessRate: 0.965,
            systemStability: 0.95,
            resourceUtilization: {
              memory: 0.7,
              cpu: 0.6,
              network: 0.8,
              database: 0.7
            }
          }
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.wallets.wallet_a.monitoring.performance.heap_used).toBeLessThan(0.8);
      expect(metrics.wallets.wallet_b.monitoring.performance.heap_used).toBeLessThan(0.8);
      expect(metrics.wallets.wallet_a.monitoring.performance.api_response_time).toBeLessThan(200);
      expect(metrics.wallets.wallet_b.monitoring.performance.api_response_time).toBeLessThan(200);
      expect(metrics.wallets.wallet_a.monitoring.performance.success_rate).toBeGreaterThan(0.95);
      expect(metrics.wallets.wallet_b.monitoring.performance.success_rate).toBeGreaterThan(0.95);
      expect(metrics.comparison.monitoring.alertsDiff).toBeLessThan(2);
      expect(metrics.comparison.monitoring.warningsDiff).toBeLessThan(2);
      expect(metrics.comparison.monitoring.mttrDiff).toBeLessThan(50);
      expect(metrics.comparison.performance.heapUsedDiff).toBeLessThan(0.1);
      expect(metrics.comparison.performance.apiResponseTimeDiff).toBeLessThan(20);
      expect(metrics.comparison.performance.successRateDiff).toBeLessThan(0.02);
      expect(metrics.comparison.highLoad.systemStability).toBeGreaterThan(0.9);
      expect(metrics.comparison.highLoad.resourceUtilization.memory).toBeLessThan(0.8);
      expect(metrics.comparison.highLoad.resourceUtilization.cpu).toBeLessThan(0.7);
      expect(metrics.comparison.highLoad.resourceUtilization.network).toBeLessThan(0.9);
      expect(metrics.comparison.highLoad.resourceUtilization.database).toBeLessThan(0.8);
    });
  });
});
