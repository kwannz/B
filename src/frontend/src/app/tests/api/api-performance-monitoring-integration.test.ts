import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Performance Monitoring Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should track API response times', async () => {
    const latencyTests = [
      { endpoint: '/api/trades', latency: 100 },
      { endpoint: '/api/wallets', latency: 150 },
      { endpoint: '/api/bots', latency: 200 }
    ];

    for (const test of latencyTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: test.endpoint },
          async () => {
            await new Promise(resolve => 
              setTimeout(resolve, test.latency)
            );
            return { status: 'success' };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.avgLatency).toBeGreaterThan(0);
    expect(metrics.performance.latencyDistribution).toBeDefined();
  });

  it('should monitor throughput degradation', async () => {
    const throughputTests = Array(5).fill(null).map((_, i) => ({
      requests: 10 * (i + 1),
      interval: 1000,
      success: i < 3
    }));

    for (const test of throughputTests) {
      const requests = Array(test.requests).fill(null);
      await Promise.all(
        requests.map(async (_, i) => {
          try {
            await runDebugApiTest(async () => {
              await debugMetricsMiddleware(
                { method: 'POST', url: '/api/throughput-test' },
                async () => {
                  if (!test.success && i === test.requests - 1) {
                    throw new Error('Throughput limit exceeded');
                  }
                  return {
                    request: i,
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
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.throughput).toBeDefined();
    expect(metrics.performance.degradationRate).toBeGreaterThan(0);
  });

  it('should track resource utilization', async () => {
    const resourceTests = [
      { cpu: 0.4, memory: 0.5, disk: 0.3 },
      { cpu: 0.6, memory: 0.7, disk: 0.4 },
      { cpu: 0.8, memory: 0.9, disk: 0.5 }
    ];

    for (const test of resourceTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: '/api/resources' },
          async () => ({
            cpu_usage: test.cpu,
            memory_usage: test.memory,
            disk_usage: test.disk,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.resources.cpuUsage).toBeGreaterThan(0);
    expect(metrics.resources.memoryUsage).toBeGreaterThan(0);
  });

  it('should implement adaptive rate limiting', async () => {
    const rateLimitTests = [
      { load: 0.3, limit: 100 },
      { load: 0.6, limit: 50 },
      { load: 0.9, limit: 25 }
    ];

    for (const test of rateLimitTests) {
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

      const requests = Array(test.limit + 10).fill(null);
      let accepted = 0;

      await Promise.all(
        requests.map(async (_, i) => {
          try {
            await runDebugApiTest(async () => {
              await debugMetricsMiddleware(
                { method: 'POST', url: '/api/rate-limit-test' },
                async () => {
                  if (i >= test.limit) {
                    throw new Error('Rate limit exceeded');
                  }
                  accepted++;
                  return { accepted, limit: test.limit };
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
    expect(metrics.performance.rateLimit).toBeDefined();
    expect(metrics.performance.adaptiveScaling).toBeDefined();
  });

  it('should track error rate patterns', async () => {
    const errorTests = Array(5).fill(null).map((_, i) => ({
      requests: 20,
      errorRate: 0.1 * (i + 1)
    }));

    for (const test of errorTests) {
      const requests = Array(test.requests).fill(null);
      let errors = 0;

      await Promise.all(
        requests.map(async (_, i) => {
          try {
            await runDebugApiTest(async () => {
              await debugMetricsMiddleware(
                { method: 'POST', url: '/api/error-test' },
                async () => {
                  if (Math.random() < test.errorRate) {
                    errors++;
                    throw new Error('Random error');
                  }
                  return { success: true };
                }
              );
            });
          } catch (e) {
            expect(e).toBeDefined();
          }
        })
      );

      expect(errors / test.requests).toBeCloseTo(test.errorRate, 1);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.errorRate).toBeGreaterThan(0);
    expect(metrics.performance.errorPatterns).toBeDefined();
  });
});
