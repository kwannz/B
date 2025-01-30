import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { errorHandlingMiddleware } from '../../middleware/errorHandlingMiddleware';
import { ApiClient } from '../../api/client';

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

  it('should handle network errors with retries', async () => {
    const networkError = { message: 'Network Error', code: 'NETWORK_ERROR', status: 503 };
    let retryCount = 0;

    mockAPI.createWallet.mockImplementation(() => {
      retryCount++;
      if (retryCount <= 2) {
        throw networkError;
      }
      return Promise.resolve({ address: 'test-address' });
    });

    await runDebugApiTest(async () => {
      await errorHandlingMiddleware(async () => {
        await apiClient.createWallet('test-bot');
      });
    });

    const metrics = useDebugStore.getState().metrics;
    expect(retryCount).toBe(3);
    expect(metrics.performance.errorRate).toBeGreaterThan(0);
    expect(useDebugStore.getState().logs).toContain(
      expect.stringContaining('Network Error')
    );
  });

  it('should handle rate limiting with backoff', async () => {
    const rateLimitError = { message: 'Rate Limit', code: 'RATE_LIMIT', status: 429 };
    const attempts = [];

    mockAPI.createBot.mockImplementation(() => {
      attempts.push(Date.now());
      if (attempts.length <= 2) {
        throw rateLimitError;
      }
      return Promise.resolve({ id: 'test-bot' });
    });

    await runDebugApiTest(async () => {
      await errorHandlingMiddleware(async () => {
        await apiClient.createBot('trading', 'test-strategy');
      });
    });

    const intervals = attempts.slice(1).map((time, i) => time - attempts[i]);
    expect(intervals[1]).toBeGreaterThan(intervals[0]);
    expect(useDebugStore.getState().logs).toContain(
      expect.stringContaining('Rate Limit')
    );
  });

  it('should handle validation errors with context', async () => {
    const validationError = {
      message: 'Invalid Input',
      code: 'VALIDATION_ERROR',
      status: 400,
      details: { field: 'amount', error: 'Must be positive' }
    };

    mockAPI.transferSOL.mockRejectedValue(validationError);

    try {
      await runDebugApiTest(async () => {
        await errorHandlingMiddleware(async () => {
          await apiClient.transferSOL('wallet-a', 'wallet-b', -1);
        });
      });
    } catch (error) {
      expect(error).toBeDefined();
    }

    const logs = useDebugStore.getState().logs;
    expect(logs).toContain(expect.stringContaining('Invalid Input'));
    expect(logs).toContain(expect.stringContaining('Must be positive'));
  });

  it('should handle timeout errors with metrics', async () => {
    const timeoutDelay = DEBUG_CONFIG.thresholds.api.timeout_ms + 1000;

    mockAPI.getBotStatus.mockImplementation(() =>
      new Promise(resolve => setTimeout(resolve, timeoutDelay))
    );

    try {
      await runDebugApiTest(async () => {
        await errorHandlingMiddleware(async () => {
          await apiClient.getBotStatus('test-bot');
        });
      });
    } catch (error) {
      expect(error).toBeDefined();
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.apiLatency).toBeGreaterThan(
      DEBUG_CONFIG.thresholds.api.timeout_ms
    );
    expect(metrics.performance.systemHealth).toBeLessThan(1);
  });

  it('should handle concurrent error scenarios', async () => {
    const errors = [
      { message: 'Network Error', code: 'NETWORK_ERROR', status: 503 },
      { message: 'Rate Limit', code: 'RATE_LIMIT', status: 429 },
      { message: 'Invalid Input', code: 'VALIDATION_ERROR', status: 400 }
    ];

    const operations = errors.map((error, i) => ({
      fn: () => apiClient.createWallet(`bot-${i}`),
      error
    }));

    await Promise.allSettled(
      operations.map(async op => {
        mockAPI.createWallet.mockRejectedValueOnce(op.error);
        try {
          await errorHandlingMiddleware(op.fn);
        } catch (e) {
          expect(e).toBeDefined();
        }
      })
    );

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.errorRate).toBeGreaterThan(0.5);
    expect(useDebugStore.getState().logs.length).toBe(errors.length);
  });
});
