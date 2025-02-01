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
    lastPrice?: number;
  };
  memeCoin: {
    volume: number;
    averageSentiment: number;
    totalTrades: number;
    momentum?: number;
  };
}

export interface BotMetrics extends TradingMetrics {
  botStatuses: Record<string, BotStatus>;
  activePositions: number;
  lastPrice?: number;
}

export interface WalletInfo {
  address: string;
  balance: number;
  metrics: SystemMetrics;
}

export interface SystemMetrics {
  api_latency: number;
  error_rate: number;
  success_rate: number;
  throughput: number;
  active_trades: number;
  total_volume: number;
  profit_loss: number;
  system: {
    cpu_usage: number;
    memory_usage: number;
    disk_usage: number;
    network_latency: number;
    duration: number;
  };
}

export interface TestMetrics {
  render_duration: number;
  component_loaded: boolean;
  elements_visible?: Record<string, boolean>;
  form_elements?: Record<string, boolean>;
  total_duration?: number;
  steps_completed?: number;
  workflow_data?: Array<{ step: string; duration: number }>;
  performance_metrics?: {
    average_step_duration?: number;
    step_duration_variance?: number;
    step_durations?: Record<string, number>;
  };
}
