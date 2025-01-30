import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Validation Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should track input validation metrics', async () => {
    const validationTests = [
      { field: 'amount', value: -1, type: 'number' },
      { field: 'address', value: 'invalid', type: 'string' },
      { field: 'timestamp', value: 'not-a-date', type: 'date' }
    ];

    for (const test of validationTests) {
      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/api/validate' },
            async () => {
              throw {
                type: 'validation_error',
                field: test.field,
                value: test.value,
                expected: test.type
              };
            }
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.validation.errorRate).toBeGreaterThan(0);
    expect(metrics.validation.fieldErrors).toBeDefined();
  });

  it('should handle complex validation scenarios', async () => {
    const scenarios = [
      {
        type: 'trade',
        data: { amount: -1, price: 0, timestamp: 'invalid' }
      },
      {
        type: 'wallet',
        data: { address: '123', network: undefined }
      },
      {
        type: 'bot',
        data: { strategy: '', config: null }
      }
    ];

    for (const scenario of scenarios) {
      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: `/api/${scenario.type}` },
            async () => {
              const errors = Object.entries(scenario.data)
                .filter(([_, value]) => !value)
                .map(([field]) => ({
                  field,
                  message: `Invalid ${field}`
                }));
              throw {
                type: 'validation_error',
                errors
              };
            }
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.validation.complexErrors).toBeGreaterThan(0);
    expect(metrics.validation.errorPatterns).toBeDefined();
  });

  it('should track validation performance impact', async () => {
    const validationLoads = Array(5).fill(null).map((_, i) => ({
      fields: i + 1,
      complexity: Math.pow(2, i),
      delay: 50 * (i + 1)
    }));

    for (const load of validationLoads) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/validate-performance' },
          async () => {
            await new Promise(resolve => setTimeout(resolve, load.delay));
            return {
              fields_validated: load.fields,
              validation_time: load.delay,
              complexity_score: load.complexity
            };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.validation.avgProcessingTime).toBeGreaterThan(0);
    expect(metrics.performance.validationImpact).toBeDefined();
  });

  it('should monitor validation patterns', async () => {
    const patterns = [
      { type: 'repeated_invalid', count: 3, interval: 100 },
      { type: 'cascading_error', count: 2, interval: 200 },
      { type: 'dependency_validation', count: 4, interval: 150 }
    ];

    for (const pattern of patterns) {
      const validations = Array(pattern.count).fill(null);
      await Promise.all(
        validations.map(async (_, i) => {
          try {
            await runDebugApiTest(async () => {
              await new Promise(resolve => 
                setTimeout(resolve, i * pattern.interval)
              );
              await debugMetricsMiddleware(
                { method: 'POST', url: '/api/validation-pattern' },
                async () => {
                  throw {
                    type: pattern.type,
                    attempt: i + 1,
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
    expect(metrics.validation.patterns).toBeDefined();
    expect(metrics.validation.patternFrequency).toBeGreaterThan(0);
  });

  it('should track validation recovery strategies', async () => {
    const recoveryTests = [
      { field: 'amount', attempts: 3, shouldRecover: true },
      { field: 'address', attempts: 2, shouldRecover: false },
      { field: 'config', attempts: 4, shouldRecover: true }
    ];

    for (const test of recoveryTests) {
      let attempts = 0;
      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/api/validation-recovery' },
            async () => {
              attempts++;
              if (attempts < test.attempts || !test.shouldRecover) {
                throw {
                  type: 'validation_error',
                  field: test.field,
                  attempt: attempts
                };
              }
              return { status: 'recovered', attempts };
            }
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.validation.recoveryRate).toBeDefined();
    expect(metrics.validation.avgRecoveryAttempts).toBeGreaterThan(1);
  });
});
