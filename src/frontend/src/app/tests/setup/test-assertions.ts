import { TestMetrics } from '../types/test.types';

export const assertMetrics = {
  validatePerformanceMetrics(metrics: TestMetrics['performance']) {
    expect(metrics.apiLatency).toBeDefined();
    expect(metrics.errorRate).toBeDefined();
    expect(metrics.successRate).toBeDefined();
    expect(metrics.throughput).toBeDefined();
    expect(metrics.totalTrades).toBeDefined();
    expect(metrics.walletBalance).toBeDefined();
  },

  validateSystemMetrics(metrics: TestMetrics['system']) {
    expect(metrics.heapUsed).toBeDefined();
    expect(metrics.heapTotal).toBeDefined();
    expect(metrics.external).toBeDefined();
    expect(metrics.eventLoopLag).toBeDefined();
    expect(metrics.activeHandles).toBeDefined();
    expect(metrics.activeRequests).toBeDefined();
    expect(metrics.garbageCollection).toBeDefined();
    expect(metrics.garbageCollection.count).toBeDefined();
    expect(metrics.garbageCollection.duration).toBeDefined();
  },

  validateWorkflowMetrics(metrics: TestMetrics['workflow']) {
    expect(metrics.steps).toBeInstanceOf(Array);
    expect(metrics.totalDuration).toBeDefined();
    expect(metrics.completedSteps).toBeDefined();
    
    metrics.steps.forEach(step => {
      expect(step.name).toBeDefined();
      expect(step.duration).toBeDefined();
      expect(step.success).toBeDefined();
      if (step.metrics) {
        expect(step.metrics.heapUsed).toBeDefined();
        expect(step.metrics.activeRequests).toBeDefined();
      }
    });
  },

  validateWalletMetrics(metrics: TestMetrics['wallet']) {
    expect(metrics.address).toBeDefined();
    expect(metrics.balance).toBeDefined();
    expect(metrics.metrics).toBeDefined();
    expect(metrics.metrics.trades).toBeDefined();
    expect(metrics.metrics.volume).toBeDefined();
    expect(metrics.metrics.profitLoss).toBeDefined();
  },

  expectMetricRange(value: number, min: number, max: number) {
    expect(value).toBeGreaterThanOrEqual(min);
    expect(value).toBeLessThanOrEqual(max);
  },

  expectMetricTrend(values: number[], trend: 'increasing' | 'decreasing' | 'stable') {
    if (trend === 'increasing') {
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
      }
    } else if (trend === 'decreasing') {
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
      }
    } else {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
      expect(variance).toBeLessThan(mean * 0.1);
    }
  }
};
