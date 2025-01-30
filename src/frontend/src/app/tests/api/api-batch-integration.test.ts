import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Batch Operations Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should track batch request performance', async () => {
    const batchTests = [
      { size: 10, expectedLatency: 100 },
      { size: 20, expectedLatency: 200 },
      { size: 30, expectedLatency: 300 }
    ];

    for (const test of batchTests) {
      const startTime = Date.now();
      const requests = Array(test.size).fill(null).map((_, i) => ({
        id: `req-${i}`,
        type: 'wallet_info'
      }));

      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/batch' },
          async () => {
            await new Promise(resolve => 
              setTimeout(resolve, test.expectedLatency)
            );
            return requests.map(req => ({
              id: req.id,
              result: { status: 'success' }
            }));
          }
        );
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThanOrEqual(test.expectedLatency);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.batch.averageLatency).toBeGreaterThan(0);
    expect(metrics.batch.throughput).toBeDefined();
  });

  it('should handle batch operation failures', async () => {
    const failureTests = [
      { total: 10, failCount: 2 },
      { total: 15, failCount: 5 },
      { total: 20, failCount: 8 }
    ];

    for (const test of failureTests) {
      const requests = Array(test.total).fill(null).map((_, i) => ({
        id: `req-${i}`,
        shouldFail: i < test.failCount
      }));

      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/api/batch-test' },
            async () => {
              const results = requests.map(req => ({
                id: req.id,
                status: req.shouldFail ? 'error' : 'success'
              }));

              if (test.failCount > test.total / 2) {
                throw new Error('Batch operation failed');
              }

              return results;
            }
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.batch.failureRate).toBeGreaterThan(0);
    expect(metrics.batch.partialSuccess).toBeDefined();
  });

  it('should track batch operation memory usage', async () => {
    const memoryTests = Array(3).fill(null).map((_, i) => ({
      batchSize: Math.pow(10, i + 2),
      itemSize: 1024 * (i + 1)
    }));

    for (const test of memoryTests) {
      const batch = Array(test.batchSize).fill({
        data: 'x'.repeat(test.itemSize)
      });

      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/batch-memory' },
          async () => ({
            processedItems: test.batchSize,
            memoryUsed: test.batchSize * test.itemSize
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.batch.memoryUsage).toBeGreaterThan(0);
    expect(metrics.batch.itemProcessingRate).toBeDefined();
  });

  it('should implement batch size optimization', async () => {
    const optimizationTests = [
      { load: 0.3, optimalSize: 100 },
      { load: 0.6, optimalSize: 50 },
      { load: 0.9, optimalSize: 25 }
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

      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/batch-optimize' },
          async () => ({
            recommendedBatchSize: test.optimalSize,
            currentLoad: test.load
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.batch.optimizedSize).toBeDefined();
    expect(metrics.batch.adaptiveScaling).toBeDefined();
  });

  it('should track batch operation retries', async () => {
    const retryTests = [
      { items: 10, retryCount: 1 },
      { items: 15, retryCount: 2 },
      { items: 20, retryCount: 3 }
    ];

    for (const test of retryTests) {
      let attempts = 0;
      const items = Array(test.items).fill(null);

      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/api/batch-retry' },
            async () => {
              attempts++;
              if (attempts <= test.retryCount) {
                throw new Error('Batch retry needed');
              }
              return items.map((_, i) => ({
                id: i,
                status: 'success',
                attempts
              }));
            }
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.batch.retryRate).toBeGreaterThan(0);
    expect(metrics.batch.averageRetries).toBeDefined();
  });
});
