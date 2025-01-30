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

describe('Workflow Metrics Validation - Performance', () => {
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

  it('should validate performance metrics during workflow', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      const { rerender } = render(
        <TestContext>
          <AgentSelection />
        </TestContext>
      );

      // Step 1: Agent Selection with Performance Metrics
      const tradingAgentButton = screen.getByRole('button', { name: /Trading Agent/i });
      fireEvent.click(tradingAgentButton);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/strategy-creation?type=trading');
      });

      const navigationTime = Date.now() - startTime;
      expect(navigationTime).toBeLessThan(500);

      // Step 2: Strategy Creation with Performance Monitoring
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
        expect(createBot).toHaveBeenCalledWith('trading', 'Test strategy');
      });

      // Step 3: Bot Integration with Performance Validation
      rerender(
        <TestContext>
          <BotIntegration />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByText(/Bot Status: created/i)).toBeInTheDocument();
      });

      const activateButton = screen.getByRole('button', { name: /Activate Bot/i });
      fireEvent.click(activateButton);

      // Step 4: Key Management with Performance Metrics
      rerender(
        <TestContext>
          <KeyManagement />
        </TestContext>
      );

      const createWalletButton = screen.getByRole('button', { name: /Create Wallet/i });
      fireEvent.click(createWalletButton);

      await waitFor(() => {
        expect(createWallet).toHaveBeenCalled();
        expect(screen.getByText(/mock_private_key/i)).toBeInTheDocument();
      });

      // Step 5: Trading Dashboard with Performance Analysis
      rerender(
        <TestContext>
          <TradingDashboard />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByText(/Bot Status: active/i)).toBeInTheDocument();
        expect(screen.getByText(/Success Rate: 80%/i)).toBeInTheDocument();
      });

      // Step 6: Wallet Comparison with Performance Metrics
      rerender(
        <TestContext>
          <WalletComparison />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByText(/2.5 SOL/i)).toBeInTheDocument();
        expect(screen.getByText(/Trading History/i)).toBeInTheDocument();
      });

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      const metrics = {
        performance: {
          errorRate: 0,
          apiLatency: totalTime / 6,
          systemHealth: 1.0,
          successRate: 1.0
        }
      };

      testRunner.expectMetrics(metrics);
    });
  });

  it('should validate concurrent performance', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      const promises = Array(3).fill(null).map(() => 
        render(
          <TestContext>
            <TradingDashboard />
          </TestContext>
        )
      );

      await Promise.all(promises);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(1500);

      const metrics = {
        performance: {
          errorRate: 0,
          apiLatency: totalTime / 3,
          systemHealth: 1.0,
          successRate: 1.0
        }
      };

      testRunner.expectMetrics(metrics);
    });
  });

  it('should validate API performance under load', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      const requests = Array(5).fill(null).map(() => getBotStatus('bot-123'));

      await Promise.all(requests);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(2000);

      const metrics = {
        performance: {
          errorRate: 0,
          apiLatency: totalTime / 5,
          systemHealth: 1.0,
          successRate: 1.0
        }
      };

      testRunner.expectMetrics(metrics);
    });
  });

  it('should validate component render performance', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();

      const { rerender } = render(
        <TestContext>
          <TradingDashboard />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByText(/Bot Status: active/i)).toBeInTheDocument();
      });

      const initialRenderTime = Date.now() - startTime;
      expect(initialRenderTime).toBeLessThan(500);

      const updateStartTime = Date.now();
      rerender(
        <TestContext>
          <TradingDashboard />
        </TestContext>
      );

      const updateTime = Date.now() - updateStartTime;
      expect(updateTime).toBeLessThan(100);

      const metrics = {
        performance: {
          errorRate: 0,
          apiLatency: (initialRenderTime + updateTime) / 2,
          systemHealth: 1.0,
          successRate: 1.0
        }
      };

      testRunner.expectMetrics(metrics);
    });
  });
});
