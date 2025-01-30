import { renderHook, act } from '@testing-library/react';
import { useMetricsStore } from '../../stores/metricsStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { DEBUG_CONFIG } from '../../config/debug.config';

describe('Metrics Store', () => {
  beforeEach(() => {
    useMetricsStore.setState({
      metrics: createDebugMetrics(),
      metricsHistory: [],
      isEnabled: true
    });
  });

  it('should initialize with default metrics', () => {
    const { result } = renderHook(() => useMetricsStore());
    expect(result.current.metrics).toEqual(createDebugMetrics());
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.metricsHistory).toHaveLength(0);
  });

  it('should update performance metrics', () => {
    const { result } = renderHook(() => useMetricsStore());

    act(() => {
      result.current.updateMetrics({
        performance: {
          errorRate: 0.5,
          apiLatency: 1000,
          systemHealth: 0.5
        }
      });
    });

    expect(result.current.metrics.performance.errorRate).toBe(0.5);
    expect(result.current.metrics.performance.apiLatency).toBe(1000);
    expect(result.current.metrics.performance.systemHealth).toBe(0.5);
  });

  it('should maintain metrics history', () => {
    const { result } = renderHook(() => useMetricsStore());

    for (let i = 0; i < 5; i++) {
      act(() => {
        result.current.updateMetrics({
          performance: {
            errorRate: i * 0.2,
            apiLatency: i * 200,
            systemHealth: 1 - i * 0.2
          }
        });
      });
    }

    expect(result.current.metricsHistory).toHaveLength(5);
    expect(result.current.metricsHistory[0].performance.errorRate).toBe(0);
    expect(result.current.metricsHistory[4].performance.errorRate).toBe(0.8);
  });

  it('should respect history retention limits', () => {
    const { result } = renderHook(() => useMetricsStore());

    const maxEntries = DEBUG_CONFIG.retention.max_logs;
    for (let i = 0; i < maxEntries + 5; i++) {
      act(() => {
        result.current.updateMetrics({
          performance: {
            errorRate: i * 0.1,
            apiLatency: i * 100,
            systemHealth: 1 - i * 0.1
          }
        });
      });
    }

    expect(result.current.metricsHistory).toHaveLength(maxEntries);
    expect(result.current.metricsHistory[maxEntries - 1].performance.errorRate)
      .toBeGreaterThan(result.current.metricsHistory[0].performance.errorRate);
  });

  it('should clear metrics history', () => {
    const { result } = renderHook(() => useMetricsStore());

    act(() => {
      result.current.updateMetrics({
        performance: {
          errorRate: 0.5,
          apiLatency: 1000,
          systemHealth: 0.5
        }
      });
      result.current.clearHistory();
    });

    expect(result.current.metricsHistory).toHaveLength(0);
    expect(result.current.metrics).toEqual(createDebugMetrics());
  });

  it('should toggle debug mode', () => {
    const { result } = renderHook(() => useMetricsStore());

    act(() => {
      result.current.toggleDebug();
    });

    expect(result.current.isEnabled).toBe(false);

    act(() => {
      result.current.toggleDebug();
    });

    expect(result.current.isEnabled).toBe(true);
  });

  it('should handle concurrent metric updates', async () => {
    const { result } = renderHook(() => useMetricsStore());

    await Promise.all([
      act(async () => {
        result.current.updateMetrics({
          performance: { errorRate: 0.1, apiLatency: 100, systemHealth: 0.9 }
        });
      }),
      act(async () => {
        result.current.updateMetrics({
          performance: { errorRate: 0.2, apiLatency: 200, systemHealth: 0.8 }
        });
      })
    ]);

    expect(result.current.metricsHistory).toHaveLength(2);
    expect(result.current.metrics.performance.errorRate).toBe(0.2);
  });
});
