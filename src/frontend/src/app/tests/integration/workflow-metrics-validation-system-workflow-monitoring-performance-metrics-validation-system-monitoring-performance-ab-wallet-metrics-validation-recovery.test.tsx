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

describe('Workflow Metrics Validation - AB Wallet Metrics Validation Recovery', () => {
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
          recovery: {
            mttr: 300,
            mttf: 3600,
            recovery_success_rate: 0.95,
            average_recovery_time: 250
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
          recovery: {
            mttr: 250,
            mttf: 4000,
            recovery_success_rate: 0.97,
            average_recovery_time: 200
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

  it('should validate AB wallet metrics with recovery validation during normal workflow', async () => {
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
              recovery: {
                mttr: Math.max(100, 300 - metricsData.length * 20),
                mttf: 3600 + metricsData.length * 100,
                recovery_success_rate: Math.min(1.0, 0.95 + metricsData.length * 0.01),
                average_recovery_time: Math.max(100, 250 - metricsData.length * 15)
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
              recovery: {
                mttr: Math.max(100, 250 - metricsData.length * 15),
                mttf: 4000 + metricsData.length * 100,
                recovery_success_rate: Math.min(1.0, 0.97 + metricsData.length * 0.005),
                average_recovery_time: Math.max(100, 200 - metricsData.length * 10)
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
              recovery: {
                mttr: metricsData[metricsData.length - 1].wallet_a.validation.recovery.mttr,
                mttf: metricsData[metricsData.length - 1].wallet_a.validation.recovery.mttf,
                recoverySuccessRate: metricsData[metricsData.length - 1].wallet_a.validation.recovery.recovery_success_rate,
                averageRecoveryTime: metricsData[metricsData.length - 1].wallet_a.validation.recovery.average_recovery_time
              }
            }
          },
          wallet_b: {
            validation: {
              successRate: metricsData[metricsData.length - 1].wallet_b.validation.success_rate,
              errorCount: metricsData[metricsData.length - 1].wallet_b.validation.error_count,
              warningCount: metricsData[metricsData.length - 1].wallet_b.validation.warning_count,
              validationTime: metricsData[metricsData.length - 1].wallet_b.validation.validation_time,
              recovery: {
                mttr: metricsData[metricsData.length - 1].wallet_b.validation.recovery.mttr,
                mttf: metricsData[metricsData.length - 1].wallet_b.validation.recovery.mttf,
                recoverySuccessRate: metricsData[metricsData.length - 1].wallet_b.validation.recovery.recovery_success_rate,
                averageRecoveryTime: metricsData[metricsData.length - 1].wallet_b.validation.recovery.average_recovery_time
              }
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
          recovery: {
            mttrDiff: Math.abs(
              metricsData[metricsData.length - 1].wallet_a.validation.recovery.mttr -
              metricsData[metricsData.length - 1].wallet_b.validation.recovery.mttr
            ),
            mttfDiff: Math.abs(
              metricsData[metricsData.length - 1].wallet_a.validation.recovery.mttf -
              metricsData[metricsData.length - 1].wallet_b.validation.recovery.mttf
            ),
            recoverySuccessRateDiff: Math.abs(
              metricsData[metricsData.length - 1].wallet_a.validation.recovery.recovery_success_rate -
              metricsData[metricsData.length - 1].wallet_b.validation.recovery.recovery_success_rate
            ),
            averageRecoveryTimeDiff: Math.abs(
              metricsData[metricsData.length - 1].wallet_a.validation.recovery.average_recovery_time -
              metricsData[metricsData.length - 1].wallet_b.validation.recovery.average_recovery_time
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
      expect(metrics.comparison.recovery.mttrDiff).toBeLessThan(100);
      expect(metrics.comparison.recovery.mttfDiff).toBeLessThan(1000);
      expect(metrics.comparison.recovery.recoverySuccessRateDiff).toBeLessThan(0.05);
      expect(metrics.comparison.recovery.averageRecoveryTimeDiff).toBeLessThan(100);
    });
  });

  it('should validate AB wallet metrics during error recovery with validation checks', async () => {
    await testRunner.runTest(async () => {
      const error = new Error('API Error');
      const startTime = performance.now();
      const metricsData: any[] = [];
      let retryCount = 0;

      (getBotStatus as jest.Mock)
        .mockRejectedValueOnce(error)
        .mockImplementation(() => {
          retryCount++;
          const metrics = {
            wallet_a: {
              validation: {
                success_rate: Math.min(1.0, 0.9 + retryCount * 0.02),
                error_count: Math.max(0, 5 - retryCount),
                warning_count: Math.max(0, 8 - retryCount),
                validation_time: 200 - retryCount * 10,
                recovery: {
                  mttr: Math.max(100, 400 - retryCount * 25),
                  mttf: 3000 + retryCount * 200,
                  recovery_success_rate: Math.min(1.0, 0.9 + retryCount * 0.02),
                  average_recovery_time: Math.max(100, 300 - retryCount * 20)
                }
              }
            },
            wallet_b: {
              validation: {
                success_rate: Math.min(1.0, 0.92 + retryCount * 0.02),
                error_count: Math.max(0, 4 - retryCount),
                warning_count: Math.max(0, 6 - retryCount),
                validation_time: 180 - retryCount * 8,
                recovery: {
                  mttr: Math.max(100, 350 - retryCount * 20),
                  mttf: 3200 + retryCount * 200,
                  recovery_success_rate: Math.min(1.0, 0.92 + retryCount * 0.02),
                  average_recovery_time: Math.max(100, 280 - retryCount * 15)
                }
              }
            }
          };
          metricsData.push(metrics);
          return Promise.resolve({
            id: 'bot-123',
            status: 'active',
            metrics: {
              wallet_a: metrics.wallet_a,
              wallet_b: metrics.wallet_b
            }
          });
        });

      const workflow = [
        <AgentSelection />,
        <StrategyCreation />,
        <BotIntegration />,
        <KeyManagement />,
        <TradingDashboard />,
        <WalletComparison />
      ];

      for (const component of workflow) {
        render(<TestContext>{component}</TestContext>);
        await waitFor(() => {
          expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
        });
      }

      const endTime = performance.now();
      const recoveryTime = endTime - startTime;

      const metrics = {
        wallets: {
          wallet_a: {
            validation: metricsData[metricsData.length - 1].wallet_a.validation,
            recovery: {
              initialMetrics: metricsData[0].wallet_a.validation,
              finalMetrics: metricsData[metricsData.length - 1].wallet_a.validation,
              improvement: {
                successRate: 
                  metricsData[metricsData.length - 1].wallet_a.validation.success_rate -
                  metricsData[0].wallet_a.validation.success_rate,
                errorReduction:
                  metricsData[0].wallet_a.validation.error_count -
                  metricsData[metricsData.length - 1].wallet_a.validation.error_count,
                mttrImprovement:
                  metricsData[0].wallet_a.validation.recovery.mttr -
                  metricsData[metricsData.length - 1].wallet_a.validation.recovery.mttr
              }
            }
          },
          wallet_b: {
            validation: metricsData[metricsData.length - 1].wallet_b.validation,
            recovery: {
              initialMetrics: metricsData[0].wallet_b.validation,
              finalMetrics: metricsData[metricsData.length - 1].wallet_b.validation,
              improvement: {
                successRate:
                  metricsData[metricsData.length - 1].wallet_b.validation.success_rate -
                  metricsData[0].wallet_b.validation.success_rate,
                errorReduction:
                  metricsData[0].wallet_b.validation.error_count -
                  metricsData[metricsData.length - 1].wallet_b.validation.error_count,
                mttrImprovement:
                  metricsData[0].wallet_b.validation.recovery.mttr -
                  metricsData[metricsData.length - 1].wallet_b.validation.recovery.mttr
              }
            }
          }
        },
        recovery: {
          time: recoveryTime,
          retryCount,
          metrics: {
            successRateImprovement: {
              wallet_a: metricsData[metricsData.length - 1].wallet_a.validation.success_rate -
                       metricsData[0].wallet_a.validation.success_rate,
              wallet_b: metricsData[metricsData.length - 1].wallet_b.validation.success_rate -
                       metricsData[0].wallet_b.validation.success_rate
            },
            errorReduction: {
              wallet_a: metricsData[0].wallet_a.validation.error_count -
                       metricsData[metricsData.length - 1].wallet_a.validation.error_count,
              wallet_b: metricsData[0].wallet_b.validation.error_count -
                       metricsData[metricsData.length - 1].wallet_b.validation.error_count
            },
            mttrImprovement: {
              wallet_a: metricsData[0].wallet_a.validation.recovery.mttr -
                       metricsData[metricsData.length - 1].wallet_a.validation.recovery.mttr,
              wallet_b: metricsData[0].wallet_b.validation.recovery.mttr -
                       metricsData[metricsData.length - 1].wallet_b.validation.recovery.mttr
            }
          }
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.recovery.time).toBeLessThan(2000);
      expect(metrics.recovery.retryCount).toBeGreaterThan(0);
      expect(metrics.recovery.metrics.successRateImprovement.wallet_a).toBeGreaterThan(0);
      expect(metrics.recovery.metrics.successRateImprovement.wallet_b).toBeGreaterThan(0);
      expect(metrics.recovery.metrics.errorReduction.wallet_a).toBeGreaterThan(0);
      expect(metrics.recovery.metrics.errorReduction.wallet_b).toBeGreaterThan(0);
      expect(metrics.recovery.metrics.mttrImprovement.wallet_a).toBeGreaterThan(0);
      expect(metrics.recovery.metrics.mttrImprovement.wallet_b).toBeGreaterThan(0);
    });
  });
});
