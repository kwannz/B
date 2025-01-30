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

describe('Workflow Metrics Validation - AB Wallet Testing', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  };

  const mockWalletA = {
    address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
    private_key: 'mock_private_key_a',
    balance: 2.5,
    transactions: [
      { type: 'trade', amount: 0.1, timestamp: Date.now() }
    ]
  };

  const mockWalletB = {
    address: '7MmPwD5TQzXBtKnLGNEHzLHuPsE8kw9aNgvhYxM3yxVJ',
    private_key: 'mock_private_key_b',
    balance: 3.0,
    transactions: [
      { type: 'trade', amount: 0.2, timestamp: Date.now() }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (createBot as jest.Mock).mockResolvedValue({ id: 'bot-123', status: 'created' });
    (createWallet as jest.Mock)
      .mockResolvedValueOnce(mockWalletA)
      .mockResolvedValueOnce(mockWalletB);
    (getBotStatus as jest.Mock).mockResolvedValue({
      id: 'bot-123',
      status: 'active',
      metrics: {
        trades: 10,
        success_rate: 0.8,
        profit_loss: 0.15
      }
    });
    (getWallet as jest.Mock)
      .mockResolvedValueOnce(mockWalletA)
      .mockResolvedValueOnce(mockWalletB);
  });

  it('should validate AB wallet comparison workflow', async () => {
    await testRunner.runTest(async () => {
      const { rerender } = render(
        <TestContext>
          <WalletComparison />
        </TestContext>
      );

      // Create first wallet
      const createWalletButton = screen.getByRole('button', { name: /Create Wallet A/i });
      fireEvent.click(createWalletButton);

      await waitFor(() => {
        expect(screen.getByText(mockWalletA.address)).toBeInTheDocument();
        expect(screen.getByText(/2.5 SOL/i)).toBeInTheDocument();
      });

      // Create second wallet
      const createWalletBButton = screen.getByRole('button', { name: /Create Wallet B/i });
      fireEvent.click(createWalletBButton);

      await waitFor(() => {
        expect(screen.getByText(mockWalletB.address)).toBeInTheDocument();
        expect(screen.getByText(/3.0 SOL/i)).toBeInTheDocument();
      });

      // Compare wallet performance
      const performanceMetrics = screen.getAllByTestId('performance-metric');
      expect(performanceMetrics).toHaveLength(6);

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

  it('should validate wallet performance metrics', async () => {
    await testRunner.runTest(async () => {
      render(
        <TestContext>
          <WalletComparison />
        </TestContext>
      );

      // Create both wallets
      const createWalletAButton = screen.getByRole('button', { name: /Create Wallet A/i });
      fireEvent.click(createWalletAButton);

      const createWalletBButton = screen.getByRole('button', { name: /Create Wallet B/i });
      fireEvent.click(createWalletBButton);

      await waitFor(() => {
        const walletAMetrics = screen.getByTestId('wallet-a-metrics');
        const walletBMetrics = screen.getByTestId('wallet-b-metrics');

        expect(walletAMetrics).toHaveTextContent(/Success Rate: 80%/i);
        expect(walletBMetrics).toHaveTextContent(/Success Rate: 85%/i);
      });

      const metrics = {
        performance: {
          errorRate: 0,
          apiLatency: 150,
          systemHealth: 1.0,
          successRate: 1.0
        }
      };

      testRunner.expectMetrics(metrics);
    });
  });

  it('should validate wallet transaction history', async () => {
    await testRunner.runTest(async () => {
      render(
        <TestContext>
          <WalletComparison />
        </TestContext>
      );

      // Create both wallets
      const createWalletAButton = screen.getByRole('button', { name: /Create Wallet A/i });
      fireEvent.click(createWalletAButton);

      const createWalletBButton = screen.getByRole('button', { name: /Create Wallet B/i });
      fireEvent.click(createWalletBButton);

      await waitFor(() => {
        const walletAHistory = screen.getByTestId('wallet-a-history');
        const walletBHistory = screen.getByTestId('wallet-b-history');

        expect(walletAHistory).toHaveTextContent(/0.1 SOL/i);
        expect(walletBHistory).toHaveTextContent(/0.2 SOL/i);
      });

      const metrics = {
        performance: {
          errorRate: 0,
          apiLatency: 120,
          systemHealth: 1.0,
          successRate: 1.0
        }
      };

      testRunner.expectMetrics(metrics);
    });
  });

  it('should validate wallet comparison metrics calculation', async () => {
    await testRunner.runTest(async () => {
      render(
        <TestContext>
          <WalletComparison />
        </TestContext>
      );

      // Create both wallets
      const createWalletAButton = screen.getByRole('button', { name: /Create Wallet A/i });
      fireEvent.click(createWalletAButton);

      const createWalletBButton = screen.getByRole('button', { name: /Create Wallet B/i });
      fireEvent.click(createWalletBButton);

      await waitFor(() => {
        const comparisonMetrics = screen.getByTestId('wallet-comparison-metrics');
        expect(comparisonMetrics).toHaveTextContent(/Performance Difference: \+20%/i);
      });

      const metrics = {
        performance: {
          errorRate: 0,
          apiLatency: 130,
          systemHealth: 1.0,
          successRate: 1.0
        }
      };

      testRunner.expectMetrics(metrics);
    });
  });
});
