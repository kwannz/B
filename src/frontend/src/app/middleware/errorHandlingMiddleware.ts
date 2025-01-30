import { useDebugStore } from '../stores/debugStore';
import { ApiError } from '../tests/types/api.types';
import { DEBUG_CONFIG } from '../config/debug.config';

export const errorHandlingMiddleware = async <T>(
  operation: () => Promise<T>
): Promise<T> => {
  const startTime = performance.now();
  const store = useDebugStore.getState();

  try {
    const result = await operation();
    const endTime = performance.now();
    const latency = endTime - startTime;

    store.updateMetrics({
      performance: {
        ...store.metrics.performance,
        apiLatency: latency,
        errorRate: Math.max(0, store.metrics.performance.errorRate - 0.1),
        systemHealth: Math.min(1, store.metrics.performance.systemHealth + 0.1)
      }
    });

    if (latency > DEBUG_CONFIG.thresholds.system.latency) {
      store.addLog(`High latency operation detected: ${latency}ms`);
      store.updateMetrics({
        performance: {
          ...store.metrics.performance,
          systemHealth: Math.max(0, store.metrics.performance.systemHealth - 0.1)
        }
      });
    }

    return result;
  } catch (error) {
    const endTime = performance.now();
    const latency = endTime - startTime;

    const apiError = error as ApiError;
    const errorContext = {
      code: apiError.code || 'UNKNOWN_ERROR',
      status: apiError.status || 500,
      message: apiError.message || 'An unknown error occurred',
      timestamp: new Date().toISOString(),
      latency
    };

    store.addLog(
      `Error: ${errorContext.code} (${errorContext.status}): ${errorContext.message}`
    );

    if (apiError.cause) {
      store.addLog(`Caused by: ${apiError.cause.message}`);
    }

    store.updateMetrics({
      performance: {
        ...store.metrics.performance,
        errorRate: Math.min(1, store.metrics.performance.errorRate + 0.2),
        systemHealth: Math.max(0, store.metrics.performance.systemHealth - 0.2),
        apiLatency: latency
      }
    });

    throw error;
  }
};
