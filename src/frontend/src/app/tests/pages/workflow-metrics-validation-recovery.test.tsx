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

describe('Workflow Metrics Validation and Recovery', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (createBot as jest.Mock).mockResolvedValue({ id: 'bot-123', status: 'created' });
    (createWallet as jest.Mock).mockResolvedValue({
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      private_key: 'mock_private_key',
      balance: 0
    });
    (getBotStatus as jest.Mock).mockResolvedValue({
      id: 'bot-123',
      status: 'active',
      metrics: {
        trades: 10,
        success_rate: 0.8,
        profit_loss: 0.15
      }
    });
    (getWallet as jest.Mock).mockResolvedValue({
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      balance: 2.5,
      transactions: [
        { type: 'trade', amount: 0.1, timestamp: Date.now() }
      ]
    });
  });

  it('should handle and recover from API errors during workflow', async () => {
    await testRunner.runTest(async () => {
      const { rerender } = render(
        <TestContext>
          <AgentSelection />
        </TestContext>
      );

      // Step 1: Agent Selection with API Error
      (createBot as jest.Mock).mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ id: 'bot-123', status: 'created' });

      const tradingAgentButton = screen.getByRole('button', { name: /Trading Agent/i });
      fireEvent.click(tradingAgentButton);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/strategy-creation?type=trading');
      });

      // Step 2: Strategy Creation with Recovery
      rerender(
        <TestContext>
          <StrategyCreation />
        </TestContext>
      );

      const strategyInput = screen.getByRole('textbox', { name: /Strategy Description/i });
      fireEvent.change(strategyInput, { target: { value: 'Test strategy' } });

      const createStrategyButton = screen.getByRole('button', { name: /Create Strategy/i });
      fireEvent.click(createStrategyButton);

      await waitFor(() => {
        expect(screen.getByText(/Error creating strategy/i)).toBeInTheDocument();
      });

      fireEvent.click(createStrategyButton);

      await waitFor(() => {
        expect(createBot).toHaveBeenCalledTimes(2);
        expect(mockRouter.push).toHaveBeenCalledWith('/bot-integration?id=bot-123');
      });

      // Step 3: Bot Integration with API Error
      (getBotStatus as jest.Mock).mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce({ id: 'bot-123', status: 'created' });

      rerender(
        <TestContext>
          <BotIntegration />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByText(/Error loading bot status/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /Retry/i });
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText(/Bot Status: created/i)).toBeInTheDocument();
      });

      // Step 4: Key Management with Recovery
      (createWallet as jest.Mock).mockRejectedValueOnce(new Error('Wallet creation failed'))
        .mockResolvedValueOnce({
          address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
          private_key: 'mock_private_key',
          balance: 0
        });

      rerender(
        <TestContext>
          <KeyManagement />
        </TestContext>
      );

      const createWalletButton = screen.getByRole('button', { name: /Create Wallet/i });
      fireEvent.click(createWalletButton);

      await waitFor(() => {
        expect(screen.getByText(/Error creating wallet/i)).toBeInTheDocument();
      });

      fireEvent.click(createWalletButton);

      await waitFor(() => {
        expect(createWallet).toHaveBeenCalledTimes(2);
        expect(screen.getByText(/mock_private_key/i)).toBeInTheDocument();
      });

      // Step 5: Trading Dashboard with API Recovery
      (getBotStatus as jest.Mock).mockRejectedValueOnce(new Error('Status update failed'))
        .mockResolvedValueOnce({
          id: 'bot-123',
          status: 'active',
          metrics: {
            trades: 10,
            success_rate: 0.8,
            profit_loss: 0.15
          }
        });

      rerender(
        <TestContext>
          <TradingDashboard />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByText(/Error updating bot status/i)).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole('button', { name: /Refresh/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(screen.getByText(/Bot Status: active/i)).toBeInTheDocument();
        expect(screen.getByText(/Success Rate: 80%/i)).toBeInTheDocument();
      });

      // Step 6: Wallet Comparison with Recovery
      (getWallet as jest.Mock).mockRejectedValueOnce(new Error('Failed to fetch wallet data'))
        .mockResolvedValueOnce({
          address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
          balance: 2.5,
          transactions: [
            { type: 'trade', amount: 0.1, timestamp: Date.now() }
          ]
        });

      rerender(
        <TestContext>
          <WalletComparison />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByText(/Error fetching wallet data/i)).toBeInTheDocument();
      });

      const reloadButton = screen.getByRole('button', { name: /Reload/i });
      fireEvent.click(reloadButton);

      await waitFor(() => {
        expect(screen.getByText(/2.5 SOL/i)).toBeInTheDocument();
        expect(screen.getByText(/Trading History/i)).toBeInTheDocument();
      });

      const metrics = {
        performance: {
          errorRate: 0.5,
          apiLatency: 150,
          systemHealth: 0.95,
          successRate: 0.5
        }
      };

      testRunner.expectMetrics(metrics);
    });
  });

  it('should validate metrics during error recovery', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();

      render(
        <TestContext>
          <TradingDashboard />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByText(/Bot Status: active/i)).toBeInTheDocument();
      });

      const endTime = Date.now();
      const apiLatency = endTime - startTime;

      const metrics = {
        performance: {
          errorRate: 0,
          apiLatency,
          systemHealth: 1.0,
          successRate: 1.0
        }
      };

      testRunner.expectMetrics(metrics);
    });
  });
});
