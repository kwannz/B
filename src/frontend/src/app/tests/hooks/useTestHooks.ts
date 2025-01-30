import { renderHook, act } from '@testing-library/react';
import { useDebugMetrics } from '../../hooks/useDebugMetrics';
import { useDebugStore } from '../../stores/debugStore';
import { DebugMetricsProvider } from '../../providers/DebugMetricsProvider';
import { TestMetrics } from '../types/test.types';
import { createDebugMetrics } from '../utils/debug-test-utils';

export const useTestDebugMetrics = () => {
  const { result } = renderHook(() => useDebugMetrics(), {
    wrapper: DebugMetricsProvider
  });

  const updateMetrics = (metrics: Partial<TestMetrics>) => {
    act(() => {
      useDebugStore.setState(state => ({
        ...state,
        metrics: {
          ...state.metrics,
          ...metrics
        }
      }));
    });
  };

  const resetMetrics = () => {
    act(() => {
      useDebugStore.setState({
        isEnabled: true,
        logs: [],
        metrics: createDebugMetrics()
      });
    });
  };

  const simulateApiCall = async <T>(
    promise: Promise<T>,
    latency = 100
  ): Promise<T> => {
    const startTime = performance.now();
    const result = await promise;
    const endTime = performance.now();
    
    updateMetrics({
      performance: {
        apiLatency: endTime - startTime,
        errorRate: 0,
        systemHealth: 1
      }
    });

    return result;
  };

  const simulateApiError = async (
    promise: Promise<any>,
    error: Error
  ): Promise<void> => {
    try {
      await promise;
    } catch (e) {
      updateMetrics({
        performance: {
          errorRate: 1,
          systemHealth: 0
        }
      });
      throw error;
    }
  };

  return {
    metrics: result.current,
    updateMetrics,
    resetMetrics,
    simulateApiCall,
    simulateApiError
  };
};
