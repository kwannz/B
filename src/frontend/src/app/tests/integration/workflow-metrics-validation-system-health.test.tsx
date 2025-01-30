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

describe('Workflow Metrics Validation - System Health', () => {
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

  it('should validate system health metrics during workflow execution', async () => {
    await testRunner.runTest(async () => {
      const healthMetrics: number[] = [];
      let callCount = 0;

      (getBotStatus as jest.Mock).mockImplementation(() => {
        callCount++;
        const health = callCount <= 2 ? 0.8 : 1.0;
        healthMetrics.push(health);
        return Promise.resolve({
          ...mockBot,
          metrics: {
            ...mockBot.metrics,
            performance: {
              ...mockBot.metrics.performance,
              system_health: health
            }
          }
        });
      });

      render(
        <TestContext>
          <TradingDashboard />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByTestId('system-health')).toHaveTextContent(/100%/);
      });

      const metrics = {
        performance: {
          errorRate: 0,
          apiLatency: 100,
          systemHealth: healthMetrics[healthMetrics.length - 1],
          successRate: 1.0
        }
      };

      testRunner.expectMetrics(metrics);
      expect(healthMetrics[0]).toBe(0.8);
      expect(healthMetrics[healthMetrics.length - 1]).toBe(1.0);
    });
  });

  it('should validate system health recovery after degradation', async () => {
    await testRunner.runTest(async () => {
      const healthMetrics: number[] = [];
      let callCount = 0;

      (getBotStatus as jest.Mock).mockImplementation(() => {
        callCount++;
        const health = callCount === 2 ? 0.6 : 1.0;
        healthMetrics.push(health);
        return Promise.resolve({
          ...mockBot,
          metrics: {
            ...mockBot.metrics,
            performance: {
              ...mockBot.metrics.performance,
              system_health: health
            }
          }
        });
      });

      render(
        <TestContext>
          <TradingDashboard />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByTestId('system-health')).toHaveTextContent(/60%/);
      });

      await waitFor(() => {
        expect(screen.getByTestId('system-health')).toHaveTextContent(/100%/);
      });

      const metrics = {
        performance: {
          errorRate: 0,
          apiLatency: 100,
          systemHealth: healthMetrics[healthMetrics.length - 1],
          successRate: 1.0,
          recoveryTime: expect.any(Number)
        }
      };

      testRunner.expectMetrics(metrics);
      expect(Math.min(...healthMetrics)).toBe(0.6);
      expect(healthMetrics[healthMetrics.length - 1]).toBe(1.0);
    });
  });

  it('should validate system health during concurrent operations', async () => {
    await testRunner.runTest(async () => {
      const healthMetrics: number[] = [];
      let callCount = 0;

      (getBotStatus as jest.Mock).mockImplementation(() => {
        callCount++;
        const health = callCount <= 3 ? 0.7 : 1.0;
        healthMetrics.push(health);
        return Promise.resolve({
          ...mockBot,
          metrics: {
            ...mockBot.metrics,
            performance: {
              ...mockBot.metrics.performance,
              system_health: health
            }
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
        expect(screen.getAllByTestId('system-health')).toHaveLength(2);
      });

      const metrics = {
        performance: {
          errorRate: 0,
          apiLatency: 100,
          systemHealth: healthMetrics[healthMetrics.length - 1],
          successRate: 1.0,
          concurrentOperations: 2
        }
      };

      testRunner.expectMetrics(metrics);
      expect(Math.min(...healthMetrics)).toBe(0.7);
      expect(healthMetrics[healthMetrics.length - 1]).toBe(1.0);
    });
  });

  it('should validate system health monitoring thresholds', async () => {
    await testRunner.runTest(async () => {
      const healthMetrics: number[] = [];
      let callCount = 0;

      (getBotStatus as jest.Mock).mockImplementation(() => {
        callCount++;
        const health = [0.9, 0.8, 0.7, 0.9, 1.0][callCount - 1] || 1.0;
        healthMetrics.push(health);
        return Promise.resolve({
          ...mockBot,
          metrics: {
            ...mockBot.metrics,
            performance: {
              ...mockBot.metrics.performance,
              system_health: health
            }
          }
        });
      });

      render(
        <TestContext>
          <TradingDashboard />
        </TestContext>
      );

      for (let i = 0; i < 5; i++) {
        await waitFor(() => {
          const expectedHealth = [90, 80, 70, 90, 100][i];
          expect(screen.getByTestId('system-health')).toHaveTextContent(`${expectedHealth}%`);
        });
      }

      const metrics = {
        performance: {
          errorRate: 0,
          apiLatency: 100,
          systemHealth: healthMetrics[healthMetrics.length - 1],
          successRate: 1.0,
          healthThresholdBreaches: 1
        }
      };

      testRunner.expectMetrics(metrics);
      expect(Math.min(...healthMetrics)).toBe(0.7);
      expect(healthMetrics[healthMetrics.length - 1]).toBe(1.0);
    });
  });
});
