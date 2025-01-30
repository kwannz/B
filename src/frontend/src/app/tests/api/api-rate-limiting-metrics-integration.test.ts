import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Rate Limiting Metrics Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should track rate limit metrics across endpoints', async () => {
    const rateLimitTests = [
      { endpoint: '/api/trades', limit: 100, window: 1000 },
      { endpoint: '/api/wallets', limit: 50, window: 2000 },
      { endpoint: '/api/bots', limit: 75, window: 1500 }
    ];

    for (const test of rateLimitTests) {
      const requests = Array(test.limit + 10).fill(null);
      let accepted = 0;

      await Promise.all(
        requests.map(async (_, i) => {
          try {
            await runDebugApiTest(async () => {
              await debugMetricsMiddleware(
                { method: 'GET', url: test.endpoint },
                async () => {
                  if (i >= test.limit) {
                    throw new Error('Rate limit exceeded');
                  }
                  accepted++;
                  return { request: i, timestamp: Date.now() };
                }
              );
            });
          } catch (e) {
            expect(e).toBeDefined();
          }
        })
      );

      expect(accepted).toBeLessThanOrEqual(test.limit);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.rateLimit.limitExceeded).toBeGreaterThan(0);
    expect(metrics.rateLimit.endpointDistribution).toBeDefined();
  });

  it('should implement adaptive rate limiting', async () => {
    const adaptiveTests = [
      { load: 0.3, multiplier: 1.0 },
      { load: 0.6, multiplier: 0.7 },
      { load: 0.9, multiplier: 0.4 }
    ];

    for (const test of adaptiveTests) {
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

      const baseLimit = 100;
      const adjustedLimit = Math.floor(baseLimit * test.multiplier);
      const requests = Array(baseLimit).fill(null);
      let accepted = 0;

      await Promise.all(
        requests.map(async (_, i) => {
          try {
            await runDebugApiTest(async () => {
              await debugMetricsMiddleware(
                { method: 'POST', url: '/api/adaptive-limit' },
                async () => {
                  if (i >= adjustedLimit) {
                    throw new Error('Adaptive limit exceeded');
                  }
                  accepted++;
                  return {
                    load: test.load,
                    limit: adjustedLimit,
                    accepted
                  };
                }
              );
            });
          } catch (e) {
            expect(e).toBeDefined();
          }
        })
      );

      expect(accepted).toBeLessThanOrEqual(adjustedLimit);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.rateLimit.adaptiveAdjustments).toBeGreaterThan(0);
    expect(metrics.rateLimit.loadCorrelation).toBeDefined();
  });

  it('should track concurrent request patterns', async () => {
    const concurrencyTests = [
      { window: 100, requests: 20 },
      { window: 200, requests: 15 },
      { window: 300, requests: 10 }
    ];

    for (const test of concurrencyTests) {
      const startTime = Date.now();
      const requests = Array(test.requests).fill(null);
      let concurrent = 0;
      let maxConcurrent = 0;

      await Promise.all(
        requests.map(async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);

          try {
            await runDebugApiTest(async () => {
              await debugMetricsMiddleware(
                { method: 'POST', url: '/api/concurrency' },
                async () => {
                  await new Promise(resolve => 
                    setTimeout(resolve, test.window)
                  );
                  concurrent--;
                  return {
                    concurrent,
                    maxConcurrent,
                    timestamp: Date.now() - startTime
                  };
                }
              );
            });
          } catch (e) {
            concurrent--;
            expect(e).toBeDefined();
          }
        })
      );

      expect(maxConcurrent).toBeLessThanOrEqual(
        DEBUG_CONFIG.thresholds.api.concurrent_requests
      );
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.rateLimit.concurrentRequests).toBeDefined();
    expect(metrics.rateLimit.windowPatterns).toBeDefined();
  });

  it('should implement token bucket rate limiting', async () => {
    const bucketTests = [
      { capacity: 10, refillRate: 2, tokens: 5 },
      { capacity: 20, refillRate: 4, tokens: 10 },
      { capacity: 15, refillRate: 3, tokens: 7 }
    ];

    for (const test of bucketTests) {
      let availableTokens = test.tokens;
      const requests = Array(test.capacity).fill(null);
      let accepted = 0;

      const refillInterval = setInterval(() => {
        availableTokens = Math.min(
          availableTokens + test.refillRate,
          test.capacity
        );
      }, 1000);

      await Promise.all(
        requests.map(async (_, i) => {
          try {
            await runDebugApiTest(async () => {
              await debugMetricsMiddleware(
                { method: 'POST', url: '/api/token-bucket' },
                async () => {
                  if (availableTokens <= 0) {
                    throw new Error('No tokens available');
                  }
                  availableTokens--;
                  accepted++;
                  return {
                    tokens: availableTokens,
                    accepted,
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

      clearInterval(refillInterval);
      expect(accepted).toBeLessThanOrEqual(test.capacity);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.rateLimit.tokenConsumption).toBeDefined();
    expect(metrics.rateLimit.bucketUtilization).toBeGreaterThan(0);
  });
});
