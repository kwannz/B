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

describe('API Debug Integration', () => {
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

  it('should track API performance metrics during wallet creation', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    const mockWallet = {
      address: 'test-wallet',
      private_key: 'test-key',
      balance: 1000,
      bot_id: 'test-bot'
    };

    (createWallet as jest.Mock).mockResolvedValue(mockWallet);

    const startTime = performance.now();
    await createWallet('test-bot');
    const duration = performance.now() - startTime;

    const metrics = result.current.getMetricsSnapshot();
    expect(metrics.performance.apiLatency).toBeGreaterThanOrEqual(0);
    expect(metrics.performance.errorRate).toBe(0);
    expect(metrics.performance.systemHealth).toBeGreaterThan(0);
  });

  it('should track API errors during wallet retrieval', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    const mockError = new Error('API Error');
    (getWallet as jest.Mock).mockRejectedValue(mockError);

    try {
      await getWallet('test-bot');
    } catch (error) {
      const metrics = result.current.getMetricsSnapshot();
      expect(metrics.performance.errorRate).toBe(1);
      expect(metrics.performance.systemHealth).toBe(0);
    }
  });

  it('should track bot creation and status metrics', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    const mockBot = {
      id: 'test-bot',
      type: 'trading',
      strategy: 'test-strategy',
      status: 'active',
      created_at: new Date().toISOString()
    };

    (createBot as jest.Mock).mockResolvedValue(mockBot);
    (getBotStatus as jest.Mock).mockResolvedValue({
      ...mockBot,
      metrics: {
        total_volume: 1000,
        profit_loss: 100,
        active_positions: 2
      }
    });

    await createBot('trading', 'test-strategy');
    await getBotStatus('test-bot');

    const metrics = result.current.getMetricsSnapshot();
    expect(metrics.trading.botStatuses['test-bot']).toBe('active');
    expect(metrics.performance.apiLatency).toBeGreaterThanOrEqual(0);
  });

  it('should respect debug configuration thresholds', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    const mockWallet = {
      address: 'test-wallet',
      private_key: 'test-key',
      balance: 1000,
      bot_id: 'test-bot'
    };

    (createWallet as jest.Mock).mockImplementation(() => 
      new Promise(resolve => {
        setTimeout(() => resolve(mockWallet), DEBUG_CONFIG.thresholds.system.latency + 100);
      })
    );

    await createWallet('test-bot');

    const metrics = result.current.getMetricsSnapshot();
    expect(metrics.performance.systemHealth).toBeLessThan(1);
    expect(metrics.performance.apiLatency).toBeGreaterThan(DEBUG_CONFIG.thresholds.system.latency);
  });

  it('should track concurrent API calls correctly', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    const mockBot = {
      id: 'test-bot',
      type: 'trading',
      strategy: 'test-strategy',
      status: 'active',
      created_at: new Date().toISOString()
    };

    (createBot as jest.Mock).mockResolvedValue(mockBot);
    (getBotStatus as jest.Mock).mockResolvedValue(mockBot);

    await Promise.all([
      createBot('trading', 'strategy-1'),
      createBot('trading', 'strategy-2'),
      getBotStatus('test-bot-1'),
      getBotStatus('test-bot-2')
    ]);

    const metrics = result.current.getMetricsSnapshot();
    expect(metrics.performance.apiLatency).toBeGreaterThanOrEqual(0);
    expect(metrics.performance.errorRate).toBe(0);
  });
});
