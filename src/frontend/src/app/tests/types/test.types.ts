import { WalletResponse, BotResponse, TransferResponse } from './api.types';

export type TestWallet = WalletResponse & {
  address: string;
  private_key: string;
  balance: number;
  bot_id: string;
};

export type TestBot = BotResponse & {
  id: string;
  type: 'trading' | 'defi';
  strategy: string;
  status: 'active' | 'inactive';
  created_at: string;
  metrics: {
    total_volume: number;
    profit_loss: number;
    active_positions: number;
  };
};

export type TestTransfer = TransferResponse & {
  transaction_hash: string;
  from_address: string;
  to_address: string;
  amount: number;
  status: 'confirmed' | 'pending' | 'failed';
  timestamp: string;
};

export type TestMetrics = {
  performance: {
    errorRate: number;
    apiLatency: number;
    systemHealth: number;
    successRate: number;
    totalTrades: number;
    walletBalance: number;
    [key: string]: number;
  };
  wallet: {
    balances: Record<string, number>;
    transactions: number;
    performance: {
      total_trades: number;
      success_rate: number;
      profit_loss: number;
      avg_trade_duration: number;
      max_drawdown: number;
    };
  };
  trading: {
    activePositions: number;
    totalVolume: number;
    profitLoss: number;
  };
  debug: {
    logs: string[];
    errors: string[];
    warnings: string[];
    metrics: Record<string, number>;
  };
};

export type TestDebugConfig = {
  update_interval: number;
  retention: {
    max_logs: number;
    max_age_ms: number;
  };
  thresholds: {
    system: {
      latency: number;
      error_rate: number;
      resource_usage: number;
    };
    metrics: {
      success_rate: number;
      min_trades: number;
      min_balance: number;
    };
  };
};
