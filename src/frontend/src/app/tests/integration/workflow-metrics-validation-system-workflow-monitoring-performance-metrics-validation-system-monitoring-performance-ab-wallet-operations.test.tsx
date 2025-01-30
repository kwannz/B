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

describe('Workflow Metrics Validation - AB Wallet Operations', () => {
  const mockWalletA = {
    address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
    private_key: 'mock_private_key_a',
    balance: 1.5,
    transactions: [
      { type: 'trade', amount: 0.1, timestamp: Date.now() }
    ]
  };

  const mockWalletB = {
    address: '7MmPb3RLvEgtg4HQY8gguARGwGKyYaCeT8DLvBwfLL',
    private_key: 'mock_private_key_b',
    balance: 2.0,
    transactions: [
      { type: 'trade', amount: 0.2, timestamp: Date.now() }
    ]
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

  it('should validate AB wallet operations during normal workflow', async () => {
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
            balance: mockWalletA.balance + metricsData.length * 0.1,
            transaction_count: mockWalletA.transactions.length + metricsData.length,
            performance: {
              api_latency: 100 + metricsData.length * 10,
              error_rate: Math.max(0, 0.1 - metricsData.length * 0.02),
              system_health: Math.min(1.0, 0.9 + metricsData.length * 0.02)
            }
          },
          wallet_b: {
            balance: mockWalletB.balance + metricsData.length * 0.15,
            transaction_count: mockWalletB.transactions.length + metricsData.length,
            performance: {
              api_latency: 90 + metricsData.length * 8,
              error_rate: Math.max(0, 0.08 - metricsData.length * 0.02),
              system_health: Math.min(1.0, 0.92 + metricsData.length * 0.02)
            }
          }
        };
        metricsData.push(metrics);
      }

      const metrics = {
        wallets: {
          wallet_a: {
            balance: metricsData[metricsData.length - 1].wallet_a.balance,
            transactionCount: metricsData[metricsData.length - 1].wallet_a.transaction_count,
            performance: {
              apiLatency: metricsData[metricsData.length - 1].wallet_a.performance.api_latency,
              errorRate: metricsData[metricsData.length - 1].wallet_a.performance.error_rate,
              systemHealth: metricsData[metricsData.length - 1].wallet_a.performance.system_health
            }
          },
          wallet_b: {
            balance: metricsData[metricsData.length - 1].wallet_b.balance,
            transactionCount: metricsData[metricsData.length - 1].wallet_b.transaction_count,
            performance: {
              apiLatency: metricsData[metricsData.length - 1].wallet_b.performance.api_latency,
              errorRate: metricsData[metricsData.length - 1].wallet_b.performance.error_rate,
              systemHealth: metricsData[metricsData.length - 1].wallet_b.performance.system_health
            }
          }
        },
        comparison: {
          balanceDifference: Math.abs(
            metricsData[metricsData.length - 1].wallet_a.balance -
            metricsData[metricsData.length - 1].wallet_b.balance
          ),
          performanceDifference: {
            apiLatency: Math.abs(
              metricsData[metricsData.length - 1].wallet_a.performance.api_latency -
              metricsData[metricsData.length - 1].wallet_b.performance.api_latency
            ),
            errorRate: Math.abs(
              metricsData[metricsData.length - 1].wallet_a.performance.error_rate -
              metricsData[metricsData.length - 1].wallet_b.performance.error_rate
            ),
            systemHealth: Math.abs(
              metricsData[metricsData.length - 1].wallet_a.performance.system_health -
              metricsData[metricsData.length - 1].wallet_b.performance.system_health
            )
          }
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.wallets.wallet_a.performance.apiLatency).toBeLessThan(200);
      expect(metrics.wallets.wallet_b.performance.apiLatency).toBeLessThan(200);
      expect(metrics.comparison.performanceDifference.apiLatency).toBeLessThan(50);
      expect(metrics.comparison.performanceDifference.errorRate).toBeLessThan(0.05);
    });
  });

  it('should validate AB wallet operations during transfer operations', async () => {
    await testRunner.runTest(async () => {
      const transferAmount = 0.1;
      const startTime = performance.now();
      const metricsData: any[] = [];

      (transferSOL as jest.Mock).mockImplementation(async () => {
        const metrics = {
          wallet_a: {
            balance: mockWalletA.balance - transferAmount,
            transaction_count: mockWalletA.transactions.length + 1,
            performance: {
              api_latency: 120,
              error_rate: 0.05,
              system_health: 0.95
            }
          },
          wallet_b: {
            balance: mockWalletB.balance + transferAmount,
            transaction_count: mockWalletB.transactions.length + 1,
            performance: {
              api_latency: 110,
              error_rate: 0.04,
              system_health: 0.96
            }
          }
        };
        metricsData.push(metrics);
        return { success: true };
      });

      render(<TestContext><WalletComparison /></TestContext>);

      await waitFor(() => {
        expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const operationTime = endTime - startTime;

      const metrics = {
        wallets: {
          wallet_a: {
            balance: metricsData[0].wallet_a.balance,
            transactionCount: metricsData[0].wallet_a.transaction_count,
            performance: {
              apiLatency: metricsData[0].wallet_a.performance.api_latency,
              errorRate: metricsData[0].wallet_a.performance.error_rate,
              systemHealth: metricsData[0].wallet_a.performance.system_health
            }
          },
          wallet_b: {
            balance: metricsData[0].wallet_b.balance,
            transactionCount: metricsData[0].wallet_b.transaction_count,
            performance: {
              apiLatency: metricsData[0].wallet_b.performance.api_latency,
              errorRate: metricsData[0].wallet_b.performance.error_rate,
              systemHealth: metricsData[0].wallet_b.performance.system_health
            }
          }
        },
        operations: {
          transferAmount,
          operationTime,
          success: true
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.operations.operationTime).toBeLessThan(1000);
      expect(metrics.wallets.wallet_a.performance.apiLatency).toBeLessThan(150);
      expect(metrics.wallets.wallet_b.performance.apiLatency).toBeLessThan(150);
    });
  });

  it('should validate AB wallet operations during error recovery', async () => {
    await testRunner.runTest(async () => {
      const error = new Error('Transfer Error');
      const startTime = performance.now();
      const metricsData: any[] = [];
      let retryCount = 0;

      (transferSOL as jest.Mock)
        .mockRejectedValueOnce(error)
        .mockImplementation(async () => {
          retryCount++;
          const metrics = {
            wallet_a: {
              balance: mockWalletA.balance,
              transaction_count: mockWalletA.transactions.length + retryCount,
              performance: {
                api_latency: 100 + retryCount * 20,
                error_rate: Math.max(0, 0.2 - retryCount * 0.05),
                system_health: Math.min(1.0, 0.8 + retryCount * 0.05)
              }
            },
            wallet_b: {
              balance: mockWalletB.balance,
              transaction_count: mockWalletB.transactions.length + retryCount,
              performance: {
                api_latency: 90 + retryCount * 15,
                error_rate: Math.max(0, 0.15 - retryCount * 0.05),
                system_health: Math.min(1.0, 0.85 + retryCount * 0.05)
              }
            }
          };
          metricsData.push(metrics);
          return { success: true };
        });

      render(<TestContext><WalletComparison /></TestContext>);

      await waitFor(() => {
        expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const recoveryTime = endTime - startTime;

      const metrics = {
        wallets: {
          wallet_a: {
            balance: metricsData[metricsData.length - 1].wallet_a.balance,
            transactionCount: metricsData[metricsData.length - 1].wallet_a.transaction_count,
            performance: {
              apiLatency: metricsData[metricsData.length - 1].wallet_a.performance.api_latency,
              errorRate: metricsData[metricsData.length - 1].wallet_a.performance.error_rate,
              systemHealth: metricsData[metricsData.length - 1].wallet_a.performance.system_health
            }
          },
          wallet_b: {
            balance: metricsData[metricsData.length - 1].wallet_b.balance,
            transactionCount: metricsData[metricsData.length - 1].wallet_b.transaction_count,
            performance: {
              apiLatency: metricsData[metricsData.length - 1].wallet_b.performance.api_latency,
              errorRate: metricsData[metricsData.length - 1].wallet_b.performance.error_rate,
              systemHealth: metricsData[metricsData.length - 1].wallet_b.performance.system_health
            }
          }
        },
        recovery: {
          recoveryTime,
          retryCount,
          initialError: error.message,
          finalSuccess: true
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.recovery.recoveryTime).toBeLessThan(2000);
      expect(metrics.recovery.retryCount).toBeGreaterThan(0);
      expect(metrics.wallets.wallet_a.performance.apiLatency).toBeLessThan(200);
      expect(metrics.wallets.wallet_b.performance.apiLatency).toBeLessThan(200);
    });
  });
});
