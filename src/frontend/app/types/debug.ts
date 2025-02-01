export interface DebugMetrics {
  performance: {
    errorRate: number;
    apiLatency: number;
    systemHealth: number;
  };
  wallet: {
    balances: Record<string, number>;
    transactions: number;
  };
  trading: {
    activePositions: number;
    totalVolume: number;
    profitLoss: number;
  };
}

export interface DebugLog {
  level: 'info' | 'warn' | 'error';
  category: 'system' | 'trading' | 'wallet';
  message: string;
  timestamp: number;
  data?: unknown;
}

export interface DebugConfig {
  enableRealTimeDebugging: boolean;
  logLevel: 'info' | 'warn' | 'error';
  maxLogEntries: number;
  metricsUpdateInterval: number;
}
