import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useTradeHistory } from './useTradeHistory';
import { useMarketDataProvider } from './useMarketDataProvider';

interface PerformanceMetrics {
  returns: {
    total: number;
    daily: number;
    weekly: number;
    monthly: number;
    annual: number;
  };
  risk: {
    volatility: number;
    sharpe_ratio: number;
    sortino_ratio: number;
    max_drawdown: number;
    value_at_risk: number;
  };
  efficiency: {
    win_rate: number;
    profit_factor: number;
    average_win: number;
    average_loss: number;
    risk_reward_ratio: number;
  };
  execution: {
    slippage: number;
    fill_rate: number;
    average_execution_time: number;
    rejection_rate: number;
  };
}

export const useTradePerformance = (botId: string | null) => {
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { trades, stats } = useTradeHistory(botId);
  const { marketContext } = useMarketDataProvider(null, botId);

  useEffect(() => {
    if (!trades?.length || !stats || !marketContext) return;

    const calculateReturns = () => {
      const returns = trades.map(t => t.profit_loss || 0);
      const total = returns.reduce((a, b) => a + b, 0);
      const periods = {
        daily: 1,
        weekly: 7,
        monthly: 30,
        annual: 365
      };

      return {
        total,
        daily: total / periods.daily,
        weekly: total / periods.weekly,
        monthly: total / periods.monthly,
        annual: total / periods.annual
      };
    };

    const calculateRiskMetrics = (returns: number[]) => {
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
      const volatility = Math.sqrt(variance);
      const riskFreeRate = 0.02;
      const excessReturn = mean - riskFreeRate;
      const downside = returns.filter(r => r < 0);
      const downsideVolatility = Math.sqrt(
        downside.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downside.length
      );

      return {
        volatility,
        sharpe_ratio: volatility ? excessReturn / volatility : 0,
        sortino_ratio: downsideVolatility ? excessReturn / downsideVolatility : 0,
        max_drawdown: Math.min(...returns),
        value_at_risk: volatility * 1.645 * Math.sqrt(stats.total_volume)
      };
    };

    const calculateEfficiencyMetrics = () => {
      const wins = trades.filter(t => (t.profit_loss || 0) > 0);
      const losses = trades.filter(t => (t.profit_loss || 0) < 0);
      const totalWins = wins.reduce((sum, t) => sum + (t.profit_loss || 0), 0);
      const totalLosses = Math.abs(losses.reduce((sum, t) => sum + (t.profit_loss || 0), 0));

      return {
        win_rate: (wins.length / trades.length) * 100,
        profit_factor: totalLosses ? totalWins / totalLosses : 0,
        average_win: wins.length ? totalWins / wins.length : 0,
        average_loss: losses.length ? totalLosses / losses.length : 0,
        risk_reward_ratio: losses.length && wins.length ? 
          (totalWins / wins.length) / (totalLosses / losses.length) : 0
      };
    };

    const calculateExecutionMetrics = () => {
      const filledTrades = trades.filter(t => t.status === 'filled');
      const rejectedTrades = trades.filter(t => t.status === 'failed');

      return {
        slippage: trades.reduce((sum, t) => sum + Math.abs((t.price || 0) - marketContext.price.current), 0) / trades.length,
        fill_rate: (filledTrades.length / trades.length) * 100,
        average_execution_time: stats.average_execution_time,
        rejection_rate: (rejectedTrades.length / trades.length) * 100
      };
    };

    const returns = trades.map(t => t.profit_loss || 0);
    
    setPerformance({
      returns: calculateReturns(),
      risk: calculateRiskMetrics(returns),
      efficiency: calculateEfficiencyMetrics(),
      execution: calculateExecutionMetrics()
    });

  }, [trades, stats, marketContext]);

  return { performance, error, isLoading };
};
