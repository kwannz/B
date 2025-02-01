// Common types
export interface BaseTrade {
  id: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  status: 'completed' | 'pending' | 'failed';
  timestamp: string;
}

export type BotStatus = 'active' | 'inactive';

// DEX Swap specific types
export interface DexSwapTrade extends BaseTrade {
  fromToken: string;
  toToken: string;
  slippage: number;
  priceImpact: number;
  minimumReceived: number;
}

// Meme Coin specific types
export interface MemeCoinTrade extends BaseTrade {
  ticker: string;
  volume: number;
  sentimentScore: number;
  momentum: number;
}

// Union type for all trades
export type Trade = DexSwapTrade | MemeCoinTrade;

// Metrics types
export interface TradingMetrics {
  totalTrades: number;
  successRate: number;
  profitLoss: number;
  lastUpdated: number;
  dexSwap: {
    volume: number;
    averageSlippage: number;
    totalSwaps: number;
  };
  memeCoin: {
    volume: number;
    averageSentiment: number;
    totalTrades: number;
  };
}
