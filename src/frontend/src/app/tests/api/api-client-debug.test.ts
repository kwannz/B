import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';
import { errorHandlingMiddleware } from '../../middleware/errorHandlingMiddleware';
import { ApiClient } from '../../api/client';

describe('API Client Debug Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should track wallet operations with metrics', async () => {
    const { metrics } = await runDebugApiTest(async () => {
      await errorHandlingMiddleware(async () => {
        await apiClient.createWallet('test-bot');
        await apiClient.getWalletBalance('test-bot');
        await apiClient.transferSOL('wallet-a', 'wallet-b', 1.0);
      });

      return useDebugStore.getState().metrics;
    });

    expect(metrics.wallet.transactions).toBe(3);
    expect(metrics.performance.errorRate).toBe(0);
    expect(metrics.performance.apiLatency).toBeLessThan(
      DEBUG_CONFIG.thresholds.system.latency
    );
  });

  it('should handle API request retries', async () => {
    const error = { message: 'Network Error', code: 'NETWORK_ERROR', status: 503 };
    let retryCount = 0;

    mockAPI.createWallet.mockImplementation(() => {
      retryCount++;
      if (retryCount <= 2) {
        throw error;
      }
      return Promise.resolve({ address: 'test-address' });
    });

    await runDebugApiTest(async () => {
      await apiClient.createWallet('test-bot');
    });

    const metrics = useDebugStore.getState().metrics;
    expect(retryCount).toBe(3);
    expect(metrics.performance.errorRate).toBeGreaterThan(0);
    expect(useDebugStore.getState().logs).toContain(
      expect.stringContaining('Retry attempt')
    );
  });

  it('should track API request batching', async () => {
    const operations = Array(5).fill(null).map((_, i) => ({
      botId: `bot-${i}`,
      amount: i + 1
    }));

    const { metrics } = await runDebugApiTest(async () => {
      await Promise.all(
        operations.map(op =>
          apiClient.createWallet(op.botId).then(() =>
            apiClient.transferSOL(op.botId, 'target-wallet', op.amount)
          )
        )
      );

      return useDebugStore.getState().metrics;
    });

    expect(metrics.wallet.transactions).toBe(operations.length * 2);
    expect(metrics.performance.apiLatency).toBeLessThanOrEqual(
      DEBUG_CONFIG.thresholds.system.latency * operations.length
    );
  });

  it('should maintain request context in error scenarios', async () => {
    const errors = [
      { message: 'Rate Limit', code: 'RATE_LIMIT', status: 429 },
      { message: 'Invalid Input', code: 'VALIDATION_ERROR', status: 400 },
      { message: 'Server Error', code: 'SERVER_ERROR', status: 500 }
    ];

    let errorIndex = 0;
    mockAPI.createWallet.mockImplementation(() => {
      throw errors[errorIndex++ % errors.length];
    });

    for (let i = 0; i < errors.length; i++) {
      try {
        await apiClient.createWallet(`bot-${i}`);
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.errorRate).toBeGreaterThan(0.5);
    expect(useDebugStore.getState().logs.length).toBe(errors.length);
    expect(metrics.performance.systemHealth).toBeLessThan(0.5);
  });

  it('should track API performance degradation', async () => {
    const delays = [100, 500, 1000, 2000, 5000];
    
    for (const delay of delays) {
      mockAPI.createWallet.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, delay))
      );

      try {
        await apiClient.createWallet('test-bot');
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.apiLatency).toBeGreaterThan(
      DEBUG_CONFIG.thresholds.system.latency
    );
    expect(metrics.performance.systemHealth).toBeLessThan(1);
  });
});
