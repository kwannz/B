import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Rate Limiting Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should handle rate limiting with exponential backoff', async () => {
    const rateLimitError = { message: 'Rate Limit', code: 'RATE_LIMIT', status: 429 };
    const attempts = [];

    mockAPI.createBot.mockImplementation(() => {
      attempts.push(Date.now());
      if (attempts.length <= 3) {
        throw rateLimitError;
      }
      return Promise.resolve({ id: 'test-bot' });
    });

    await runDebugApiTest(async () => {
      await debugMetricsMiddleware(
        { method: 'POST', url: '/api/bots' },
        () => apiClient.createBot('trading', 'test-strategy')
      );
    });

    const intervals = attempts.slice(1).map((time, i) => time - attempts[i]);
    expect(intervals[1]).toBeGreaterThan(intervals[0]);
    expect(intervals[2]).toBeGreaterThan(intervals[1]);
  });

  it('should track rate limit metrics across endpoints', async () => {
    const rateLimitErrors = Array(5).fill(null).map(() => ({
      message: 'Rate Limit',
      code: 'RATE_LIMIT',
      status: 429
    }));

    let errorCount = 0;
    mockAPI.createWallet.mockImplementation(() => {
      if (errorCount < rateLimitErrors.length) {
        errorCount++;
        throw rateLimitErrors[errorCount - 1];
      }
      return Promise.resolve({ address: 'test-address' });
    });

    for (let i = 0; i < rateLimitErrors.length; i++) {
      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/api/wallets' },
            () => apiClient.createWallet(`bot-${i}`)
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.rateLimitCount).toBe(rateLimitErrors.length);
    expect(metrics.performance.systemHealth).toBeLessThan(1);
  });

  it('should implement concurrent request throttling', async () => {
    const requests = Array(10).fill(null).map((_, i) => ({
      botId: `bot-${i}`,
      delay: 100 * (i + 1)
    }));

    const startTime = Date.now();
    await Promise.all(
      requests.map(req =>
        runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/api/bots' },
            async () => {
              await new Promise(resolve => setTimeout(resolve, req.delay));
              return apiClient.createBot('trading', `strategy-${req.botId}`);
            }
          );
        })
      )
    );
    const endTime = Date.now();

    const metrics = useDebugStore.getState().metrics;
    expect(endTime - startTime).toBeGreaterThan(
      DEBUG_CONFIG.thresholds.api.concurrent_requests * requests[0].delay
    );
    expect(metrics.performance.concurrentRequests).toBeLessThanOrEqual(
      DEBUG_CONFIG.thresholds.api.concurrent_requests
    );
  });

  it('should recover from rate limit bursts', async () => {
    const burstSize = 5;
    const cooldownPeriod = 1000;
    let requestCount = 0;

    mockAPI.createBot.mockImplementation(() => {
      requestCount++;
      if (requestCount <= burstSize) {
        throw { message: 'Rate Limit', code: 'RATE_LIMIT', status: 429 };
      }
      return Promise.resolve({ id: 'test-bot' });
    });

    const requests = Array(burstSize + 1).fill(null);
    await Promise.all(
      requests.map(async (_, i) => {
        try {
          await new Promise(resolve => setTimeout(resolve, i * cooldownPeriod));
          await runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'POST', url: '/api/bots' },
              () => apiClient.createBot('trading', `strategy-${i}`)
            );
          });
        } catch (e) {
          expect(e).toBeDefined();
        }
      })
    );

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.rateLimitCount).toBe(burstSize);
    expect(metrics.performance.systemHealth).toBeGreaterThan(0);
  });
});
