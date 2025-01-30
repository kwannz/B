import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useStrategyManager } from './useStrategyManager';
import { useMarketAggregator } from './useMarketAggregator';
import { usePerformanceMonitor } from './usePerformanceMonitor';

interface BacktestConfig {
  start_date: string;
  end_date: string;
  initial_capital: number;
  strategy_params: {
    entry_conditions: Record<string, any>;
    exit_conditions: Record<string, any>;
    position_sizing: Record<string, any>;
    risk_management: Record<string, any>;
  };
  market_conditions: {
    volatility_range: [number, number];
    volume_range: [number, number];
    trend_type: 'bullish' | 'bearish' | 'sideways';
  };
}

interface BacktestResult {
  performance_metrics: {
    total_return: number;
    sharpe_ratio: number;
    max_drawdown: number;
    win_rate: number;
    profit_factor: number;
    recovery_factor: number;
  };
  trade_metrics: {
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    average_win: number;
    average_loss: number;
    largest_win: number;
    largest_loss: number;
  };
  risk_metrics: {
    value_at_risk: number;
    expected_shortfall: number;
    beta: number;
    correlation: number;
  };
  equity_curve: Array<{
    timestamp: string;
    equity: number;
    drawdown: number;
  }>;
  trades: Array<{
    timestamp: string;
    type: 'entry' | 'exit';
    price: number;
    size: number;
    pnl: number;
    reason: string;
  }>;
}

export const useBacktesting = (botId: string | null) => {
  const [config, setConfig] = useState<BacktestConfig | null>(null);
  const [results, setResults] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const { strategy } = useStrategyManager(botId);
  const { data: marketData } = useMarketAggregator(botId);
  const { metrics: liveMetrics } = usePerformanceMonitor(botId);

  useEffect(() => {
    if (!config || !strategy || !marketData) return;

    const runBacktest = async () => {
      try {
        setIsRunning(true);

        const calculatePerformanceMetrics = (trades: BacktestResult['trades']) => {
          const returns = trades.map(t => t.pnl);
          const totalReturn = returns.reduce((sum, r) => sum + r, 0);
          const avgReturn = totalReturn / trades.length;
          const stdDev = Math.sqrt(
            returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / trades.length
          );

          const winningTrades = trades.filter(t => t.pnl > 0);
          const losingTrades = trades.filter(t => t.pnl <= 0);

          return {
            total_return: totalReturn,
            sharpe_ratio: stdDev !== 0 ? avgReturn / stdDev * Math.sqrt(252) : 0,
            max_drawdown: Math.min(...trades.map(t => t.pnl)),
            win_rate: winningTrades.length / trades.length,
            profit_factor: Math.abs(
              winningTrades.reduce((sum, t) => sum + t.pnl, 0) /
              losingTrades.reduce((sum, t) => sum + t.pnl, 0)
            ),
            recovery_factor: totalReturn / Math.abs(Math.min(...trades.map(t => t.pnl)))
          };
        };

        const calculateRiskMetrics = (trades: BacktestResult['trades']) => {
          const returns = trades.map(t => t.pnl);
          const sortedReturns = [...returns].sort((a, b) => a - b);
          const varIndex = Math.floor(returns.length * 0.05);
          const var95 = sortedReturns[varIndex];
          const es95 = sortedReturns.slice(0, varIndex).reduce((sum, r) => sum + r, 0) / varIndex;

          return {
            value_at_risk: Math.abs(var95),
            expected_shortfall: Math.abs(es95),
            beta: 1.0,
            correlation: 0.5
          };
        };

        const generateMockTrades = () => {
          const trades: BacktestResult['trades'] = [];
          let equity = config.initial_capital;
          const timeStep = (new Date(config.end_date).getTime() - new Date(config.start_date).getTime()) / 100;

          for (let i = 0; i < 100; i++) {
            const timestamp = new Date(new Date(config.start_date).getTime() + timeStep * i).toISOString();
            const isEntry = i % 2 === 0;
            const price = marketData.market_data.price.current * (1 + (Math.random() - 0.5) * 0.1);
            const size = config.initial_capital * 0.1;
            const pnl = isEntry ? -size * 0.001 : size * (Math.random() - 0.4) * 0.02;

            trades.push({
              timestamp,
              type: isEntry ? 'entry' : 'exit',
              price,
              size,
              pnl,
              reason: isEntry ? 'Strategy entry signal' : 'Strategy exit signal'
            });

            equity += pnl;
          }

          return trades;
        };

        const trades = generateMockTrades();
        const performanceMetrics = calculatePerformanceMetrics(trades);
        const riskMetrics = calculateRiskMetrics(trades);

        const equityCurve = trades.reduce((curve, trade, index) => {
          const equity = config.initial_capital + trades.slice(0, index + 1)
            .reduce((sum, t) => sum + t.pnl, 0);
          const maxEquity = Math.max(...curve.map(p => p.equity), equity);
          const drawdown = (maxEquity - equity) / maxEquity;

          curve.push({
            timestamp: trade.timestamp,
            equity,
            drawdown
          });

          return curve;
        }, [] as BacktestResult['equity_curve']);

        const newResults: BacktestResult = {
          performance_metrics: performanceMetrics,
          trade_metrics: {
            total_trades: trades.length,
            winning_trades: trades.filter(t => t.pnl > 0).length,
            losing_trades: trades.filter(t => t.pnl <= 0).length,
            average_win: trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0) /
                        trades.filter(t => t.pnl > 0).length,
            average_loss: trades.filter(t => t.pnl <= 0).reduce((sum, t) => sum + t.pnl, 0) /
                         trades.filter(t => t.pnl <= 0).length,
            largest_win: Math.max(...trades.map(t => t.pnl)),
            largest_loss: Math.min(...trades.map(t => t.pnl))
          },
          risk_metrics: riskMetrics,
          equity_curve: equityCurve,
          trades
        };

        setResults(newResults);
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to run backtest',
          code: 'BACKTEST_ERROR'
        });
        setResults(null);
      } finally {
        setIsRunning(false);
      }
    };

    runBacktest();
  }, [config, strategy, marketData]);

  const startBacktest = (newConfig: BacktestConfig) => {
    setConfig(newConfig);
  };

  const compareWithLive = () => {
    if (!results || !liveMetrics) return null;

    return {
      total_return_diff: liveMetrics.returns.total_return - results.performance_metrics.total_return,
      sharpe_ratio_diff: liveMetrics.risk_metrics.sharpe_ratio - results.performance_metrics.sharpe_ratio,
      win_rate_diff: liveMetrics.trade_metrics.win_rate - results.performance_metrics.win_rate
    };
  };

  const getOptimalParameters = () => {
    if (!results) return null;

    return {
      position_sizing: {
        optimal_size: results.performance_metrics.total_return > 0 ?
          config?.strategy_params.position_sizing : { size: config?.initial_capital * 0.1 }
      },
      risk_management: {
        stop_loss: results.trade_metrics.largest_loss * 1.1,
        take_profit: results.trade_metrics.largest_win * 0.9
      }
    };
  };

  return {
    results,
    error,
    isRunning,
    startBacktest,
    compareWithLive,
    getOptimalParameters
  };
};
