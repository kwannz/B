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

  it('should handle exponential backoff retries', async () => {
    const retryAttempts = [];
    const error = { message: 'Network Error', code: 'NETWORK_ERROR', status: 503 };

    mockAPI.createWallet.mockImplementation(() => {
      retryAttempts.push(Date.now());
      if (retryAttempts.length <= 3) {
        throw error;
      }
      return Promise.resolve({ address: 'test-address' });
    });

    await runDebugApiTest(async () => {
      await debugMetricsMiddleware(
        { method: 'POST', url: '/api/wallets' },
        () => apiClient.createWallet('test-bot')
      );
    });

    const intervals = retryAttempts.slice(1).map((time, i) => time - retryAttempts[i]);
    expect(intervals[1]).toBeGreaterThan(intervals[0]);
    expect(intervals[2]).toBeGreaterThan(intervals[1]);
  });

  it('should respect maximum retry attempts', async () => {
    const maxRetries = DEBUG_CONFIG.thresholds.api.retry_count;
    let attempts = 0;

    mockAPI.createBot.mockImplementation(() => {
      attempts++;
      throw new Error('Persistent Error');
    });

    try {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/bots' },
          () => apiClient.createBot('trading', 'test-strategy')
        );
      });
    } catch (error) {
      expect(error).toBeDefined();
    }

    expect(attempts).toBe(maxRetries + 1);
    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.errorRate).toBeGreaterThan(0);
  });

  it('should track retry success rates', async () => {
    const operations = Array(5).fill(null).map((_, i) => ({
      shouldSucceed: i > 2,
      attempts: 0
    }));

    for (const op of operations) {
      mockAPI.createWallet.mockImplementation(() => {
        op.attempts++;
        if (!op.shouldSucceed && op.attempts <= 3) {
          throw new Error('Temporary Error');
        }
        return Promise.resolve({ address: 'test-address' });
      });

      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/api/wallets' },
            () => apiClient.createWallet('test-bot')
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.retrySuccessRate).toBeCloseTo(0.4, 1);
  });

  it('should handle concurrent retries', async () => {
    const concurrentOps = Array(3).fill(null).map((_, i) => ({
      id: `bot-${i}`,
      attempts: 0,
      maxAttempts: i + 2
    }));

    await Promise.all(
      concurrentOps.map(async op => {
        mockAPI.createBot.mockImplementation(() => {
          op.attempts++;
          if (op.attempts < op.maxAttempts) {
            throw new Error('Retry Error');
          }
          return Promise.resolve({ id: op.id });
        });

        try {
          await runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'POST', url: '/api/bots' },
              () => apiClient.createBot('trading', `strategy-${op.id}`)
            );
          });
        } catch (e) {
          expect(e).toBeDefined();
        }
      })
    );

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.concurrentRequests).toBeLessThanOrEqual(
      DEBUG_CONFIG.thresholds.api.concurrent_requests
    );
  });

  it('should handle different error types differently', async () => {
    const errorScenarios = [
      { type: 'network', code: 503, retryable: true },
      { type: 'validation', code: 400, retryable: false },
      { type: 'auth', code: 401, retryable: false },
      { type: 'timeout', code: 504, retryable: true }
    ];

    for (const scenario of errorScenarios) {
      let attempts = 0;
      mockAPI.createWallet.mockImplementation(() => {
        attempts++;
        throw { 
          message: `${scenario.type} Error`,
          status: scenario.code
        };
      });

      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/api/wallets' },
            () => apiClient.createWallet('test-bot')
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }

      if (scenario.retryable) {
        expect(attempts).toBeGreaterThan(1);
      } else {
        expect(attempts).toBe(1);
      }
    }
  });
});
