import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Trading Metrics Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should track trading operation performance', async () => {
    const tradeTests = [
      { type: 'market', size: 1.0, price: 50000 },
      { type: 'limit', size: 0.5, price: 51000 },
      { type: 'stop', size: 0.75, price: 49000 }
    ];

    for (const test of tradeTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/trades' },
          async () => ({
            type: test.type,
            size: test.size,
            price: test.price,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.trading.operationCount).toBeGreaterThan(0);
    expect(metrics.trading.volumeDistribution).toBeDefined();
  });

  it('should monitor order execution latency', async () => {
    const latencyTests = [
      { priority: 'high', latency: 100 },
      { priority: 'medium', latency: 200 },
      { priority: 'low', latency: 300 }
    ];

    for (const test of latencyTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/orders/execute' },
          async () => {
            await new Promise(resolve => 
              setTimeout(resolve, test.latency)
            );
            return {
              priority: test.priority,
              latency: test.latency,
              timestamp: Date.now()
            };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.trading.executionLatency).toBeDefined();
    expect(metrics.trading.priorityDistribution).toBeDefined();
  });

  it('should track order fill rates', async () => {
    const fillTests = [
      { size: 1.0, filled: 1.0 },
      { size: 2.0, filled: 1.5 },
      { size: 3.0, filled: 3.0 }
    ];

    for (const test of fillTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/orders/fill' },
          async () => ({
            size: test.size,
            filled: test.filled,
            rate: test.filled / test.size,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.trading.fillRate).toBeDefined();
    expect(metrics.trading.orderCompletion).toBeGreaterThan(0);
  });

  it('should implement trading performance monitoring', async () => {
    const performanceTests = [
      { trades: 10, success: 8, profit: 500 },
      { trades: 20, success: 15, profit: 1000 },
      { trades: 30, success: 25, profit: 1500 }
    ];

    for (const test of performanceTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/trading/performance' },
          async () => ({
            trades: test.trades,
            successful: test.success,
            profit: test.profit,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.trading.successRate).toBeGreaterThan(0);
    expect(metrics.trading.profitMetrics).toBeDefined();
  });

  it('should track market impact analysis', async () => {
    const impactTests = [
      { size: 1.0, impact: 0.01 },
      { size: 2.0, impact: 0.02 },
      { size: 3.0, impact: 0.03 }
    ];

    for (const test of impactTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/trading/impact' },
          async () => ({
            size: test.size,
            impact: test.impact,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.trading.marketImpact).toBeDefined();
    expect(metrics.trading.sizeCorrelation).toBeGreaterThan(0);
  });

  it('should monitor trading strategy performance', async () => {
    const strategyTests = [
      { strategy: 'momentum', signals: 10, accuracy: 0.8 },
      { strategy: 'mean-reversion', signals: 15, accuracy: 0.7 },
      { strategy: 'arbitrage', signals: 20, accuracy: 0.9 }
    ];

    for (const test of strategyTests) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/trading/strategy' },
          async () => ({
            strategy: test.strategy,
            signals: test.signals,
            accuracy: test.accuracy,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.trading.strategyPerformance).toBeDefined();
    expect(metrics.trading.signalAccuracy).toBeGreaterThan(0);
  });
});
