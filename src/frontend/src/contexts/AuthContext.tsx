import React, { createContext, useContext, ReactNode, useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletContextState } from '@solana/wallet-adapter-react';

interface AuthContextType {
  isAuthenticated: boolean;
  walletAddress: string | null;
  connectWithWallet: () => Promise<void>;
  disconnectWallet: () => void;
  checkWalletBalance: () => Promise<number>;
}

const MIN_SOL_BALANCE = 0.5;
const WALLET_ADDRESS_KEY = 'wallet_address';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { connected, publicKey, disconnect, wallet } = useWallet();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(
    localStorage.getItem(WALLET_ADDRESS_KEY)
  );

  const checkWalletBalance = useCallback(async (): Promise<number> => {
    if (!publicKey || !wallet?.adapter) {
      return 0;
    }

    try {
      const balance = await wallet.adapter.getBalance();
      return balance.value / 1e9; // Convert lamports to SOL
    } catch (error) {
      console.error('Error checking wallet balance:', error);
      return 0;
    }
  }, [publicKey, wallet]);

  const connectWithWallet = useCallback(async () => {
    if (!publicKey) {
      throw new Error('Wallet not connected');
    }

    const balance = await checkWalletBalance();
    if (balance < MIN_SOL_BALANCE) {
      throw new Error(`Insufficient balance. Minimum required: ${MIN_SOL_BALANCE} SOL`);
    }

    const address = publicKey.toString();
    localStorage.setItem(WALLET_ADDRESS_KEY, address);
    setWalletAddress(address);
    setIsAuthenticated(true);
  }, [publicKey, checkWalletBalance]);

  const disconnectWallet = useCallback(() => {
    disconnect();
    localStorage.removeItem(WALLET_ADDRESS_KEY);
    setWalletAddress(null);
    setIsAuthenticated(false);
  }, [disconnect]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        walletAddress,
        connectWithWallet,
        disconnectWallet,
        checkWalletBalance,
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
