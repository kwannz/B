import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Monitoring Metrics Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should track system health metrics', async () => {
    const healthTests = [
      { service: 'api', status: 'healthy', load: 0.3 },
      { service: 'database', status: 'degraded', load: 0.7 },
      { service: 'cache', status: 'healthy', load: 0.4 }
    ];

    for (const test of healthTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: `/health/${test.service}` },
          async () => ({
            service: test.service,
            status: test.status,
            load: test.load,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.health.systemStatus).toBeDefined();
    expect(metrics.health.serviceHealth).toBeDefined();
  });

  it('should implement resource monitoring', async () => {
    const resourceTests = [
      { type: 'cpu', usage: 0.6, threshold: 0.8 },
      { type: 'memory', usage: 0.7, threshold: 0.9 },
      { type: 'disk', usage: 0.5, threshold: 0.85 }
    ];

    for (const test of resourceTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: `/metrics/resources/${test.type}` },
          async () => ({
            type: test.type,
            usage: test.usage,
            threshold: test.threshold,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.resources.usage).toBeDefined();
    expect(metrics.resources.thresholds).toBeDefined();
  });

  it('should track performance degradation', async () => {
    const degradationTests = Array(5).fill(null).map((_, i) => ({
      latency: 100 * (1 + i * 0.2),
      errorRate: 0.01 * (i + 1),
      throughput: 1000 / (i + 1)
    }));

    for (const test of degradationTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/metrics/performance' },
          async () => ({
            metrics: test,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.degradation).toBeGreaterThan(0);
    expect(metrics.performance.trends).toBeDefined();
  });

  it('should implement adaptive monitoring thresholds', async () => {
    const thresholdTests = [
      { load: 0.3, threshold: { latency: 200, errors: 0.01 } },
      { load: 0.6, threshold: { latency: 300, errors: 0.02 } },
      { load: 0.9, threshold: { latency: 500, errors: 0.05 } }
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
          { method: 'POST', url: '/metrics/thresholds' },
          async () => ({
            load: test.load,
            thresholds: test.threshold,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.monitoring.adaptiveThresholds).toBeDefined();
    expect(metrics.monitoring.loadCorrelation).toBeDefined();
  });

  it('should track service dependencies', async () => {
    const dependencyTests = [
      { service: 'api', dependencies: ['database', 'cache'] },
      { service: 'trading', dependencies: ['api', 'market-data'] },
      { service: 'analytics', dependencies: ['database', 'api'] }
    ];

    for (const test of dependencyTests) {
      const checks = test.dependencies.map(async dep => {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'GET', url: `/health/dependency/${test.service}/${dep}` },
            async () => ({
              service: test.service,
              dependency: dep,
              status: Math.random() > 0.2 ? 'healthy' : 'degraded',
              timestamp: Date.now()
            })
          );
        });
      });

      await Promise.all(checks);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.dependencies.serviceMap).toBeDefined();
    expect(metrics.dependencies.healthStatus).toBeDefined();
  });

  it('should implement cascading failure detection', async () => {
    const failureTests = [
      { service: 'database', impact: ['api', 'cache'] },
      { service: 'api', impact: ['trading', 'analytics'] },
      { service: 'market-data', impact: ['trading'] }
    ];

    for (const test of failureTests) {
      const cascades = test.impact.map(async (service, i) => {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/metrics/cascade' },
            async () => {
              if (i === 0) {
                throw new Error(`${test.service} failure`);
              }
              return {
                source: test.service,
                impacted: service,
                delay: i * 100,
                timestamp: Date.now()
              };
            }
          );
        });
      });

      await Promise.all(cascades);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.failures.cascadePatterns).toBeDefined();
    expect(metrics.failures.impactAnalysis).toBeDefined();
  });
});
