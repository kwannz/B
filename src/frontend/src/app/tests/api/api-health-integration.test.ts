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

  it('should track system vitals', async () => {
    const vitalChecks = [
      { cpu: 0.4, memory: 0.6, disk: 0.3, network: 0.5 },
      { cpu: 0.6, memory: 0.7, disk: 0.4, network: 0.6 },
      { cpu: 0.8, memory: 0.8, disk: 0.5, network: 0.7 }
    ];

    for (const check of vitalChecks) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: '/health/vitals' },
          async () => ({
            cpu_usage: check.cpu,
            memory_usage: check.memory,
            disk_usage: check.disk,
            network_usage: check.network,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.system.cpuUsage).toBeGreaterThan(0);
    expect(metrics.system.memoryUsage).toBeGreaterThan(0);
  });

  it('should monitor service dependencies', async () => {
    const dependencies = [
      { service: 'database', status: 'healthy', latency: 50 },
      { service: 'cache', status: 'degraded', latency: 200 },
      { service: 'queue', status: 'healthy', latency: 75 }
    ];

    for (const dep of dependencies) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: `/health/dependencies/${dep.service}` },
          async () => {
            await new Promise(resolve => setTimeout(resolve, dep.latency));
            return {
              status: dep.status,
              response_time: dep.latency,
              timestamp: Date.now()
            };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.system.dependencyHealth).toBeDefined();
    expect(metrics.system.serviceLatency).toBeGreaterThan(0);
  });

  it('should track error rates and patterns', async () => {
    const errorScenarios = [
      { type: 'validation', count: 3, window: 1000 },
      { type: 'timeout', count: 2, window: 2000 },
      { type: 'system', count: 1, window: 3000 }
    ];

    for (const scenario of errorScenarios) {
      const errors = Array(scenario.count).fill(null);
      await Promise.all(
        errors.map(async (_, i) => {
          try {
            await runDebugApiTest(async () => {
              await new Promise(resolve => 
                setTimeout(resolve, i * (scenario.window / scenario.count))
              );
              await debugMetricsMiddleware(
                { method: 'POST', url: '/health/errors' },
                async () => {
                  throw {
                    type: scenario.type,
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
    expect(metrics.system.errorRate).toBeGreaterThan(0);
    expect(metrics.system.errorPatterns).toBeDefined();
  });

  it('should monitor system performance degradation', async () => {
    const performanceTests = Array(5).fill(null).map((_, i) => ({
      load: 0.2 * (i + 1),
      latency: 50 * (i + 1),
      errors: Math.floor(i / 2)
    }));

    for (const test of performanceTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/health/performance' },
          async () => {
            await new Promise(resolve => setTimeout(resolve, test.latency));
            return {
              system_load: test.load,
              response_time: test.latency,
              error_count: test.errors
            };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.system.performanceDegradation).toBeDefined();
    expect(metrics.system.loadTrend).toBeGreaterThan(0);
  });

  it('should track system recovery patterns', async () => {
    const recoveryTests = [
      { initial_health: 0.4, recovery_time: 1000, success: true },
      { initial_health: 0.2, recovery_time: 2000, success: false },
      { initial_health: 0.6, recovery_time: 500, success: true }
    ];

    for (const test of recoveryTests) {
      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/health/recovery' },
            async () => {
              await new Promise(resolve => 
                setTimeout(resolve, test.recovery_time)
              );
              if (!test.success) {
                throw new Error('Recovery failed');
              }
              return {
                initial_health: test.initial_health,
                final_health: test.success ? 0.9 : test.initial_health,
                recovery_time: test.recovery_time
              };
            }
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.system.recoveryRate).toBeDefined();
    expect(metrics.system.meanTimeToRecovery).toBeGreaterThan(0);
  });
});
