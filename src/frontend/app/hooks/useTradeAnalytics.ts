import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useTradeHistory } from './useTradeHistory';
import { useBotPerformance } from './useBotPerformance';
import { useMarketDataProvider } from './useMarketDataProvider';

interface TradeAnalytics {
  performance: {
    total_pnl: number;
    win_rate: number;
    average_return: number;
    sharpe_ratio: number;
    max_drawdown: number;
    best_trade: number;
    worst_trade: number;
  };
  risk_metrics: {
    volatility: number;
    beta: number;
    value_at_risk: number;
    correlation: number;
  };
  market_impact: {
    slippage: number;
    execution_quality: number;
    price_impact: number;
    liquidity_score: number;
  };
  trading_patterns: {
    avg_holding_time: number;
    trade_frequency: number;
    position_sizing: number;
    market_timing_score: number;
  };
}

export const useTradeAnalytics = (botId: string | null) => {
  const [analytics, setAnalytics] = useState<TradeAnalytics | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { trades, stats } = useTradeHistory(botId);
  const { performance } = useBotPerformance(botId);
  const { marketContext } = useMarketDataProvider(null, botId);

  useEffect(() => {
    if (!trades?.length || !stats || !performance || !marketContext) return;

    const calculateVolatility = () => {
      const returns = trades.map(t => t.profit_loss || 0);
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      return Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length);
    };

    const calculateSharpeRatio = (volatility: number) => {
      const riskFreeRate = 0.02;
      const excessReturn = (stats.profit_loss.total / stats.total_volume) - riskFreeRate;
      return volatility ? excessReturn / volatility : 0;
    };

    const volatility = calculateVolatility();
    const sharpeRatio = calculateSharpeRatio(volatility);

    setAnalytics({
      performance: {
        total_pnl: stats.profit_loss.total,
        win_rate: (stats.successful_trades / stats.total_trades) * 100,
        average_return: stats.profit_loss.average,
        sharpe_ratio: sharpeRatio,
        max_drawdown: performance.largest_loss || 0,
        best_trade: stats.profit_loss.best,
        worst_trade: stats.profit_loss.worst
      },
      risk_metrics: {
        volatility,
        beta: marketContext.technical.strength,
        value_at_risk: volatility * 1.645 * Math.sqrt(stats.total_volume),
        correlation: marketContext.technical.trend === 'bullish' ? 1 : -1
      },
      market_impact: {
        slippage: trades.reduce((sum, t) => sum + (t.fee || 0), 0) / trades.length,
        execution_quality: stats.successful_trades / stats.total_trades,
        price_impact: trades.reduce((sum, t) => sum + Math.abs((t.price || 0) - marketContext.price.current), 0) / trades.length,
        liquidity_score: marketContext.volume.current_24h / marketContext.price.current
      },
      trading_patterns: {
        avg_holding_time: stats.average_execution_time || 0,
        trade_frequency: stats.total_trades / (24 * 60 * 60 * 1000),
        position_sizing: stats.total_volume / stats.total_trades,
        market_timing_score: marketContext.signals.strength
      }
    });

    setError(null);
  }, [trades, stats, performance, marketContext]);

  return { analytics, error, isLoading };
};
