import { renderHook } from '@testing-library/react';
import { useDebugMetrics } from '../hooks/useDebugMetrics';
import { useDebugStore } from '../stores/debugStore';
import { DebugMetricsProvider } from '../providers/DebugMetricsProvider';
import { createWallet, getWallet, createBot, getBotStatus } from '../api/client';
import { DEBUG_CONFIG } from '../config/debug.config';

jest.mock('../api/client', () => ({
  createWallet: jest.fn(),
  getWallet: jest.fn(),
  createBot: jest.fn(),
  getBotStatus: jest.fn()
}));

describe('API Metrics Collection', () => {
  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: {
        performance: [],
        trading: [],
        wallet: []
      }
    });
    jest.clearAllMocks();
  });

  it('should collect metrics without minimum balance enforcement', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    const mockWallet = {
      address: 'test-wallet',
      private_key: 'test-key',
      balance: 0,
      bot_id: 'test-bot'
    };

    (createWallet as jest.Mock).mockResolvedValue(mockWallet);
    await createWallet('test-bot');

    const metrics = result.current.getMetricsSnapshot();
    expect(metrics.wallet.balances['test-wallet']).toBe(0);
    expect(metrics.performance.errorRate).toBe(0);
  });

  it('should track API latency metrics', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    const mockBot = {
      id: 'test-bot',
      status: 'active'
    };

    (getBotStatus as jest.Mock).mockImplementation(() => 
      new Promise(resolve => {
        setTimeout(() => resolve(mockBot), 100);
      })
    );

    const startTime = performance.now();
    await getBotStatus('test-bot');
    const endTime = performance.now();

    const metrics = result.current.getMetricsSnapshot();
    expect(metrics.performance.apiLatency).toBeGreaterThanOrEqual(0);
    expect(metrics.performance.apiLatency).toBeLessThanOrEqual(endTime - startTime);
  });

  it('should track error rates without enforcing balance limits', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    const mockError = new Error('Insufficient funds');
    (getWallet as jest.Mock).mockRejectedValue(mockError);

    try {
      await getWallet('test-wallet');
    } catch (error) {
      const metrics = result.current.getMetricsSnapshot();
      expect(metrics.performance.errorRate).toBe(1);
      expect(metrics.performance.systemHealth).toBe(0);
    }
  });

  it('should collect metrics across multiple timeframes', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    const mockBot = {
      id: 'test-bot',
      status: 'active'
    };

    (getBotStatus as jest.Mock).mockResolvedValue(mockBot);

    for (let i = 0; i < 5; i++) {
      await getBotStatus('test-bot');
    }

    const metrics = result.current.getMetricsSnapshot();
    expect(metrics.performance.apiLatency).toBeGreaterThanOrEqual(0);
    expect(metrics.trading.botStatuses['test-bot']).toBe('active');
  });

  it('should respect debug configuration thresholds', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    const mockBot = {
      id: 'test-bot',
      status: 'active'
    };

    (getBotStatus as jest.Mock).mockImplementation(() => 
      new Promise(resolve => {
        setTimeout(() => resolve(mockBot), DEBUG_CONFIG.thresholds.system.latency + 100);
      })
    );

    await getBotStatus('test-bot');

    const metrics = result.current.getMetricsSnapshot();
    expect(metrics.performance.systemHealth).toBeLessThan(1);
    expect(metrics.performance.apiLatency).toBeGreaterThan(DEBUG_CONFIG.thresholds.system.latency);
  });

  it('should track concurrent API calls without balance enforcement', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    const mockWallet = {
      address: 'test-wallet',
      private_key: 'test-key',
      balance: 0,
      bot_id: 'test-bot'
    };

    (createWallet as jest.Mock).mockResolvedValue(mockWallet);

    await Promise.all([
      createWallet('bot-1'),
      createWallet('bot-2'),
      createWallet('bot-3')
    ]);

    const metrics = result.current.getMetricsSnapshot();
    expect(metrics.performance.apiLatency).toBeGreaterThanOrEqual(0);
    expect(metrics.performance.errorRate).toBe(0);
    expect(Object.keys(metrics.wallet.balances)).toHaveLength(3);
  });
});
