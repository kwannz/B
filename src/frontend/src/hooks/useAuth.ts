import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from '../components/ui/use-toast';

const MIN_SOL_BALANCE = 0.5;
const WALLET_ADDRESS_KEY = 'wallet_address';

export interface AuthContextType {
  isAuthenticated: boolean;
  walletAddress: string | null;
  connectWithWallet: () => Promise<void>;
  disconnectWallet: () => void;
  checkWalletBalance: () => Promise<number>;
}

export const useAuthContext = (): AuthContextType => {
  const { connected, publicKey, disconnect, wallet } = useWallet();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const address = localStorage.getItem(WALLET_ADDRESS_KEY);
    return !!address;
  });
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
      toast({
        variant: "destructive",
        title: "Error checking wallet balance",
        description: "Please try again or use a different wallet",
      });
      return 0;
    }
  }, [publicKey, wallet]);

  const connectWithWallet = useCallback(async () => {
    if (!publicKey) {
      toast({
        variant: "destructive",
        title: "Wallet not connected",
        description: "Please connect your wallet first",
      });
      throw new Error('Wallet not connected');
    }

    const balance = await checkWalletBalance();
    if (balance < MIN_SOL_BALANCE) {
      toast({
        variant: "destructive",
        title: "Insufficient balance",
        description: `Minimum required: ${MIN_SOL_BALANCE} SOL`,
      });
      throw new Error(`Insufficient balance. Minimum required: ${MIN_SOL_BALANCE} SOL`);
    }

    const address = publicKey.toString();
    localStorage.setItem(WALLET_ADDRESS_KEY, address);
    setWalletAddress(address);
    setIsAuthenticated(true);
    
    toast({
      title: "Successfully connected",
      description: "Your wallet has been connected",
    });
  }, [publicKey, checkWalletBalance]);

  const disconnectWallet = useCallback(() => {
    disconnect();
    localStorage.removeItem(WALLET_ADDRESS_KEY);
    setWalletAddress(null);
    setIsAuthenticated(false);
    
    toast({
      title: "Disconnected",
      description: "Your wallet has been disconnected",
    });
  }, [disconnect]);

  return {
    isAuthenticated,
    walletAddress,
    connectWithWallet,
    disconnectWallet,
    checkWalletBalance,
  };
};
