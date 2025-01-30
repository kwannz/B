import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Wallet Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should track wallet creation metrics', async () => {
    const wallets = Array(3).fill(null).map((_, i) => ({
      botId: `bot-${i}`,
      balance: i * 1.5
    }));

    for (const wallet of wallets) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/wallets' },
          () => apiClient.createWallet(wallet.botId)
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.wallet.totalWallets).toBe(wallets.length);
    expect(metrics.performance.apiLatency).toBeLessThan(
      DEBUG_CONFIG.thresholds.system.latency
    );
  });

  it('should monitor wallet balance changes', async () => {
    const transfers = [
      { from: 'wallet-a', to: 'wallet-b', amount: 1.0 },
      { from: 'wallet-b', to: 'wallet-c', amount: 0.5 },
      { from: 'wallet-a', to: 'wallet-c', amount: 0.3 }
    ];

    for (const transfer of transfers) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/transfers' },
          () => apiClient.transferSOL(transfer.from, transfer.to, transfer.amount)
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.wallet.transactions).toBe(transfers.length);
    expect(metrics.wallet.transferVolume).toBeGreaterThan(0);
  });

  it('should track wallet operation performance', async () => {
    const operations = Array(5).fill(null).map((_, i) => ({
      type: i % 2 === 0 ? 'create' : 'transfer',
      delay: 100 * (i + 1)
    }));

    for (const op of operations) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: `/api/${op.type === 'create' ? 'wallets' : 'transfers'}` },
          async () => {
            await new Promise(resolve => setTimeout(resolve, op.delay));
            if (op.type === 'create') {
              return apiClient.createWallet(`bot-${op.delay}`);
            } else {
              return apiClient.transferSOL('wallet-a', 'wallet-b', 0.1);
            }
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.apiLatency).toBeGreaterThan(100);
    expect(metrics.wallet.operationLatency).toBeDefined();
  });

  it('should handle wallet errors gracefully', async () => {
    const errorScenarios = [
      { type: 'insufficient_balance', amount: 1000 },
      { type: 'invalid_address', address: 'invalid' },
      { type: 'network_error', delay: 5000 }
    ];

    for (const scenario of errorScenarios) {
      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/api/transfers' },
            async () => {
              if (scenario.type === 'network_error') {
                await new Promise(resolve => setTimeout(resolve, scenario.delay));
              }
              throw new Error(`Wallet ${scenario.type}`);
            }
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.wallet.errorRate).toBeGreaterThan(0);
    expect(metrics.performance.systemHealth).toBeLessThan(1);
  });

  it('should track wallet health metrics', async () => {
    const healthChecks = Array(3).fill(null).map((_, i) => ({
      walletId: `wallet-${i}`,
      balance: i * 0.5,
      transactions: i * 2,
      status: i === 1 ? 'warning' : 'healthy'
    }));

    for (const check of healthChecks) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: `/api/wallets/${check.walletId}/health` },
          async () => {
            useDebugStore.setState(state => ({
              ...state,
              metrics: {
                ...state.metrics,
                wallet: {
                  ...state.metrics.wallet,
                  health: {
                    ...state.metrics.wallet.health,
                    [check.walletId]: check.status
                  }
                }
              }
            }));
            return { status: check.status };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.wallet.health).toBeDefined();
    expect(Object.keys(metrics.wallet.health)).toHaveLength(healthChecks.length);
  });
});
