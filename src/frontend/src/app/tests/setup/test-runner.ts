import { expect } from '@jest/globals';
import type { TestMetrics } from '../types/test.types';

interface TestRunner {
  runTest: (testFn: () => Promise<void>) => Promise<void>;
  expectMetrics: (metrics: TestMetrics) => void;
  cleanup: () => void;
}

export const createTestRunner = (): TestRunner => {
  let cleanup: (() => void)[] = [];

  const runTest = async (testFn: () => Promise<void>) => {
    try {
      await testFn();
    } finally {
      cleanup.forEach(fn => fn());
      cleanup = [];
    }
  };

  const expectMetrics = (metrics: TestMetrics) => {
    expect(metrics.performance.errorRate).toBeLessThan(0.1);
    expect(metrics.performance.apiLatency).toBeLessThan(1000);
    expect(metrics.performance.systemHealth).toBeGreaterThan(0.9);
    expect(metrics.performance.successRate).toBeGreaterThan(0.8);
  };

  const addCleanup = (fn: () => void) => {
    cleanup.push(fn);
  };

  return {
    runTest,
    expectMetrics,
    cleanup: () => {
      cleanup.forEach(fn => fn());
      cleanup = [];
    }
  };
};

export const testRunner = createTestRunner();
