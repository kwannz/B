import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Error Recovery Metrics Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should track error recovery patterns', async () => {
    const recoveryTests = [
      { type: 'network', attempts: 3, success: true },
      { type: 'validation', attempts: 2, success: false },
      { type: 'timeout', attempts: 4, success: true }
    ];

    for (const test of recoveryTests) {
      let attempts = 0;
      let recovered = false;

      while (attempts < test.attempts && !recovered) {
        try {
          await runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'POST', url: '/api/recovery' },
              async () => {
                attempts++;
                if (attempts === test.attempts && test.success) {
                  recovered = true;
                  return {
                    type: test.type,
                    attempts,
                    recovered,
                    timestamp: Date.now()
                  };
                }
                throw new Error(`${test.type} error, attempt ${attempts}`);
              }
            );
          });
        } catch (e) {
          expect(e).toBeDefined();
        }
      }

      expect(attempts).toBe(test.attempts);
      expect(recovered).toBe(test.success);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.recovery.patterns).toBeDefined();
    expect(metrics.recovery.successRate).toBeGreaterThan(0);
  });

  it('should implement adaptive retry strategies', async () => {
    const strategyTests = [
      { error: 'timeout', backoff: 'exponential' },
      { error: 'rate-limit', backoff: 'linear' },
      { error: 'network', backoff: 'fixed' }
    ];

    for (const test of strategyTests) {
      const retries = Array(3).fill(null);
      let delay = 100;

      await Promise.all(
        retries.map(async (_, i) => {
          try {
            await runDebugApiTest(async () => {
              await debugMetricsMiddleware(
                { method: 'POST', url: '/api/retry' },
                async () => {
                  await new Promise(resolve => 
                    setTimeout(resolve, delay)
                  );
                  
                  switch (test.backoff) {
                    case 'exponential':
                      delay *= 2;
                      break;
                    case 'linear':
                      delay += 100;
                      break;
                  }

                  throw new Error(`${test.error} error, retry ${i + 1}`);
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
    expect(metrics.recovery.strategies).toBeDefined();
    expect(metrics.recovery.backoffPatterns).toBeDefined();
  });

  it('should track error resolution time', async () => {
    const resolutionTests = [
      { error: 'api', time: 1000 },
      { error: 'database', time: 2000 },
      { error: 'cache', time: 500 }
    ];

    for (const test of resolutionTests) {
      const startTime = Date.now();
      let resolved = false;

      while (Date.now() - startTime < test.time && !resolved) {
        try {
          await runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'POST', url: '/api/resolution' },
              async () => {
                if (Date.now() - startTime >= test.time) {
                  resolved = true;
                  return {
                    error: test.error,
                    time: Date.now() - startTime,
                    resolved,
                    timestamp: Date.now()
                  };
                }
                throw new Error(`${test.error} error, unresolved`);
              }
            );
          });
        } catch (e) {
          expect(e).toBeDefined();
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      expect(resolved).toBe(true);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.recovery.resolutionTime).toBeDefined();
    expect(metrics.recovery.timeDistribution).toBeDefined();
  });

  it('should implement cascading recovery patterns', async () => {
    const cascadeTests = [
      { services: ['api', 'cache', 'database'], delay: 100 },
      { services: ['auth', 'user', 'session'], delay: 200 },
      { services: ['trade', 'wallet', 'market'], delay: 300 }
    ];

    for (const test of cascadeTests) {
      let recovered = 0;

      await Promise.all(
        test.services.map(async (service, i) => {
          await new Promise(resolve => 
            setTimeout(resolve, test.delay * i)
          );
          
          try {
            await runDebugApiTest(async () => {
              await debugMetricsMiddleware(
                { method: 'POST', url: '/api/cascade' },
                async () => {
                  recovered++;
                  return {
                    service,
                    sequence: i,
                    recovered,
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

      expect(recovered).toBe(test.services.length);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.recovery.cascadePatterns).toBeDefined();
    expect(metrics.recovery.serviceRecovery).toBeDefined();
  });
});
