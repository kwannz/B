import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Batch Operations Metrics Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should track batch operation performance', async () => {
    const batchTests = [
      { size: 10, operations: ['create', 'update'] },
      { size: 20, operations: ['read', 'delete'] },
      { size: 30, operations: ['transfer', 'validate'] }
    ];

    for (const test of batchTests) {
      const operations = Array(test.size).fill(null);
      let processed = 0;

      await Promise.all(
        operations.map(async (_, i) => {
          const operation = test.operations[i % test.operations.length];
          await runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'POST', url: `/api/batch/${operation}` },
              async () => {
                processed++;
                return {
                  operation,
                  index: i,
                  processed,
                  timestamp: Date.now()
                };
              }
            );
          });
        })
      );

      expect(processed).toBe(test.size);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.batch.throughput).toBeGreaterThan(0);
    expect(metrics.batch.operationDistribution).toBeDefined();
  });

  it('should implement batch size optimization', async () => {
    const optimizationTests = [
      { load: 0.3, optimalSize: 50 },
      { load: 0.6, optimalSize: 30 },
      { load: 0.9, optimalSize: 10 }
    ];

    for (const test of optimizationTests) {
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

      const batches = Array(3).fill(null);
      let totalProcessed = 0;

      await Promise.all(
        batches.map(async (_, batchIndex) => {
          const size = Math.floor(test.optimalSize * (1 + batchIndex * 0.5));
          const operations = Array(size).fill(null);

          await Promise.all(
            operations.map(async (_, i) => {
              try {
                await runDebugApiTest(async () => {
                  await debugMetricsMiddleware(
                    { method: 'POST', url: '/api/batch/optimize' },
                    async () => {
                      if (size > test.optimalSize) {
                        throw new Error('Batch size exceeded optimal');
                      }
                      totalProcessed++;
                      return {
                        batchIndex,
                        size,
                        optimal: test.optimalSize,
                        processed: totalProcessed
                      };
                    }
                  );
                });
              } catch (e) {
                expect(e).toBeDefined();
              }
            })
          );
        })
      );

      expect(totalProcessed).toBeLessThanOrEqual(test.optimalSize * batches.length);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.batch.optimizationRate).toBeGreaterThan(0);
    expect(metrics.batch.sizeDistribution).toBeDefined();
  });

  it('should track batch error patterns', async () => {
    const errorTests = [
      { size: 10, errorRate: 0.2 },
      { size: 20, errorRate: 0.3 },
      { size: 30, errorRate: 0.4 }
    ];

    for (const test of errorTests) {
      const operations = Array(test.size).fill(null);
      let errors = 0;

      await Promise.all(
        operations.map(async (_, i) => {
          try {
            await runDebugApiTest(async () => {
              await debugMetricsMiddleware(
                { method: 'POST', url: '/api/batch/error' },
                async () => {
                  if (Math.random() < test.errorRate) {
                    errors++;
                    throw new Error('Batch operation failed');
                  }
                  return {
                    index: i,
                    errors,
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

      expect(errors / test.size).toBeCloseTo(test.errorRate, 1);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.batch.errorRate).toBeGreaterThan(0);
    expect(metrics.batch.errorPatterns).toBeDefined();
  });

  it('should implement batch recovery strategies', async () => {
    const recoveryTests = [
      { size: 10, failurePoint: 5, retryLimit: 3 },
      { size: 20, failurePoint: 10, retryLimit: 2 },
      { size: 30, failurePoint: 15, retryLimit: 1 }
    ];

    for (const test of recoveryTests) {
      const operations = Array(test.size).fill(null);
      let retries = 0;
      let recovered = 0;

      await Promise.all(
        operations.map(async (_, i) => {
          try {
            await runDebugApiTest(async () => {
              await debugMetricsMiddleware(
                { method: 'POST', url: '/api/batch/recovery' },
                async () => {
                  if (i === test.failurePoint && retries < test.retryLimit) {
                    retries++;
                    throw new Error('Batch failure, attempting recovery');
                  }
                  recovered++;
                  return {
                    index: i,
                    retries,
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

      expect(retries).toBeLessThanOrEqual(test.retryLimit);
      expect(recovered).toBeLessThanOrEqual(test.size);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.batch.recoveryRate).toBeGreaterThan(0);
    expect(metrics.batch.retryPatterns).toBeDefined();
  });
});
