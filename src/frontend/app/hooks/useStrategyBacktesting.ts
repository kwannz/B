import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useStrategyValidation } from './useStrategyValidation';
import { useMarketDataAggregation } from './useMarketDataAggregation';

interface BacktestConfig {
  symbol: string;
  start_date: string;
  end_date: string;
  initial_capital: number;
  strategy_params: Record<string, any>;
  risk_params: {
    max_position_size: number;
    max_leverage: number;
    stop_loss: number;
    take_profit: number;
  };
}

interface TradeResult {
  id: string;
  timestamp: string;
  type: 'entry' | 'exit';
  side: 'long' | 'short';
  price: number;
  size: number;
  pnl: number;
  fees: number;
  slippage: number;
}

interface BacktestResult {
  trades: TradeResult[];
  metrics: {
    total_return: number;
    sharpe_ratio: number;
    max_drawdown: number;
    win_rate: number;
    profit_factor: number;
    average_trade: number;
    total_trades: number;
    profitable_trades: number;
  };
  equity_curve: Array<{
    timestamp: string;
    equity: number;
    drawdown: number;
  }>;
  risk_metrics: {
    var_95: number;
    var_99: number;
    expected_shortfall: number;
    beta: number;
    correlation: number;
  };
}

export const useStrategyBacktesting = (botId: string | null) => {
  const [config, setConfig] = useState<BacktestConfig | null>(null);
  const [results, setResults] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isBacktesting, setIsBacktesting] = useState(false);

  const { result: validationResult } = useStrategyValidation(botId);
  const { snapshot: marketData } = useMarketDataAggregation({
    symbol: config?.symbol || 'SOL/USD',
    update_interval: 5000,
    data_window: 100
  });

  useEffect(() => {
    if (!botId || !config || !marketData) return;

    const runBacktest = async () => {
      try {
        setIsBacktesting(true);

        const trades: TradeResult[] = [];
        const equityCurve: BacktestResult['equity_curve'] = [];
        const equity = config.initial_capital;
        const maxEquity = equity;
        const currentDrawdown = 0;

        const calculateMetrics = () => {
          if (trades.length === 0) return null;

          const returns = trades.map(t => t.pnl / equity);
          const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
          const stdReturn = Math.sqrt(
            returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / 
            (returns.length - 1)
          );

          const profitableTrades = trades.filter(t => t.pnl > 0);
          const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
          const totalProfit = profitableTrades.reduce((sum, t) => sum + t.pnl, 0);
          const totalLoss = Math.abs(
            trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0)
          );

          return {
            total_return: (equity - config.initial_capital) / config.initial_capital,
            sharpe_ratio: meanReturn / stdReturn * Math.sqrt(252),
            max_drawdown: Math.min(...equityCurve.map(p => p.drawdown)),
            win_rate: profitableTrades.length / trades.length,
            profit_factor: totalLoss === 0 ? Infinity : totalProfit / totalLoss,
            average_trade: totalPnl / trades.length,
            total_trades: trades.length,
            profitable_trades: profitableTrades.length
          };
        };

        const calculateRiskMetrics = () => {
          const returns = trades.map(t => t.pnl / equity);
          returns.sort((a, b) => a - b);

          const var95Index = Math.floor(returns.length * 0.05);
          const var99Index = Math.floor(returns.length * 0.01);

          const marketReturns = equityCurve.map((p, i, arr) => 
            i === 0 ? 0 : (p.equity - arr[i-1].equity) / arr[i-1].equity
          );

          const covariance = returns.reduce((sum, r, i) => 
            sum + (r - meanReturn) * (marketReturns[i] - meanMarketReturn), 0
          ) / (returns.length - 1);

          const marketVariance = marketReturns.reduce((sum, r) => 
            sum + Math.pow(r - meanMarketReturn, 2), 0
          ) / (marketReturns.length - 1);

          return {
            var_95: returns[var95Index],
            var_99: returns[var99Index],
            expected_shortfall: returns.slice(0, var95Index).reduce((sum, r) => 
              sum + r, 0
            ) / var95Index,
            beta: covariance / marketVariance,
            correlation: covariance / (stdReturn * Math.sqrt(marketVariance))
          };
        };

        const meanReturn = trades.reduce((sum, t) => 
          sum + t.pnl / equity, 0
        ) / Math.max(1, trades.length);

        const meanMarketReturn = marketData.price.change_percentage_24h / 100;
        const stdReturn = Math.sqrt(
          trades.reduce((sum, t) => 
            sum + Math.pow(t.pnl / equity - meanReturn, 2), 0
          ) / Math.max(1, trades.length - 1)
        );

        setResults({
          trades,
          metrics: calculateMetrics() || {
            total_return: 0,
            sharpe_ratio: 0,
            max_drawdown: 0,
            win_rate: 0,
            profit_factor: 0,
            average_trade: 0,
            total_trades: 0,
            profitable_trades: 0
          },
          equity_curve: equityCurve,
          risk_metrics: calculateRiskMetrics()
        });

        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to run backtest',
          code: 'BACKTEST_ERROR'
        });
      } finally {
        setIsBacktesting(false);
      }
    };

    runBacktest();
  }, [botId, config, marketData]);

  const updateConfig = (newConfig: Partial<BacktestConfig>) => {
    setConfig(prev => ({
      ...prev,
      ...newConfig,
      risk_params: { ...prev?.risk_params, ...newConfig.risk_params }
    }));
  };

  const getTrades = () => results?.trades || [];

  const getMetrics = () => results?.metrics || null;

  const getEquityCurve = () => results?.equity_curve || [];

  const getRiskMetrics = () => results?.risk_metrics || null;

  const getDrawdownPeriods = () => {
    if (!results?.equity_curve) return [];

    const periods = [];
    let inDrawdown = false;
    let drawdownStart = '';
    let maxDrawdown = 0;

    for (const point of results.equity_curve) {
      if (point.drawdown < 0) {
        if (!inDrawdown) {
          inDrawdown = true;
          drawdownStart = point.timestamp;
        }
        maxDrawdown = Math.min(maxDrawdown, point.drawdown);
      } else if (inDrawdown) {
        periods.push({
          start: drawdownStart,
          end: point.timestamp,
          max_drawdown: maxDrawdown
        });
        inDrawdown = false;
        maxDrawdown = 0;
      }
    }

    return periods;
  };

  return {
    config,
    results,
    error,
    isBacktesting,
    updateConfig,
    getTrades,
    getMetrics,
    getEquityCurve,
    getRiskMetrics,
    getDrawdownPeriods
  };
};
