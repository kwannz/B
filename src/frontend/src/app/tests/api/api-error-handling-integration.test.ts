import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Error Handling Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should track error patterns across system components', async () => {
    const errorScenarios = [
      { component: 'wallet', type: 'validation', code: 400 },
      { component: 'trading', type: 'timeout', code: 504 },
      { component: 'bot', type: 'internal', code: 500 },
      { component: 'market', type: 'rate_limit', code: 429 }
    ];

    for (const scenario of errorScenarios) {
      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: `/api/${scenario.component}` },
            async () => {
              throw {
                type: scenario.type,
                status: scenario.code,
                message: `${scenario.type} error in ${scenario.component}`
              };
            }
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.errorRate).toBeGreaterThan(0);
    expect(metrics.performance.componentErrors).toBeDefined();
  });

  it('should handle cascading error scenarios', async () => {
    const operations = [
      { type: 'wallet_create', shouldFail: true },
      { type: 'bot_create', shouldFail: true },
      { type: 'trade_execute', shouldFail: false }
    ];

    for (const op of operations) {
      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: `/api/${op.type}` },
            async () => {
              if (op.shouldFail) {
                throw new Error(`${op.type} failed`);
              }
              return { status: 'success' };
            }
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.cascadingErrors).toBeGreaterThan(0);
    expect(metrics.alerts.error).toBeGreaterThan(0);
  });

  it('should track error recovery patterns', async () => {
    const recoveryScenarios = Array(5).fill(null).map((_, i) => ({
      attempts: i + 1,
      shouldRecover: i < 3
    }));

    for (const scenario of recoveryScenarios) {
      let attempts = 0;
      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/api/test-recovery' },
            async () => {
              attempts++;
              if (attempts < scenario.attempts || !scenario.shouldRecover) {
                throw new Error('Temporary failure');
              }
              return { status: 'recovered' };
            }
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.recoveryRate).toBeDefined();
    expect(metrics.performance.meanTimeToRecovery).toBeGreaterThan(0);
  });

  it('should monitor error impact on system health', async () => {
    const healthImpacts = [
      { errors: 2, requests: 10, latency: 100 },
      { errors: 5, requests: 15, latency: 200 },
      { errors: 8, requests: 20, latency: 300 }
    ];

    for (const impact of healthImpacts) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/health-check' },
          async () => {
            useDebugStore.setState(state => ({
              ...state,
              metrics: {
                ...state.metrics,
                performance: {
                  ...state.metrics.performance,
                  errorRate: impact.errors / impact.requests,
                  apiLatency: impact.latency
                }
              }
            }));
            return { status: 'checked' };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.systemHealth).toBeLessThan(1);
    expect(metrics.performance.errorImpact).toBeDefined();
  });

  it('should track error correlation patterns', async () => {
    const errorPatterns = [
      { type: 'network', count: 3, interval: 100 },
      { type: 'validation', count: 2, interval: 200 },
      { type: 'timeout', count: 4, interval: 150 }
    ];

    for (const pattern of errorPatterns) {
      const errors = Array(pattern.count).fill(null);
      await Promise.all(
        errors.map(async (_, i) => {
          try {
            await runDebugApiTest(async () => {
              await new Promise(resolve => 
                setTimeout(resolve, i * pattern.interval)
              );
              await debugMetricsMiddleware(
                { method: 'POST', url: '/api/error-pattern' },
                async () => {
                  throw new Error(`${pattern.type} error`);
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
    expect(metrics.performance.errorPatterns).toBeDefined();
    expect(metrics.performance.errorCorrelation).toBeGreaterThan(0);
  });
});
