import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Caching Metrics Integration', () => {
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
      { key: 'wallet-1', ttl: 1000 },
      { key: 'wallet-2', ttl: 2000 },
      { key: 'wallet-3', ttl: 3000 }
    ];

    for (const test of cacheTests) {
      const requests = Array(5).fill(null);
      let hits = 0;

      for (const _ of requests) {
        try {
          await runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'GET', url: `/api/cache/${test.key}` },
              async () => {
                const isCached = Math.random() > 0.5;
                if (isCached) hits++;
                return {
                  key: test.key,
                  cached: isCached,
                  ttl: test.ttl,
                  timestamp: Date.now()
                };
              }
            );
          });
        } catch (e) {
          expect(e).toBeDefined();
        }
      }

      expect(hits).toBeLessThanOrEqual(requests.length);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.cache.hitRate).toBeDefined();
    expect(metrics.cache.missRate).toBeDefined();
  });

  it('should monitor cache eviction patterns', async () => {
    const evictionTests = [
      { size: 100, maxSize: 50 },
      { size: 200, maxSize: 100 },
      { size: 300, maxSize: 150 }
    ];

    for (const test of evictionTests) {
      const entries = Array(test.size).fill(null);
      let evicted = 0;

      await Promise.all(
        entries.map(async (_, i) => {
          try {
            await runDebugApiTest(async () => {
              await debugMetricsMiddleware(
                { method: 'POST', url: '/api/cache/entry' },
                async () => {
                  if (i >= test.maxSize) {
                    evicted++;
                    throw new Error('Cache eviction');
                  }
                  return {
                    index: i,
                    size: test.size,
                    maxSize: test.maxSize,
                    evicted,
                    timestamp: Date.now()
                  };
                }
              );
            });
          } catch (e) {
            expect(e).toBeDefined();
          }
        })
      );

      expect(evicted).toBeGreaterThan(0);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.cache.evictionRate).toBeGreaterThan(0);
    expect(metrics.cache.sizeDistribution).toBeDefined();
  });

  it('should track cache performance impact', async () => {
    const performanceTests = [
      { cached: true, latency: 10 },
      { cached: false, latency: 100 },
      { cached: true, latency: 15 }
    ];

    for (const test of performanceTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: '/api/cache/performance' },
          async () => {
            await new Promise(resolve => 
              setTimeout(resolve, test.latency)
            );
            return {
              cached: test.cached,
              latency: test.latency,
              timestamp: Date.now()
            };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.cache.performanceGain).toBeGreaterThan(0);
    expect(metrics.cache.latencyDistribution).toBeDefined();
  });

  it('should implement adaptive cache strategies', async () => {
    const strategyTests = [
      { load: 0.3, strategy: 'aggressive' },
      { load: 0.6, strategy: 'balanced' },
      { load: 0.9, strategy: 'conservative' }
    ];

    for (const test of strategyTests) {
      useDebugStore.setState(state => ({
        ...state,
        metrics: {
          ...state.metrics,
          performance: {
            ...state.metrics.performance,
            systemLoad: test.load
          }
        }
      }));

      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/cache/strategy' },
          async () => ({
            load: test.load,
            strategy: test.strategy,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.cache.strategyChanges).toBeGreaterThan(0);
    expect(metrics.cache.adaptivePatterns).toBeDefined();
  });

  it('should track cache consistency metrics', async () => {
    const consistencyTests = [
      { replicas: 2, inconsistencies: 0 },
      { replicas: 3, inconsistencies: 1 },
      { replicas: 4, inconsistencies: 2 }
    ];

    for (const test of consistencyTests) {
      const operations = Array(10).fill(null);
      let detected = 0;

      await Promise.all(
        operations.map(async (_, i) => {
          try {
            await runDebugApiTest(async () => {
              await debugMetricsMiddleware(
                { method: 'POST', url: '/api/cache/consistency' },
                async () => {
                  if (detected < test.inconsistencies) {
                    detected++;
                    throw new Error('Consistency error');
                  }
                  return {
                    replicas: test.replicas,
                    inconsistencies: detected,
                    operation: i,
                    timestamp: Date.now()
                  };
                }
              );
            });
          } catch (e) {
            expect(e).toBeDefined();
          }
        })
      );

      expect(detected).toBe(test.inconsistencies);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.cache.consistencyRate).toBeDefined();
    expect(metrics.cache.replicaSync).toBeGreaterThan(0);
  });
});
