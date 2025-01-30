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

  it('should track trade execution metrics', async () => {
    const trades = [
      { type: 'buy', amount: 1.0, price: 100, success: true },
      { type: 'sell', amount: 0.5, price: 110, success: true },
      { type: 'buy', amount: 2.0, price: 95, success: false }
    ];

    for (const trade of trades) {
      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/api/trades' },
            async () => {
              if (!trade.success) {
                throw new Error('Trade execution failed');
              }
              return {
                type: trade.type,
                amount: trade.amount,
                price: trade.price,
                timestamp: Date.now()
              };
            }
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.trading.successRate).toBeGreaterThan(0);
    expect(metrics.trading.volume).toBeGreaterThan(0);
  });

  it('should monitor order book updates', async () => {
    const updates = [
      { bids: 10, asks: 8, spread: 0.1 },
      { bids: 15, asks: 12, spread: 0.15 },
      { bids: 20, asks: 18, spread: 0.12 }
    ];

    for (const update of updates) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: '/api/orderbook' },
          async () => ({
            bid_count: update.bids,
            ask_count: update.asks,
            spread: update.spread,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.trading.orderBookDepth).toBeGreaterThan(0);
    expect(metrics.trading.averageSpread).toBeDefined();
  });

  it('should track trading strategy performance', async () => {
    const strategies = [
      { id: 'strategy-1', trades: 10, profit: 500 },
      { id: 'strategy-2', trades: 15, profit: -200 },
      { id: 'strategy-3', trades: 20, profit: 1000 }
    ];

    for (const strategy of strategies) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: `/api/strategies/${strategy.id}` },
          async () => ({
            trade_count: strategy.trades,
            total_profit: strategy.profit,
            performance_metrics: {
              win_rate: strategy.profit > 0 ? 0.6 : 0.4,
              avg_return: strategy.profit / strategy.trades
            }
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.trading.strategyPerformance).toBeDefined();
    expect(metrics.trading.profitLoss).toBeDefined();
  });

  it('should handle trading system events', async () => {
    const events = [
      { type: 'order_placed', status: 'pending' },
      { type: 'order_filled', status: 'complete' },
      { type: 'order_cancelled', status: 'cancelled' }
    ];

    for (const event of events) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/trading/events' },
          async () => ({
            event_type: event.type,
            status: event.status,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.trading.eventCount).toBeGreaterThan(0);
    expect(metrics.trading.eventDistribution).toBeDefined();
  });

  it('should track trading position metrics', async () => {
    const positions = [
      { asset: 'SOL', size: 10, pnl: 100 },
      { asset: 'ETH', size: 5, pnl: -50 },
      { asset: 'BTC', size: 2, pnl: 200 }
    ];

    for (const position of positions) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: `/api/positions/${position.asset}` },
          async () => ({
            position_size: position.size,
            unrealized_pnl: position.pnl,
            timestamp: Date.now()
          })
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.trading.positionCount).toBeGreaterThan(0);
    expect(metrics.trading.totalExposure).toBeDefined();
  });
});
