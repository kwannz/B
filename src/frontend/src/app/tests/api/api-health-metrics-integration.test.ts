import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Health Metrics Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should track system health indicators', async () => {
    const healthTests = [
      { component: 'api', status: 'healthy', metrics: { cpu: 0.3, memory: 0.4 } },
      { component: 'database', status: 'degraded', metrics: { cpu: 0.7, memory: 0.8 } },
      { component: 'cache', status: 'healthy', metrics: { cpu: 0.4, memory: 0.5 } }
    ];

    for (const test of healthTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: `/health/${test.component}` },
          async () => ({
            component: test.component,
            status: test.status,
            metrics: test.metrics,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.health.componentStatus).toBeDefined();
    expect(metrics.health.resourceUtilization).toBeDefined();
  });

  it('should monitor service dependencies', async () => {
    const dependencyTests = [
      { service: 'trading', dependencies: ['api', 'database'] },
      { service: 'analytics', dependencies: ['database', 'cache'] },
      { service: 'monitoring', dependencies: ['metrics', 'logging'] }
    ];

    for (const test of dependencyTests) {
      await Promise.all(
        test.dependencies.map(async dep => {
          await runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'GET', url: `/health/dependencies/${test.service}/${dep}` },
              async () => ({
                service: test.service,
                dependency: dep,
                status: Math.random() > 0.2 ? 'healthy' : 'degraded',
                timestamp: Date.now()
              })
            );
          });
        })
      );
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.health.dependencyMap).toBeDefined();
    expect(metrics.health.serviceHealth).toBeDefined();
  });

  it('should track performance degradation patterns', async () => {
    const degradationTests = Array(5).fill(null).map((_, i) => ({
      service: 'api',
      latency: 100 * (1 + i * 0.2),
      errorRate: 0.01 * (i + 1),
      throughput: 1000 / (i + 1)
    }));

    for (const test of degradationTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/health/performance' },
          async () => ({
            service: test.service,
            metrics: {
              latency: test.latency,
              errorRate: test.errorRate,
              throughput: test.throughput
            },
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.health.degradationPatterns).toBeDefined();
    expect(metrics.health.performanceTrends).toBeDefined();
  });

  it('should implement health check thresholds', async () => {
    const thresholdTests = [
      { load: 0.3, thresholds: { latency: 200, errors: 0.01 } },
      { load: 0.6, thresholds: { latency: 300, errors: 0.02 } },
      { load: 0.9, thresholds: { latency: 500, errors: 0.05 } }
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
          { method: 'POST', url: '/health/thresholds' },
          async () => ({
            load: test.load,
            thresholds: test.thresholds,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.health.thresholdAdjustments).toBeDefined();
    expect(metrics.health.loadCorrelation).toBeDefined();
  });

  it('should track system recovery patterns', async () => {
    const recoveryTests = [
      { incident: 'high-load', duration: 1000, recovered: true },
      { incident: 'error-spike', duration: 2000, recovered: true },
      { incident: 'dependency-failure', duration: 3000, recovered: false }
    ];

    for (const test of recoveryTests) {
      const startTime = Date.now();
      let attempts = 0;

      while (Date.now() - startTime < test.duration) {
        attempts++;
        try {
          await runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'POST', url: '/health/recovery' },
              async () => {
                if (!test.recovered && attempts === 3) {
                  throw new Error('Recovery failed');
                }
                return {
                  incident: test.incident,
                  attempts,
                  duration: Date.now() - startTime,
                  recovered: test.recovered,
                  timestamp: Date.now()
                };
              }
            );
          });
          break;
        } catch (e) {
          expect(e).toBeDefined();
        }
      }

      expect(attempts).toBeLessThanOrEqual(3);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.health.recoveryPatterns).toBeDefined();
    expect(metrics.health.incidentResolution).toBeDefined();
  });
});
