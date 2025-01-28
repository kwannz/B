import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletStore } from '../store/useWalletStore';
import { useErrorHandler } from './useErrorHandler';

export interface AuthContextType {
  isAuthenticated: boolean;
  walletAddress: string | null;
  isConnecting: boolean;
  error: string | null;
  connectWithWallet: () => Promise<void>;
  disconnectWallet: () => void;
  checkWalletBalance: () => Promise<number>;
}

export const useAuthContext = (): AuthContextType => {
  const navigate = useNavigate();
  const { publicKey, wallet, disconnect } = useWallet();
  const { handleError } = useErrorHandler();
  
  const {
    isAuthenticated,
    walletAddress,
    isConnecting,
    error,
    connectWallet,
    disconnectWallet,
    checkWalletBalance,
  } = useWalletStore();

  const handleConnectWallet = useCallback(async () => {
    try {
      if (!publicKey || !wallet?.adapter) {
        throw new Error('Please connect your wallet first');
      }
      
      // Check minimum balance requirement
      const balance = await checkWalletBalance(publicKey.toString(), wallet.adapter);
      if (balance < 0.5) { // 0.5 SOL minimum requirement
        throw new Error('Insufficient balance. Minimum 0.5 SOL required.');
      }

      await connectWallet(publicKey.toString(), wallet.adapter);
      navigate('/dashboard');
    } catch (error) {
      handleError(error, {
        title: 'Wallet Connection Error',
        fallbackMessage: 'Failed to connect wallet',
        shouldRetry: true,
        onRetry: () => handleConnectWallet(),
      });
    }
  }, [publicKey, wallet, connectWallet, checkWalletBalance, navigate, handleError]);

  const handleDisconnectWallet = useCallback(async () => {
    try {
      await disconnect();
      disconnectWallet();
      navigate('/login');
    } catch (error) {
      handleError(error, {
        title: 'Wallet Disconnection Error',
        fallbackMessage: 'Failed to disconnect wallet',
      });
    }
  }, [disconnect, disconnectWallet, navigate, handleError]);

  return {
    isAuthenticated,
    walletAddress,
    isConnecting,
    error,
    connectWithWallet: handleConnectWallet,
    disconnectWallet: handleDisconnectWallet,
    checkWalletBalance: () => checkWalletBalance(publicKey!, wallet?.adapter!),
  };
};
