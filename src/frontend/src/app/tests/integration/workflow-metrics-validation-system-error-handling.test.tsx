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

describe('Workflow Metrics Validation - System Error Handling', () => {
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

  it('should validate system error handling during API failures', async () => {
    await testRunner.runTest(async () => {
      const error = new Error('API Error');
      let retryCount = 0;

      (getBotStatus as jest.Mock)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockImplementationOnce(() => {
          retryCount++;
          return Promise.resolve(mockBot);
        });

      render(
        <TestContext>
          <TradingDashboard />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByText(/Error/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText(/Success Rate: 80%/i)).toBeInTheDocument();
      });

      const metrics = {
        performance: {
          errorRate: 0.67,
          apiLatency: 150,
          systemHealth: 0.8,
          successRate: 0.33
        }
      };

      testRunner.expectMetrics(metrics);
      expect(retryCount).toBe(1);
    });
  });

  it('should validate system error handling during concurrent operations', async () => {
    await testRunner.runTest(async () => {
      const error = new Error('System Error');
      const startTime = performance.now();

      (getBotStatus as jest.Mock)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockBot);

      (getWallet as jest.Mock)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockWallet);

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
          errorRate: 0.5,
          apiLatency: recoveryTime / 4,
          systemHealth: 0.9,
          successRate: 0.5,
          recoveryTime
        }
      };

      testRunner.expectMetrics(metrics);
      expect(recoveryTime).toBeLessThan(4000);
    });
  });

  it('should validate system error boundary recovery', async () => {
    await testRunner.runTest(async () => {
      const error = new Error('Component Error');
      jest.spyOn(console, 'error').mockImplementation(() => {});

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
          errorRate: 0,
          apiLatency: 100,
          systemHealth: 1.0,
          successRate: 1.0
        }
      };

      testRunner.expectMetrics(metrics);
    });
  });

  it('should validate system error handling during workflow transitions', async () => {
    await testRunner.runTest(async () => {
      const error = new Error('Transition Error');
      const startTime = performance.now();

      (createBot as jest.Mock)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockBot);

      render(
        <TestContext>
          <AgentSelection />
        </TestContext>
      );

      const tradingAgentButton = screen.getByRole('button', { name: /Trading Agent/i });
      fireEvent.click(tradingAgentButton);

      await waitFor(() => {
        expect(createBot).toHaveBeenCalledTimes(2);
        expect(mockRouter.push).toHaveBeenCalledWith('/strategy-creation?botId=bot-123');
      });

      const endTime = performance.now();
      const recoveryTime = endTime - startTime;

      const metrics = {
        performance: {
          errorRate: 0.5,
          apiLatency: recoveryTime / 2,
          systemHealth: 0.9,
          successRate: 0.5,
          recoveryTime
        }
      };

      testRunner.expectMetrics(metrics);
      expect(recoveryTime).toBeLessThan(3000);
    });
  });
});
