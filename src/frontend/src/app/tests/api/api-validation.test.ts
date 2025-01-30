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

  it('should validate wallet creation parameters', async () => {
    const invalidInputs = [
      { botId: '' },
      { botId: null },
      { botId: undefined },
      { botId: '   ' },
      { botId: 'invalid!@#$' }
    ];

    for (const input of invalidInputs) {
      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/api/wallets' },
            () => apiClient.createWallet(input.botId as string)
          );
        });
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain('validation');
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.validationErrors).toBe(invalidInputs.length);
    expect(metrics.performance.errorRate).toBeGreaterThan(0);
  });

  it('should validate bot creation parameters', async () => {
    const invalidStrategies = [
      { type: '', strategy: '' },
      { type: null, strategy: null },
      { type: 'invalid', strategy: '@#$' },
      { type: 'trading', strategy: '' },
      { type: '', strategy: 'valid' }
    ];

    for (const input of invalidStrategies) {
      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/api/bots' },
            () => apiClient.createBot(input.type as string, input.strategy as string)
          );
        });
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain('validation');
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.validationErrors).toBe(invalidStrategies.length);
  });

  it('should validate transfer parameters', async () => {
    const invalidTransfers = [
      { from: '', to: '', amount: 0 },
      { from: 'wallet-a', to: '', amount: -1 },
      { from: '', to: 'wallet-b', amount: 1000000 },
      { from: 'wallet-a', to: 'wallet-a', amount: 1 },
      { from: '!@#$', to: '%^&*', amount: 0.1 }
    ];

    for (const transfer of invalidTransfers) {
      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/api/transfers' },
            () => apiClient.transferSOL(transfer.from, transfer.to, transfer.amount)
          );
        });
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toMatch(/validation|invalid/i);
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.validationErrors).toBe(invalidTransfers.length);
    expect(useDebugStore.getState().logs).toContain(
      expect.stringContaining('Invalid transfer parameters')
    );
  });

  it('should track validation performance impact', async () => {
    const operations = Array(10).fill(null).map((_, i) => ({
      valid: i % 2 === 0,
      botId: i % 2 === 0 ? `valid-bot-${i}` : '',
      delay: 100
    }));

    for (const op of operations) {
      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/api/wallets' },
            async () => {
              await new Promise(resolve => setTimeout(resolve, op.delay));
              return apiClient.createWallet(op.botId);
            }
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.validationErrors).toBe(operations.length / 2);
    expect(metrics.performance.apiLatency).toBeGreaterThan(0);
  });

  it('should handle concurrent validation requests', async () => {
    const requests = Array(5).fill(null).map((_, i) => ({
      valid: i % 2 === 0,
      botId: i % 2 === 0 ? `bot-${i}` : '',
      type: i % 2 === 0 ? 'trading' : '',
      strategy: i % 2 === 0 ? 'strategy-1' : ''
    }));

    await Promise.all(
      requests.map(req =>
        runDebugApiTest(async () => {
          try {
            await debugMetricsMiddleware(
              { method: 'POST', url: '/api/bots' },
              () => apiClient.createBot(req.type, req.strategy)
            );
          } catch (e) {
            expect(e).toBeDefined();
          }
        })
      )
    );

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.validationErrors).toBe(
      requests.filter(r => !r.valid).length
    );
    expect(metrics.performance.concurrentRequests).toBeLessThanOrEqual(
      DEBUG_CONFIG.thresholds.api.concurrent_requests
    );
  });
});
