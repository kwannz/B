import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Performance Metrics Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should track real-time performance metrics', async () => {
    const performanceTests = [
      { endpoint: '/api/trades', latency: 100, load: 0.3 },
      { endpoint: '/api/wallets', latency: 150, load: 0.5 },
      { endpoint: '/api/bots', latency: 200, load: 0.7 }
    ];

    for (const test of performanceTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: test.endpoint },
          async () => {
            await new Promise(resolve => 
              setTimeout(resolve, test.latency)
            );
            return {
              latency: test.latency,
              system_load: test.load,
              timestamp: Date.now()
            };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.latencyTrend).toBeDefined();
    expect(metrics.performance.loadDistribution).toBeDefined();
  });

  it('should aggregate performance data across services', async () => {
    const serviceTests = [
      { service: 'trading', metrics: { cpu: 0.4, memory: 0.6, io: 0.3 } },
      { service: 'wallet', metrics: { cpu: 0.5, memory: 0.7, io: 0.4 } },
      { service: 'analytics', metrics: { cpu: 0.6, memory: 0.8, io: 0.5 } }
    ];

    for (const test of serviceTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: `/metrics/${test.service}` },
          async () => ({
            service: test.service,
            metrics: test.metrics,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.serviceMetrics).toBeDefined();
    expect(metrics.performance.aggregateLoad).toBeGreaterThan(0);
  });

  it('should detect performance anomalies', async () => {
    const anomalyTests = Array(10).fill(null).map((_, i) => ({
      latency: i === 5 ? 1000 : 100,
      error_rate: i === 7 ? 0.9 : 0.1,
      throughput: i === 3 ? 10 : 100
    }));

    for (const test of anomalyTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/metrics/anomaly' },
          async () => ({
            metrics: test,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.anomalyCount).toBeGreaterThan(0);
    expect(metrics.performance.anomalyPatterns).toBeDefined();
  });

  it('should track performance degradation patterns', async () => {
    const degradationTests = Array(5).fill(null).map((_, i) => ({
      baseline: 100,
      current: 100 * (1 + i * 0.2),
      threshold: 100 * 1.5
    }));

    for (const test of degradationTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/metrics/degradation' },
          async () => ({
            baseline_performance: test.baseline,
            current_performance: test.current,
            threshold: test.threshold,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.degradationRate).toBeGreaterThan(0);
    expect(metrics.performance.thresholdViolations).toBeDefined();
  });

  it('should implement adaptive performance thresholds', async () => {
    const thresholdTests = [
      { load: 0.3, threshold: 200 },
      { load: 0.6, threshold: 300 },
      { load: 0.9, threshold: 500 }
    ];

    for (const test of thresholdTests) {
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
          { method: 'POST', url: '/metrics/threshold' },
          async () => ({
            adaptive_threshold: test.threshold,
            current_load: test.load,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.adaptiveThresholds).toBeDefined();
    expect(metrics.performance.thresholdAdjustments).toBeGreaterThan(0);
  });
});
