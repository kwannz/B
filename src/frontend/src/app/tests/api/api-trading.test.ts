import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Trading Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should track trading operation metrics', async () => {
    const tradingOperations = [
      { type: 'buy', amount: 1.0, price: 100 },
      { type: 'sell', amount: 0.5, price: 110 },
      { type: 'buy', amount: 2.0, price: 95 }
    ];

    for (const op of tradingOperations) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/trades' },
          () => apiClient.executeTrade(op.type, op.amount, op.price)
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.trading.totalTrades).toBe(tradingOperations.length);
    expect(metrics.trading.successRate).toBe(1);
  });

  it('should monitor trading performance', async () => {
    const positions = [
      { entry: 100, exit: 110, size: 1.0 },
      { entry: 95, exit: 90, size: 2.0 },
      { entry: 105, exit: 115, size: 1.5 }
    ];

    for (const pos of positions) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/positions' },
          async () => {
            await apiClient.openPosition(pos.entry, pos.size);
            await apiClient.closePosition(pos.exit);
            return { profit: (pos.exit - pos.entry) * pos.size };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.trading.profitableTrades).toBeGreaterThan(0);
    expect(metrics.trading.totalVolume).toBeGreaterThan(0);
  });

  it('should track order execution metrics', async () => {
    const orders = Array(5).fill(null).map((_, i) => ({
      type: i % 2 === 0 ? 'market' : 'limit',
      price: 100 + i * 10,
      size: 1.0 + i * 0.5,
      shouldFill: i < 3
    }));

    for (const order of orders) {
      mockAPI.placeOrder.mockImplementation(() =>
        Promise.resolve({
          status: order.shouldFill ? 'filled' : 'pending',
          fillPrice: order.shouldFill ? order.price : null
        })
      );

      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/orders' },
          () => apiClient.placeOrder(order.type, order.price, order.size)
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.trading.fillRate).toBe(0.6);
    expect(metrics.trading.orderLatency).toBeLessThan(
      DEBUG_CONFIG.thresholds.trading.order_latency
    );
  });

  it('should monitor slippage metrics', async () => {
    const trades = Array(3).fill(null).map((_, i) => ({
      expectedPrice: 100 + i * 10,
      actualPrice: 100 + i * 10 + (i + 1),
      size: 1.0
    }));

    for (const trade of trades) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/trades' },
          () => apiClient.executeTrade('buy', trade.size, trade.expectedPrice)
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.trading.averageSlippage).toBeGreaterThan(0);
    expect(metrics.trading.maxSlippage).toBeLessThan(
      DEBUG_CONFIG.thresholds.trading.max_slippage
    );
  });

  it('should track trading system health', async () => {
    const healthChecks = [
      { type: 'orderbook', status: 'healthy', latency: 50 },
      { type: 'price_feed', status: 'degraded', latency: 200 },
      { type: 'execution', status: 'healthy', latency: 100 }
    ];

    for (const check of healthChecks) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: `/api/health/${check.type}` },
          async () => {
            await new Promise(resolve => setTimeout(resolve, check.latency));
            return { status: check.status };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.trading.systemHealth).toBeLessThan(1);
    expect(metrics.performance.apiLatency).toBeGreaterThan(0);
  });
});
