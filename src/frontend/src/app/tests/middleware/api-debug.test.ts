import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugTest, runDebugApiTest, runDebugErrorTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { useDebugStore } from '../../stores/debugStore';
import { ApiError } from '../types/api.types';
import { apiDebugMiddleware } from '../../middleware/apiDebugMiddleware';

describe('API Debug Middleware', () => {
  beforeEach(() => {
    jest.resetAllMocks();
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
      return apiDebugMiddleware(mockRequest, async () => mockResponse);
    });

    expect(metrics.performance.errorRate).toBe(0);
    expect(metrics.performance.apiLatency).toBeLessThanOrEqual(
      DEBUG_CONFIG.thresholds.system.latency
    );
    expect(metrics.performance.systemHealth).toBe(1);
  });

  it('should handle API errors', async () => {
    const mockRequest = {
      method: 'POST',
      url: '/api/test',
      headers: {}
    };

    const mockError: ApiError = {
      message: 'API Error',
      code: 'API_ERROR',
      status: 500
    };

    const { error, metrics } = await runDebugErrorTest(
      async () => {
        return apiDebugMiddleware(mockRequest, async () => {
          throw mockError;
        });
      },
      mockError
    );

    expect(metrics.performance.errorRate).toBe(1);
    expect(metrics.performance.systemHealth).toBe(0);
  });

  it('should track slow API responses', async () => {
    const mockRequest = {
      method: 'GET',
      url: '/api/test',
      headers: {}
    };

    const mockResponse = {
      status: 200,
      data: { success: true }
    };

    const delay = DEBUG_CONFIG.thresholds.system.latency + 100;

    const { metrics } = await runDebugTest(
      async () => {
        return apiDebugMiddleware(mockRequest, async () => {
          await new Promise(resolve => setTimeout(resolve, delay));
          return mockResponse;
        });
      },
      {
        expectedLatency: delay + 50,
        expectedErrorRate: 0,
        expectedHealth: 1
      }
    );

    expect(metrics.performance.apiLatency).toBeGreaterThan(
      DEBUG_CONFIG.thresholds.system.latency
    );
  });

  it('should aggregate multiple API requests', async () => {
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
      await Promise.all([
        apiDebugMiddleware(mockRequest, async () => mockResponse),
        apiDebugMiddleware(mockRequest, async () => mockResponse),
        apiDebugMiddleware(mockRequest, async () => mockResponse)
      ]);
    });

    expect(metrics.performance.errorRate).toBe(0);
    expect(metrics.performance.systemHealth).toBe(1);
  });

  it('should handle mixed success and failure requests', async () => {
    const mockRequest = {
      method: 'GET',
      url: '/api/test',
      headers: {}
    };

    const mockResponse = {
      status: 200,
      data: { success: true }
    };

    const mockError: ApiError = {
      message: 'API Error',
      code: 'API_ERROR',
      status: 500
    };

    const { metrics } = await runDebugTest(async () => {
      const results = await Promise.allSettled([
        apiDebugMiddleware(mockRequest, async () => mockResponse),
        apiDebugMiddleware(mockRequest, async () => { throw mockError; }),
        apiDebugMiddleware(mockRequest, async () => mockResponse)
      ]);
      return results;
    });

    expect(metrics.performance.errorRate).toBeGreaterThan(0);
    expect(metrics.performance.errorRate).toBeLessThan(1);
    expect(metrics.performance.systemHealth).toBeGreaterThan(0);
  });
});
