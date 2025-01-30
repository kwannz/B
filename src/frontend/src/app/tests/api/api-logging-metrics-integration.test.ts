import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Logging Metrics Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should track log level distribution', async () => {
    const logTests = [
      { level: 'info', message: 'System startup', count: 5 },
      { level: 'warn', message: 'Performance degradation', count: 3 },
      { level: 'error', message: 'Operation failed', count: 2 }
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
                message: test.message,
                sequence: i,
                timestamp: Date.now()
              })
            );
          });
        })
      );
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.logging.levelDistribution).toBeDefined();
    expect(metrics.logging.messagePatterns).toBeDefined();
  });

  it('should implement log aggregation patterns', async () => {
    const aggregationTests = [
      { component: 'api', logs: 10 },
      { component: 'trading', logs: 15 },
      { component: 'wallet', logs: 20 }
    ];

    for (const test of aggregationTests) {
      const logs = Array(test.logs).fill(null);
      let aggregated = 0;

      await Promise.all(
        logs.map(async (_, i) => {
          await runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'POST', url: '/api/logs/aggregate' },
              async () => {
                aggregated++;
                return {
                  component: test.component,
                  sequence: i,
                  aggregated,
                  timestamp: Date.now()
                };
              }
            );
          });
        })
      );

      expect(aggregated).toBe(test.logs);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.logging.aggregationRate).toBeGreaterThan(0);
    expect(metrics.logging.componentDistribution).toBeDefined();
  });

  it('should track error reporting patterns', async () => {
    const errorTests = [
      { type: 'validation', count: 5 },
      { type: 'network', count: 3 },
      { type: 'system', count: 2 }
    ];

    for (const test of errorTests) {
      const errors = Array(test.count).fill(null);
      let reported = 0;

      await Promise.all(
        errors.map(async (_, i) => {
          try {
            await runDebugApiTest(async () => {
              await debugMetricsMiddleware(
                { method: 'POST', url: '/api/errors' },
                async () => {
                  reported++;
                  throw new Error(`${test.type} error ${i}`);
                }
              );
            });
          } catch (e) {
            expect(e).toBeDefined();
          }
        })
      );

      expect(reported).toBe(test.count);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.errors.typeDistribution).toBeDefined();
    expect(metrics.errors.occurrencePatterns).toBeDefined();
  });

  it('should implement error correlation analysis', async () => {
    const correlationTests = [
      { service: 'api', errors: ['timeout', 'validation'] },
      { service: 'trading', errors: ['market', 'balance'] },
      { service: 'wallet', errors: ['signature', 'network'] }
    ];

    for (const test of correlationTests) {
      await Promise.all(
        test.errors.map(async (error, i) => {
          try {
            await runDebugApiTest(async () => {
              await debugMetricsMiddleware(
                { method: 'POST', url: '/api/errors/correlate' },
                async () => {
                  throw new Error(`${test.service} ${error} error`);
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
    expect(metrics.errors.correlationPatterns).toBeDefined();
    expect(metrics.errors.serviceDistribution).toBeDefined();
  });

  it('should track log retention patterns', async () => {
    const retentionTests = [
      { period: '1h', logs: 100 },
      { period: '1d', logs: 50 },
      { period: '1w', logs: 25 }
    ];

    for (const test of retentionTests) {
      const logs = Array(test.logs).fill(null);
      let retained = 0;

      await Promise.all(
        logs.map(async (_, i) => {
          await runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'POST', url: '/api/logs/retention' },
              async () => {
                retained++;
                return {
                  period: test.period,
                  sequence: i,
                  retained,
                  timestamp: Date.now()
                };
              }
            );
          });
        })
      );

      expect(retained).toBe(test.logs);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.logging.retentionRate).toBeDefined();
    expect(metrics.logging.periodDistribution).toBeDefined();
  });
});
