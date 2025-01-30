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

  it('should aggregate system-wide performance metrics', async () => {
    const performanceData = [
      { cpu: 0.4, memory: 0.6, latency: 100, errors: 2 },
      { cpu: 0.5, memory: 0.7, latency: 150, errors: 1 },
      { cpu: 0.6, memory: 0.8, latency: 200, errors: 3 }
    ];

    for (const data of performanceData) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/metrics/performance' },
          async () => ({
            cpu_usage: data.cpu,
            memory_usage: data.memory,
            response_time: data.latency,
            error_count: data.errors,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.avgLatency).toBeGreaterThan(0);
    expect(metrics.performance.errorRate).toBeDefined();
  });

  it('should track metrics collection patterns', async () => {
    const collectionTests = Array(5).fill(null).map((_, i) => ({
      interval: 1000 * (i + 1),
      samples: 5 - i,
      metrics: ['cpu', 'memory', 'network', 'disk']
    }));

    for (const test of collectionTests) {
      await Promise.all(
        Array(test.samples).fill(null).map(async (_, i) => {
          await runDebugApiTest(async () => {
            await new Promise(resolve => 
              setTimeout(resolve, i * test.interval / test.samples)
            );
            await debugMetricsMiddleware(
              { method: 'POST', url: '/metrics/collect' },
              async () => ({
                metrics: test.metrics.reduce((acc, metric) => ({
                  ...acc,
                  [metric]: Math.random()
                }), {}),
                interval: test.interval,
                timestamp: Date.now()
              })
            );
          });
        })
      );
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.collection.sampleRate).toBeGreaterThan(0);
    expect(metrics.collection.coverage).toBeDefined();
  });

  it('should handle metrics aggregation windows', async () => {
    const windows = [
      { duration: '1m', metrics: 10 },
      { duration: '5m', metrics: 5 },
      { duration: '15m', metrics: 3 }
    ];

    for (const window of windows) {
      const metrics = Array(window.metrics).fill(null);
      await Promise.all(
        metrics.map(async (_, i) => {
          await runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'POST', url: '/metrics/window' },
              async () => ({
                window: window.duration,
                value: Math.random(),
                sequence: i,
                timestamp: Date.now()
              })
            );
          });
        })
      );
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.aggregation.windowCoverage).toBeDefined();
    expect(metrics.aggregation.completeness).toBeGreaterThan(0);
  });

  it('should track metrics correlation patterns', async () => {
    const correlationTests = [
      { metrics: ['cpu', 'memory'], correlation: 0.8 },
      { metrics: ['latency', 'errors'], correlation: 0.6 },
      { metrics: ['requests', 'throughput'], correlation: 0.9 }
    ];

    for (const test of correlationTests) {
      const samples = Array(10).fill(null);
      await Promise.all(
        samples.map(async (_, i) => {
          await runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'POST', url: '/metrics/correlation' },
              async () => ({
                metrics: test.metrics,
                values: test.metrics.map(m => Math.random()),
                correlation: test.correlation,
                timestamp: Date.now()
              })
            );
          });
        })
      );
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.analysis.correlations).toBeDefined();
    expect(metrics.analysis.patterns).toBeDefined();
  });

  it('should implement adaptive metric collection', async () => {
    const adaptiveTests = [
      { load: 0.3, interval: 1000 },
      { load: 0.6, interval: 2000 },
      { load: 0.9, interval: 5000 }
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

      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/metrics/adaptive' },
          async () => {
            await new Promise(resolve => 
              setTimeout(resolve, test.interval)
            );
            return {
              load: test.load,
              collection_interval: test.interval,
              timestamp: Date.now()
            };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.collection.adaptiveRate).toBeDefined();
    expect(metrics.collection.efficiency).toBeGreaterThan(0);
  });
});
