import { renderHook, act } from '@testing-library/react';
import { useDebugMetrics } from '../../hooks/useDebugMetrics';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { TestProvider } from '../contexts/TestContext';
import { mockAPI } from '../setup/test-config';
import { runDebugTest, runDebugApiTest } from '../utils/debug-test-runner';
import { apiDebugMiddleware } from '../../middleware/apiDebugMiddleware';
import { DEBUG_CONFIG } from '../../config/debug.config';

describe('Debug Metrics Integration', () => {
  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
  });

  it('should track complete trading workflow', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: TestProvider
    });

    await runDebugTest(async () => {
      // Create bot
      await apiDebugMiddleware(
        { method: 'POST', url: '/bots', data: { type: 'trading', strategy: 'test' } },
        async () => {
          const response = await mockAPI.createBot('trading', 'test');
          return response;
        }
      );

      // Create wallet
      await apiDebugMiddleware(
        { method: 'POST', url: '/wallets', data: { bot_id: 'test-bot' } },
        async () => {
          const response = await mockAPI.createWallet('test-bot');
          return response;
        }
      );

      // Update bot status
      await apiDebugMiddleware(
        { method: 'PATCH', url: '/bots/test-bot', data: { status: 'active' } },
        async () => {
          const response = await mockAPI.updateBotStatus('test-bot', 'active');
          return response;
        }
      );

      // Transfer SOL
      await apiDebugMiddleware(
        { method: 'POST', url: '/wallets/transfer', data: { amount: 1.0 } },
        async () => {
          const response = await mockAPI.transferSOL('wallet-a', 'wallet-b', 1.0);
          return response;
        }
      );
    });

    expect(result.current.metrics.performance.errorRate).toBe(0);
    expect(result.current.metrics.performance.systemHealth).toBe(1);
    expect(result.current.metrics.performance.apiLatency).toBeLessThanOrEqual(
      DEBUG_CONFIG.thresholds.system.latency
    );
    expect(result.current.metrics.wallet.transactions).toBeGreaterThan(0);
  });

  it('should handle system-wide error propagation', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: TestProvider
    });

    const error = {
      message: 'System Error',
      code: 'SYSTEM_ERROR',
      status: 500
    };

    mockAPI.createBot.mockRejectedValue(error);
    mockAPI.createWallet.mockRejectedValue(error);
    mockAPI.getBotStatus.mockRejectedValue(error);

    await runDebugTest(async () => {
      try {
        await Promise.all([
          apiDebugMiddleware(
            { method: 'POST', url: '/bots', data: { type: 'trading' } },
            () => mockAPI.createBot('trading', 'test')
          ),
          apiDebugMiddleware(
            { method: 'POST', url: '/wallets', data: { bot_id: 'test' } },
            () => mockAPI.createWallet('test')
          ),
          apiDebugMiddleware(
            { method: 'GET', url: '/bots/test' },
            () => mockAPI.getBotStatus('test')
          )
        ]);
      } catch (e) {
        // Expected errors
      }
    });

    expect(result.current.metrics.performance.errorRate).toBeGreaterThan(0);
    expect(result.current.metrics.performance.systemHealth).toBeLessThan(1);
  });

  it('should track concurrent API operations', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: TestProvider
    });

    await runDebugTest(async () => {
      const operations = Array(5).fill(null).map((_, i) =>
        apiDebugMiddleware(
          { method: 'POST', url: '/bots', data: { type: 'trading' } },
          async () => {
            await new Promise(resolve => setTimeout(resolve, i * 100));
            return mockAPI.createBot('trading', `test-${i}`);
          }
        )
      );

      await Promise.all(operations);
    });

    expect(result.current.metrics.performance.apiLatency).toBeLessThanOrEqual(
      DEBUG_CONFIG.thresholds.system.latency * 5
    );
    expect(result.current.metricsHistory.length).toBeGreaterThan(0);
  });

  it('should maintain metrics history during long operations', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: TestProvider
    });

    await runDebugTest(async () => {
      for (let i = 0; i < 5; i++) {
        await apiDebugMiddleware(
          { method: 'GET', url: `/bots/test-${i}` },
          async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return mockAPI.getBotStatus(`test-${i}`);
          }
        );
      }
    });

    expect(result.current.metricsHistory.length).toBe(5);
    expect(result.current.metricsHistory[0].performance.apiLatency).toBeLessThan(
      result.current.metricsHistory[4].performance.apiLatency
    );
  });
});
