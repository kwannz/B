'use client';

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import WalletComparison from '@/app/wallet-comparison/page';
import { getWallet, listWallets } from '@/app/api/client';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/api/client');

describe('Wallet Comparison Integration', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn()
  };

  const mockWallet = {
    connected: true,
    publicKey: { toString: () => '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK' }
  };

  const mockWallets = [
    {
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      balance: 1.5,
      performance: {
        total_trades: 50,
        success_rate: 0.8,
        profit_loss: 0.5,
        avg_trade_duration: 120,
        max_drawdown: 0.1
      }
    },
    {
      address: '7MmPwD5TcJwHh5YeK8mCtNyJRmCxfCXgzMJFzEgQHHVE',
      balance: 2.0,
      performance: {
        total_trades: 75,
        success_rate: 0.85,
        profit_loss: 0.75,
        avg_trade_duration: 90,
        max_drawdown: 0.08
      }
    }
  ];

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useWallet as jest.Mock).mockReturnValue(mockWallet);
    (listWallets as jest.Mock).mockResolvedValue(mockWallets);
    (getWallet as jest.Mock).mockImplementation((address) => 
      Promise.resolve(mockWallets.find(w => w.address === address))
    );
  });

  it('should display wallet comparison metrics', async () => {
    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/Wallet Performance Comparison/i)).toBeInTheDocument();
      expect(screen.getByText(/5KKs.*fKK/)).toBeInTheDocument();
      expect(screen.getByText(/7MmP.*HVE/)).toBeInTheDocument();
    });

    for (const wallet of mockWallets) {
      await waitFor(() => {
        expect(screen.getByText(new RegExp(`${wallet.balance} SOL`))).toBeInTheDocument();
        expect(screen.getByText(new RegExp(`${wallet.performance.total_trades} trades`))).toBeInTheDocument();
        expect(screen.getByText(new RegExp(`${wallet.performance.success_rate * 100}%`))).toBeInTheDocument();
        expect(screen.getByText(new RegExp(`\\+${wallet.performance.profit_loss} SOL`))).toBeInTheDocument();
      });
    }
  });

  it('should handle wallet performance metrics sorting', async () => {
    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/Sort by/i)).toBeInTheDocument();
    });

    const sortButton = screen.getByRole('button', { name: /sort by profit/i });
    fireEvent.click(sortButton);

    await waitFor(() => {
      const profitValues = screen.getAllByText(/\+\d+\.\d+ SOL/);
      const profits = profitValues.map(el => parseFloat(el.textContent!.match(/\d+\.\d+/)![0]));
      expect(profits).toEqual([...profits].sort((a, b) => b - a));
    });
  });

  it('should handle wallet filtering by performance metrics', async () => {
    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/Filter/i)).toBeInTheDocument();
    });

    const filterInput = screen.getByLabelText(/minimum success rate/i);
    fireEvent.change(filterInput, { target: { value: '82' } });

    await waitFor(() => {
      expect(screen.queryByText(/80%/)).not.toBeInTheDocument();
      expect(screen.getByText(/85%/)).toBeInTheDocument();
    });
  });

  it('should display detailed performance metrics for selected wallet', async () => {
    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/View Details/i)[0]).toBeInTheDocument();
    });

    const detailsButton = screen.getAllByText(/View Details/i)[0];
    fireEvent.click(detailsButton);

    await waitFor(() => {
      expect(screen.getByText(/Average Trade Duration/i)).toBeInTheDocument();
      expect(screen.getByText(/Maximum Drawdown/i)).toBeInTheDocument();
      expect(screen.getByText(/120s/)).toBeInTheDocument();
      expect(screen.getByText(/10%/)).toBeInTheDocument();
    });
  });

  it('should handle API errors gracefully', async () => {
    (listWallets as jest.Mock).mockRejectedValueOnce(new Error('Failed to fetch wallets'));

    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/Error loading wallet data/i)).toBeInTheDocument();
    });
  });

  it('should update wallet metrics in real-time', async () => {
    const updatedWallet = {
      ...mockWallets[0],
      performance: {
        ...mockWallets[0].performance,
        profit_loss: 0.6,
        total_trades: 51
      }
    };

    (getWallet as jest.Mock)
      .mockResolvedValueOnce(mockWallets[0])
      .mockResolvedValueOnce(updatedWallet);

    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/\+0.5 SOL/)).toBeInTheDocument();
      expect(screen.getByText(/50 trades/)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/\+0.6 SOL/)).toBeInTheDocument();
      expect(screen.getByText(/51 trades/)).toBeInTheDocument();
    });
  });
});
