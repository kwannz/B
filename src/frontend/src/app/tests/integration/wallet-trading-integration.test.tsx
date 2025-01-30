import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet, transferSOL } from '@/app/api/client';
import { useDebugStore } from '@/app/stores/debugStore';
import { TestMetrics } from '../types/test.types';
import KeyManagement from '@/app/key-management/page';
import TradingDashboard from '@/app/trading-dashboard/page';
import WalletComparison from '@/app/wallet-comparison/page';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/api/client');
jest.mock('@/app/stores/debugStore');

describe('Wallet and Trading Integration', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn()
  };

  const mockWallet = {
    connected: true,
    connecting: false,
    publicKey: { toString: () => '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK' },
    connect: jest.fn(),
    disconnect: jest.fn(),
    signTransaction: jest.fn(),
    signAllTransactions: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useWallet as jest.Mock).mockReturnValue(mockWallet);
    (createBot as jest.Mock).mockResolvedValue({
      id: 'bot-123',
      type: 'trading',
      strategy: 'Test Strategy'
    });
    (getBotStatus as jest.Mock).mockResolvedValue({
      id: 'bot-123',
      status: 'active',
      metrics: {
        total_volume: 1000,
        profit_loss: 0.5,
        active_positions: 2
      }
    });
    (createWallet as jest.Mock).mockResolvedValue({
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      balance: 1.5,
      bot_id: 'bot-123'
    });
    (getWallet as jest.Mock).mockResolvedValue({
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      balance: 1.5,
      bot_id: 'bot-123'
    });
    (transferSOL as jest.Mock).mockResolvedValue({
      success: true,
      txHash: '23456789abcdef'
    });
  });

  it('should validate wallet creation and trading integration', async () => {
    const startTime = Date.now();
    let currentMetrics: TestMetrics;

    // Step 1: Create and validate wallet
    const { rerender } = render(
      <TestContext>
        <KeyManagement />
      </TestContext>
    );

    const createWalletButton = screen.getByRole('button', { name: /create wallet/i });
    fireEvent.click(createWalletButton);

    await waitFor(() => {
      expect(createWallet).toHaveBeenCalled();
      expect(screen.getByText(/5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK/)).toBeInTheDocument();
    });

    // Step 2: Verify trading dashboard integration
    rerender(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(getBotStatus).toHaveBeenCalled();
      expect(screen.getByText(/total volume/i)).toBeInTheDocument();
      expect(screen.getByText(/1000/)).toBeInTheDocument();
      expect(screen.getByText(/1.5 SOL/)).toBeInTheDocument();
    });

    // Step 3: Test wallet comparison functionality
    rerender(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    await waitFor(() => {
      expect(getWallet).toHaveBeenCalled();
      expect(screen.getByText(/1.5 SOL/)).toBeInTheDocument();
    });

    currentMetrics = {
      performance: {
        errorRate: 0,
        apiLatency: Date.now() - startTime,
        systemHealth: 1,
        successRate: 1,
        totalTrades: 0,
        walletBalance: 1.5
      },
      trading: {
        totalVolume: 1000,
        profitLoss: 0.5,
        activePositions: 2
      }
    };

    expect(currentMetrics.performance.apiLatency).toBeLessThan(5000);
    expect(currentMetrics.performance.errorRate).toBe(0);
    expect(currentMetrics.trading.totalVolume).toBe(1000);
  });

  it('should handle wallet transfer operations', async () => {
    render(
      <TestContext>
        <KeyManagement />
      </TestContext>
    );

    const transferButton = screen.getByRole('button', { name: /transfer/i });
    fireEvent.click(transferButton);

    const addressInput = screen.getByRole('textbox', { name: /recipient address/i });
    const amountInput = screen.getByRole('spinbutton', { name: /amount/i });
    
    fireEvent.change(addressInput, { target: { value: '7YarSpUQYkiRfGzaRzEbqkEYP1ELXKoZKeMVhxk3YL7F' } });
    fireEvent.change(amountInput, { target: { value: '0.1' } });

    const confirmButton = screen.getByRole('button', { name: /confirm transfer/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(transferSOL).toHaveBeenCalledWith(
        'bot-123',
        '7YarSpUQYkiRfGzaRzEbqkEYP1ELXKoZKeMVhxk3YL7F',
        0.1
      );
      expect(screen.getByText(/transfer successful/i)).toBeInTheDocument();
    });
  });

  it('should validate minimum balance requirements', async () => {
    (getWallet as jest.Mock).mockResolvedValueOnce({
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      balance: 0.1,
      bot_id: 'bot-123'
    });

    render(
      <TestContext>
        <KeyManagement />
      </TestContext>
    );

    const transferButton = screen.getByRole('button', { name: /transfer/i });
    fireEvent.click(transferButton);

    const amountInput = screen.getByRole('spinbutton', { name: /amount/i });
    fireEvent.change(amountInput, { target: { value: '0.1' } });

    await waitFor(() => {
      expect(screen.getByText(/insufficient balance/i)).toBeInTheDocument();
      expect(screen.getByText(/minimum 0.5 SOL required/i)).toBeInTheDocument();
    });
  });

  it('should track wallet performance metrics', async () => {
    const startTime = Date.now();
    
    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    await waitFor(() => {
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics.performance.apiLatency).toBeLessThan(1000);
      expect(metrics.performance.errorRate).toBe(0);
      expect(metrics.performance.walletBalance).toBe(1.5);
      expect(Date.now() - startTime).toBeLessThan(2000);
    });
  });
});
