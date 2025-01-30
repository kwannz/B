import { TestMetrics } from '../types/test.types';
import { DEBUG_CONFIG } from '../../config/debug.config';

export const createDebugMetrics = (overrides?: Partial<TestMetrics>): TestMetrics => ({
  performance: {
    errorRate: 0,
    apiLatency: DEBUG_CONFIG.thresholds.system.latency / 2,
    systemHealth: 1,
    ...overrides?.performance
  },
  wallet: {
    balances: {},
    transactions: 0,
    ...overrides?.wallet
  },
  trading: {
    activePositions: 0,
    totalVolume: 0,
    profitLoss: 0,
    ...overrides?.trading
  }
});

export const expectDebugMetrics = (metrics: TestMetrics) => ({
  toHaveNoErrors: () => {
    expect(metrics.performance.errorRate).toBe(0);
    expect(metrics.performance.systemHealth).toBe(1);
  },
  toHaveAcceptableLatency: () => {
    expect(metrics.performance.apiLatency).toBeLessThanOrEqual(
      DEBUG_CONFIG.thresholds.system.latency
    );
  },
  toHaveWalletTransactions: (count: number) => {
    expect(metrics.wallet.transactions).toBe(count);
  },
  toHaveWalletBalance: (address: string, balance: number) => {
    expect(metrics.wallet.balances[address]).toBe(balance);
  },
  toHaveActivePositions: (count: number) => {
    expect(metrics.trading.activePositions).toBe(count);
  },
  toHaveTradingVolume: (volume: number) => {
    expect(metrics.trading.totalVolume).toBe(volume);
  },
  toHaveProfitLoss: (pl: number) => {
    expect(metrics.trading.profitLoss).toBe(pl);
  }
});

export const mockDebugConfig = {
  update_interval: 1000,
  retention: {
    max_logs: 100,
    max_age_ms: 3600000
  },
  thresholds: {
    system: {
      latency: 500,
      error_rate: 0.01,
      resource_usage: 0.8
    }
  }
};

export const mockDebugStore = {
  isEnabled: true,
  logs: [],
  metrics: createDebugMetrics()
};
