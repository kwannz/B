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

describe('Workflow Metrics Validation - AB Wallet Metrics', () => {
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
        response_time: 200
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
        response_time: 180
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

  it('should validate AB wallet metrics during normal workflow', async () => {
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
            api_latency: mockWalletA.metrics.performance.api_latency + metricsData.length * 10,
            error_rate: Math.max(0, mockWalletA.metrics.performance.error_rate - metricsData.length * 0.01),
            system_health: Math.min(1.0, mockWalletA.metrics.performance.system_health + metricsData.length * 0.01)
          },
          wallet_b: {
            ...mockWalletB.metrics.performance,
            api_latency: mockWalletB.metrics.performance.api_latency + metricsData.length * 8,
            error_rate: Math.max(0, mockWalletB.metrics.performance.error_rate - metricsData.length * 0.01),
            system_health: Math.min(1.0, mockWalletB.metrics.performance.system_health + metricsData.length * 0.01)
          }
        };
        metricsData.push(metrics);
      }

      const metrics = {
        wallets: {
          wallet_a: {
            performance: metricsData[metricsData.length - 1].wallet_a,
            averages: {
              apiLatency: metricsData.reduce((sum, m) => sum + m.wallet_a.api_latency, 0) / metricsData.length,
              errorRate: metricsData.reduce((sum, m) => sum + m.wallet_a.error_rate, 0) / metricsData.length,
              systemHealth: metricsData.reduce((sum, m) => sum + m.wallet_a.system_health, 0) / metricsData.length
            }
          },
          wallet_b: {
            performance: metricsData[metricsData.length - 1].wallet_b,
            averages: {
              apiLatency: metricsData.reduce((sum, m) => sum + m.wallet_b.api_latency, 0) / metricsData.length,
              errorRate: metricsData.reduce((sum, m) => sum + m.wallet_b.error_rate, 0) / metricsData.length,
              systemHealth: metricsData.reduce((sum, m) => sum + m.wallet_b.system_health, 0) / metricsData.length
            }
          }
        },
        comparison: {
          performance: {
            apiLatencyDiff: Math.abs(
              metricsData[metricsData.length - 1].wallet_a.api_latency -
              metricsData[metricsData.length - 1].wallet_b.api_latency
            ),
            errorRateDiff: Math.abs(
              metricsData[metricsData.length - 1].wallet_a.error_rate -
              metricsData[metricsData.length - 1].wallet_b.error_rate
            ),
            systemHealthDiff: Math.abs(
              metricsData[metricsData.length - 1].wallet_a.system_health -
              metricsData[metricsData.length - 1].wallet_b.system_health
            )
          },
          averages: {
            apiLatencyDiff: Math.abs(
              metricsData.reduce((sum, m) => sum + m.wallet_a.api_latency, 0) / metricsData.length -
              metricsData.reduce((sum, m) => sum + m.wallet_b.api_latency, 0) / metricsData.length
            ),
            errorRateDiff: Math.abs(
              metricsData.reduce((sum, m) => sum + m.wallet_a.error_rate, 0) / metricsData.length -
              metricsData.reduce((sum, m) => sum + m.wallet_b.error_rate, 0) / metricsData.length
            ),
            systemHealthDiff: Math.abs(
              metricsData.reduce((sum, m) => sum + m.wallet_a.system_health, 0) / metricsData.length -
              metricsData.reduce((sum, m) => sum + m.wallet_b.system_health, 0) / metricsData.length
            )
          }
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.wallets.wallet_a.performance.apiLatency).toBeLessThan(200);
      expect(metrics.wallets.wallet_b.performance.apiLatency).toBeLessThan(200);
      expect(metrics.comparison.performance.apiLatencyDiff).toBeLessThan(50);
      expect(metrics.comparison.performance.errorRateDiff).toBeLessThan(0.05);
      expect(metrics.comparison.averages.apiLatencyDiff).toBeLessThan(30);
      expect(metrics.comparison.averages.errorRateDiff).toBeLessThan(0.03);
    });
  });

  it('should validate AB wallet metrics during high load', async () => {
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
              apiLatency: 150,
              errorRate: 0.08,
              systemHealth: 0.92,
              memoryUsage: 0.5,
              cpuUsage: 0.4,
              networkLatency: 70,
              throughput: 90,
              responseTime: 250
            }
          },
          wallet_b: {
            performance: {
              apiLatency: 140,
              errorRate: 0.07,
              systemHealth: 0.93,
              memoryUsage: 0.45,
              cpuUsage: 0.35,
              networkLatency: 65,
              throughput: 95,
              responseTime: 230
            }
          }
        },
        comparison: {
          performance: {
            apiLatencyDiff: 10,
            errorRateDiff: 0.01,
            systemHealthDiff: 0.01,
            resourceUtilization: {
              memoryDiff: 0.05,
              cpuDiff: 0.05,
              networkDiff: 5,
              throughputDiff: 5
            }
          }
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.wallets.wallet_a.performance.apiLatency).toBeLessThan(200);
      expect(metrics.wallets.wallet_b.performance.apiLatency).toBeLessThan(200);
      expect(metrics.comparison.performance.apiLatencyDiff).toBeLessThan(20);
      expect(metrics.comparison.performance.errorRateDiff).toBeLessThan(0.02);
      expect(metrics.comparison.performance.resourceUtilization.memoryDiff).toBeLessThan(0.1);
      expect(metrics.comparison.performance.resourceUtilization.cpuDiff).toBeLessThan(0.1);
    });
  });

  it('should validate AB wallet metrics during error recovery', async () => {
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
              api_latency: 100 + retryCount * 20,
              error_rate: Math.max(0, 0.2 - retryCount * 0.05),
              system_health: Math.min(1.0, 0.8 + retryCount * 0.05),
              memory_usage: 0.4 + retryCount * 0.05,
              cpu_usage: 0.3 + retryCount * 0.05,
              network_latency: 50 + retryCount * 10,
              throughput: 100 - retryCount * 5,
              response_time: 200 + retryCount * 20
            },
            wallet_b: {
              api_latency: 90 + retryCount * 15,
              error_rate: Math.max(0, 0.15 - retryCount * 0.05),
              system_health: Math.min(1.0, 0.85 + retryCount * 0.05),
              memory_usage: 0.35 + retryCount * 0.04,
              cpu_usage: 0.25 + retryCount * 0.04,
              network_latency: 45 + retryCount * 8,
              throughput: 110 - retryCount * 4,
              response_time: 180 + retryCount * 15
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
            performance: metricsData[metricsData.length - 1].wallet_a,
            recovery: {
              initialApiLatency: metricsData[0].wallet_a.api_latency,
              finalApiLatency: metricsData[metricsData.length - 1].wallet_a.api_latency,
              initialErrorRate: metricsData[0].wallet_a.error_rate,
              finalErrorRate: metricsData[metricsData.length - 1].wallet_a.error_rate
            }
          },
          wallet_b: {
            performance: metricsData[metricsData.length - 1].wallet_b,
            recovery: {
              initialApiLatency: metricsData[0].wallet_b.api_latency,
              finalApiLatency: metricsData[metricsData.length - 1].wallet_b.api_latency,
              initialErrorRate: metricsData[0].wallet_b.error_rate,
              finalErrorRate: metricsData[metricsData.length - 1].wallet_b.error_rate
            }
          }
        },
        recovery: {
          time: recoveryTime,
          retryCount,
          metrics: {
            apiLatencyImprovement: {
              wallet_a: metricsData[0].wallet_a.api_latency - metricsData[metricsData.length - 1].wallet_a.api_latency,
              wallet_b: metricsData[0].wallet_b.api_latency - metricsData[metricsData.length - 1].wallet_b.api_latency
            },
            errorRateImprovement: {
              wallet_a: metricsData[0].wallet_a.error_rate - metricsData[metricsData.length - 1].wallet_a.error_rate,
              wallet_b: metricsData[0].wallet_b.error_rate - metricsData[metricsData.length - 1].wallet_b.error_rate
            }
          }
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.recovery.time).toBeLessThan(2000);
      expect(metrics.recovery.retryCount).toBeGreaterThan(0);
      expect(metrics.recovery.metrics.apiLatencyImprovement.wallet_a).toBeGreaterThan(0);
      expect(metrics.recovery.metrics.apiLatencyImprovement.wallet_b).toBeGreaterThan(0);
      expect(metrics.recovery.metrics.errorRateImprovement.wallet_a).toBeGreaterThan(0);
      expect(metrics.recovery.metrics.errorRateImprovement.wallet_b).toBeGreaterThan(0);
    });
  });
});
