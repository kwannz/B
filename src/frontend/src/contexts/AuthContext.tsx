import React, { createContext, useContext, ReactNode, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWallet as useWalletHook } from '../hooks/useWallet';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { usePersistentStorage } from '../hooks/usePersistentStorage';

interface AuthContextType {
  isAuthenticated: boolean;
  walletAddress: string | null;
  balance: number;
  isConnecting: boolean;
  error: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  checkBalance: () => Promise<number>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { publicKey, wallet } = useWallet();
  const {
    isAuthenticated,
    walletAddress,
    balance,
    isConnecting,
    error,
    connect,
    disconnect,
    checkBalance,
  } = useWalletHook();
  const { handleError } = useErrorHandler();
  const storage = usePersistentStorage({ prefix: 'auth_' });

  const handleConnectWallet = useCallback(async () => {
    try {
      if (!publicKey || !wallet?.adapter) {
        throw new Error('Please connect your wallet first');
      }
      await connect(publicKey, wallet.adapter);
      storage.setItem('lastConnected', Date.now());
    } catch (error) {
      handleError(error, {
        title: 'Wallet Connection Error',
        fallbackMessage: 'Failed to connect wallet',
      });
    }
  }, [publicKey, wallet, connect, storage, handleError]);

  const handleDisconnectWallet = useCallback(() => {
    try {
      disconnect();
      storage.removeItem('lastConnected');
    } catch (error) {
      handleError(error, {
        title: 'Wallet Disconnection Error',
        fallbackMessage: 'Failed to disconnect wallet',
      });
    }
  }, [disconnect, storage, handleError]);

  const handleCheckBalance = useCallback(async () => {
    try {
      if (!publicKey || !wallet?.adapter) {
        throw new Error('Wallet not connected');
      }
      return await checkBalance(publicKey, wallet.adapter);
    } catch (error) {
      handleError(error, {
        title: 'Balance Check Error',
        fallbackMessage: 'Failed to check wallet balance',
      });
      return 0;
    }
  }, [publicKey, wallet, checkBalance, handleError]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        walletAddress,
        balance,
        isConnecting,
        error,
        connectWallet: handleConnectWallet,
        disconnectWallet: handleDisconnectWallet,
        checkBalance: handleCheckBalance,
      }}
    >
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
