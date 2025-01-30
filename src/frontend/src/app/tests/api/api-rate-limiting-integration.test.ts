import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Rate Limiting Integration', () => {
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
    const endpoints = [
      { path: '/wallets', limit: 10, interval: 1000 },
      { path: '/bots', limit: 5, interval: 1000 },
      { path: '/trades', limit: 3, interval: 1000 }
    ];

    for (const endpoint of endpoints) {
      const requests = Array(endpoint.limit + 2).fill(null);
      await Promise.all(
        requests.map(async (_, i) => {
          try {
            await runDebugApiTest(async () => {
              await debugMetricsMiddleware(
                { method: 'GET', url: endpoint.path },
                async () => {
                  if (i >= endpoint.limit) {
                    throw { status: 429, message: 'Rate limit exceeded' };
                  }
                  return { status: 'success' };
                }
              );
            });
          } catch (e) {
            expect(e).toBeDefined();
          }
        })
      );
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.rateLimitExceeded).toBeGreaterThan(0);
    expect(metrics.performance.requestRate).toBeDefined();
  });

  it('should handle concurrent request throttling', async () => {
    const maxConcurrent = DEBUG_CONFIG.thresholds.api.concurrent_requests;
    const requests = Array(maxConcurrent + 3).fill(null).map((_, i) => ({
      id: i,
      delay: 100 * (i % 3)
    }));

    await Promise.all(
      requests.map(async req => {
        try {
          await runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'POST', url: '/api/concurrent-test' },
              async () => {
                await new Promise(resolve => setTimeout(resolve, req.delay));
                if (req.id >= maxConcurrent) {
                  throw { status: 429, message: 'Too many concurrent requests' };
                }
                return { status: 'success' };
              }
            );
          });
        } catch (e) {
          expect(e).toBeDefined();
        }
      })
    );

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.concurrentRequests).toBeLessThanOrEqual(
      maxConcurrent
    );
  });

  it('should implement adaptive rate limiting', async () => {
    const scenarios = [
      { load: 0.3, limit: 10 },
      { load: 0.6, limit: 7 },
      { load: 0.9, limit: 4 }
    ];

    for (const scenario of scenarios) {
      const requests = Array(scenario.limit + 2).fill(null);
      useDebugStore.setState(state => ({
        ...state,
        metrics: {
          ...state.metrics,
          performance: {
            ...state.metrics.performance,
            systemLoad: scenario.load
          }
        }
      }));

      await Promise.all(
        requests.map(async (_, i) => {
          try {
            await runDebugApiTest(async () => {
              await debugMetricsMiddleware(
                { method: 'POST', url: '/api/adaptive-test' },
                async () => {
                  if (i >= scenario.limit) {
                    throw { status: 429, message: 'Adaptive rate limit exceeded' };
                  }
                  return { status: 'success' };
                }
              );
            });
          } catch (e) {
            expect(e).toBeDefined();
          }
        })
      );
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.adaptiveThrottling).toBeDefined();
    expect(metrics.performance.systemLoad).toBeGreaterThan(0.8);
  });

  it('should track rate limit recovery patterns', async () => {
    const timeWindows = [
      { window: 1000, requests: 5 },
      { window: 2000, requests: 8 },
      { window: 3000, requests: 12 }
    ];

    for (const window of timeWindows) {
      const start = Date.now();
      const requests = Array(window.requests).fill(null);

      for (const _ of requests) {
        try {
          await runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'POST', url: '/api/window-test' },
              async () => {
                const elapsed = Date.now() - start;
                if (elapsed < window.window) {
                  throw { status: 429, message: 'Window rate limit exceeded' };
                }
                return { status: 'success' };
              }
            );
          });
        } catch (e) {
          expect(e).toBeDefined();
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.rateLimitRecovery).toBeDefined();
    expect(metrics.performance.windowViolations).toBeGreaterThan(0);
  });

  it('should handle distributed rate limiting', async () => {
    const services = [
      { id: 'service-1', limit: 5 },
      { id: 'service-2', limit: 3 },
      { id: 'service-3', limit: 4 }
    ];

    for (const service of services) {
      const requests = Array(service.limit + 1).fill(null);
      let currentCount = 0;

      await Promise.all(
        requests.map(async () => {
          try {
            await runDebugApiTest(async () => {
              await debugMetricsMiddleware(
                { method: 'POST', url: `/api/${service.id}` },
                async () => {
                  currentCount++;
                  if (currentCount > service.limit) {
                    throw { status: 429, message: 'Service rate limit exceeded' };
                  }
                  return { status: 'success' };
                }
              );
            });
          } catch (e) {
            expect(e).toBeDefined();
          }
        })
      );
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.serviceThrottling).toBeDefined();
    expect(metrics.performance.distributedLimits).toBeDefined();
  });
});
