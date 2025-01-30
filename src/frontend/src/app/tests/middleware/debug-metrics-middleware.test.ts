import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugTest, runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { useDebugStore } from '../../stores/debugStore';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';
import { ApiError } from '../types/api.types';

describe('Debug Metrics Middleware', () => {
  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
  });

  it('should track API request metrics', async () => {
    const mockRequest = {
      method: 'GET',
      url: '/api/test',
      headers: {}
    };

    const mockResponse = {
      status: 200,
      data: { success: true }
    };

    const { metrics } = await runDebugTest(async () => {
      return debugMetricsMiddleware(mockRequest, async () => mockResponse);
    });

    expect(metrics.performance.errorRate).toBe(0);
    expect(metrics.performance.apiLatency).toBeLessThanOrEqual(
      DEBUG_CONFIG.thresholds.system.latency
    );
    expect(metrics.performance.systemHealth).toBe(1);
  });

  it('should handle API errors with detailed metrics', async () => {
    const mockRequest = {
      method: 'POST',
      url: '/api/test',
      headers: {},
      data: { test: true }
    };

    const mockError: ApiError = {
      message: 'API Error',
      code: 'API_ERROR',
      status: 500
    };

    try {
      await debugMetricsMiddleware(mockRequest, async () => {
        throw mockError;
      });
    } catch (error) {
      const metrics = useDebugStore.getState().metrics;
      expect(metrics.performance.errorRate).toBeGreaterThan(0);
      expect(metrics.performance.systemHealth).toBeLessThan(1);
      expect(error).toEqual(mockError);
    }
  });

  it('should track concurrent API requests', async () => {
    const requests = Array(5).fill(null).map((_, i) => ({
      method: 'GET',
      url: `/api/test/${i}`,
      headers: {}
    }));

    const { metrics } = await runDebugTest(async () => {
      await Promise.all(
        requests.map(req =>
          debugMetricsMiddleware(req, async () => ({ status: 200, data: {} }))
        )
      );
    });

    expect(metrics.performance.apiLatency).toBeLessThanOrEqual(
      DEBUG_CONFIG.thresholds.system.latency * 5
    );
    expect(metrics.performance.errorRate).toBe(0);
  });

  it('should handle mixed success and failure scenarios', async () => {
    const requests = Array(4).fill(null).map((_, i) => ({
      method: 'POST',
      url: `/api/test/${i}`,
      headers: {},
      data: { test: true }
    }));

    const mockError: ApiError = {
      message: 'API Error',
      code: 'API_ERROR',
      status: 500
    };

    const results = await Promise.allSettled(
      requests.map((req, i) =>
        debugMetricsMiddleware(req, async () => {
          if (i % 2 === 0) {
            return { status: 200, data: {} };
          }
          throw mockError;
        })
      )
    );

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.errorRate).toBe(0.5);
    expect(metrics.performance.systemHealth).toBeLessThan(1);
    expect(results.filter(r => r.status === 'fulfilled').length).toBe(2);
  });

  it('should track API latency thresholds', async () => {
    const delay = DEBUG_CONFIG.thresholds.system.latency + 100;
    const mockRequest = {
      method: 'GET',
      url: '/api/test',
      headers: {}
    };

    const { metrics } = await runDebugTest(async () => {
      await debugMetricsMiddleware(mockRequest, async () => {
        await new Promise(resolve => setTimeout(resolve, delay));
        return { status: 200, data: {} };
      });
    });

    expect(metrics.performance.apiLatency).toBeGreaterThan(
      DEBUG_CONFIG.thresholds.system.latency
    );
    expect(metrics.performance.systemHealth).toBeLessThan(1);
  });

  it('should maintain metrics history', async () => {
    const mockRequest = {
      method: 'GET',
      url: '/api/test',
      headers: {}
    };

    for (let i = 0; i < 5; i++) {
      await debugMetricsMiddleware(mockRequest, async () => {
        await new Promise(resolve => setTimeout(resolve, i * 100));
        return { status: 200, data: {} };
      });
    }

    const store = useDebugStore.getState();
    expect(store.metricsHistory.length).toBe(5);
    expect(store.metricsHistory[0].performance.apiLatency).toBeLessThan(
      store.metricsHistory[4].performance.apiLatency
    );
  });
});
