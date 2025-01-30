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

  it('should track cache hit rates', async () => {
    const cacheTests = [
      { key: 'market-data', hits: 3, misses: 1 },
      { key: 'wallet-info', hits: 2, misses: 2 },
      { key: 'bot-status', hits: 4, misses: 0 }
    ];

    for (const test of cacheTests) {
      const requests = Array(test.hits + test.misses).fill(null);
      let hitCount = 0;

      for (const _ of requests) {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'GET', url: `/api/${test.key}` },
            async () => {
              hitCount++;
              return {
                cached: hitCount <= test.hits,
                timestamp: Date.now()
              };
            }
          );
        });
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.cache.hitRate).toBeGreaterThan(0.5);
    expect(metrics.cache.missRate).toBeLessThan(0.5);
  });

  it('should monitor cache invalidation patterns', async () => {
    const invalidationTests = [
      { type: 'time-based', ttl: 1000 },
      { type: 'manual', immediate: true },
      { type: 'version-based', version: 2 }
    ];

    for (const test of invalidationTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/cache/invalidate' },
          async () => {
            if (test.type === 'time-based') {
              await new Promise(resolve => setTimeout(resolve, test.ttl));
            }
            return {
              type: test.type,
              timestamp: Date.now()
            };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.cache.invalidationRate).toBeGreaterThan(0);
    expect(metrics.cache.invalidationPatterns).toBeDefined();
  });

  it('should track cache memory usage', async () => {
    const memoryTests = Array(5).fill(null).map((_, i) => ({
      size: 1024 * Math.pow(2, i),
      entries: i + 1
    }));

    for (const test of memoryTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/cache/metrics' },
          async () => {
            const data = new Array(test.entries).fill({
              size: test.size,
              content: 'x'.repeat(test.size)
            });
            return {
              memoryUsage: test.size * test.entries,
              entries: test.entries
            };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.cache.memoryUsage).toBeGreaterThan(0);
    expect(metrics.cache.entryCount).toBeGreaterThan(0);
  });

  it('should handle concurrent cache operations', async () => {
    const concurrentTests = Array(3).fill(null).map((_, i) => ({
      operations: i + 2,
      delay: 100 * (i + 1)
    }));

    for (const test of concurrentTests) {
      const operations = Array(test.operations).fill(null);
      await Promise.all(
        operations.map(async (_, i) => {
          await runDebugApiTest(async () => {
            await new Promise(resolve => 
              setTimeout(resolve, i * test.delay)
            );
            await debugMetricsMiddleware(
              { method: 'POST', url: '/api/cache/concurrent' },
              async () => ({
                operation: i,
                timestamp: Date.now()
              })
            );
          });
        })
      );
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.cache.concurrentOperations).toBeGreaterThan(0);
    expect(metrics.performance.cacheLatency).toBeDefined();
  });

  it('should track cache eviction strategies', async () => {
    const evictionTests = [
      { strategy: 'lru', size: 1000, maxEntries: 100 },
      { strategy: 'lfu', size: 2000, maxEntries: 200 },
      { strategy: 'fifo', size: 3000, maxEntries: 300 }
    ];

    for (const test of evictionTests) {
      const entries = Array(test.maxEntries + 10).fill(null);
      await Promise.all(
        entries.map(async (_, i) => {
          await runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'POST', url: '/api/cache/entry' },
              async () => ({
                strategy: test.strategy,
                entry: i,
                evicted: i >= test.maxEntries
              })
            );
          });
        })
      );
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.cache.evictionRate).toBeGreaterThan(0);
    expect(metrics.cache.evictionStrategy).toBeDefined();
  });
});
