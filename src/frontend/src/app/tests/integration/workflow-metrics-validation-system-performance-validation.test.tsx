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

describe('Workflow Metrics Validation - System Performance Validation', () => {
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

  it('should validate system performance metrics during high load', async () => {
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

      const components = Array(5).fill(null).map(() => (
        render(
          <TestContext>
            <TradingDashboard />
          </TestContext>
        )
      ));

      await Promise.all(components);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      await waitFor(() => {
        expect(screen.getAllByTestId('performance-metrics')).toHaveLength(5);
      });

      const metrics = {
        performance: {
          errorRate: metricsData[metricsData.length - 1].error_rate,
          apiLatency: metricsData[metricsData.length - 1].api_latency,
          systemHealth: metricsData[metricsData.length - 1].system_health,
          successRate: 1.0,
          totalTime,
          averageTime: totalTime / components.length
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.averageTime).toBeLessThan(500);
      expect(metrics.performance.apiLatency).toBeLessThan(150);
      expect(metrics.performance.systemHealth).toBeGreaterThan(0.95);
    });
  });

  it('should validate system performance metrics during workflow transitions', async () => {
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

      const workflow = [
        <AgentSelection />,
        <StrategyCreation />,
        <BotIntegration />,
        <KeyManagement />,
        <TradingDashboard />
      ];

      for (const component of workflow) {
        render(
          <TestContext>
            {component}
          </TestContext>
        );

        await waitFor(() => {
          expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
        });
      }

      const endTime = performance.now();
      const workflowTime = endTime - startTime;

      const metrics = {
        performance: {
          errorRate: metricsData[metricsData.length - 1].error_rate,
          apiLatency: metricsData[metricsData.length - 1].api_latency,
          systemHealth: metricsData[metricsData.length - 1].system_health,
          successRate: 1.0,
          workflowTime,
          averageTransitionTime: workflowTime / workflow.length
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.averageTransitionTime).toBeLessThan(400);
      expect(metrics.performance.apiLatency).toBeLessThan(200);
      expect(metrics.performance.systemHealth).toBeGreaterThan(0.9);
    });
  });

  it('should validate system performance metrics during concurrent operations', async () => {
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

      const operations = Promise.all([
        render(
          <TestContext>
            <TradingDashboard />
          </TestContext>
        ),
        render(
          <TestContext>
            <BotIntegration />
          </TestContext>
        ),
        render(
          <TestContext>
            <KeyManagement />
          </TestContext>
        )
      ]);

      await operations;

      const endTime = performance.now();
      const operationTime = endTime - startTime;

      await waitFor(() => {
        expect(screen.getAllByTestId('performance-metrics')).toHaveLength(3);
      });

      const metrics = {
        performance: {
          errorRate: metricsData[metricsData.length - 1].error_rate,
          apiLatency: metricsData[metricsData.length - 1].api_latency,
          systemHealth: metricsData[metricsData.length - 1].system_health,
          successRate: 1.0,
          operationTime,
          concurrentOperations: 3
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.operationTime).toBeLessThan(1500);
      expect(metrics.performance.apiLatency).toBeLessThan(200);
      expect(metrics.performance.systemHealth).toBeGreaterThan(0.9);
    });
  });

  it('should validate system performance metrics during error recovery', async () => {
    await testRunner.runTest(async () => {
      const error = new Error('API Error');
      const startTime = performance.now();
      const metricsData: any[] = [];
      let retryCount = 0;

      (getBotStatus as jest.Mock)
        .mockRejectedValueOnce(error)
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
          <TradingDashboard />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const recoveryTime = endTime - startTime;

      const metrics = {
        performance: {
          errorRate: metricsData[metricsData.length - 1].error_rate,
          apiLatency: metricsData[metricsData.length - 1].api_latency,
          systemHealth: metricsData[metricsData.length - 1].system_health,
          successRate: retryCount / (retryCount + 2),
          recoveryTime,
          retryCount
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.recoveryTime).toBeLessThan(3000);
      expect(metrics.performance.apiLatency).toBeLessThan(200);
      expect(metrics.performance.systemHealth).toBeGreaterThan(0.9);
    });
  });
});
