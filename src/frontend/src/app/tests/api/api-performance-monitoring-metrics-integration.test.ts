import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Performance Monitoring Metrics Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should track endpoint performance metrics', async () => {
    const endpointTests = [
      { path: '/api/trades', latency: 100, load: 0.3 },
      { path: '/api/wallets', latency: 150, load: 0.5 },
      { path: '/api/bots', latency: 200, load: 0.7 }
    ];

    for (const test of endpointTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: test.path },
          async () => {
            await new Promise(resolve => 
              setTimeout(resolve, test.latency)
            );
            return {
              path: test.path,
              latency: test.latency,
              load: test.load,
              timestamp: Date.now()
            };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.endpointLatency).toBeDefined();
    expect(metrics.performance.loadDistribution).toBeDefined();
  });

  it('should implement performance optimization triggers', async () => {
    const optimizationTests = [
      { threshold: 200, current: 250, optimize: true },
      { threshold: 300, current: 280, optimize: false },
      { threshold: 400, current: 450, optimize: true }
    ];

    for (const test of optimizationTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/performance/optimize' },
          async () => {
            if (test.optimize) {
              await new Promise(resolve => 
                setTimeout(resolve, test.current - test.threshold)
              );
            }
            return {
              threshold: test.threshold,
              current: test.current,
              optimized: test.optimize,
              timestamp: Date.now()
            };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.optimizationTriggers).toBeGreaterThan(0);
    expect(metrics.performance.thresholdViolations).toBeDefined();
  });

  it('should track resource utilization patterns', async () => {
    const resourceTests = [
      { type: 'cpu', usage: [0.3, 0.4, 0.5] },
      { type: 'memory', usage: [0.4, 0.5, 0.6] },
      { type: 'network', usage: [0.2, 0.3, 0.4] }
    ];

    for (const test of resourceTests) {
      await Promise.all(
        test.usage.map(async usage => {
          await runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'POST', url: `/api/resources/${test.type}` },
              async () => ({
                type: test.type,
                usage,
                timestamp: Date.now()
              })
            );
          });
        })
      );
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.resources.utilizationPatterns).toBeDefined();
    expect(metrics.resources.typeDistribution).toBeDefined();
  });

  it('should monitor performance degradation patterns', async () => {
    const degradationTests = Array(5).fill(null).map((_, i) => ({
      baseline: 100,
      current: 100 * (1 + i * 0.2),
      threshold: 100 * 1.5
    }));

    for (const test of degradationTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/performance/degradation' },
          async () => ({
            baseline: test.baseline,
            current: test.current,
            threshold: test.threshold,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.degradationRate).toBeGreaterThan(0);
    expect(metrics.performance.degradationPatterns).toBeDefined();
  });

  it('should track optimization effectiveness', async () => {
    const optimizationTests = [
      { strategy: 'caching', improvement: 0.3 },
      { strategy: 'batching', improvement: 0.4 },
      { strategy: 'indexing', improvement: 0.2 }
    ];

    for (const test of optimizationTests) {
      const before = Date.now();
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/performance/optimize' },
          async () => {
            await new Promise(resolve => 
              setTimeout(resolve, 100 * (1 - test.improvement))
            );
            return {
              strategy: test.strategy,
              before,
              after: Date.now(),
              improvement: test.improvement
            };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.optimization.effectiveness).toBeGreaterThan(0);
    expect(metrics.optimization.strategyImpact).toBeDefined();
  });
});
