import { renderHook, act } from '@testing-library/react';
import { useDebugMetrics } from '../../hooks/useDebugMetrics';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { TestProvider } from '../contexts/TestContext';
import { DEBUG_CONFIG } from '../../config/debug.config';

describe('useDebugMetrics Hook', () => {
  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
  });

  it('should initialize with default metrics', () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: TestProvider
    });

    expect(result.current.metrics).toEqual(createDebugMetrics());
    expect(result.current.isEnabled).toBe(true);
  });

  it('should update performance metrics', () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: TestProvider
    });

    act(() => {
      result.current.updatePerformanceMetrics({
        errorRate: 0.5,
        apiLatency: 1000,
        systemHealth: 0.5
      });
    });

    expect(result.current.metrics.performance.errorRate).toBe(0.5);
    expect(result.current.metrics.performance.apiLatency).toBe(1000);
    expect(result.current.metrics.performance.systemHealth).toBe(0.5);
  });

  it('should update trading metrics', () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: TestProvider
    });

    act(() => {
      result.current.updateTradingMetrics({
        activePositions: 5,
        totalVolume: 10000,
        profitLoss: 500
      });
    });

    expect(result.current.metrics.trading.activePositions).toBe(5);
    expect(result.current.metrics.trading.totalVolume).toBe(10000);
    expect(result.current.metrics.trading.profitLoss).toBe(500);
  });

  it('should update wallet metrics', () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: TestProvider
    });

    act(() => {
      result.current.updateWalletMetrics({
        balances: { 'test-wallet': 100 },
        transactions: 5
      });
    });

    expect(result.current.metrics.wallet.balances['test-wallet']).toBe(100);
    expect(result.current.metrics.wallet.transactions).toBe(5);
  });

  it('should track API call performance', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: TestProvider
    });

    const mockApiCall = jest.fn().mockResolvedValue({ data: 'success' });

    await act(async () => {
      await result.current.trackApiCall(mockApiCall);
    });

    expect(result.current.metrics.performance.apiLatency).toBeLessThanOrEqual(
      DEBUG_CONFIG.thresholds.system.latency
    );
    expect(result.current.metrics.performance.errorRate).toBe(0);
  });

  it('should handle API errors', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: TestProvider
    });

    const mockApiCall = jest.fn().mockRejectedValue(new Error('API Error'));

    await act(async () => {
      try {
        await result.current.trackApiCall(mockApiCall);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    expect(result.current.metrics.performance.errorRate).toBeGreaterThan(0);
    expect(result.current.metrics.performance.systemHealth).toBeLessThan(1);
  });

  it('should maintain metrics history', () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: TestProvider
    });

    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.updatePerformanceMetrics({
          errorRate: i * 0.1,
          apiLatency: i * 100,
          systemHealth: 1 - i * 0.1
        });
      }
    });

    expect(result.current.metricsHistory).toHaveLength(5);
    expect(result.current.metricsHistory[0].performance.errorRate).toBe(0);
    expect(result.current.metricsHistory[4].performance.errorRate).toBe(0.4);
  });

  it('should clear metrics history', () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: TestProvider
    });

    act(() => {
      result.current.updatePerformanceMetrics({
        errorRate: 0.1,
        apiLatency: 100,
        systemHealth: 0.9
      });
      result.current.clearMetricsHistory();
    });

    expect(result.current.metricsHistory).toHaveLength(0);
  });
});
