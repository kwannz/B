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

describe('Workflow Metrics Validation - System Metrics', () => {
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

  it('should validate system metrics aggregation during workflow', async () => {
    await testRunner.runTest(async () => {
      const metricsData: any[] = [];
      let callCount = 0;

      (getBotStatus as jest.Mock).mockImplementation(() => {
        callCount++;
        const metrics = {
          api_latency: callCount * 50,
          error_rate: callCount > 2 ? 0 : 0.1,
          system_health: callCount > 2 ? 1.0 : 0.9
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
      expect(metricsData[0].error_rate).toBe(0.1);
      expect(metricsData[metricsData.length - 1].error_rate).toBe(0);
    });
  });

  it('should validate system metrics during concurrent operations', async () => {
    await testRunner.runTest(async () => {
      const metricsData: any[] = [];

      (getBotStatus as jest.Mock).mockImplementation(() => {
        const metrics = {
          api_latency: metricsData.length * 25,
          error_rate: metricsData.length > 2 ? 0 : 0.05,
          system_health: metricsData.length > 2 ? 1.0 : 0.95
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

      const requests = Promise.all([
        render(
          <TestContext>
            <TradingDashboard />
          </TestContext>
        ),
        render(
          <TestContext>
            <BotIntegration />
          </TestContext>
        )
      ]);

      await requests;

      await waitFor(() => {
        expect(screen.getAllByTestId('performance-metrics')).toHaveLength(2);
      });

      const metrics = {
        performance: {
          errorRate: metricsData[metricsData.length - 1].error_rate,
          apiLatency: metricsData[metricsData.length - 1].api_latency,
          systemHealth: metricsData[metricsData.length - 1].system_health,
          successRate: 1.0,
          concurrentOperations: 2
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metricsData[0].system_health).toBe(0.95);
      expect(metricsData[metricsData.length - 1].system_health).toBe(1.0);
    });
  });

  it('should validate system metrics thresholds', async () => {
    await testRunner.runTest(async () => {
      const metricsData: any[] = [];
      const thresholds = {
        maxLatency: 200,
        maxErrorRate: 0.1,
        minHealth: 0.9
      };

      (getBotStatus as jest.Mock).mockImplementation(() => {
        const metrics = {
          api_latency: 150 + Math.random() * 50,
          error_rate: Math.random() * 0.1,
          system_health: 0.9 + Math.random() * 0.1
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
        expect(metric.api_latency).toBeLessThan(thresholds.maxLatency);
        expect(metric.error_rate).toBeLessThan(thresholds.maxErrorRate);
        expect(metric.system_health).toBeGreaterThan(thresholds.minHealth);
      });
    });
  });

  it('should validate system metrics aggregation over time', async () => {
    await testRunner.runTest(async () => {
      const metricsData: any[] = [];
      const startTime = performance.now();

      (getBotStatus as jest.Mock).mockImplementation(() => {
        const elapsedTime = performance.now() - startTime;
        const metrics = {
          api_latency: Math.min(100 + elapsedTime / 10, 200),
          error_rate: Math.max(0, 0.1 - elapsedTime / 10000),
          system_health: Math.min(1.0, 0.9 + elapsedTime / 1000)
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
          successRate: 1.0,
          metricsCount: metricsData.length
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metricsData[0].system_health).toBeLessThan(metricsData[metricsData.length - 1].system_health);
      expect(metricsData[0].error_rate).toBeGreaterThan(metricsData[metricsData.length - 1].error_rate);
    });
  });
});
