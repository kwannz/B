export interface WalletState {
  address: string | null;
  walletAddress: string | null;
  balance: number;
  isAuthenticated: boolean;
  isConnecting: boolean;
  error: string | null;
  connectWallet: (publicKey: string, adapter: any) => Promise<void>;
  disconnectWallet: () => void;
  checkWalletBalance: (publicKey: string, adapter: any) => Promise<void>;
}
