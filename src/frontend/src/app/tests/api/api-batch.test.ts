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

  it('should handle bulk wallet creation', async () => {
    const walletBatch = Array(5).fill(null).map((_, i) => ({
      botId: `bot-${i}`,
      type: 'trading'
    }));

    await runDebugApiTest(async () => {
      await Promise.all(
        walletBatch.map(wallet =>
          debugMetricsMiddleware(
            { method: 'POST', url: '/api/wallets' },
            () => apiClient.createWallet(wallet.botId)
          )
        )
      );
    });

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.batchOperations).toBe(1);
    expect(metrics.wallet.transactions).toBe(walletBatch.length);
  });

  it('should optimize batch transfers', async () => {
    const transfers = Array(3).fill(null).map((_, i) => ({
      from: `wallet-${i}`,
      to: `wallet-${i + 1}`,
      amount: (i + 1) * 0.1
    }));

    await runDebugApiTest(async () => {
      await Promise.all(
        transfers.map(transfer =>
          debugMetricsMiddleware(
            { method: 'POST', url: '/api/transfers' },
            () => apiClient.transferSOL(transfer.from, transfer.to, transfer.amount)
          )
        )
      );
    });

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.batchLatency).toBeLessThan(
      DEBUG_CONFIG.thresholds.system.latency * transfers.length
    );
  });

  it('should handle batch bot operations', async () => {
    const bots = Array(4).fill(null).map((_, i) => ({
      type: 'trading',
      strategy: `strategy-${i}`,
      status: i % 2 === 0 ? 'active' : 'inactive'
    }));

    await runDebugApiTest(async () => {
      const createdBots = await Promise.all(
        bots.map(bot =>
          debugMetricsMiddleware(
            { method: 'POST', url: '/api/bots' },
            () => apiClient.createBot(bot.type, bot.strategy)
          )
        )
      );

      await Promise.all(
        createdBots.map((bot, i) =>
          debugMetricsMiddleware(
            { method: 'PATCH', url: `/api/bots/${bot.id}` },
            () => apiClient.updateBotStatus(bot.id, bots[i].status as any)
          )
        )
      );
    });

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.batchOperations).toBe(2);
    expect(metrics.performance.apiLatency).toBeLessThan(
      DEBUG_CONFIG.thresholds.system.latency * 2
    );
  });

  it('should handle mixed batch operations', async () => {
    const operations = [
      { type: 'wallet', botId: 'bot-1' },
      { type: 'bot', strategy: 'strategy-1' },
      { type: 'transfer', from: 'wallet-1', to: 'wallet-2', amount: 0.1 }
    ];

    await runDebugApiTest(async () => {
      await Promise.all(
        operations.map(op => {
          switch (op.type) {
            case 'wallet':
              return debugMetricsMiddleware(
                { method: 'POST', url: '/api/wallets' },
                () => apiClient.createWallet(op.botId)
              );
            case 'bot':
              return debugMetricsMiddleware(
                { method: 'POST', url: '/api/bots' },
                () => apiClient.createBot('trading', op.strategy)
              );
            case 'transfer':
              return debugMetricsMiddleware(
                { method: 'POST', url: '/api/transfers' },
                () => apiClient.transferSOL(op.from, op.to, op.amount)
              );
          }
        })
      );
    });

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.batchOperations).toBe(1);
    expect(metrics.performance.concurrentRequests).toBeLessThanOrEqual(
      DEBUG_CONFIG.thresholds.api.concurrent_requests
    );
  });

  it('should handle batch operation failures', async () => {
    const operations = Array(5).fill(null).map((_, i) => ({
      botId: `bot-${i}`,
      shouldFail: i % 2 === 0
    }));

    for (const op of operations) {
      if (op.shouldFail) {
        mockAPI.createWallet.mockRejectedValueOnce(new Error('Operation failed'));
      } else {
        mockAPI.createWallet.mockResolvedValueOnce({ address: 'test-address' });
      }
    }

    await runDebugApiTest(async () => {
      await Promise.allSettled(
        operations.map(op =>
          debugMetricsMiddleware(
            { method: 'POST', url: '/api/wallets' },
            () => apiClient.createWallet(op.botId)
          )
        )
      );
    });

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.batchFailureRate).toBe(0.6);
    expect(metrics.performance.errorRate).toBeGreaterThan(0);
  });
});
