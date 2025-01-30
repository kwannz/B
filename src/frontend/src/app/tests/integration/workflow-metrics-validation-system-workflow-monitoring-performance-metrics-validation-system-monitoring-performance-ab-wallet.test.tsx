import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import AgentSelection from '@/app/agent-selection/page';
import StrategyCreation from '@/app/strategy-creation/page';
import BotIntegration from '@/app/bot-integration/page';
import KeyManagement from '@/app/key-management/page';
import TradingDashboard from '@/app/trading-dashboard/page';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('next/navigation');
jest.mock('@/app/api/client');

describe('Workflow Metrics Validation - System Workflow Monitoring Performance Metrics Validation System Monitoring Performance AB Wallet', () => {
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

  const mockBot = {
    id: 'bot-123',
    metrics: {
      performance: {
        monitoring: {
          alerts: 0,
          warnings: 0,
          critical_errors: 0,
          system_events: 100,
          health_checks: 50,
          uptime: 3600,
          mttr: 0,
          mttf: 3600,
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

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
    (createBot as jest.Mock).mockResolvedValue(mockBot);
    (getBotStatus as jest.Mock).mockResolvedValue(mockBot);
    (createWallet as jest.Mock)
      .mockImplementation((botId) => Promise.resolve(botId === 'bot-123' ? mockWalletA : mockWalletB));
    (getWallet as jest.Mock)
      .mockImplementation((botId) => Promise.resolve(botId === 'bot-123' ? mockWalletA : mockWalletB));
  });

  it('should validate AB wallet comparison workflow with system metrics', async () => {
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
            balance: mockWalletA.balance,
            transaction_count: mockWalletA.transactions.length,
            performance: {
              api_latency: 100 + metricsData.length * 10,
              error_rate: Math.max(0, 0.1 - metricsData.length * 0.02),
              system_health: Math.min(1.0, 0.9 + metricsData.length * 0.02)
            }
          },
          wallet_b: {
            balance: mockWalletB.balance,
            transaction_count: mockWalletB.transactions.length,
            performance: {
              api_latency: 90 + metricsData.length * 8,
              error_rate: Math.max(0, 0.08 - metricsData.length * 0.02),
              system_health: Math.min(1.0, 0.92 + metricsData.length * 0.02)
            }
          },
          system_metrics: {
            heap_used: 0.5 + metricsData.length * 0.05,
            heap_total: 0.8,
            external_memory: 0.2 + metricsData.length * 0.02,
            event_loop_lag: 10 + metricsData.length * 2,
            active_handles: 50 + metricsData.length * 5,
            active_requests: 20 + metricsData.length * 2,
            garbage_collection_count: 5 + metricsData.length,
            garbage_collection_time: 100 + metricsData.length * 10
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
        systemMetrics: {
          heapUsed: metricsData[metricsData.length - 1].system_metrics.heap_used,
          heapTotal: metricsData[metricsData.length - 1].system_metrics.heap_total,
          externalMemory: metricsData[metricsData.length - 1].system_metrics.external_memory,
          eventLoopLag: metricsData[metricsData.length - 1].system_metrics.event_loop_lag,
          activeHandles: metricsData[metricsData.length - 1].system_metrics.active_handles,
          activeRequests: metricsData[metricsData.length - 1].system_metrics.active_requests,
          garbageCollectionCount: metricsData[metricsData.length - 1].system_metrics.garbage_collection_count,
          garbageCollectionTime: metricsData[metricsData.length - 1].system_metrics.garbage_collection_time
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
      expect(metrics.wallets.wallet_a.performance.errorRate).toBeLessThan(0.1);
      expect(metrics.wallets.wallet_b.performance.errorRate).toBeLessThan(0.1);
      expect(metrics.systemMetrics.heapUsed).toBeLessThan(0.8);
      expect(metrics.systemMetrics.eventLoopLag).toBeLessThan(30);
      expect(metrics.comparison.performanceDifference.apiLatency).toBeLessThan(50);
      expect(metrics.comparison.performanceDifference.errorRate).toBeLessThan(0.05);
    });
  });

  it('should validate AB wallet comparison during high load', async () => {
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
            balance: mockWalletA.balance,
            transactionCount: mockWalletA.transactions.length,
            performance: {
              apiLatency: 150,
              errorRate: 0.05,
              systemHealth: 0.95
            }
          },
          wallet_b: {
            balance: mockWalletB.balance,
            transactionCount: mockWalletB.transactions.length,
            performance: {
              apiLatency: 140,
              errorRate: 0.04,
              systemHealth: 0.96
            }
          }
        },
        systemMetrics: {
          heapUsed: 0.7,
          heapTotal: 0.9,
          externalMemory: 0.3,
          eventLoopLag: 20,
          activeHandles: 80,
          activeRequests: 40,
          garbageCollectionCount: 10,
          garbageCollectionTime: 150
        },
        comparison: {
          balanceDifference: Math.abs(mockWalletA.balance - mockWalletB.balance),
          performanceDifference: {
            apiLatency: 10,
            errorRate: 0.01,
            systemHealth: 0.01
          }
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.wallets.wallet_a.performance.apiLatency).toBeLessThan(200);
      expect(metrics.wallets.wallet_b.performance.apiLatency).toBeLessThan(200);
      expect(metrics.systemMetrics.heapUsed).toBeLessThan(0.8);
      expect(metrics.systemMetrics.eventLoopLag).toBeLessThan(30);
      expect(metrics.comparison.performanceDifference.apiLatency).toBeLessThan(20);
      expect(metrics.comparison.performanceDifference.errorRate).toBeLessThan(0.02);
    });
  });
});
