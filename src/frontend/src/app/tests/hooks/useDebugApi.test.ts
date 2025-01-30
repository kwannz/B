import { renderHook, act } from '@testing-library/react';
import { useDebugMetrics } from '../../hooks/useDebugMetrics';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { TestProvider } from '../contexts/TestContext';
import { mockAPI } from '../setup/test-config';
import { runDebugTest } from '../utils/debug-test-runner';
import { DEBUG_CONFIG } from '../../config/debug.config';

describe('Debug API Integration', () => {
  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
  });

  it('should track wallet API metrics', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: TestProvider
    });

    await runDebugTest(async () => {
      await mockAPI.createWallet('test-bot');
      await mockAPI.getWallet('test-bot');
      await mockAPI.transferSOL('wallet-a', 'wallet-b', 1.0);
    });

    expect(result.current.metrics.wallet.transactions).toBeGreaterThan(0);
    expect(result.current.metrics.performance.errorRate).toBe(0);
  });

  it('should track bot API metrics', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: TestProvider
    });

    await runDebugTest(async () => {
      await mockAPI.createBot('trading', 'test-strategy');
      await mockAPI.getBotStatus('test-bot');
      await mockAPI.updateBotStatus('test-bot', 'active');
    });

    expect(result.current.metrics.trading.activePositions).toBeGreaterThanOrEqual(0);
    expect(result.current.metrics.performance.apiLatency).toBeLessThanOrEqual(
      DEBUG_CONFIG.thresholds.system.latency
    );
  });

  it('should handle API timeouts', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: TestProvider
    });

    const delay = DEBUG_CONFIG.thresholds.system.latency + 1000;
    mockAPI.createWallet.mockImplementation(() =>
      new Promise(resolve => setTimeout(resolve, delay))
    );

    await runDebugTest(async () => {
      try {
        await mockAPI.createWallet('test-bot');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    expect(result.current.metrics.performance.apiLatency).toBeGreaterThan(
      DEBUG_CONFIG.thresholds.system.latency
    );
    expect(result.current.metrics.performance.systemHealth).toBeLessThan(1);
  });

  it('should handle concurrent API calls', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: TestProvider
    });

    await runDebugTest(async () => {
      await Promise.all([
        mockAPI.createWallet('bot-1'),
        mockAPI.createWallet('bot-2'),
        mockAPI.createBot('trading', 'strategy-1'),
        mockAPI.createBot('trading', 'strategy-2')
      ]);
    });

    expect(result.current.metrics.performance.apiLatency).toBeLessThanOrEqual(
      DEBUG_CONFIG.thresholds.system.latency * 4
    );
    expect(result.current.metricsHistory.length).toBeGreaterThan(0);
  });

  it('should track API error patterns', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: TestProvider
    });

    const errors = [
      { message: 'Network Error', code: 'NETWORK_ERROR', status: 503 },
      { message: 'Timeout', code: 'TIMEOUT', status: 504 },
      { message: 'Server Error', code: 'SERVER_ERROR', status: 500 }
    ];

    await runDebugTest(async () => {
      for (const error of errors) {
        mockAPI.createWallet.mockRejectedValueOnce(error);
        try {
          await mockAPI.createWallet('test-bot');
        } catch (e) {
          expect(e).toBeDefined();
        }
      }
    });

    expect(result.current.metrics.performance.errorRate).toBeGreaterThan(0);
    expect(result.current.metrics.performance.systemHealth).toBeLessThan(1);
    expect(result.current.metricsHistory.length).toBe(errors.length);
  });

  it('should maintain API metrics history', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: TestProvider
    });

    await runDebugTest(async () => {
      for (let i = 0; i < 5; i++) {
        if (i % 2 === 0) {
          await mockAPI.createWallet(`bot-${i}`);
        } else {
          mockAPI.createWallet.mockRejectedValueOnce(new Error('API Error'));
          try {
            await mockAPI.createWallet(`bot-${i}`);
          } catch (e) {
            expect(e).toBeDefined();
          }
        }
      }
    });

    const history = result.current.metricsHistory;
    expect(history.length).toBe(5);
    expect(history.filter(m => m.performance.errorRate > 0).length).toBe(2);
  });
});
