import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Validation Metrics Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should track input validation patterns', async () => {
    const validationTests = [
      { field: 'amount', value: -100, error: 'invalid_amount' },
      { field: 'wallet', value: '0x123', error: 'invalid_address' },
      { field: 'strategy', value: '', error: 'required_field' }
    ];

    for (const test of validationTests) {
      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/api/validate' },
            async () => {
              throw {
                field: test.field,
                value: test.value,
                error: test.error,
                timestamp: Date.now()
              };
            }
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.validation.errorPatterns).toBeDefined();
    expect(metrics.validation.fieldDistribution).toBeDefined();
  });

  it('should implement adaptive validation thresholds', async () => {
    const thresholdTests = [
      { load: 0.3, strictness: 'high' },
      { load: 0.6, strictness: 'medium' },
      { load: 0.9, strictness: 'low' }
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
          { method: 'POST', url: '/api/validation/threshold' },
          async () => ({
            load: test.load,
            strictness: test.strictness,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.validation.adaptiveThresholds).toBeDefined();
    expect(metrics.validation.strictnessLevels).toBeDefined();
  });

  it('should track validation performance impact', async () => {
    const performanceTests = Array(5).fill(null).map((_, i) => ({
      complexity: i + 1,
      fields: (i + 1) * 2,
      validations: (i + 1) * 3
    }));

    for (const test of performanceTests) {
      const startTime = Date.now();
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/validation/performance' },
          async () => {
            await new Promise(resolve => 
              setTimeout(resolve, test.complexity * 50)
            );
            return {
              complexity: test.complexity,
              fields: test.fields,
              validations: test.validations,
              duration: Date.now() - startTime
            };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.validation.performanceImpact).toBeGreaterThan(0);
    expect(metrics.validation.complexityDistribution).toBeDefined();
  });

  it('should handle concurrent validation requests', async () => {
    const concurrencyTests = [
      { requests: 5, delay: 100 },
      { requests: 10, delay: 200 },
      { requests: 15, delay: 300 }
    ];

    for (const test of concurrencyTests) {
      const requests = Array(test.requests).fill(null);
      let concurrent = 0;
      let maxConcurrent = 0;

      await Promise.all(
        requests.map(async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);

          try {
            await runDebugApiTest(async () => {
              await debugMetricsMiddleware(
                { method: 'POST', url: '/api/validation/concurrent' },
                async () => {
                  await new Promise(resolve => 
                    setTimeout(resolve, test.delay)
                  );
                  concurrent--;
                  return {
                    concurrent,
                    maxConcurrent,
                    timestamp: Date.now()
                  };
                }
              );
            });
          } catch (e) {
            concurrent--;
            expect(e).toBeDefined();
          }
        })
      );

      expect(maxConcurrent).toBeLessThanOrEqual(
        DEBUG_CONFIG.thresholds.api.concurrent_requests
      );
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.validation.concurrentValidations).toBeDefined();
    expect(metrics.validation.validationThroughput).toBeGreaterThan(0);
  });

  it('should track validation cache effectiveness', async () => {
    const cacheTests = [
      { input: 'test1', cached: false },
      { input: 'test1', cached: true },
      { input: 'test2', cached: false },
      { input: 'test2', cached: true }
    ];

    for (const test of cacheTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/validation/cache' },
          async () => ({
            input: test.input,
            cached: test.cached,
            duration: test.cached ? 10 : 100,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.validation.cacheHitRate).toBeGreaterThan(0);
    expect(metrics.validation.cacheDuration).toBeDefined();
  });
});
