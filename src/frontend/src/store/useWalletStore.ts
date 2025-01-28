import create from 'zustand';
import { persist } from 'zustand/middleware';
import { PublicKey } from '@solana/web3.js';
import { toast } from '../components/ui/use-toast';
import solanaService from '../services/solana';
import { logger } from './middleware/logger';

interface WalletState {
  isAuthenticated: boolean;
  walletAddress: string | null;
  balance: number;
  isConnecting: boolean;
  error: string | null;
  setWalletAddress: (address: string | null) => void;
  setBalance: (balance: number) => void;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  setError: (error: string | null) => void;
  connectWallet: (publicKey: PublicKey, adapter: any) => Promise<void>;
  disconnectWallet: () => void;
  checkWalletBalance: (publicKey: PublicKey, adapter: any) => Promise<number>;
}

const useWalletStore = create<WalletState>(
  logger(
    persist(
      (set, get) => ({
  isAuthenticated: false,
  walletAddress: localStorage.getItem('wallet_address'),
  balance: 0,
  isConnecting: false,
  error: null,

  setWalletAddress: (address) => {
    if (address) {
      localStorage.setItem('wallet_address', address);
    } else {
      localStorage.removeItem('wallet_address');
    }
    set({ walletAddress: address });
  },

  setBalance: (balance) => set({ balance }),
  setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setError: (error) => set({ error }),

  connectWallet: async (publicKey, adapter) => {
    set({ isConnecting: true, error: null });
    try {
      const balance = await solanaService.checkBalance(publicKey, adapter);
      if (balance < 0.5) {
        throw new Error('Insufficient balance');
      }

      const address = publicKey.toString();
      set({
        walletAddress: address,
        balance,
        isAuthenticated: true,
        isConnecting: false,
      });

      localStorage.setItem('wallet_address', address);
      
      toast({
        title: "Successfully connected",
        description: "Your wallet has been connected",
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to connect wallet',
        isConnecting: false,
      });
      
      toast({
        variant: "destructive",
        title: "Connection failed",
        description: error instanceof Error ? error.message : 'Failed to connect wallet',
      });
    }
  },

  disconnectWallet: () => {
    localStorage.removeItem('wallet_address');
    set({
      walletAddress: null,
      balance: 0,
      isAuthenticated: false,
      error: null,
    });
    
    toast({
      title: "Disconnected",
      description: "Your wallet has been disconnected",
    });
  },

  checkWalletBalance: async (publicKey, adapter) => {
    try {
      const balance = await solanaService.checkBalance(publicKey, adapter);
      set({ balance });
      return balance;
    } catch (error) {
      set({ error: 'Failed to check wallet balance' });
      return 0;
    }
  },
}),
      {
        name: 'wallet-store',
        getStorage: () => localStorage,
      }
    ),
    'walletStore'
  )
);

export default useWalletStore;
