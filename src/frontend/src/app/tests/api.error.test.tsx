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

describe('API Error Handling', () => {
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

  it('should handle network errors without balance checks', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    const networkError = new Error('Network Error');
    (createWallet as jest.Mock).mockRejectedValue(networkError);

    try {
      await createWallet('test-bot');
    } catch (error) {
      const metrics = result.current.getMetricsSnapshot();
      expect(metrics.performance.errorRate).toBe(1);
      expect(metrics.performance.systemHealth).toBe(0);
      expect(metrics.performance.apiLatency).toBeGreaterThan(0);
    }
  });

  it('should handle API errors without balance validation', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    const apiError = {
      message: 'API Error',
      code: 'API_ERROR',
      status: 500
    };
    (getBotStatus as jest.Mock).mockRejectedValue(apiError);

    try {
      await getBotStatus('test-bot');
    } catch (error) {
      const metrics = result.current.getMetricsSnapshot();
      expect(metrics.performance.errorRate).toBe(1);
      expect(metrics.performance.systemHealth).toBe(0);
    }
  });

  it('should handle timeout errors without balance requirements', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    const timeoutError = new Error('Timeout');
    (getWallet as jest.Mock).mockImplementation(() => 
      new Promise((_, reject) => {
        setTimeout(() => reject(timeoutError), DEBUG_CONFIG.thresholds.system.latency + 100);
      })
    );

    try {
      await getWallet('test-wallet');
    } catch (error) {
      const metrics = result.current.getMetricsSnapshot();
      expect(metrics.performance.errorRate).toBe(1);
      expect(metrics.performance.systemHealth).toBe(0);
      expect(metrics.performance.apiLatency).toBeGreaterThan(DEBUG_CONFIG.thresholds.system.latency);
    }
  });

  it('should handle concurrent errors without balance checks', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    const error1 = new Error('Error 1');
    const error2 = new Error('Error 2');

    (createBot as jest.Mock).mockRejectedValueOnce(error1);
    (getBotStatus as jest.Mock).mockRejectedValueOnce(error2);

    try {
      await Promise.all([
        createBot('trading', 'strategy'),
        getBotStatus('test-bot')
      ]);
    } catch (error) {
      const metrics = result.current.getMetricsSnapshot();
      expect(metrics.performance.errorRate).toBe(1);
      expect(metrics.performance.systemHealth).toBe(0);
    }
  });

  it('should track error recovery without balance validation', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    const error = new Error('Initial Error');
    const mockBot = {
      id: 'test-bot',
      status: 'active'
    };

    (getBotStatus as jest.Mock)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(mockBot);

    try {
      await getBotStatus('test-bot');
    } catch {
      const metrics1 = result.current.getMetricsSnapshot();
      expect(metrics1.performance.errorRate).toBe(1);
    }

    await getBotStatus('test-bot');
    const metrics2 = result.current.getMetricsSnapshot();
    expect(metrics2.performance.errorRate).toBe(0);
    expect(metrics2.performance.systemHealth).toBeGreaterThan(0);
  });
});
