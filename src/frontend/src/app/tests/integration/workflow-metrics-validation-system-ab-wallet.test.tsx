import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, createWallet, getBotStatus, getWallet } from '@/app/api/client';
import AgentSelection from '@/app/agent-selection/page';
import StrategyCreation from '@/app/strategy-creation/page';
import BotIntegration from '@/app/bot-integration/page';
import KeyManagement from '@/app/key-management/page';
import TradingDashboard from '@/app/trading-dashboard/page';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('next/navigation');
jest.mock('@/app/api/client');

describe('Workflow Metrics Validation - System AB Wallet', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  };

  const mockBot = {
    id: 'bot-123',
    type: 'trading',
    strategy: 'Test Strategy',
    status: 'active',
    metrics: {
      trades: 10,
      success_rate: 0.8,
      profit_loss: 0.15,
      performance: {
        api_latency: 100,
        error_rate: 0,
        system_health: 1.0
      }
    }
  };

  const mockWallets = [
    {
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      private_key: 'mock_private_key_1',
      balance: 1.5,
      transactions: [
        { type: 'trade', amount: 0.1, timestamp: Date.now() }
      ]
    },
    {
      address: '7MmRFw3RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfLL',
      private_key: 'mock_private_key_2',
      balance: 2.0,
      transactions: [
        { type: 'trade', amount: 0.2, timestamp: Date.now() }
      ]
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (createBot as jest.Mock).mockResolvedValue(mockBot);
    (getBotStatus as jest.Mock).mockResolvedValue(mockBot);
    (createWallet as jest.Mock).mockImplementation((botId) => 
      Promise.resolve(mockWallets[botId === 'bot-123' ? 0 : 1]));
    (getWallet as jest.Mock).mockImplementation((botId) => 
      Promise.resolve(mockWallets[botId === 'bot-123' ? 0 : 1]));
  });

  it('should validate system metrics during AB wallet comparison', async () => {
    await testRunner.runTest(async () => {
      const startTime = performance.now();
      const metricsData: any[] = [];

      (getBotStatus as jest.Mock).mockImplementation(() => {
        const metrics = {
          api_latency: 100 + metricsData.length * 10,
          error_rate: Math.max(0, 0.05 - metricsData.length * 0.01),
          system_health: Math.min(1.0, 0.95 + metricsData.length * 0.01)
        };
        metricsData.push(metrics);
        return Promise.resolve({
          ...mockBot,
          metrics: {
            ...mockBot.metrics,
            performance: metrics
          }
        });
      });

      render(
        <TestContext>
          <WalletComparison />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const comparisonTime = endTime - startTime;

      const metrics = {
        performance: {
          errorRate: metricsData[metricsData.length - 1].error_rate,
          apiLatency: metricsData[metricsData.length - 1].api_latency,
          systemHealth: metricsData[metricsData.length - 1].system_health,
          successRate: 1.0,
          comparisonTime
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.comparisonTime).toBeLessThan(1000);
    });
  });

  it('should validate system metrics during concurrent AB wallet operations', async () => {
    await testRunner.runTest(async () => {
      const startTime = performance.now();
      const metricsData: any[] = [];

      (getBotStatus as jest.Mock).mockImplementation(() => {
        const metrics = {
          api_latency: 100 + metricsData.length * 15,
          error_rate: Math.max(0, 0.08 - metricsData.length * 0.02),
          system_health: Math.min(1.0, 0.92 + metricsData.length * 0.02)
        };
        metricsData.push(metrics);
        return Promise.resolve({
          ...mockBot,
          metrics: {
            ...mockBot.metrics,
            performance: metrics
          }
        });
      });

      const operations = Promise.all([
        render(
          <TestContext>
            <WalletComparison />
          </TestContext>
        ),
        render(
          <TestContext>
            <TradingDashboard />
          </TestContext>
        )
      ]);

      await operations;

      const endTime = performance.now();
      const operationTime = endTime - startTime;

      await waitFor(() => {
        expect(screen.getAllByTestId('performance-metrics')).toHaveLength(2);
      });

      const metrics = {
        performance: {
          errorRate: metricsData[metricsData.length - 1].error_rate,
          apiLatency: metricsData[metricsData.length - 1].api_latency,
          systemHealth: metricsData[metricsData.length - 1].system_health,
          successRate: 1.0,
          operationTime,
          concurrentOperations: 2
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.operationTime).toBeLessThan(2000);
    });
  });

  it('should validate system metrics during AB wallet performance comparison', async () => {
    await testRunner.runTest(async () => {
      const startTime = performance.now();
      const metricsData: any[] = [];

      (getBotStatus as jest.Mock).mockImplementation(() => {
        const metrics = {
          api_latency: 100 + metricsData.length * 20,
          error_rate: Math.max(0, 0.1 - metricsData.length * 0.02),
          system_health: Math.min(1.0, 0.9 + metricsData.length * 0.02)
        };
        metricsData.push(metrics);
        return Promise.resolve({
          ...mockBot,
          metrics: {
            ...mockBot.metrics,
            performance: metrics
          }
        });
      });

      render(
        <TestContext>
          <WalletComparison />
        </TestContext>
      );

      const compareButton = screen.getByRole('button', { name: /Compare Performance/i });
      fireEvent.click(compareButton);

      await waitFor(() => {
        expect(screen.getByTestId('performance-comparison')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const comparisonTime = endTime - startTime;

      const metrics = {
        performance: {
          errorRate: metricsData[metricsData.length - 1].error_rate,
          apiLatency: metricsData[metricsData.length - 1].api_latency,
          systemHealth: metricsData[metricsData.length - 1].system_health,
          successRate: 1.0,
          comparisonTime,
          walletCount: 2
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.comparisonTime).toBeLessThan(1500);
    });
  });

  it('should validate system metrics during AB wallet error recovery', async () => {
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
            api_latency: 100 + retryCount * 25,
            error_rate: Math.max(0, 0.2 - retryCount * 0.05),
            system_health: Math.min(1.0, 0.8 + retryCount * 0.05)
          };
          metricsData.push(metrics);
          return Promise.resolve({
            ...mockBot,
            metrics: {
              ...mockBot.metrics,
              performance: metrics
            }
          });
        });

      render(
        <TestContext>
          <WalletComparison />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const recoveryTime = endTime - startTime;

      const metrics = {
        performance: {
          errorRate: metricsData[metricsData.length - 1].error_rate,
          apiLatency: metricsData[metricsData.length - 1].api_latency,
          systemHealth: metricsData[metricsData.length - 1].system_health,
          successRate: retryCount / (retryCount + 1),
          recoveryTime,
          retryCount
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.recoveryTime).toBeLessThan(2000);
      expect(metrics.performance.systemHealth).toBeGreaterThan(0.9);
    });
  });
});
