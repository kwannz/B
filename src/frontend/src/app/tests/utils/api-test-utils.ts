import { ApiError, WalletResponse, BotResponse, TransferResponse } from '../types/api.types';
import { TestMetrics } from '../types/test.types';

export const createMockApiResponse = <T>(data: T) => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {}
});

export const createMockApiError = (message: string, code: string, status: number): ApiError => ({
  message,
  code,
  status
});

export const createMockWallet = (overrides?: Partial<WalletResponse>): WalletResponse => ({
  address: 'test-wallet',
  private_key: 'test-key',
  balance: 0,
  bot_id: 'test-bot',
  ...overrides
});

export const createMockBot = (overrides?: Partial<BotResponse>): BotResponse => ({
  id: 'test-bot',
  type: 'trading',
  strategy: 'test-strategy',
  status: 'active',
  created_at: new Date().toISOString(),
  metrics: {
    total_volume: 1000,
    profit_loss: 100,
    active_positions: 2
  },
  ...overrides
});

export const createMockTransfer = (overrides?: Partial<TransferResponse>): TransferResponse => ({
  transaction_hash: 'test-hash',
  from_address: 'wallet-a',
  to_address: 'wallet-b',
  amount: 1.0,
  status: 'confirmed',
  timestamp: new Date().toISOString(),
  ...overrides
});

export const createMockMetrics = (overrides?: Partial<TestMetrics>): TestMetrics => ({
  performance: {
    errorRate: 0,
    apiLatency: 100,
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

export const expectMetricsToMatch = (actual: TestMetrics, expected: Partial<TestMetrics>) => {
  if (expected.performance) {
    Object.entries(expected.performance).forEach(([key, value]) => {
      expect(actual.performance[key as keyof typeof actual.performance]).toBe(value);
    });
  }
  if (expected.wallet) {
    Object.entries(expected.wallet).forEach(([key, value]) => {
      expect(actual.wallet[key as keyof typeof actual.wallet]).toBe(value);
    });
  }
  if (expected.trading) {
    Object.entries(expected.trading).forEach(([key, value]) => {
      expect(actual.trading[key as keyof typeof actual.trading]).toBe(value);
    });
  }
};
