import { renderHook, act } from '@testing-library/react';
import { useDebugMetrics } from '../hooks/useDebugMetrics';
import { useDebugStore } from '../stores/debugStore';
import { DebugMetricsProvider } from '../providers/DebugMetricsProvider';
import { DEBUG_CONFIG } from '../config/debug.config';
import { ApiError } from '../api/client';

describe('Debug Integration Tests', () => {
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
  });

  it('should track API performance metrics', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    act(() => {
      result.current.addPerformanceMetric({
        apiLatency: 100,
        memoryUsage: 0.5,
        errorRate: 0.01,
        systemHealth: 0.95
      });
    });

    const metrics = result.current.getMetricsSnapshot();
    expect(metrics.performance.apiLatency).toBe(100);
    expect(metrics.performance.memoryUsage).toBe(0.5);
    expect(metrics.performance.errorRate).toBe(0.01);
    expect(metrics.performance.systemHealth).toBe(0.95);
  });

  it('should track trading metrics across timeframes', () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    act(() => {
      result.current.addTradingMetric({
        botId: 'test-bot',
        status: 'active',
        positions: 5,
        trades: 100,
        successRate: 0.8
      });
    });

    const metrics = result.current.getMetricsSnapshot();
    expect(metrics.trading.botStatuses['test-bot']).toBe('active');
    expect(metrics.trading.activePositions).toBe(5);
    expect(metrics.trading.totalTrades).toBe(100);
    expect(metrics.trading.successRate).toBe(0.8);
  });

  it('should track wallet performance metrics', () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    act(() => {
      result.current.addWalletMetric({
        address: 'test-wallet',
        balance: 1000,
        transactions: 50
      });
    });

    const metrics = result.current.getMetricsSnapshot();
    expect(metrics.wallet.balances['test-wallet']).toBe(1000);
    expect(metrics.wallet.transactions).toBe(50);
  });

  it('should handle API errors and update error rates', () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    const apiError: ApiError = {
      message: 'Test error',
      code: 'TEST_ERROR',
      details: { reason: 'test' }
    };

    act(() => {
      result.current.addPerformanceMetric({
        apiLatency: 500,
        errorRate: 1,
        systemHealth: 0
      });
    });

    const metrics = result.current.getMetricsSnapshot();
    expect(metrics.performance.errorRate).toBe(1);
    expect(metrics.performance.systemHealth).toBe(0);
  });

  it('should respect data retention limits', () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    const dataPoints = DEBUG_CONFIG.visualization.data_points + 10;
    
    act(() => {
      for (let i = 0; i < dataPoints; i++) {
        result.current.addPerformanceMetric({
          apiLatency: i,
          systemHealth: 1
        });
      }
    });

    const metrics = useDebugStore.getState().metrics.performance;
    expect(metrics.length).toBeLessThanOrEqual(DEBUG_CONFIG.visualization.data_points);
  });

  it('should export and import metrics correctly', () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    act(() => {
      result.current.addPerformanceMetric({
        apiLatency: 100,
        errorRate: 0,
        systemHealth: 1,
        memoryUsage: 0.5
      });
    });

    const exported = result.current.exportMetrics();
    act(() => {
      result.current.clearMetrics();
    });

    let metrics = result.current.getMetricsSnapshot();
    expect(metrics.performance.apiLatency).toBe(0);

    act(() => {
      useDebugStore.setState({ metrics: JSON.parse(exported) });
    });

    metrics = result.current.getMetricsSnapshot();
    expect(metrics.performance.apiLatency).toBe(100);
    expect(metrics.performance.memoryUsage).toBe(0.5);
  });
});
