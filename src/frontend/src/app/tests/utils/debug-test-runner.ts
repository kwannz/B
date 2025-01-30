import { TestMetrics, TestWallet, TestBot, TestTransfer } from '../types/test.types';
import { createMockApiResponse } from './api-test-utils';
import { createDebugMetrics } from './debug-test-utils';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiError } from '../types/api.types';

export const runDebugTest = async <T>(
  testFn: () => Promise<T>,
  options: {
    expectedLatency?: number;
    expectedErrorRate?: number;
    expectedHealth?: number;
    validateResult?: (result: T) => void;
  } = {}
) => {
  const startMetrics = createDebugMetrics();
  const startTime = performance.now();

  try {
    const result = await testFn();
    const endTime = performance.now();
    const latency = endTime - startTime;

    const endMetrics = createDebugMetrics({
      performance: {
        errorRate: 0,
        apiLatency: latency,
        systemHealth: 1
      }
    });

    if (options.expectedLatency) {
      expect(latency).toBeLessThanOrEqual(options.expectedLatency);
    }

    if (options.expectedErrorRate !== undefined) {
      expect(endMetrics.performance.errorRate).toBe(options.expectedErrorRate);
    }

    if (options.expectedHealth !== undefined) {
      expect(endMetrics.performance.systemHealth).toBe(options.expectedHealth);
    }

    if (options.validateResult) {
      options.validateResult(result);
    }

    return { result, metrics: endMetrics };
  } catch (error) {
    const endTime = performance.now();
    const errorMetrics = createDebugMetrics({
      performance: {
        errorRate: 1,
        apiLatency: endTime - startTime,
        systemHealth: 0
      }
    });

    throw error;
  }
};

export const runDebugApiTest = async <T>(
  apiCall: () => Promise<T>,
  options: {
    expectedStatus?: number;
    expectedError?: Partial<ApiError>;
    validateResponse?: (response: T) => void;
  } = {}
) => {
  return runDebugTest(apiCall, {
    expectedLatency: DEBUG_CONFIG.thresholds.system.latency,
    expectedErrorRate: 0,
    expectedHealth: 1,
    validateResult: (result) => {
      if (options.validateResponse) {
        options.validateResponse(result);
      }
    }
  });
};

export const runDebugErrorTest = async (
  apiCall: () => Promise<any>,
  expectedError: Partial<ApiError>
) => {
  try {
    await apiCall();
    fail('Expected API call to fail');
  } catch (error) {
    expect(error).toMatchObject(expectedError);
    const metrics = createDebugMetrics({
      performance: {
        errorRate: 1,
        systemHealth: 0
      }
    });
    return { error, metrics };
  }
};

export const runDebugMetricsTest = async (
  metricsUpdate: () => Promise<void>,
  expectedMetrics: Partial<TestMetrics>
) => {
  const startMetrics = createDebugMetrics();
  await metricsUpdate();
  const endMetrics = createDebugMetrics();

  Object.entries(expectedMetrics).forEach(([category, metrics]) => {
    Object.entries(metrics as Record<string, any>).forEach(([key, value]) => {
      expect(endMetrics[category as keyof TestMetrics][key]).toBe(value);
    });
  });

  return { startMetrics, endMetrics };
};
