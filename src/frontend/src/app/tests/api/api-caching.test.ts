import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Caching Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should cache repeated wallet queries', async () => {
    const walletId = 'test-wallet';
    let apiCallCount = 0;

    mockAPI.getWallet.mockImplementation(() => {
      apiCallCount++;
      return Promise.resolve({ address: 'test-address' });
    });

    // First call should hit the API
    await runDebugApiTest(async () => {
      await debugMetricsMiddleware(
        { method: 'GET', url: `/api/wallets/${walletId}` },
        () => apiClient.getWallet(walletId)
      );
    });

    // Second call within cache window should use cached data
    await runDebugApiTest(async () => {
      await debugMetricsMiddleware(
        { method: 'GET', url: `/api/wallets/${walletId}` },
        () => apiClient.getWallet(walletId)
      );
    });

    expect(apiCallCount).toBe(1);
    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.cacheHitRate).toBeGreaterThan(0);
  });

  it('should handle cache invalidation', async () => {
    const botId = 'test-bot';
    const cacheTimeout = DEBUG_CONFIG.thresholds.api.cache_ttl;

    mockAPI.getBotStatus.mockImplementation(() => 
      Promise.resolve({ status: 'active' })
    );

    // Initial call
    await runDebugApiTest(async () => {
      await debugMetricsMiddleware(
        { method: 'GET', url: `/api/bots/${botId}` },
        () => apiClient.getBotStatus(botId)
      );
    });

    // Wait for cache to expire
    await new Promise(resolve => setTimeout(resolve, cacheTimeout + 100));

    // Call after cache expiration
    await runDebugApiTest(async () => {
      await debugMetricsMiddleware(
        { method: 'GET', url: `/api/bots/${botId}` },
        () => apiClient.getBotStatus(botId)
      );
    });

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.cacheMissRate).toBeGreaterThan(0);
  });

  it('should track cache performance metrics', async () => {
    const operations = Array(10).fill(null).map((_, i) => ({
      botId: `bot-${i}`,
      repeat: i < 5
    }));

    for (const op of operations) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: `/api/bots/${op.botId}` },
          () => apiClient.getBotStatus(op.botId)
        );

        if (op.repeat) {
          await debugMetricsMiddleware(
            { method: 'GET', url: `/api/bots/${op.botId}` },
            () => apiClient.getBotStatus(op.botId)
          );
        }
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.cacheHitRate).toBeCloseTo(0.33, 2);
    expect(metrics.performance.apiLatency).toBeLessThan(
      DEBUG_CONFIG.thresholds.system.latency
    );
  });

  it('should handle concurrent cache access', async () => {
    const requests = Array(5).fill(null).map((_, i) => ({
      botId: `bot-${i}`,
      delay: 100 * (i + 1)
    }));

    await Promise.all(
      requests.map(async req => {
        await runDebugApiTest(async () => {
          // First request
          await debugMetricsMiddleware(
            { method: 'GET', url: `/api/bots/${req.botId}` },
            async () => {
              await new Promise(resolve => setTimeout(resolve, req.delay));
              return apiClient.getBotStatus(req.botId);
            }
          );

          // Immediate second request should use cache
          await debugMetricsMiddleware(
            { method: 'GET', url: `/api/bots/${req.botId}` },
            () => apiClient.getBotStatus(req.botId)
          );
        });
      })
    );

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.cacheHitRate).toBeGreaterThan(0.4);
    expect(metrics.performance.concurrentRequests).toBeLessThanOrEqual(
      DEBUG_CONFIG.thresholds.api.concurrent_requests
    );
  });

  it('should handle cache updates on write operations', async () => {
    const botId = 'test-bot';
    let getCallCount = 0;

    mockAPI.getBotStatus.mockImplementation(() => {
      getCallCount++;
      return Promise.resolve({ status: 'active' });
    });

    // Initial get request
    await runDebugApiTest(async () => {
      await debugMetricsMiddleware(
        { method: 'GET', url: `/api/bots/${botId}` },
        () => apiClient.getBotStatus(botId)
      );
    });

    // Update operation should invalidate cache
    await runDebugApiTest(async () => {
      await debugMetricsMiddleware(
        { method: 'PATCH', url: `/api/bots/${botId}` },
        () => apiClient.updateBotStatus(botId, 'inactive')
      );
    });

    // Get request after update should hit API
    await runDebugApiTest(async () => {
      await debugMetricsMiddleware(
        { method: 'GET', url: `/api/bots/${botId}` },
        () => apiClient.getBotStatus(botId)
      );
    });

    expect(getCallCount).toBe(2);
    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.cacheInvalidationRate).toBeGreaterThan(0);
  });
});
