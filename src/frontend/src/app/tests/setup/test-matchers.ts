import { TestMetrics } from '../types/test.types';

declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveMetric(metricName: string, value: number): R;
      toHaveErrorRate(rate: number): R;
      toHaveLatency(milliseconds: number): R;
    }
  }
}

expect.extend({
  toHaveMetric(received: TestMetrics, metricName: string, value: number) {
    const metrics = received.performance;
    const pass = metrics[metricName as keyof typeof metrics] === value;
    return {
      message: () =>
        `expected metrics to ${pass ? 'not ' : ''}have ${metricName}=${value}`,
      pass
    };
  },

  toHaveErrorRate(received: TestMetrics, rate: number) {
    const pass = received.performance.errorRate === rate;
    return {
      message: () =>
        `expected error rate to be ${rate} but got ${received.performance.errorRate}`,
      pass
    };
  },

  toHaveLatency(received: TestMetrics, milliseconds: number) {
    const pass = received.performance.apiLatency <= milliseconds;
    return {
      message: () =>
        `expected API latency to be <= ${milliseconds}ms but got ${received.performance.apiLatency}ms`,
      pass
    };
  }
});

export {};
