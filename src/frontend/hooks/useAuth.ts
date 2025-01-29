import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet, useAddress } from "@thirdweb-dev/react";
import { useWalletStore } from '../store/useWalletStore';
import { useErrorHandler } from './useErrorHandler';
import { type SmartWallet } from '@thirdweb-dev/react';

interface ErrorOptions {
  title: string;
  fallbackMessage: string;
}

import type { TokenBalance } from '../types/wallet';

export interface AuthContextType {
  isAuthenticated: boolean;
  walletAddress: string | null;
  isConnecting: boolean;
  error: string | null;
  connectWithWallet: () => Promise<void>;
  disconnectWallet: () => void;
  checkWalletBalance: () => Promise<TokenBalance>;
}

interface WalletAdapterType {
  adapter?: SmartWallet;
}

export const useAuthContext = (): AuthContextType => {
  const navigate = useNavigate();
  const address = useAddress();
  const wallet = useWallet();
  const { handleError } = useErrorHandler();
  
  const {
    isAuthenticated,
    walletAddress,
    isConnecting,
    error,
    connectWallet,
    disconnectWallet,
    checkWalletBalance,
  } = useWalletStore((state) => ({
    isAuthenticated: state.isAuthenticated,
    walletAddress: state.walletAddress,
    isConnecting: state.isConnecting,
    error: state.error,
    connectWallet: state.connectWallet,
    disconnectWallet: state.disconnectWallet,
    checkWalletBalance: state.checkWalletBalance,
  }));

  const handleConnectWallet = useCallback(async () => {
    try {
      if (!address || !wallet) {
        throw new Error('Please connect your wallet first');
      }

      const walletAdapter = wallet as unknown as SmartWallet;
      
      // Check minimum balance requirement
      const balance = await checkWalletBalance(address, walletAdapter);
      const balanceInSOL = Number(balance.displayValue);
      if (balanceInSOL < 0.5) { // 0.5 SOL minimum requirement
        throw new Error('Insufficient balance. Minimum 0.5 SOL required.');
      }

      await connectWallet(address, walletAdapter);
      navigate('/dashboard');
    } catch (error) {
      handleError(error, {
        title: 'Wallet Connection Error',
        fallbackMessage: 'Failed to connect wallet'
      });
    }
  }, [address, wallet, connectWallet, checkWalletBalance, navigate, handleError]);

  const handleDisconnectWallet = useCallback(async () => {
    try {
      if (wallet) {
        await wallet.disconnect?.();
      }
      disconnectWallet();
      navigate('/login');
    } catch (error) {
      handleError(error, {
        title: 'Wallet Disconnection Error',
        fallbackMessage: 'Failed to disconnect wallet',
      });
    }
  }, [wallet, disconnectWallet, navigate, handleError]);

  return {
    isAuthenticated,
    walletAddress,
    isConnecting,
    error,
    connectWithWallet: handleConnectWallet,
    disconnectWallet: handleDisconnectWallet,
    checkWalletBalance: async () => {
      if (!address || !wallet) {
        throw new Error('Wallet not connected');
      }
      const walletAdapter = wallet as unknown as SmartWallet;
      return checkWalletBalance(address, walletAdapter);
    },
  };
};
