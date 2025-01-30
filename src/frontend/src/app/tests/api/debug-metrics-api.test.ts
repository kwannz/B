import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { useMetricsStore } from '../../stores/metricsStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugTest, runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { errorHandlingMiddleware } from '../../middleware/errorHandlingMiddleware';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('Debug Metrics API Integration', () => {
  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    useMetricsStore.setState({
      metrics: createDebugMetrics(),
      metricsHistory: []
    });
  });

  it('should track wallet API metrics', async () => {
    const { metrics } = await runDebugApiTest(async () => {
      await mockAPI.createWallet('test-bot');
      await mockAPI.getWallet('test-bot');
      await mockAPI.transferSOL('wallet-a', 'wallet-b', 1.0);

      return useDebugStore.getState().metrics;
    });

    expect(metrics.performance.errorRate).toBe(0);
    expect(metrics.performance.apiLatency).toBeLessThan(
      DEBUG_CONFIG.thresholds.system.latency
    );
    expect(metrics.wallet.transactions).toBe(3);
  });

  it('should track bot API metrics', async () => {
    const { metrics } = await runDebugApiTest(async () => {
      await mockAPI.createBot('trading', 'test-strategy');
      await mockAPI.getBotStatus('test-bot');
      await mockAPI.updateBotStatus('test-bot', 'active');

      return useDebugStore.getState().metrics;
    });

    expect(metrics.performance.errorRate).toBe(0);
    expect(metrics.trading.activePositions).toBeGreaterThanOrEqual(0);
  });

  it('should handle API timeouts', async () => {
    const delay = DEBUG_CONFIG.thresholds.system.latency + 1000;
    mockAPI.createWallet.mockImplementation(() =>
      new Promise(resolve => setTimeout(resolve, delay))
    );

    const { metrics } = await runDebugApiTest(async () => {
      try {
        await mockAPI.createWallet('test-bot');
      } catch (error) {
        expect(error).toBeDefined();
      }

      return useDebugStore.getState().metrics;
    });

    expect(metrics.performance.apiLatency).toBeGreaterThan(
      DEBUG_CONFIG.thresholds.system.latency
    );
    expect(metrics.performance.systemHealth).toBeLessThan(1);
  });

  it('should track API error patterns', async () => {
    const errors = [
      { message: 'Network Error', code: 'NETWORK_ERROR', status: 503 },
      { message: 'Rate Limit', code: 'RATE_LIMIT', status: 429 },
      { message: 'Invalid Input', code: 'VALIDATION_ERROR', status: 400 }
    ];

    for (const error of errors) {
      mockAPI.createWallet.mockRejectedValueOnce(error);
      try {
        await mockAPI.createWallet('test-bot');
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.errorRate).toBeGreaterThan(0.5);
    expect(useDebugStore.getState().logs.length).toBe(errors.length);
  });

  it('should maintain API metrics history', async () => {
    const operations = Array(5).fill(null).map((_, i) => ({
      success: i % 2 === 0,
      latency: (i + 1) * 100
    }));

    for (const op of operations) {
      if (op.success) {
        await mockAPI.createWallet(`bot-${op.latency}`);
      } else {
        mockAPI.createWallet.mockRejectedValueOnce(new Error('Test Error'));
        try {
          await mockAPI.createWallet(`bot-${op.latency}`);
        } catch (e) {
          expect(e).toBeDefined();
        }
      }
    }

    const store = useMetricsStore.getState();
    expect(store.metricsHistory.length).toBe(operations.length);
    expect(store.metricsHistory[0].performance.apiLatency).toBeLessThan(
      store.metricsHistory[4].performance.apiLatency
    );
  });

  it('should track concurrent API calls', async () => {
    const { metrics } = await runDebugApiTest(async () => {
      await Promise.all([
        mockAPI.createWallet('bot-1'),
        mockAPI.createWallet('bot-2'),
        mockAPI.createBot('trading', 'strategy-1'),
        mockAPI.createBot('trading', 'strategy-2')
      ]);

      return useDebugStore.getState().metrics;
    });

    expect(metrics.performance.apiLatency).toBeLessThanOrEqual(
      DEBUG_CONFIG.thresholds.system.latency * 4
    );
    expect(metrics.performance.errorRate).toBe(0);
  });
});
