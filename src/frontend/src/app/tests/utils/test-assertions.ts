import { TestMetrics, TestWallet, TestBot, TestTransfer } from '../types/test.types';
import { ApiError } from '../types/api.types';
import { DEBUG_CONFIG } from '../../config/debug.config';

export const assertMetricsWithinThresholds = (metrics: TestMetrics) => {
  expect(metrics.performance.errorRate).toBeLessThanOrEqual(
    DEBUG_CONFIG.thresholds.system.error_rate
  );
  expect(metrics.performance.apiLatency).toBeLessThanOrEqual(
    DEBUG_CONFIG.thresholds.system.latency
  );
  expect(metrics.performance.systemHealth).toBeGreaterThan(0);
};

export const assertValidWalletResponse = (wallet: TestWallet) => {
  expect(wallet).toHaveProperty('address');
  expect(wallet).toHaveProperty('private_key');
  expect(wallet).toHaveProperty('bot_id');
  expect(typeof wallet.balance).toBe('number');
};

export const assertValidBotResponse = (bot: TestBot) => {
  expect(bot).toHaveProperty('id');
  expect(bot).toHaveProperty('type');
  expect(bot).toHaveProperty('strategy');
  expect(bot).toHaveProperty('status');
  expect(bot).toHaveProperty('created_at');
  expect(bot.metrics).toHaveProperty('total_volume');
  expect(bot.metrics).toHaveProperty('profit_loss');
  expect(bot.metrics).toHaveProperty('active_positions');
};

export const assertValidTransferResponse = (transfer: TestTransfer) => {
  expect(transfer).toHaveProperty('transaction_hash');
  expect(transfer).toHaveProperty('from_address');
  expect(transfer).toHaveProperty('to_address');
  expect(typeof transfer.amount).toBe('number');
  expect(['confirmed', 'pending', 'failed']).toContain(transfer.status);
  expect(transfer).toHaveProperty('timestamp');
};

export const assertApiError = (error: ApiError) => {
  expect(error).toHaveProperty('message');
  expect(error).toHaveProperty('code');
  expect(error).toHaveProperty('status');
  expect(typeof error.status).toBe('number');
};

export const assertDebugMetricsUpdate = (
  before: TestMetrics,
  after: TestMetrics,
  expectedChanges: Partial<TestMetrics>
) => {
  Object.entries(expectedChanges).forEach(([category, changes]) => {
    Object.entries(changes as Record<string, any>).forEach(([key, value]) => {
      const beforeValue = before[category as keyof TestMetrics][key];
      const afterValue = after[category as keyof TestMetrics][key];
      expect(afterValue).toBe(
        typeof value === 'function' ? value(beforeValue) : value
      );
    });
  });
};
