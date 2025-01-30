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

describe('Workflow Metrics Validation - Integration Testing', () => {
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
      profit_loss: 0.15
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

  it('should validate complete workflow integration', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();

      // Step 1: Agent Selection
      render(
        <TestContext>
          <AgentSelection />
        </TestContext>
      );

      const tradingAgentButton = screen.getByRole('button', { name: /Trading Agent/i });
      fireEvent.click(tradingAgentButton);

      await waitFor(() => {
        expect(createBot).toHaveBeenCalled();
        expect(mockRouter.push).toHaveBeenCalledWith('/strategy-creation?botId=bot-123');
      });

      // Step 2: Strategy Creation
      render(
        <TestContext>
          <StrategyCreation />
        </TestContext>
      );

      const strategyForm = screen.getByTestId('strategy-form');
      fireEvent.submit(strategyForm);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/bot-integration?botId=bot-123');
      });

      // Step 3: Bot Integration
      render(
        <TestContext>
          <BotIntegration />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByText(/Active/i)).toBeInTheDocument();
      });

      // Step 4: Key Management
      render(
        <TestContext>
          <KeyManagement />
        </TestContext>
      );

      const createWalletButton = screen.getByRole('button', { name: /Create Wallet/i });
      fireEvent.click(createWalletButton);

      await waitFor(() => {
        expect(screen.getByText(mockWallet.address)).toBeInTheDocument();
      });

      // Step 5: Trading Dashboard
      render(
        <TestContext>
          <TradingDashboard />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByText(/Success Rate: 80%/i)).toBeInTheDocument();
        expect(screen.getByText(/1.5 SOL/i)).toBeInTheDocument();
      });

      // Step 6: Wallet Comparison
      render(
        <TestContext>
          <WalletComparison />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByTestId('wallet-comparison-metrics')).toBeInTheDocument();
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      const metrics = {
        performance: {
          errorRate: 0,
          apiLatency: duration / 6, // Average latency per step
          systemHealth: 1.0,
          successRate: 1.0,
          totalTrades: 10,
          walletBalance: 1.5
        }
      };

      testRunner.expectMetrics(metrics);
      expect(duration).toBeLessThan(6000); // Complete workflow should finish within 6 seconds
    });
  });

  it('should validate error handling across workflow', async () => {
    await testRunner.runTest(async () => {
      const error = new Error('API Error');
      let retryCount = 0;

      (getBotStatus as jest.Mock)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockBot);

      render(
        <TestContext>
          <BotIntegration />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByText(/Error/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText(/Active/i)).toBeInTheDocument();
      });

      const metrics = {
        performance: {
          errorRate: 0.5,
          apiLatency: 150,
          systemHealth: 0.9,
          successRate: 0.5
        }
      };

      testRunner.expectMetrics(metrics);
    });
  });

  it('should validate performance metrics across workflow', async () => {
    await testRunner.runTest(async () => {
      const apiCalls: number[] = [];
      const startTime = Date.now();

      (getBotStatus as jest.Mock).mockImplementation(() => {
        const callDuration = Date.now() - startTime;
        apiCalls.push(callDuration);
        return Promise.resolve(mockBot);
      });

      render(
        <TestContext>
          <TradingDashboard />
        </TestContext>
      );

      await waitFor(() => {
        expect(apiCalls.length).toBeGreaterThan(0);
        const avgLatency = apiCalls.reduce((a, b) => a + b, 0) / apiCalls.length;
        expect(avgLatency).toBeLessThan(200);
      });

      const metrics = {
        performance: {
          errorRate: 0,
          apiLatency: Math.max(...apiCalls),
          systemHealth: 1.0,
          successRate: 1.0
        }
      };

      testRunner.expectMetrics(metrics);
    });
  });

  it('should validate component integration', async () => {
    await testRunner.runTest(async () => {
      render(
        <TestContext>
          <TradingDashboard />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByTestId('bot-status')).toBeInTheDocument();
        expect(screen.getByTestId('wallet-display')).toBeInTheDocument();
        expect(screen.getByTestId('trading-history')).toBeInTheDocument();
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
});
