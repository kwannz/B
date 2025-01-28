import { PublicKey } from '@solana/web3.js';

export interface Position {
  id: string;
  symbol: string;
  type: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
}

export interface OrderBookEntry {
  price: number;
  size: number;
  type: 'ask' | 'bid';
}

export interface OrderBook {
  asks: OrderBookEntry[];
  bids: OrderBookEntry[];
  currentPrice: number;
}

export interface TradingState {
  positions: Position[];
  orderBook: OrderBook;
  isLoading: boolean;
  refreshData: () => Promise<void>;
  closePosition: (positionId: string) => Promise<void>;
}

export interface WalletState {
  isAuthenticated: boolean;
  walletAddress: string | null;
  publicKey: PublicKey | null;
  balance: number;
  setWalletAddress: (address: string | null) => void;
  setBalance: (balance: number) => void;
  setIsAuthenticated: (isAuth: boolean) => void;
  setPublicKey: (key: PublicKey | null) => void;
}

export interface ChartData {
  time: string;
  price: number;
  volume?: number;
  ma20?: number;
  ma50?: number;
  type?: 'ask' | 'bid';
}

export interface ErrorHandlerOptions {
  title?: string;
  fallbackMessage?: string;
  shouldRetry?: boolean;
}
