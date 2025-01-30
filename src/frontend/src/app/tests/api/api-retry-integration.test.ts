import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Retry Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should track retry patterns across endpoints', async () => {
    const retryScenarios = [
      { endpoint: '/wallets', attempts: 3, shouldSucceed: true },
      { endpoint: '/bots', attempts: 2, shouldSucceed: false },
      { endpoint: '/trades', attempts: 4, shouldSucceed: true }
    ];

    for (const scenario of retryScenarios) {
      let attempts = 0;
      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: scenario.endpoint },
            async () => {
              attempts++;
              if (attempts < scenario.attempts || !scenario.shouldSucceed) {
                throw new Error(`Attempt ${attempts} failed`);
              }
              return { status: 'success', attempts };
            }
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.retryRate).toBeGreaterThan(0);
    expect(metrics.performance.retryPatterns).toBeDefined();
  });

  it('should implement exponential backoff', async () => {
    const backoffTests = Array(3).fill(null).map((_, i) => ({
      baseDelay: 100 * (i + 1),
      maxAttempts: i + 2
    }));

    for (const test of backoffTests) {
      const startTime = Date.now();
      let attempts = 0;

      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/api/backoff-test' },
            async () => {
              attempts++;
              const currentDelay = test.baseDelay * Math.pow(2, attempts - 1);
              await new Promise(resolve => setTimeout(resolve, currentDelay));
              
              if (attempts < test.maxAttempts) {
                throw new Error('Retry with backoff');
              }
              return { status: 'success', attempts };
            }
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThan(
        test.baseDelay * (Math.pow(2, test.maxAttempts) - 1)
      );
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.backoffPatterns).toBeDefined();
  });

  it('should handle concurrent retries', async () => {
    const concurrentTests = Array(3).fill(null).map((_, i) => ({
      id: `test-${i}`,
      retries: i + 2,
      delay: 100 * (i + 1)
    }));

    await Promise.all(
      concurrentTests.map(async test => {
        let attempts = 0;
        try {
          await runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'POST', url: `/api/concurrent-retry/${test.id}` },
              async () => {
                attempts++;
                await new Promise(resolve => setTimeout(resolve, test.delay));
                if (attempts < test.retries) {
                  throw new Error('Concurrent retry needed');
                }
                return { status: 'success', attempts };
              }
            );
          });
        } catch (e) {
          expect(e).toBeDefined();
        }
      })
    );

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.concurrentRetries).toBeDefined();
    expect(metrics.performance.retryOverlap).toBeGreaterThan(0);
  });

  it('should track retry impact on system health', async () => {
    const healthScenarios = [
      { retries: 2, load: 0.3 },
      { retries: 3, load: 0.5 },
      { retries: 4, load: 0.7 }
    ];

    for (const scenario of healthScenarios) {
      let attempts = 0;
      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/api/health-impact' },
            async () => {
              attempts++;
              useDebugStore.setState(state => ({
                ...state,
                metrics: {
                  ...state.metrics,
                  performance: {
                    ...state.metrics.performance,
                    systemLoad: scenario.load + (attempts * 0.1)
                  }
                }
              }));

              if (attempts < scenario.retries) {
                throw new Error('Retry needed');
              }
              return { status: 'success', attempts };
            }
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.retryImpact).toBeDefined();
    expect(metrics.performance.systemHealth).toBeLessThan(1);
  });

  it('should implement adaptive retry strategies', async () => {
    const adaptiveTests = [
      { load: 0.3, maxRetries: 4 },
      { load: 0.6, maxRetries: 3 },
      { load: 0.9, maxRetries: 2 }
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

      let attempts = 0;
      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/api/adaptive-retry' },
            async () => {
              attempts++;
              if (attempts < test.maxRetries) {
                throw new Error('Adaptive retry needed');
              }
              return { status: 'success', attempts };
            }
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.adaptiveRetries).toBeDefined();
    expect(metrics.performance.retryEfficiency).toBeGreaterThan(0);
  });
});
