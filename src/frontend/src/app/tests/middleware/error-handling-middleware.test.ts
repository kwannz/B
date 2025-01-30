import { errorHandlingMiddleware } from '../../middleware/errorHandlingMiddleware';
import { useDebugStore } from '../../stores/debugStore';
import { TestMetrics } from '../types/test.types';

jest.mock('../../stores/debugStore', () => ({
  useDebugStore: {
    getState: jest.fn(() => ({
      metrics: {
        performance: {
          errorRate: 0,
          apiLatency: 0,
          systemHealth: 1,
          successRate: 1,
          totalTrades: 0,
          walletBalance: 0
        }
      },
      updateMetrics: jest.fn(),
      addLog: jest.fn()
    })),
    setState: jest.fn()
  }
}));

describe('Error Handling Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should track successful operations with metrics', async () => {
    const operation = jest.fn().mockResolvedValue({ success: true });
    const result = await errorHandlingMiddleware(operation);

    expect(result).toEqual({ success: true });
    const metrics = useDebugStore.getState().metrics as TestMetrics;
    expect(metrics).toHaveErrorRate(0);
    expect(metrics).toHaveLatency(1000);
    expect(metrics.performance.systemHealth).toBeGreaterThan(0.9);
  });

  it('should handle and track API errors', async () => {
    const apiError = new Error('API Error');
    apiError.name = 'ApiError';
    const operation = jest.fn().mockRejectedValue(apiError);

    await expect(errorHandlingMiddleware(operation)).rejects.toThrow('API Error');

    const metrics = useDebugStore.getState().metrics as TestMetrics;
    expect(metrics).toHaveErrorRate(0.2);
    expect(metrics.performance.systemHealth).toBeLessThan(0.9);
    expect(useDebugStore.getState().addLog).toHaveBeenCalledWith(
      expect.stringContaining('API Error')
    );
  });

  it('should handle network timeouts', async () => {
    const timeoutError = new Error('Network Timeout');
    timeoutError.name = 'TimeoutError';
    const operation = jest.fn().mockRejectedValue(timeoutError);

    await expect(errorHandlingMiddleware(operation)).rejects.toThrow('Network Timeout');

    const metrics = useDebugStore.getState().metrics as TestMetrics;
    expect(metrics).toHaveErrorRate(0.2);
    expect(metrics).toHaveLatency(5000);
    expect(metrics.performance.systemHealth).toBeLessThan(0.8);
  });

  it('should track high latency operations', async () => {
    const slowOperation = jest.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 2000))
    );

    const result = await errorHandlingMiddleware(slowOperation);
    expect(result).toEqual({ success: true });

    const metrics = useDebugStore.getState().metrics as TestMetrics;
    expect(metrics).toHaveLatency(2000);
    expect(metrics.performance.systemHealth).toBeLessThan(1);
    expect(useDebugStore.getState().addLog).toHaveBeenCalledWith(
      expect.stringContaining('High latency operation detected')
    );
  });

  it('should handle validation errors', async () => {
    const validationError = new Error('Validation Error');
    validationError.name = 'ValidationError';
    const operation = jest.fn().mockRejectedValue(validationError);

    await expect(errorHandlingMiddleware(operation)).rejects.toThrow('Validation Error');

    const metrics = useDebugStore.getState().metrics as TestMetrics;
    expect(metrics).toHaveErrorRate(0.2);
    expect(metrics.performance.systemHealth).toBeLessThan(0.9);
  });

  it('should accumulate error rates for multiple failures', async () => {
    const error = new Error('Multiple Failures');
    const operation = jest.fn().mockRejectedValue(error);

    await expect(errorHandlingMiddleware(operation)).rejects.toThrow();
    await expect(errorHandlingMiddleware(operation)).rejects.toThrow();

    const metrics = useDebugStore.getState().metrics as TestMetrics;
    expect(metrics).toHaveErrorRate(0.4);
    expect(metrics.performance.systemHealth).toBeLessThan(0.7);
  });

  it('should recover system health after successful operations', async () => {
    const error = new Error('Initial Error');
    const failOperation = jest.fn().mockRejectedValue(error);
    const successOperation = jest.fn().mockResolvedValue({ success: true });

    await expect(errorHandlingMiddleware(failOperation)).rejects.toThrow();
    await errorHandlingMiddleware(successOperation);

    const metrics = useDebugStore.getState().metrics as TestMetrics;
    expect(metrics.performance.errorRate).toBeLessThan(0.2);
    expect(metrics.performance.systemHealth).toBeGreaterThan(0.8);
  });
});
