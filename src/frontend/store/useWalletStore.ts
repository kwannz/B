import { create } from 'zustand';
import { useToast } from '../components/ui/use-toast';
import type { WalletState } from '../types/wallet';
import { type SmartWallet, type WalletInstance } from '@thirdweb-dev/react';
import type { TokenBalance } from '../types/wallet';

export const useWalletStore = create<WalletState>((set) => ({
  address: null,
  walletAddress: null,
  balance: 0,
  isAuthenticated: false,
  isConnecting: false,
  error: null,

  connectWallet: async (publicKey: string, adapter: SmartWallet) => {
    try {
      set({ isConnecting: true, error: null });
      const address = publicKey;
      set({
        address,
        walletAddress: address,
        isAuthenticated: true,
        isConnecting: false
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to connect wallet',
        isConnecting: false
      });
    }
  },

  disconnectWallet: () => {
    set({
      address: null,
      walletAddress: null,
      balance: 0,
      isAuthenticated: false,
      error: null
    });
  },

  checkWalletBalance: async (publicKey: string, adapter: SmartWallet) => {
    try {
      const balance = await adapter.getBalance();
      const tokenBalance: TokenBalance = {
        symbol: balance.symbol,
        value: BigInt(balance.value.toString()),
        name: balance.name,
        decimals: balance.decimals,
        displayValue: balance.displayValue
      };
      const numericBalance = parseFloat(tokenBalance.displayValue);
      set({ balance: numericBalance });
      return tokenBalance;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to check balance' });
      throw error;
    }
  }
}));
