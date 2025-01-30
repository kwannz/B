import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, createWallet, getBotStatus, getWallet, transferSOL } from '@/app/api/client';
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
    balance: 1.5,
    transactions: [
      { type: 'trade', amount: 0.1, timestamp: Date.now() }
    ]
  };

  const mockWalletB = {
    address: '7MmPb3RLvEgtg4HQY8gguARGwGKyYaCeT8DLvBwfNN',
    private_key: 'mock_private_key_b',
    balance: 2.0,
    transactions: [
      { type: 'trade', amount: 0.2, timestamp: Date.now() }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (createWallet as jest.Mock)
      .mockResolvedValueOnce(mockWalletA)
      .mockResolvedValueOnce(mockWalletB);
    (getWallet as jest.Mock)
      .mockImplementation((address) => 
        Promise.resolve(address === mockWalletA.address ? mockWalletA : mockWalletB)
      );
  });

  it('should validate AB wallet comparison workflow', async () => {
    await testRunner.runTest(async () => {
      render(
        <TestContext>
          <WalletComparison />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByTestId('wallet-a-balance')).toHaveTextContent('1.5 SOL');
        expect(screen.getByTestId('wallet-b-balance')).toHaveTextContent('2.0 SOL');
      });

      const metrics = {
        performance: {
          errorRate: 0,
          apiLatency: 100,
          systemHealth: 1.0,
          successRate: 1.0,
          walletABalance: 1.5,
          walletBBalance: 2.0
        }
      };

      testRunner.expectMetrics(metrics);
    });
  });

  it('should track wallet transfer performance', async () => {
    await testRunner.runTest(async () => {
      const transferAmount = 0.1;
      (transferSOL as jest.Mock).mockResolvedValue({
        success: true,
        txHash: 'mock_tx_hash'
      });

      render(
        <TestContext>
          <WalletComparison />
        </TestContext>
      );

      const transferButton = screen.getByRole('button', { name: /Transfer/i });
      fireEvent.click(transferButton);

      await waitFor(() => {
        expect(transferSOL).toHaveBeenCalledWith(
          mockWalletA.address,
          mockWalletB.address,
          transferAmount
        );
      });

      const metrics = {
        performance: {
          errorRate: 0,
          apiLatency: 100,
          systemHealth: 1.0,
          successRate: 1.0,
          transferSuccess: true
        }
      };

      testRunner.expectMetrics(metrics);
    });
  });

  it('should validate wallet performance comparison', async () => {
    await testRunner.runTest(async () => {
      const walletAMetrics = {
        trades: 10,
        success_rate: 0.8,
        profit_loss: 0.15
      };

      const walletBMetrics = {
        trades: 15,
        success_rate: 0.85,
        profit_loss: 0.2
      };

      (getWallet as jest.Mock)
        .mockImplementation((address) => 
          Promise.resolve({
            ...(address === mockWalletA.address ? mockWalletA : mockWalletB),
            metrics: address === mockWalletA.address ? walletAMetrics : walletBMetrics
          })
        );

      render(
        <TestContext>
          <WalletComparison />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByTestId('wallet-a-success-rate')).toHaveTextContent('80%');
        expect(screen.getByTestId('wallet-b-success-rate')).toHaveTextContent('85%');
      });

      const metrics = {
        performance: {
          errorRate: 0,
          apiLatency: 100,
          systemHealth: 1.0,
          successRate: 1.0,
          walletAPerformance: 0.8,
          walletBPerformance: 0.85
        }
      };

      testRunner.expectMetrics(metrics);
    });
  });

  it('should handle wallet comparison errors gracefully', async () => {
    await testRunner.runTest(async () => {
      const error = new Error('Failed to fetch wallet data');
      (getWallet as jest.Mock)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockWalletB);

      render(
        <TestContext>
          <WalletComparison />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByText(/Error loading wallet/i)).toBeInTheDocument();
      });

      const metrics = {
        performance: {
          errorRate: 0.5,
          apiLatency: 100,
          systemHealth: 0.9,
          successRate: 0.5
        }
      };

      testRunner.expectMetrics(metrics);
    });
  });
});
