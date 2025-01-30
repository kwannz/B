import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Health Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should track system-wide health metrics', async () => {
    const healthChecks = [
      { component: 'api', status: 'healthy', latency: 50 },
      { component: 'database', status: 'degraded', latency: 200 },
      { component: 'trading', status: 'healthy', latency: 100 },
      { component: 'monitoring', status: 'healthy', latency: 75 }
    ];

    for (const check of healthChecks) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: `/api/health/${check.component}` },
          async () => {
            await new Promise(resolve => setTimeout(resolve, check.latency));
            return { status: check.status };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.systemHealth).toBeLessThan(1);
    expect(metrics.performance.componentHealth).toBeDefined();
  });

  it('should monitor resource utilization', async () => {
    const resources = [
      { cpu: 0.4, memory: 0.6, disk: 0.3 },
      { cpu: 0.6, memory: 0.7, disk: 0.4 },
      { cpu: 0.8, memory: 0.8, disk: 0.5 }
    ];

    for (const resource of resources) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: '/api/metrics/resources' },
          async () => {
            useDebugStore.setState(state => ({
              ...state,
              metrics: {
                ...state.metrics,
                performance: {
                  ...state.metrics.performance,
                  resourceUsage: Math.max(resource.cpu, resource.memory, resource.disk)
                }
              }
            }));
            return resource;
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.resourceUsage).toBeGreaterThan(0.7);
    expect(metrics.performance.systemHealth).toBeLessThan(1);
  });

  it('should track API endpoint health', async () => {
    const endpoints = [
      { path: '/wallets', success: 95, error: 5, latency: 100 },
      { path: '/bots', success: 90, error: 10, latency: 150 },
      { path: '/trades', success: 85, error: 15, latency: 200 }
    ];

    for (const endpoint of endpoints) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: `/api/metrics/endpoints${endpoint.path}` },
          async () => {
            return {
              success_rate: endpoint.success / (endpoint.success + endpoint.error),
              avg_latency: endpoint.latency
            };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.endpointHealth).toBeDefined();
    expect(metrics.performance.apiLatency).toBeGreaterThan(0);
  });

  it('should monitor system dependencies', async () => {
    const dependencies = [
      { name: 'database', status: 'connected', latency: 50 },
      { name: 'cache', status: 'connected', latency: 20 },
      { name: 'queue', status: 'degraded', latency: 300 }
    ];

    for (const dep of dependencies) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: `/api/health/dependencies/${dep.name}` },
          async () => {
            await new Promise(resolve => setTimeout(resolve, dep.latency));
            return { status: dep.status };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.dependencyHealth).toBeDefined();
    expect(metrics.alerts.warning).toBeGreaterThan(0);
  });

  it('should track error rates across components', async () => {
    const errorScenarios = [
      { component: 'api', errors: 5, total: 100 },
      { component: 'trading', errors: 2, total: 50 },
      { component: 'wallet', errors: 1, total: 40 }
    ];

    for (const scenario of errorScenarios) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: `/api/metrics/errors/${scenario.component}` },
          async () => {
            return {
              error_rate: scenario.errors / scenario.total,
              total_requests: scenario.total
            };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.errorRate).toBeGreaterThan(0);
    expect(metrics.performance.componentErrors).toBeDefined();
  });
});
