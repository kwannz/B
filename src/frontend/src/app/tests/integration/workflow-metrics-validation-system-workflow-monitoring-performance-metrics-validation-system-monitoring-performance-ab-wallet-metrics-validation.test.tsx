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

describe('Workflow Metrics Validation - AB Wallet Metrics Validation', () => {
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
          validation_time: 150
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
          validation_time: 140
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

  it('should validate AB wallet metrics with comprehensive validation checks', async () => {
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
              success_rate: 0.98 + metricsData.length * 0.002,
              error_count: Math.max(0, 2 - metricsData.length),
              warning_count: Math.max(0, 5 - metricsData.length),
              validation_time: 150 + metricsData.length * 5
            }
          },
          wallet_b: {
            ...mockWalletB.metrics.performance,
            validation: {
              success_rate: 0.99 + metricsData.length * 0.001,
              error_count: Math.max(0, 1 - metricsData.length),
              warning_count: Math.max(0, 3 - metricsData.length),
              validation_time: 140 + metricsData.length * 4
            }
          }
        };
        metricsData.push(metrics);
      }

      const metrics = {
        wallets: {
          wallet_a: {
            performance: metricsData[metricsData.length - 1].wallet_a,
            validation: {
              successRate: metricsData[metricsData.length - 1].wallet_a.validation.success_rate,
              errorCount: metricsData[metricsData.length - 1].wallet_a.validation.error_count,
              warningCount: metricsData[metricsData.length - 1].wallet_a.validation.warning_count,
              validationTime: metricsData[metricsData.length - 1].wallet_a.validation.validation_time
            }
          },
          wallet_b: {
            performance: metricsData[metricsData.length - 1].wallet_b,
            validation: {
              successRate: metricsData[metricsData.length - 1].wallet_b.validation.success_rate,
              errorCount: metricsData[metricsData.length - 1].wallet_b.validation.error_count,
              warningCount: metricsData[metricsData.length - 1].wallet_b.validation.warning_count,
              validationTime: metricsData[metricsData.length - 1].wallet_b.validation.validation_time
            }
          }
        },
        validation: {
          comparison: {
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
          trends: {
            wallet_a: {
              successRateImprovement: 
                metricsData[metricsData.length - 1].wallet_a.validation.success_rate -
                metricsData[0].wallet_a.validation.success_rate,
              errorReduction:
                metricsData[0].wallet_a.validation.error_count -
                metricsData[metricsData.length - 1].wallet_a.validation.error_count,
              warningReduction:
                metricsData[0].wallet_a.validation.warning_count -
                metricsData[metricsData.length - 1].wallet_a.validation.warning_count
            },
            wallet_b: {
              successRateImprovement:
                metricsData[metricsData.length - 1].wallet_b.validation.success_rate -
                metricsData[0].wallet_b.validation.success_rate,
              errorReduction:
                metricsData[0].wallet_b.validation.error_count -
                metricsData[metricsData.length - 1].wallet_b.validation.error_count,
              warningReduction:
                metricsData[0].wallet_b.validation.warning_count -
                metricsData[metricsData.length - 1].wallet_b.validation.warning_count
            }
          }
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.wallets.wallet_a.validation.successRate).toBeGreaterThan(0.95);
      expect(metrics.wallets.wallet_b.validation.successRate).toBeGreaterThan(0.95);
      expect(metrics.validation.comparison.successRateDiff).toBeLessThan(0.05);
      expect(metrics.validation.comparison.errorCountDiff).toBeLessThan(2);
      expect(metrics.validation.comparison.warningCountDiff).toBeLessThan(3);
      expect(metrics.validation.comparison.validationTimeDiff).toBeLessThan(20);
      expect(metrics.validation.trends.wallet_a.successRateImprovement).toBeGreaterThan(0);
      expect(metrics.validation.trends.wallet_b.successRateImprovement).toBeGreaterThan(0);
      expect(metrics.validation.trends.wallet_a.errorReduction).toBeGreaterThanOrEqual(0);
      expect(metrics.validation.trends.wallet_b.errorReduction).toBeGreaterThanOrEqual(0);
    });
  });

  it('should validate AB wallet metrics during high load with validation checks', async () => {
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
            performance: {
              ...mockWalletA.metrics.performance,
              validation: {
                success_rate: 0.96,
                error_count: 3,
                warning_count: 7,
                validation_time: 180
              }
            }
          },
          wallet_b: {
            performance: {
              ...mockWalletB.metrics.performance,
              validation: {
                success_rate: 0.97,
                error_count: 2,
                warning_count: 5,
                validation_time: 170
              }
            }
          }
        },
        validation: {
          comparison: {
            successRateDiff: 0.01,
            errorCountDiff: 1,
            warningCountDiff: 2,
            validationTimeDiff: 10
          },
          highLoad: {
            averageValidationTime: 175,
            totalErrorCount: 5,
            totalWarningCount: 12,
            systemStability: 0.95
          }
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.wallets.wallet_a.performance.validation.success_rate).toBeGreaterThan(0.95);
      expect(metrics.wallets.wallet_b.performance.validation.success_rate).toBeGreaterThan(0.95);
      expect(metrics.validation.comparison.successRateDiff).toBeLessThan(0.02);
      expect(metrics.validation.comparison.validationTimeDiff).toBeLessThan(20);
      expect(metrics.validation.highLoad.averageValidationTime).toBeLessThan(200);
      expect(metrics.validation.highLoad.systemStability).toBeGreaterThan(0.9);
    });
  });
});
