import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Performance Tracking', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should track API latency across operations', async () => {
    const operations = [
      { delay: 100, success: true },
      { delay: 300, success: true },
      { delay: 500, success: true }
    ];

    for (const op of operations) {
      mockAPI.createWallet.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, op.delay))
      );

      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/wallets' },
          () => apiClient.createWallet('test-bot')
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.apiLatency).toBeGreaterThan(operations[0].delay);
    expect(metrics.performance.apiLatency).toBeLessThan(
      DEBUG_CONFIG.thresholds.system.latency
    );
  });

  it('should identify performance degradation patterns', async () => {
    const degradationPattern = [100, 200, 400, 800, 1600].map(delay => ({
      delay,
      success: true
    }));

    for (const op of degradationPattern) {
      mockAPI.getBotStatus.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, op.delay))
      );

      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: '/api/bots/status' },
          () => apiClient.getBotStatus('test-bot')
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.systemHealth).toBeLessThan(0.5);
    expect(metrics.performance.apiLatency).toBeGreaterThan(
      DEBUG_CONFIG.thresholds.system.latency
    );
  });

  it('should track concurrent API performance', async () => {
    const concurrentCalls = Array(5).fill(null).map((_, i) => ({
      delay: 200 + i * 100,
      success: true
    }));

    await runDebugApiTest(async () => {
      await Promise.all(
        concurrentCalls.map(op => {
          mockAPI.createBot.mockImplementation(() =>
            new Promise(resolve => setTimeout(resolve, op.delay))
          );
          return debugMetricsMiddleware(
            { method: 'POST', url: '/api/bots' },
            () => apiClient.createBot('trading', 'test-strategy')
          );
        })
      );
    });

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.apiLatency).toBeGreaterThan(200);
    expect(metrics.performance.concurrentRequests).toBe(concurrentCalls.length);
  });

  it('should track API error impact on performance', async () => {
    const errorPattern = [
      { delay: 100, success: true },
      { delay: 200, success: false },
      { delay: 300, success: true },
      { delay: 400, success: false }
    ];

    for (const op of errorPattern) {
      if (op.success) {
        mockAPI.createWallet.mockImplementation(() =>
          new Promise(resolve => setTimeout(resolve, op.delay))
        );
      } else {
        mockAPI.createWallet.mockImplementation(() =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Test Error')), op.delay)
          )
        );
      }

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
    expect(metrics.performance.errorRate).toBe(0.5);
    expect(metrics.performance.apiLatency).toBeGreaterThan(
      errorPattern[0].delay
    );
  });

  it('should track API resource utilization', async () => {
    const resourceIntensiveOps = Array(3).fill(null).map((_, i) => ({
      delay: 500,
      dataSize: 1024 * Math.pow(2, i)
    }));

    for (const op of resourceIntensiveOps) {
      mockAPI.getBotStatus.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve(new Array(op.dataSize).fill('x')), op.delay)
        )
      );

      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: '/api/bots/status' },
          () => apiClient.getBotStatus('test-bot')
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.resourceUsage).toBeGreaterThan(0);
    expect(metrics.performance.apiLatency).toBeGreaterThan(400);
  });
});
