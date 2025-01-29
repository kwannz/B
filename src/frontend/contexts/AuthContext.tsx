import React, { createContext, useContext, ReactNode, useCallback } from 'react';
import {
  useWallet,
  useAddress,
  useBalance,
  useConnect,
  useDisconnect,
  useConnectionStatus,
  type SmartWallet,
  phantomWallet,
} from "@thirdweb-dev/react";
import { useErrorHandler } from '../hooks/useErrorHandler';
import { usePersistentStorage } from '../hooks/usePersistentStorage';

interface AuthContextValue {
  isAuthenticated: boolean;
  walletAddress: string | undefined;
  balance: number;
  isConnecting: boolean;
  error: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  checkBalance: () => Promise<number>;
}

const MIN_SOL_BALANCE = 0.5;
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const wallet = useWallet();
  const address = useAddress();
  const { data: balanceData } = useBalance();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const connectionStatus = useConnectionStatus();
  const [error, setError] = React.useState<string | null>(null);
  const isAuthenticated = !!address;
  const isConnecting = connectionStatus === "connecting";
  const balance = balanceData ? parseFloat(balanceData.displayValue) : 0;
  const { handleError } = useErrorHandler();
  const storage = usePersistentStorage({ prefix: 'auth_' });

  const handleConnectWallet = useCallback(async () => {
    try {
      if (!wallet) {
        throw new Error('No wallet available');
      }
      // Check minimum balance requirement first
      if (balanceData && parseFloat(balanceData.displayValue) < MIN_SOL_BALANCE) {
        throw new Error(`Insufficient balance. Minimum ${MIN_SOL_BALANCE} SOL required.`);
      }
      
      const walletConfig = phantomWallet();
      await connect(walletConfig);
      storage.setItem('lastConnected', Date.now().toString());
    } catch (error) {
      handleError(error, {
        title: 'Wallet Connection Error',
        fallbackMessage: 'Failed to connect wallet',
      });
      setError(error instanceof Error ? error.message : 'Failed to connect wallet');
    }
  }, [connect, wallet, storage, handleError, setError]);

  const handleDisconnectWallet = useCallback(async () => {
    try {
      await disconnect();
      storage.removeItem('lastConnected');
      setError(null);
    } catch (error) {
      handleError(error, {
        title: 'Wallet Disconnection Error',
        fallbackMessage: 'Failed to disconnect wallet',
      });
      setError(error instanceof Error ? error.message : 'Failed to disconnect wallet');
    }
  }, [disconnect, storage, handleError, setError]);

  const handleCheckBalance = useCallback(async () => {
    try {
      if (!address) {
        throw new Error('Wallet not connected');
      }
      return balance || 0;
    } catch (error) {
      handleError(error, {
        title: 'Balance Check Error',
        fallbackMessage: 'Failed to check wallet balance',
      });
      setError(error instanceof Error ? error.message : 'Failed to check balance');
      return 0;
    }
  }, [address, balance, handleError, setError]);

  const contextValue = {
    isAuthenticated,
    walletAddress: address,
    balance,
    isConnecting,
    error,
    connectWallet: handleConnectWallet,
    disconnectWallet: handleDisconnectWallet,
    checkBalance: handleCheckBalance,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
