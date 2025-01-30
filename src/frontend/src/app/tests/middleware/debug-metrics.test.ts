import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugTest, runDebugApiTest, runDebugErrorTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { useDebugStore } from '../../stores/debugStore';
import { ApiError } from '../types/api.types';

describe('Debug Metrics Middleware', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
  });

  it('should track successful API calls', async () => {
    const { result, metrics } = await runDebugApiTest(async () => {
      const response = await mockAPI.createWallet('test-bot');
      return response;
    });

    expect(metrics.performance.errorRate).toBe(0);
    expect(metrics.performance.apiLatency).toBeLessThanOrEqual(
      DEBUG_CONFIG.thresholds.system.latency
    );
    expect(metrics.performance.systemHealth).toBe(1);
  });

  it('should track API errors', async () => {
    const expectedError: ApiError = {
      message: 'API Error',
      code: 'API_ERROR',
      status: 500
    };

    const { error, metrics } = await runDebugErrorTest(
      async () => {
        mockAPI.createWallet.mockRejectedValue(expectedError);
        return mockAPI.createWallet('test-bot');
      },
      expectedError
    );

    expect(metrics.performance.errorRate).toBe(1);
    expect(metrics.performance.systemHealth).toBe(0);
  });

  it('should track high latency API calls', async () => {
    const delay = DEBUG_CONFIG.thresholds.system.latency + 100;
    const { metrics } = await runDebugTest(
      async () => {
        await new Promise(resolve => setTimeout(resolve, delay));
        return mockAPI.createWallet('test-bot');
      },
      {
        expectedLatency: delay + 50,
        expectedErrorRate: 0,
        expectedHealth: 1
      }
    );

    expect(metrics.performance.apiLatency).toBeGreaterThan(
      DEBUG_CONFIG.thresholds.system.latency
    );
  });

  it('should aggregate multiple API calls', async () => {
    const { metrics } = await runDebugTest(async () => {
      await Promise.all([
        mockAPI.createWallet('bot-1'),
        mockAPI.createWallet('bot-2'),
        mockAPI.createWallet('bot-3')
      ]);
    });

    expect(metrics.performance.errorRate).toBe(0);
    expect(metrics.performance.systemHealth).toBe(1);
  });

  it('should handle mixed success and failure calls', async () => {
    const error: ApiError = {
      message: 'API Error',
      code: 'API_ERROR',
      status: 500
    };

    mockAPI.createWallet
      .mockResolvedValueOnce({ address: 'success-1' })
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({ address: 'success-2' });

    const { metrics } = await runDebugTest(async () => {
      const results = await Promise.allSettled([
        mockAPI.createWallet('bot-1'),
        mockAPI.createWallet('bot-2'),
        mockAPI.createWallet('bot-3')
      ]);
      return results;
    });

    expect(metrics.performance.errorRate).toBeGreaterThan(0);
    expect(metrics.performance.errorRate).toBeLessThan(1);
    expect(metrics.performance.systemHealth).toBeGreaterThan(0);
  });
});
