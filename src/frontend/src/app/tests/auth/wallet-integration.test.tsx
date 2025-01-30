'use client';

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { useWalletAuth } from '@/app/hooks/useWalletAuth';
import { WalletProvider } from '@/app/providers/WalletProvider';
import { useDebugStore } from '@/app/stores/debugStore';
import { TestMetrics } from '../types/test.types';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/hooks/useWalletAuth');
jest.mock('@/app/stores/debugStore');

describe('Wallet Integration', () => {
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

  const mockWalletAuth = {
    isAuthenticated: false,
    login: jest.fn(),
    logout: jest.fn(),
    error: null
  };

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useWallet as jest.Mock).mockReturnValue(mockWallet);
    (useWalletAuth as jest.Mock).mockReturnValue(mockWalletAuth);
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

  it('should track wallet connection metrics', async () => {
    render(
      <TestContext>
        <WalletProvider>
          <div>Wallet Test</div>
        </WalletProvider>
      </TestContext>
    );

    const connectButton = screen.getByRole('button', { name: /connect/i });
    fireEvent.click(connectButton);

    const metrics = useDebugStore.getState().metrics as TestMetrics;
    expect(metrics).toHaveErrorRate(0);
    expect(metrics).toHaveLatency(100);
    expect(metrics.performance.systemHealth).toBeGreaterThan(0.9);
  });

  it('should handle wallet connection errors with metrics', async () => {
    mockWallet.connect.mockRejectedValueOnce(new Error('Connection failed'));

    render(
      <TestContext>
        <WalletProvider>
          <div>Wallet Test</div>
        </WalletProvider>
      </TestContext>
    );

    const connectButton = screen.getByRole('button', { name: /connect/i });
    fireEvent.click(connectButton);

    await waitFor(() => {
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics).toHaveErrorRate(0.2);
      expect(metrics.performance.systemHealth).toBeLessThan(0.9);
    });
  });

  it('should validate wallet balance requirements with metrics', async () => {
    (useWallet as jest.Mock).mockReturnValue({
      ...mockWallet,
      connected: true,
      publicKey: { toString: () => '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK' }
    });

    (useWalletAuth as jest.Mock).mockReturnValue({
      ...mockWalletAuth,
      error: 'Insufficient balance'
    });

    render(
      <TestContext>
        <WalletProvider>
          <div>Wallet Test</div>
        </WalletProvider>
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/insufficient balance/i)).toBeInTheDocument();
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics.performance.systemHealth).toBeLessThan(0.9);
    });
  });

  it('should track successful wallet operations', async () => {
    (useWallet as jest.Mock).mockReturnValue({
      ...mockWallet,
      connected: true,
      publicKey: { toString: () => '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK' }
    });

    (useWalletAuth as jest.Mock).mockReturnValue({
      ...mockWalletAuth,
      isAuthenticated: true
    });

    render(
      <TestContext>
        <WalletProvider>
          <div>Wallet Test</div>
        </WalletProvider>
      </TestContext>
    );

    await waitFor(() => {
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics).toHaveErrorRate(0);
      expect(metrics).toHaveLatency(100);
      expect(metrics.performance.systemHealth).toBeGreaterThan(0.9);
    });
  });

  it('should handle wallet signature requests with metrics', async () => {
    const mockSignature = new Uint8Array([1, 2, 3, 4]);
    mockWallet.signTransaction.mockResolvedValueOnce(mockSignature);

    (useWallet as jest.Mock).mockReturnValue({
      ...mockWallet,
      connected: true,
      publicKey: { toString: () => '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK' }
    });

    render(
      <TestContext>
        <WalletProvider>
          <div>Wallet Test</div>
        </WalletProvider>
      </TestContext>
    );

    const signButton = screen.getByRole('button', { name: /sign/i });
    fireEvent.click(signButton);

    await waitFor(() => {
      expect(mockWallet.signTransaction).toHaveBeenCalled();
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics).toHaveErrorRate(0);
      expect(metrics.performance.systemHealth).toBeGreaterThan(0.9);
    });
  });
});
