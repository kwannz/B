import { type SmartWallet } from '@thirdweb-dev/react';

export interface TokenBalance {
  symbol: string;
  value: bigint;
  name: string;
  decimals: number;
  displayValue: string;
}

export interface WalletState {
  address: string | null;
  walletAddress: string | null;
  balance: number;
  isAuthenticated: boolean;
  isConnecting: boolean;
  error: string | null;
  connectWallet: (publicKey: string, adapter: SmartWallet) => Promise<void>;
  disconnectWallet: () => void;
  checkWalletBalance: (publicKey: string, adapter: SmartWallet) => Promise<TokenBalance>;
}
