import type { TradingMetrics } from '@/types/trading';

export interface TestMetrics extends TradingMetrics {
  performance: {
    successRate: number;
    apiLatency: number;
    systemHealth: number;
  };
  trading: {
    totalTrades: number;
    successfulTrades: number;
    failedTrades: number;
    averageExecutionTime: number;
  };
}

export interface TradingConfig {
  tradingType: 'dex-swap' | 'meme-coin';
  maxSlippage: number;
  minLiquidity: number;
  gasLimit: number;
  retryAttempts: number;
  timeoutMs: number;
}

export interface TestContext {
  metrics: Partial<TestMetrics>;
  config: Partial<TradingConfig>;
  errors: Error[];
}
