import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Monitoring Integration', () => {
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
    const healthChecks = [
      { component: 'api', status: 'healthy', load: 0.3 },
      { component: 'database', status: 'degraded', load: 0.7 },
      { component: 'cache', status: 'healthy', load: 0.4 }
    ];

    for (const check of healthChecks) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: `/health/${check.component}` },
          async () => ({
            status: check.status,
            systemLoad: check.load,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.system.healthScore).toBeDefined();
    expect(metrics.system.componentStatus).toBeDefined();
  });

  it('should monitor resource utilization', async () => {
    const resourceMetrics = [
      { cpu: 0.45, memory: 0.6, disk: 0.3 },
      { cpu: 0.65, memory: 0.7, disk: 0.4 },
      { cpu: 0.85, memory: 0.8, disk: 0.5 }
    ];

    for (const metric of resourceMetrics) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: '/metrics/resources' },
          async () => ({
            cpu_usage: metric.cpu,
            memory_usage: metric.memory,
            disk_usage: metric.disk,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.system.resourceUtilization).toBeGreaterThan(0);
    expect(metrics.system.resourceTrends).toBeDefined();
  });

  it('should track performance degradation', async () => {
    const performanceTests = Array(5).fill(null).map((_, i) => ({
      latency: 100 * (i + 1),
      errorRate: 0.1 * i,
      throughput: 1000 / (i + 1)
    }));

    for (const test of performanceTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/metrics/performance' },
          async () => {
            await new Promise(resolve => 
              setTimeout(resolve, test.latency)
            );
            return {
              latency: test.latency,
              error_rate: test.errorRate,
              throughput: test.throughput
            };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.degradationRate).toBeDefined();
    expect(metrics.performance.throughputTrend).toBeDefined();
  });

  it('should handle system alerts', async () => {
    const alerts = [
      { level: 'warning', component: 'api', threshold: 0.7 },
      { level: 'critical', component: 'database', threshold: 0.9 },
      { level: 'info', component: 'cache', threshold: 0.5 }
    ];

    for (const alert of alerts) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/alerts' },
          async () => ({
            level: alert.level,
            component: alert.component,
            threshold: alert.threshold,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.alerts.critical).toBeGreaterThan(0);
    expect(metrics.alerts.warning).toBeGreaterThan(0);
  });

  it('should track system dependencies', async () => {
    const dependencies = [
      { service: 'database', status: 'up', responseTime: 50 },
      { service: 'cache', status: 'degraded', responseTime: 150 },
      { service: 'queue', status: 'down', responseTime: 500 }
    ];

    for (const dep of dependencies) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: `/dependencies/${dep.service}` },
          async () => {
            await new Promise(resolve => 
              setTimeout(resolve, dep.responseTime)
            );
            return {
              status: dep.status,
              response_time: dep.responseTime
            };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.system.dependencies).toBeDefined();
    expect(metrics.system.dependencyHealth).toBeLessThan(1);
  });
});
