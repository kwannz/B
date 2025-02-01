import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useTradeHistory } from './useTradeHistory';
import { useTradeAnalytics } from './useTradeAnalytics';
import { useTradePerformance } from './useTradePerformance';
import { useMarketDataProvider } from './useMarketDataProvider';

interface TradeMonitorData {
  performance: {
    current_pnl: number;
    daily_pnl: number;
    total_pnl: number;
    win_rate: number;
    average_return: number;
  };
  risk: {
    current_exposure: number;
    max_drawdown: number;
    volatility: number;
    risk_level: 'low' | 'medium' | 'high';
  };
  execution: {
    active_orders: number;
    filled_orders: number;
    failed_orders: number;
    average_fill_time: number;
  };
  market: {
    current_price: number;
    price_change_24h: number;
    volume_24h: number;
    market_sentiment: number;
  };
}

export const useTradeMonitor = (botId: string | null) => {
  const [monitorData, setMonitorData] = useState<TradeMonitorData | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { trades, stats } = useTradeHistory(botId);
  const { analytics } = useTradeAnalytics(botId);
  const { performance } = useTradePerformance(botId);
  const { marketContext } = useMarketDataProvider(null, botId);

  useEffect(() => {
    if (!trades?.length || !stats || !analytics || !performance || !marketContext) return;

    const calculateRiskLevel = (volatility: number, drawdown: number): 'low' | 'medium' | 'high' => {
      if (volatility > 0.2 || drawdown < -0.15) return 'high';
      if (volatility > 0.1 || drawdown < -0.1) return 'medium';
      return 'low';
    };

    const activeOrders = trades.filter(t => t.status === 'partially_filled').length;
    const filledOrders = trades.filter(t => t.status === 'filled').length;
    const failedOrders = trades.filter(t => t.status === 'failed').length;

    setMonitorData({
      performance: {
        current_pnl: performance.returns.daily,
        daily_pnl: performance.returns.daily,
        total_pnl: performance.returns.total,
        win_rate: performance.efficiency.win_rate,
        average_return: performance.returns.daily / trades.length
      },
      risk: {
        current_exposure: analytics.risk_metrics.value_at_risk,
        max_drawdown: performance.risk.max_drawdown,
        volatility: performance.risk.volatility,
        risk_level: calculateRiskLevel(
          performance.risk.volatility,
          performance.risk.max_drawdown
        )
      },
      execution: {
        active_orders: activeOrders,
        filled_orders: filledOrders,
        failed_orders: failedOrders,
        average_fill_time: stats.average_execution_time
      },
      market: {
        current_price: marketContext.price.current,
        price_change_24h: marketContext.price.change_24h,
        volume_24h: marketContext.volume.current_24h,
        market_sentiment: marketContext.sentiment.overall
      }
    });

    setError(null);
  }, [trades, stats, analytics, performance, marketContext]);

  return { monitorData, error, isLoading };
};
