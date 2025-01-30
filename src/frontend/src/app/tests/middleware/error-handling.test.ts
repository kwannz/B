import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugTest, runDebugErrorTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { useDebugStore } from '../../stores/debugStore';
import { errorHandlingMiddleware } from '../../middleware/errorHandlingMiddleware';
import { ApiError } from '../types/api.types';

describe('Error Handling Middleware', () => {
  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
  });

  it('should track and categorize API errors', async () => {
    const errors = [
      { message: 'Network Error', code: 'NETWORK_ERROR', status: 503 },
      { message: 'Rate Limit', code: 'RATE_LIMIT', status: 429 },
      { message: 'Invalid Input', code: 'VALIDATION_ERROR', status: 400 },
      { message: 'Server Error', code: 'SERVER_ERROR', status: 500 }
    ];

    for (const error of errors) {
      try {
        await errorHandlingMiddleware(async () => {
          throw error;
        });
      } catch (e) {
        const metrics = useDebugStore.getState().metrics;
        expect(metrics.performance.errorRate).toBeGreaterThan(0);
        expect(useDebugStore.getState().logs).toContain(
          expect.stringContaining(error.code)
        );
      }
    }
  });

  it('should handle nested error propagation', async () => {
    const nestedError = new Error('Nested Error');
    const wrappedError = {
      message: 'Wrapped Error',
      code: 'WRAPPED_ERROR',
      status: 500,
      cause: nestedError
    };

    try {
      await errorHandlingMiddleware(async () => {
        throw wrappedError;
      });
    } catch (error) {
      const logs = useDebugStore.getState().logs;
      expect(logs).toContain(expect.stringContaining('Wrapped Error'));
      expect(logs).toContain(expect.stringContaining('Nested Error'));
    }
  });

  it('should track error frequency and patterns', async () => {
    const error = {
      message: 'Rate Limit',
      code: 'RATE_LIMIT',
      status: 429
    };

    for (let i = 0; i < 5; i++) {
      try {
        await errorHandlingMiddleware(async () => {
          throw error;
        });
      } catch (e) {
        // Expected error
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.errorRate).toBe(1);
    expect(metrics.performance.systemHealth).toBeLessThan(0.5);
  });

  it('should handle async error chains', async () => {
    const asyncError = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      throw new Error('Async Error');
    };

    try {
      await errorHandlingMiddleware(async () => {
        await asyncError();
      });
    } catch (error) {
      const metrics = useDebugStore.getState().metrics;
      expect(metrics.performance.errorRate).toBeGreaterThan(0);
      expect(metrics.performance.apiLatency).toBeGreaterThan(100);
    }
  });

  it('should maintain error context in metrics history', async () => {
    const errors = [
      { message: 'Error 1', code: 'ERROR_1', status: 500 },
      { message: 'Error 2', code: 'ERROR_2', status: 503 },
      { message: 'Error 3', code: 'ERROR_3', status: 400 }
    ];

    for (const error of errors) {
      try {
        await errorHandlingMiddleware(async () => {
          throw error;
        });
      } catch (e) {
        // Expected error
      }
    }

    const store = useDebugStore.getState();
    expect(store.metricsHistory.length).toBe(errors.length);
    expect(store.logs.length).toBe(errors.length);
  });

  it('should handle concurrent error tracking', async () => {
    const errors = Array(3).fill(null).map((_, i) => ({
      message: `Error ${i}`,
      code: `ERROR_${i}`,
      status: 500
    }));

    await Promise.allSettled(
      errors.map(error =>
        errorHandlingMiddleware(async () => {
          throw error;
        })
      )
    );

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.errorRate).toBe(1);
    expect(useDebugStore.getState().logs.length).toBe(errors.length);
  });
});
