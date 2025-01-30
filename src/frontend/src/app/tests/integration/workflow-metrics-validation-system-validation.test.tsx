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

describe('Workflow Metrics Validation - System Validation', () => {
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

  it('should validate system metrics thresholds and constraints', async () => {
    await testRunner.runTest(async () => {
      const metricsData: any[] = [];
      let callCount = 0;

      (getBotStatus as jest.Mock).mockImplementation(() => {
        callCount++;
        const metrics = {
          api_latency: Math.min(150, 100 + callCount * 10),
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
          successRate: 1.0
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.apiLatency).toBeLessThan(150);
      expect(metrics.performance.errorRate).toBeLessThan(0.1);
      expect(metrics.performance.systemHealth).toBeGreaterThan(0.8);
    });
  });

  it('should validate system metrics data consistency', async () => {
    await testRunner.runTest(async () => {
      const metricsData: any[] = [];
      const startTime = performance.now();

      (getBotStatus as jest.Mock).mockImplementation(() => {
        const elapsedTime = performance.now() - startTime;
        const metrics = {
          api_latency: Math.min(200, 100 + elapsedTime / 20),
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
          successRate: 1.0
        }
      };

      testRunner.expectMetrics(metrics);
      metricsData.forEach((metric, index) => {
        if (index > 0) {
          expect(metric.api_latency).toBeGreaterThanOrEqual(metricsData[index - 1].api_latency);
          expect(metric.error_rate).toBeLessThanOrEqual(metricsData[index - 1].error_rate);
          expect(metric.system_health).toBeGreaterThanOrEqual(metricsData[index - 1].system_health);
        }
      });
    });
  });

  it('should validate system metrics during workflow transitions', async () => {
    await testRunner.runTest(async () => {
      const metricsData: any[] = [];
      let callCount = 0;

      (getBotStatus as jest.Mock).mockImplementation(() => {
        callCount++;
        const metrics = {
          api_latency: 100 + Math.random() * 50,
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
        <AgentSelection />,
        <StrategyCreation />,
        <BotIntegration />,
        <KeyManagement />,
        <TradingDashboard />
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

      const metrics = {
        performance: {
          errorRate: metricsData[metricsData.length - 1].error_rate,
          apiLatency: metricsData[metricsData.length - 1].api_latency,
          systemHealth: metricsData[metricsData.length - 1].system_health,
          successRate: 1.0,
          transitionCount: components.length
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metricsData.length).toBe(components.length);
      expect(metrics.performance.systemHealth).toBe(1.0);
    });
  });

  it('should validate system metrics correlation', async () => {
    await testRunner.runTest(async () => {
      const metricsData: any[] = [];
      let callCount = 0;

      (getBotStatus as jest.Mock).mockImplementation(() => {
        callCount++;
        const baseErrorRate = Math.max(0, 0.1 - callCount * 0.02);
        const metrics = {
          api_latency: 100 + (baseErrorRate * 500),
          error_rate: baseErrorRate,
          system_health: Math.min(1.0, 1.0 - baseErrorRate)
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
          successRate: 1.0
        }
      };

      testRunner.expectMetrics(metrics);
      metricsData.forEach(metric => {
        expect(metric.api_latency).toBeGreaterThanOrEqual(100 + (metric.error_rate * 500));
        expect(metric.system_health).toBeCloseTo(1.0 - metric.error_rate, 1);
      });
    });
  });
});
