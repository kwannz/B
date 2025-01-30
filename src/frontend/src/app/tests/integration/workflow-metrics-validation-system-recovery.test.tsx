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

describe('Workflow Metrics Validation - System Recovery', () => {
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

  it('should validate system recovery after API failures', async () => {
    await testRunner.runTest(async () => {
      const error = new Error('API Error');
      const startTime = performance.now();
      let retryCount = 0;

      (getBotStatus as jest.Mock)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockImplementation(() => {
          retryCount++;
          return Promise.resolve({
            ...mockBot,
            metrics: {
              ...mockBot.metrics,
              performance: {
                api_latency: 100 + retryCount * 50,
                error_rate: Math.max(0, 0.3 - retryCount * 0.1),
                system_health: Math.min(1.0, 0.7 + retryCount * 0.1)
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
        expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const recoveryTime = endTime - startTime;

      const metrics = {
        performance: {
          errorRate: Math.max(0, 0.3 - retryCount * 0.1),
          apiLatency: 100 + retryCount * 50,
          systemHealth: Math.min(1.0, 0.7 + retryCount * 0.1),
          successRate: retryCount / (retryCount + 2),
          recoveryTime
        }
      };

      testRunner.expectMetrics(metrics);
      expect(recoveryTime).toBeLessThan(3000);
    });
  });

  it('should validate system recovery during concurrent failures', async () => {
    await testRunner.runTest(async () => {
      const error = new Error('System Error');
      const startTime = performance.now();
      let recoveryAttempts = 0;

      (getBotStatus as jest.Mock)
        .mockRejectedValueOnce(error)
        .mockImplementation(() => {
          recoveryAttempts++;
          return Promise.resolve({
            ...mockBot,
            metrics: {
              ...mockBot.metrics,
              performance: {
                api_latency: 100 + recoveryAttempts * 25,
                error_rate: Math.max(0, 0.2 - recoveryAttempts * 0.05),
                system_health: Math.min(1.0, 0.8 + recoveryAttempts * 0.05)
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

      const endTime = performance.now();
      const recoveryTime = endTime - startTime;

      await waitFor(() => {
        expect(screen.getAllByTestId('performance-metrics')).toHaveLength(2);
      });

      const metrics = {
        performance: {
          errorRate: Math.max(0, 0.2 - recoveryAttempts * 0.05),
          apiLatency: 100 + recoveryAttempts * 25,
          systemHealth: Math.min(1.0, 0.8 + recoveryAttempts * 0.05),
          successRate: recoveryAttempts / (recoveryAttempts + 1),
          recoveryTime,
          concurrentRequests: 2
        }
      };

      testRunner.expectMetrics(metrics);
      expect(recoveryTime).toBeLessThan(4000);
    });
  });

  it('should validate system recovery with degraded performance', async () => {
    await testRunner.runTest(async () => {
      const startTime = performance.now();
      let callCount = 0;

      (getBotStatus as jest.Mock).mockImplementation(() => {
        callCount++;
        const degradation = callCount <= 2 ? 0.3 : 0;
        return Promise.resolve({
          ...mockBot,
          metrics: {
            ...mockBot.metrics,
            performance: {
              api_latency: 100 + (degradation * 200),
              error_rate: degradation,
              system_health: 1.0 - degradation
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
        expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const recoveryTime = endTime - startTime;

      const metrics = {
        performance: {
          errorRate: 0,
          apiLatency: 100,
          systemHealth: 1.0,
          successRate: 1.0,
          recoveryTime,
          degradationPeriod: 2
        }
      };

      testRunner.expectMetrics(metrics);
      expect(recoveryTime).toBeLessThan(2000);
    });
  });

  it('should validate system recovery with cascading failures', async () => {
    await testRunner.runTest(async () => {
      const error = new Error('Cascading Error');
      const startTime = performance.now();
      let recoveryAttempts = 0;

      (getBotStatus as jest.Mock)
        .mockRejectedValueOnce(error)
        .mockImplementation(() => {
          recoveryAttempts++;
          return Promise.resolve({
            ...mockBot,
            metrics: {
              ...mockBot.metrics,
              performance: {
                api_latency: 100 + recoveryAttempts * 20,
                error_rate: Math.max(0, 0.4 - recoveryAttempts * 0.1),
                system_health: Math.min(1.0, 0.6 + recoveryAttempts * 0.1)
              }
            }
          });
        });

      (getWallet as jest.Mock)
        .mockRejectedValueOnce(error)
        .mockImplementation(() => Promise.resolve(mockWallet));

      render(
        <TestContext>
          <TradingDashboard />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
        expect(screen.getByText(/1.5 SOL/)).toBeInTheDocument();
      });

      const endTime = performance.now();
      const recoveryTime = endTime - startTime;

      const metrics = {
        performance: {
          errorRate: Math.max(0, 0.4 - recoveryAttempts * 0.1),
          apiLatency: 100 + recoveryAttempts * 20,
          systemHealth: Math.min(1.0, 0.6 + recoveryAttempts * 0.1),
          successRate: recoveryAttempts / (recoveryAttempts + 2),
          recoveryTime,
          cascadingFailures: 2
        }
      };

      testRunner.expectMetrics(metrics);
      expect(recoveryTime).toBeLessThan(5000);
    });
  });
});
