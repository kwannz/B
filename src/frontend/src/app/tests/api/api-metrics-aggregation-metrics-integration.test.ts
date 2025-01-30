import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Metrics Aggregation Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should aggregate system-wide metrics', async () => {
    const systemTests = [
      { component: 'api', metrics: { latency: 100, errors: 0 } },
      { component: 'database', metrics: { latency: 150, errors: 2 } },
      { component: 'cache', metrics: { latency: 50, errors: 1 } }
    ];

    for (const test of systemTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/metrics/system' },
          async () => ({
            component: test.component,
            metrics: test.metrics,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.system.aggregateLatency).toBeGreaterThan(0);
    expect(metrics.system.totalErrors).toBe(3);
  });

  it('should track performance metrics distribution', async () => {
    const performanceTests = Array(10).fill(null).map((_, i) => ({
      operation: 'trade',
      duration: 100 * (1 + i * 0.1),
      resources: { cpu: 0.3 + i * 0.05, memory: 0.4 + i * 0.03 }
    }));

    for (const test of performanceTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/metrics/performance' },
          async () => ({
            operation: test.operation,
            duration: test.duration,
            resources: test.resources,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.distribution).toBeDefined();
    expect(metrics.performance.resourceUsage).toBeDefined();
  });

  it('should implement real-time metrics collection', async () => {
    const realTimeTests = [
      { interval: 100, samples: 5 },
      { interval: 200, samples: 3 },
      { interval: 300, samples: 2 }
    ];

    for (const test of realTimeTests) {
      const samples = Array(test.samples).fill(null);
      let collected = 0;

      await Promise.all(
        samples.map(async (_, i) => {
          await new Promise(resolve => 
            setTimeout(resolve, test.interval * i)
          );
          await runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'POST', url: '/metrics/realtime' },
              async () => {
                collected++;
                return {
                  sample: i,
                  interval: test.interval,
                  collected,
                  timestamp: Date.now()
                };
              }
            );
          });
        })
      );

      expect(collected).toBe(test.samples);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.realtime.sampleRate).toBeGreaterThan(0);
    expect(metrics.realtime.collectionPatterns).toBeDefined();
  });

  it('should track metrics storage patterns', async () => {
    const storageTests = [
      { retention: '1h', metrics: 100 },
      { retention: '1d', metrics: 50 },
      { retention: '1w', metrics: 25 }
    ];

    for (const test of storageTests) {
      const metrics = Array(test.metrics).fill(null);
      let stored = 0;

      await Promise.all(
        metrics.map(async (_, i) => {
          await runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'POST', url: '/metrics/storage' },
              async () => {
                stored++;
                return {
                  retention: test.retention,
                  sequence: i,
                  stored,
                  timestamp: Date.now()
                };
              }
            );
          });
        })
      );

      expect(stored).toBe(test.metrics);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.storage.retentionRate).toBeDefined();
    expect(metrics.storage.compressionRatio).toBeGreaterThan(0);
  });

  it('should implement metrics aggregation windows', async () => {
    const windowTests = [
      { window: '1m', metrics: 60 },
      { window: '5m', metrics: 30 },
      { window: '15m', metrics: 15 }
    ];

    for (const test of windowTests) {
      const metrics = Array(test.metrics).fill(null);
      let aggregated = 0;

      await Promise.all(
        metrics.map(async (_, i) => {
          await runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'POST', url: '/metrics/windows' },
              async () => {
                aggregated++;
                return {
                  window: test.window,
                  sequence: i,
                  aggregated,
                  timestamp: Date.now()
                };
              }
            );
          });
        })
      );

      expect(aggregated).toBe(test.metrics);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.windows.aggregationRate).toBeDefined();
    expect(metrics.windows.windowCoverage).toBeGreaterThan(0);
  });
});
