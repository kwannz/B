import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, createWallet, getBotStatus, getWallet } from '@/app/api/client';
import AgentSelection from '@/app/agent-selection/page';
import StrategyCreation from '@/app/strategy-creation/page';
import BotIntegration from '@/app/bot-integration/page';
import KeyManagement from '@/app/key-management/page';
import TradingDashboard from '@/app/trading-dashboard/page';
import { testRunner } from '../setup/test-runner';

jest.mock('next/navigation');
jest.mock('@/app/api/client');

describe('Workflow Metrics Validation - System Metrics Aggregation', () => {
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

  const mockWallet = {
    address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
    private_key: 'mock_private_key',
    balance: 1.5,
    transactions: [
      { type: 'trade', amount: 0.1, timestamp: Date.now() }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (createBot as jest.Mock).mockResolvedValue(mockBot);
    (getBotStatus as jest.Mock).mockResolvedValue(mockBot);
    (createWallet as jest.Mock).mockResolvedValue(mockWallet);
    (getWallet as jest.Mock).mockResolvedValue(mockWallet);
  });

  it('should validate system metrics aggregation across components', async () => {
    await testRunner.runTest(async () => {
      const metricsData: any[] = [];
      let callCount = 0;

      (getBotStatus as jest.Mock).mockImplementation(() => {
        callCount++;
        const metrics = {
          api_latency: callCount * 50,
          error_rate: Math.max(0, 0.1 - callCount * 0.02),
          system_health: Math.min(1.0, 0.8 + callCount * 0.05)
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

      const components = [
        <TradingDashboard />,
        <BotIntegration />,
        <KeyManagement />
      ];

      for (const component of components) {
        render(
          <TestContext>
            {component}
          </TestContext>
        );

        await waitFor(() => {
          expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
        });
      }

      const aggregatedMetrics = {
        performance: {
          errorRate: metricsData[metricsData.length - 1].error_rate,
          apiLatency: metricsData[metricsData.length - 1].api_latency,
          systemHealth: metricsData[metricsData.length - 1].system_health,
          successRate: 1.0,
          componentCount: components.length
        }
      };

      testRunner.expectMetrics(aggregatedMetrics);
      expect(metricsData[0].system_health).toBeLessThan(metricsData[metricsData.length - 1].system_health);
      expect(metricsData[0].error_rate).toBeGreaterThan(metricsData[metricsData.length - 1].error_rate);
    });
  });

  it('should validate system metrics aggregation during workflow transitions', async () => {
    await testRunner.runTest(async () => {
      const metricsData: any[] = [];
      const startTime = performance.now();

      (getBotStatus as jest.Mock).mockImplementation(() => {
        const elapsedTime = performance.now() - startTime;
        const metrics = {
          api_latency: Math.min(150, 100 + elapsedTime / 20),
          error_rate: Math.max(0, 0.1 - elapsedTime / 2000),
          system_health: Math.min(1.0, 0.9 + elapsedTime / 2000)
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
          <AgentSelection />
        </TestContext>
      );

      const tradingAgentButton = screen.getByRole('button', { name: /Trading Agent/i });
      fireEvent.click(tradingAgentButton);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/strategy-creation?botId=bot-123');
      });

      const metrics = {
        performance: {
          errorRate: metricsData[metricsData.length - 1].error_rate,
          apiLatency: metricsData[metricsData.length - 1].api_latency,
          systemHealth: metricsData[metricsData.length - 1].system_health,
          successRate: 1.0,
          transitionCount: metricsData.length
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metricsData[0].system_health).toBeLessThan(metricsData[metricsData.length - 1].system_health);
    });
  });

  it('should validate system metrics aggregation under load', async () => {
    await testRunner.runTest(async () => {
      const metricsData: any[] = [];
      const startTime = performance.now();

      (getBotStatus as jest.Mock).mockImplementation(() => {
        const metrics = {
          api_latency: metricsData.length * 25,
          error_rate: Math.max(0, 0.1 - metricsData.length * 0.02),
          system_health: Math.min(1.0, 0.8 + metricsData.length * 0.05)
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

      const requests = Array(5).fill(null).map(() => getBotStatus('bot-123'));
      await Promise.all(requests);

      render(
        <TestContext>
          <TradingDashboard />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const metrics = {
        performance: {
          errorRate: metricsData[metricsData.length - 1].error_rate,
          apiLatency: metricsData[metricsData.length - 1].api_latency,
          systemHealth: metricsData[metricsData.length - 1].system_health,
          successRate: 1.0,
          totalDuration: endTime - startTime,
          requestCount: requests.length
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.totalDuration / requests.length).toBeLessThan(200);
    });
  });

  it('should validate system metrics aggregation with error recovery', async () => {
    await testRunner.runTest(async () => {
      const metricsData: any[] = [];
      const error = new Error('API Error');

      (getBotStatus as jest.Mock)
        .mockRejectedValueOnce(error)
        .mockImplementation(() => {
          const metrics = {
            api_latency: 100 + metricsData.length * 10,
            error_rate: Math.max(0, 0.2 - metricsData.length * 0.05),
            system_health: Math.min(1.0, 0.7 + metricsData.length * 0.1)
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
          <TradingDashboard />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
      });

      const metrics = {
        performance: {
          errorRate: metricsData[metricsData.length - 1].error_rate,
          apiLatency: metricsData[metricsData.length - 1].api_latency,
          systemHealth: metricsData[metricsData.length - 1].system_health,
          successRate: (metricsData.length - 1) / metricsData.length,
          recoveryAttempts: metricsData.length
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metricsData[0].error_rate).toBeGreaterThan(metricsData[metricsData.length - 1].error_rate);
    });
  });
});
