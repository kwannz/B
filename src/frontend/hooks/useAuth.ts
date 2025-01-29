import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet, useAddress, useConnectionStatus } from "@thirdweb-dev/react";
import { useErrorHandler } from './useErrorHandler';
import { useBalance, useDisconnect } from '@thirdweb-dev/react';

export interface AuthContextType {
  isAuthenticated: boolean;
  walletAddress: string | undefined;
  isConnecting: boolean;
  error: string | null;
  connectWithWallet: () => Promise<void>;
  disconnectWallet: () => void;
  checkWalletBalance: () => number;
}

export const useAuthContext = (): AuthContextType => {
  const navigate = useNavigate();
  const address = useAddress();
  const wallet = useWallet();
  const { handleError } = useErrorHandler();
  
  const { data: balanceData } = useBalance();
  const disconnect = useDisconnect();

  const handleConnectWallet = useCallback(async () => {
    try {
      if (!address || !wallet) {
        throw new Error('Please connect your wallet first');
      }
      
      // Check minimum balance requirement
      const balanceInSOL = balanceData ? parseFloat(balanceData.displayValue) : 0;
      if (balanceInSOL < 0.5) {
        throw new Error('Insufficient balance. Minimum 0.5 SOL required.');
      }

      navigate('/dashboard');
    } catch (error) {
      handleError(error, {
        title: 'Wallet Connection Error',
        fallbackMessage: 'Failed to connect wallet'
      });
    }
  }, [address, wallet, balanceData, navigate, handleError]);

  const handleDisconnectWallet = useCallback(async () => {
    try {
      await disconnect();
      navigate('/login');
    } catch (error) {
      handleError(error, {
        title: 'Wallet Disconnection Error',
        fallbackMessage: 'Failed to disconnect wallet',
      });
    }
  }, [disconnect, navigate, handleError]);

  const [error, setError] = useState<string | null>(null);
  const connectionStatus = useConnectionStatus();
  const isConnecting = connectionStatus === "connecting";
  const isAuthenticated = !!address;

  return {
    isAuthenticated,
    walletAddress: address,
    isConnecting,
    error,
    connectWithWallet: handleConnectWallet,
    disconnectWallet: handleDisconnectWallet,
    checkWalletBalance: () => balanceData ? parseFloat(balanceData.displayValue) : 0,
  };
};
