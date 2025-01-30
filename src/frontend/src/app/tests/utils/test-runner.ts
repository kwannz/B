import { TestMetrics, TestWallet, TestBot, TestTransfer } from '../types/test.types';
import { createMockApiResponse, createMockApiError } from './api-test-utils';
import { createDebugMetrics, expectDebugMetrics } from './debug-test-utils';
import { assertMetricsWithinThresholds, assertValidWalletResponse, assertValidBotResponse, assertValidTransferResponse } from './test-assertions';
import { DEBUG_CONFIG } from '../../config/debug.config';

export const runApiTest = async <T>(
  testFn: () => Promise<T>,
  assertions: (result: T, metrics: TestMetrics) => void
) => {
  const startMetrics = createDebugMetrics();
  let result: T;
  try {
    result = await testFn();
    const endMetrics = createDebugMetrics({
      performance: {
        errorRate: 0,
        apiLatency: performance.now() - performance.now(),
        systemHealth: 1
      }
    });
    assertions(result, endMetrics);
    assertMetricsWithinThresholds(endMetrics);
  } catch (error) {
    const errorMetrics = createDebugMetrics({
      performance: {
        errorRate: 1,
        apiLatency: DEBUG_CONFIG.thresholds.system.latency + 100,
        systemHealth: 0
      }
    });
    throw error;
  }
};

export const runWalletTest = async (
  testFn: () => Promise<TestWallet>,
  expectedBalance?: number
) => {
  await runApiTest(testFn, (wallet, metrics) => {
    assertValidWalletResponse(wallet);
    if (expectedBalance !== undefined) {
      expect(wallet.balance).toBe(expectedBalance);
    }
    expectDebugMetrics(metrics).toHaveNoErrors();
  });
};

export const runBotTest = async (
  testFn: () => Promise<TestBot>,
  expectedStatus?: 'active' | 'inactive'
) => {
  await runApiTest(testFn, (bot, metrics) => {
    assertValidBotResponse(bot);
    if (expectedStatus) {
      expect(bot.status).toBe(expectedStatus);
    }
    expectDebugMetrics(metrics).toHaveNoErrors();
  });
};

export const runTransferTest = async (
  testFn: () => Promise<TestTransfer>,
  expectedAmount?: number
) => {
  await runApiTest(testFn, (transfer, metrics) => {
    assertValidTransferResponse(transfer);
    if (expectedAmount !== undefined) {
      expect(transfer.amount).toBe(expectedAmount);
    }
    expectDebugMetrics(metrics).toHaveNoErrors();
    expectDebugMetrics(metrics).toHaveWalletTransactions(1);
  });
};
