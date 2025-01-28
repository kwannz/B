import create from 'zustand';
import { PublicKey } from '@solana/web3.js';
import { toast } from '../components/ui/use-toast';
import solanaService from '../services/solana';
import { logger } from './middleware/logger';
import { errorBoundary } from './middleware/errorBoundary';
import { configurePersist } from './middleware/persistMiddleware';
import { WalletState } from '../types/trading';

// Using types from trading.ts

const useWalletStore = create<WalletState>(
  logger(
    errorBoundary(
      configurePersist(
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
    { name: 'wallet-store' }
  ),
  'walletStore'
)
);

export default useWalletStore;
