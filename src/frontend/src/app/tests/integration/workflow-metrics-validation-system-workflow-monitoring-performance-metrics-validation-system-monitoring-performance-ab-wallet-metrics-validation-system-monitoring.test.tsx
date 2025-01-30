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

describe('Workflow Metrics Validation - AB Wallet Metrics Validation System Monitoring', () => {
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
          mttf: 3600
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
          mttf: 4000
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

  it('should validate AB wallet metrics with system monitoring during normal workflow', async () => {
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
              alerts: Math.max(0, metricsData.length - 2),
              warnings: Math.max(0, 2 - metricsData.length),
              critical_errors: 0,
              system_events: 100 + metricsData.length * 10,
              health_checks: 50 + metricsData.length * 5,
              uptime: 3600 + metricsData.length * 300,
              mttr: Math.max(100, 300 - metricsData.length * 20),
              mttf: 3600 + metricsData.length * 100
            }
          },
          wallet_b: {
            ...mockWalletB.metrics.performance,
            monitoring: {
              alerts: Math.max(0, metricsData.length - 3),
              warnings: Math.max(0, 1 - metricsData.length),
              critical_errors: 0,
              system_events: 90 + metricsData.length * 8,
              health_checks: 45 + metricsData.length * 4,
              uptime: 3600 + metricsData.length * 300,
              mttr: Math.max(100, 250 - metricsData.length * 15),
              mttf: 4000 + metricsData.length * 100
            }
          }
        };
        metricsData.push(metrics);
      }

      const metrics = {
        wallets: {
          wallet_a: {
            monitoring: metricsData[metricsData.length - 1].wallet_a.monitoring,
            trends: {
              alertsTotal: metricsData.reduce((sum, m) => sum + m.wallet_a.monitoring.alerts, 0),
              warningsTotal: metricsData.reduce((sum, m) => sum + m.wallet_a.monitoring.warnings, 0),
              healthChecksAverage: metricsData.reduce((sum, m) => sum + m.wallet_a.monitoring.health_checks, 0) / metricsData.length,
              mttrImprovement: metricsData[0].wallet_a.monitoring.mttr - metricsData[metricsData.length - 1].wallet_a.monitoring.mttr
            }
          },
          wallet_b: {
            monitoring: metricsData[metricsData.length - 1].wallet_b.monitoring,
            trends: {
              alertsTotal: metricsData.reduce((sum, m) => sum + m.wallet_b.monitoring.alerts, 0),
              warningsTotal: metricsData.reduce((sum, m) => sum + m.wallet_b.monitoring.warnings, 0),
              healthChecksAverage: metricsData.reduce((sum, m) => sum + m.wallet_b.monitoring.health_checks, 0) / metricsData.length,
              mttrImprovement: metricsData[0].wallet_b.monitoring.mttr - metricsData[metricsData.length - 1].wallet_b.monitoring.mttr
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
            healthChecksDiff: Math.abs(
              metricsData[metricsData.length - 1].wallet_a.monitoring.health_checks -
              metricsData[metricsData.length - 1].wallet_b.monitoring.health_checks
            ),
            mttrDiff: Math.abs(
              metricsData[metricsData.length - 1].wallet_a.monitoring.mttr -
              metricsData[metricsData.length - 1].wallet_b.monitoring.mttr
            )
          },
          trends: {
            alertsTotalDiff: Math.abs(
              metricsData.reduce((sum, m) => sum + m.wallet_a.monitoring.alerts, 0) -
              metricsData.reduce((sum, m) => sum + m.wallet_b.monitoring.alerts, 0)
            ),
            warningsTotalDiff: Math.abs(
              metricsData.reduce((sum, m) => sum + m.wallet_a.monitoring.warnings, 0) -
              metricsData.reduce((sum, m) => sum + m.wallet_b.monitoring.warnings, 0)
            ),
            healthChecksAverageDiff: Math.abs(
              metricsData.reduce((sum, m) => sum + m.wallet_a.monitoring.health_checks, 0) / metricsData.length -
              metricsData.reduce((sum, m) => sum + m.wallet_b.monitoring.health_checks, 0) / metricsData.length
            ),
            mttrImprovementDiff: Math.abs(
              (metricsData[0].wallet_a.monitoring.mttr - metricsData[metricsData.length - 1].wallet_a.monitoring.mttr) -
              (metricsData[0].wallet_b.monitoring.mttr - metricsData[metricsData.length - 1].wallet_b.monitoring.mttr)
            )
          }
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.wallets.wallet_a.monitoring.critical_errors).toBe(0);
      expect(metrics.wallets.wallet_b.monitoring.critical_errors).toBe(0);
      expect(metrics.comparison.monitoring.alertsDiff).toBeLessThan(2);
      expect(metrics.comparison.monitoring.warningsDiff).toBeLessThan(2);
      expect(metrics.comparison.monitoring.healthChecksDiff).toBeLessThan(10);
      expect(metrics.comparison.monitoring.mttrDiff).toBeLessThan(100);
      expect(metrics.comparison.trends.alertsTotalDiff).toBeLessThan(5);
      expect(metrics.comparison.trends.warningsTotalDiff).toBeLessThan(5);
      expect(metrics.comparison.trends.healthChecksAverageDiff).toBeLessThan(10);
      expect(metrics.comparison.trends.mttrImprovementDiff).toBeLessThan(50);
    });
  });

  it('should validate AB wallet metrics with system monitoring during high load', async () => {
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
              mttf: 4000
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
              mttf: 4200
            }
          }
        },
        comparison: {
          monitoring: {
            alertsDiff: 1,
            warningsDiff: 1,
            healthChecksDiff: 5,
            mttrDiff: 20
          },
          highLoad: {
            averageHealthChecks: 67.5,
            averageSystemEvents: 145,
            systemStability: 0.95,
            resourceUtilization: {
              memory: 0.6,
              cpu: 0.7,
              network: 0.8,
              eventLoop: 0.6
            }
          }
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.wallets.wallet_a.monitoring.critical_errors).toBe(0);
      expect(metrics.wallets.wallet_b.monitoring.critical_errors).toBe(0);
      expect(metrics.comparison.monitoring.alertsDiff).toBeLessThan(2);
      expect(metrics.comparison.monitoring.warningsDiff).toBeLessThan(2);
      expect(metrics.comparison.monitoring.healthChecksDiff).toBeLessThan(10);
      expect(metrics.comparison.monitoring.mttrDiff).toBeLessThan(50);
      expect(metrics.comparison.highLoad.systemStability).toBeGreaterThan(0.9);
      expect(metrics.comparison.highLoad.resourceUtilization.memory).toBeLessThan(0.8);
      expect(metrics.comparison.highLoad.resourceUtilization.cpu).toBeLessThan(0.8);
      expect(metrics.comparison.highLoad.resourceUtilization.network).toBeLessThan(0.9);
      expect(metrics.comparison.highLoad.resourceUtilization.eventLoop).toBeLessThan(0.7);
    });
  });
});
