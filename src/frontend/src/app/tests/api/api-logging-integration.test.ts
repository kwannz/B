import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Logging Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should track log levels and patterns', async () => {
    const logTests = [
      { level: 'info', message: 'System startup', count: 5 },
      { level: 'warn', message: 'Performance degradation', count: 3 },
      { level: 'error', message: 'API failure', count: 2 }
    ];

    for (const test of logTests) {
      const logs = Array(test.count).fill(null);
      await Promise.all(
        logs.map(async (_, i) => {
          await runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'POST', url: '/api/logs' },
              async () => ({
                level: test.level,
                message: `${test.message} ${i + 1}`,
                timestamp: Date.now()
              })
            );
          });
        })
      );
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.logging.totalLogs).toBeGreaterThan(0);
    expect(metrics.logging.errorRate).toBeDefined();
  });

  it('should implement log retention policies', async () => {
    const retentionTests = [
      { age: '1h', count: 100 },
      { age: '1d', count: 50 },
      { age: '1w', count: 25 }
    ];

    for (const test of retentionTests) {
      const logs = Array(test.count).fill(null);
      await Promise.all(
        logs.map(async (_, i) => {
          await runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'POST', url: '/api/logs/retention' },
              async () => ({
                retention: test.age,
                sequence: i,
                timestamp: Date.now() - i * 3600000
              })
            );
          });
        })
      );
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.logging.retentionRate).toBeDefined();
    expect(metrics.logging.oldestLog).toBeDefined();
  });

  it('should track log source distribution', async () => {
    const sourceTests = [
      { source: 'api', logs: 10 },
      { source: 'database', logs: 5 },
      { source: 'cache', logs: 3 }
    ];

    for (const test of sourceTests) {
      const logs = Array(test.logs).fill(null);
      await Promise.all(
        logs.map(async (_, i) => {
          await runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'POST', url: `/api/logs/${test.source}` },
              async () => ({
                source: test.source,
                sequence: i,
                timestamp: Date.now()
              })
            );
          });
        })
      );
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.logging.sourceDistribution).toBeDefined();
    expect(metrics.logging.sourceCoverage).toBeGreaterThan(0);
  });

  it('should handle log aggregation', async () => {
    const aggregationTests = [
      { window: '1m', logs: 60 },
      { window: '5m', logs: 30 },
      { window: '15m', logs: 15 }
    ];

    for (const test of aggregationTests) {
      const logs = Array(test.logs).fill(null);
      await Promise.all(
        logs.map(async (_, i) => {
          await runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'POST', url: '/api/logs/aggregate' },
              async () => ({
                window: test.window,
                count: test.logs,
                sequence: i,
                timestamp: Date.now()
              })
            );
          });
        })
      );
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.logging.aggregationRate).toBeDefined();
    expect(metrics.logging.windowCoverage).toBeGreaterThan(0);
  });

  it('should track error patterns', async () => {
    const errorTests = [
      { type: 'validation', count: 5, pattern: 'invalid_input' },
      { type: 'auth', count: 3, pattern: 'unauthorized' },
      { type: 'system', count: 2, pattern: 'timeout' }
    ];

    for (const test of errorTests) {
      const errors = Array(test.count).fill(null);
      await Promise.all(
        errors.map(async (_, i) => {
          try {
            await runDebugApiTest(async () => {
              await debugMetricsMiddleware(
                { method: 'POST', url: '/api/errors' },
                async () => {
                  throw {
                    type: test.type,
                    pattern: test.pattern,
                    sequence: i,
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
    expect(metrics.logging.errorPatterns).toBeDefined();
    expect(metrics.logging.errorDistribution).toBeDefined();
  });
});
