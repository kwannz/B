'use client';

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import WalletConnect from '@/app/components/WalletConnect';
import { useWalletAuth } from '@/app/hooks/useWalletAuth';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/hooks/useWalletAuth');

describe('Wallet Authentication', () => {
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

    // Simulate successful connection
    (useWallet as jest.Mock).mockReturnValue({
      ...mockWallet,
      connected: true,
      publicKey: { toString: () => '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK' }
    });

    await waitFor(() => {
      expect(screen.getByText(/5KKs.*fKK/)).toBeInTheDocument();
      expect(mockWalletAuth.login).toHaveBeenCalled();
    });
  });

  it('should handle wallet connection errors', async () => {
    const mockError = new Error('Failed to connect wallet');
    mockWallet.connect.mockRejectedValueOnce(mockError);

    render(
      <TestContext>
        <WalletConnect />
      </TestContext>
    );

    const connectButton = screen.getByRole('button', { name: /connect wallet/i });
    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to connect/i)).toBeInTheDocument();
    });
  });

  it('should handle wallet disconnection', async () => {
    (useWallet as jest.Mock).mockReturnValue({
      ...mockWallet,
      connected: true,
      publicKey: { toString: () => '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK' }
    });

    render(
      <TestContext>
        <WalletConnect />
      </TestContext>
    );

    const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
    fireEvent.click(disconnectButton);

    expect(mockWallet.disconnect).toHaveBeenCalled();
    expect(mockWalletAuth.logout).toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
    });
  });

  it('should validate minimum balance requirement', async () => {
    (useWallet as jest.Mock).mockReturnValue({
      ...mockWallet,
      connected: true,
      publicKey: { toString: () => '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK' }
    });

    (useWalletAuth as jest.Mock).mockReturnValue({
      ...mockWalletAuth,
      isAuthenticated: true,
      error: 'Insufficient balance'
    });

    render(
      <TestContext>
        <WalletConnect />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/insufficient balance/i)).toBeInTheDocument();
      expect(screen.getByText(/minimum 0.5 SOL required/i)).toBeInTheDocument();
    });
  });

  it('should persist wallet connection across page navigation', async () => {
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
        <WalletConnect />
      </TestContext>
    );

    const walletAddress = screen.getByText(/5KKs.*fKK/);
    expect(walletAddress).toBeInTheDocument();

    // Simulate page navigation
    mockRouter.push('/trading-dashboard');
    
    await waitFor(() => {
      expect(walletAddress).toBeInTheDocument();
      expect(mockWalletAuth.isAuthenticated).toBe(true);
    });
  });

  it('should handle wallet signature requests', async () => {
    const mockSignature = new Uint8Array([1, 2, 3, 4]);
    mockWallet.signTransaction.mockResolvedValueOnce(mockSignature);

    (useWallet as jest.Mock).mockReturnValue({
      ...mockWallet,
      connected: true,
      publicKey: { toString: () => '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK' }
    });

    render(
      <TestContext>
        <WalletConnect />
      </TestContext>
    );

    const signButton = screen.getByRole('button', { name: /sign/i });
    fireEvent.click(signButton);

    await waitFor(() => {
      expect(mockWallet.signTransaction).toHaveBeenCalled();
      expect(screen.getByText(/transaction signed/i)).toBeInTheDocument();
    });
  });
});
