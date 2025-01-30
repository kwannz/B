'use client';

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createWallet, getWallet } from '@/app/api/client';
import { useDebugStore } from '@/app/stores/debugStore';
import { TestMetrics } from '../types/test.types';
import WalletConnect from '@/app/components/WalletConnect';
import KeyManagement from '@/app/key-management/page';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/api/client');
jest.mock('@/app/stores/debugStore');

describe('Wallet Authentication Flow', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn()
  };

  const mockWallet = {
    connected: false,
    connecting: false,
    publicKey: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
    signTransaction: jest.fn(),
    signAllTransactions: jest.fn()
  };

  const mockWalletData = {
    address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
    balance: 1.5,
    bot_id: 'bot-123'
  };

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useWallet as jest.Mock).mockReturnValue(mockWallet);
    (createWallet as jest.Mock).mockResolvedValue(mockWalletData);
    (getWallet as jest.Mock).mockResolvedValue(mockWalletData);
    (useDebugStore.getState as jest.Mock).mockReturnValue({
      metrics: {
        performance: {
          errorRate: 0,
          apiLatency: 0,
          systemHealth: 1,
          successRate: 1,
          totalTrades: 0,
          walletBalance: 0
        }
      },
      updateMetrics: jest.fn(),
      addLog: jest.fn()
    });
  });

  it('should handle wallet connection flow', async () => {
    render(
      <TestContext>
        <WalletConnect />
      </TestContext>
    );

    const connectButton = screen.getByRole('button', { name: /connect wallet/i });
    expect(connectButton).toBeInTheDocument();

    fireEvent.click(connectButton);
    expect(mockWallet.connect).toHaveBeenCalled();

    (useWallet as jest.Mock).mockReturnValue({
      ...mockWallet,
      connected: true,
      publicKey: { toString: () => mockWalletData.address }
    });

    await waitFor(() => {
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics).toHaveErrorRate(0);
      expect(metrics.performance.systemHealth).toBeGreaterThan(0.9);
    });
  });

  it('should handle wallet connection errors', async () => {
    const error = new Error('Failed to connect wallet');
    mockWallet.connect.mockRejectedValueOnce(error);

    render(
      <TestContext>
        <WalletConnect />
      </TestContext>
    );

    const connectButton = screen.getByRole('button', { name: /connect wallet/i });
    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(screen.getByText(/error.*connecting wallet/i)).toBeInTheDocument();
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics).toHaveErrorRate(0.2);
      expect(metrics.performance.systemHealth).toBeLessThan(0.9);
    });
  });

  it('should validate wallet balance requirements', async () => {
    const lowBalanceWallet = { ...mockWalletData, balance: 0.1 };
    (getWallet as jest.Mock).mockResolvedValueOnce(lowBalanceWallet);

    (useWallet as jest.Mock).mockReturnValue({
      ...mockWallet,
      connected: true,
      publicKey: { toString: () => mockWalletData.address }
    });

    render(
      <TestContext>
        <KeyManagement />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/insufficient balance/i)).toBeInTheDocument();
      expect(screen.getByText(/minimum 0.5 SOL required/i)).toBeInTheDocument();
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics).toHaveErrorRate(0.2);
      expect(metrics.performance.systemHealth).toBeLessThan(0.9);
    });
  });

  it('should handle wallet signature requests', async () => {
    const mockTransaction = { serialize: jest.fn() };
    (useWallet as jest.Mock).mockReturnValue({
      ...mockWallet,
      connected: true,
      publicKey: { toString: () => mockWalletData.address }
    });

    render(
      <TestContext>
        <KeyManagement />
      </TestContext>
    );

    const transferButton = screen.getByRole('button', { name: /transfer/i });
    fireEvent.click(transferButton);

    await waitFor(() => {
      expect(mockWallet.signTransaction).toHaveBeenCalled();
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics).toHaveErrorRate(0);
      expect(metrics.performance.systemHealth).toBeGreaterThan(0.9);
    });
  });

  it('should track wallet performance metrics', async () => {
    const highPerformanceWallet = {
      ...mockWalletData,
      performance: {
        total_trades: 100,
        success_rate: 0.95,
        profit_loss: 2.5,
        avg_trade_duration: 60,
        max_drawdown: 0.05
      }
    };

    (getWallet as jest.Mock).mockResolvedValueOnce(highPerformanceWallet);

    (useWallet as jest.Mock).mockReturnValue({
      ...mockWallet,
      connected: true,
      publicKey: { toString: () => mockWalletData.address }
    });

    render(
      <TestContext>
        <KeyManagement />
      </TestContext>
    );

    await waitFor(() => {
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics).toHaveErrorRate(0);
      expect(metrics).toHaveSuccessRate(0.95);
      expect(metrics.performance.systemHealth).toBeGreaterThan(0.9);
    });
  });
});
