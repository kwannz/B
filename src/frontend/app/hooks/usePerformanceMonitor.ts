import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useStrategyManager } from './useStrategyManager';
import { useOrderManagement } from './useOrderManagement';
import { useRiskController } from './useRiskController';

interface PerformanceMetrics {
  returns: {
    total_return: number;
    daily_return: number;
    monthly_return: number;
    annualized_return: number;
  };
  risk_metrics: {
    volatility: number;
    sharpe_ratio: number;
    sortino_ratio: number;
    max_drawdown: number;
    value_at_risk: number;
  };
  trade_metrics: {
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    win_rate: number;
    profit_factor: number;
    average_win: number;
    average_loss: number;
  };
  position_metrics: {
    current_positions: number;
    average_position_size: number;
    position_concentration: number;
    position_turnover: number;
  };
}

interface PerformanceAlert {
  type: 'return' | 'risk' | 'trade' | 'position';
  level: 'info' | 'warning' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  message: string;
  timestamp: string;
}

export const usePerformanceMonitor = (botId: string | null) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const { state: strategyState } = useStrategyManager(botId);
  const { orders, metrics: orderMetrics } = useOrderManagement(botId);
  const { state: riskState } = useRiskController(botId);

  useEffect(() => {
    if (!strategyState || !orderMetrics) return;

    const monitoringInterval = setInterval(() => {
      try {
        setIsMonitoring(true);

        const calculateReturns = () => {
          const performance = strategyState.performance;
          const initialCapital = 100;
          const totalReturn = performance.total_pnl / initialCapital;

          return {
            total_return: totalReturn,
            daily_return: totalReturn / Math.max(1, performance.total_trades),
            monthly_return: totalReturn * 30 / Math.max(30, performance.total_trades),
            annualized_return: totalReturn * 365 / Math.max(365, performance.total_trades)
          };
        };

        const calculateRiskMetrics = () => {
          const returns = calculateReturns();
          const riskFreeRate = 0.02;

          const volatility = Math.sqrt(
            orders.reduce((sum, order) => {
              const ret = order.averagePrice / strategyState.current_position.entry_price - 1;
              return sum + ret * ret;
            }, 0) / Math.max(1, orders.length)
          );

          const excessReturns = returns.annualized_return - riskFreeRate;
          const sharpeRatio = volatility !== 0 ? excessReturns / volatility : 0;

          const downside = Math.sqrt(
            orders.reduce((sum, order) => {
              const ret = order.averagePrice / strategyState.current_position.entry_price - 1;
              return ret < 0 ? sum + ret * ret : sum;
            }, 0) / Math.max(1, orders.length)
          );

          return {
            volatility,
            sharpe_ratio: sharpeRatio,
            sortino_ratio: downside !== 0 ? excessReturns / downside : 0,
            max_drawdown: strategyState.performance.max_drawdown,
            value_at_risk: volatility * 1.96 * Math.sqrt(1/252)
          };
        };

        const calculateTradeMetrics = () => {
          const winningTrades = orders.filter(o => 
            o.status === 'filled' && o.averagePrice > strategyState.current_position.entry_price
          );

          const losingTrades = orders.filter(o => 
            o.status === 'filled' && o.averagePrice <= strategyState.current_position.entry_price
          );

          const avgWin = winningTrades.reduce((sum, trade) => 
            sum + (trade.averagePrice / strategyState.current_position.entry_price - 1), 0
          ) / Math.max(1, winningTrades.length);

          const avgLoss = losingTrades.reduce((sum, trade) => 
            sum + (1 - trade.averagePrice / strategyState.current_position.entry_price), 0
          ) / Math.max(1, losingTrades.length);

          return {
            total_trades: orders.length,
            winning_trades: winningTrades.length,
            losing_trades: losingTrades.length,
            win_rate: winningTrades.length / Math.max(1, orders.length),
            profit_factor: avgLoss !== 0 ? avgWin / Math.abs(avgLoss) : 0,
            average_win: avgWin,
            average_loss: avgLoss
          };
        };

        const calculatePositionMetrics = () => {
          const positions = orders.filter(o => o.status === 'filled');
          const totalSize = positions.reduce((sum, pos) => sum + pos.quantity, 0);

          return {
            current_positions: positions.length,
            average_position_size: totalSize / Math.max(1, positions.length),
            position_concentration: Math.max(...positions.map(p => p.quantity)) / totalSize,
            position_turnover: totalSize / Math.max(1, strategyState.performance.total_trades)
          };
        };

        const generateAlerts = (newMetrics: PerformanceMetrics): PerformanceAlert[] => {
          const alerts: PerformanceAlert[] = [];
          const timestamp = new Date().toISOString();

          if (newMetrics.risk_metrics.max_drawdown < -0.1) {
            alerts.push({
              type: 'risk',
              level: 'critical',
              metric: 'max_drawdown',
              value: newMetrics.risk_metrics.max_drawdown,
              threshold: -0.1,
              message: 'Maximum drawdown exceeded threshold',
              timestamp
            });
          }

          if (newMetrics.trade_metrics.win_rate < 0.4) {
            alerts.push({
              type: 'trade',
              level: 'warning',
              metric: 'win_rate',
              value: newMetrics.trade_metrics.win_rate,
              threshold: 0.4,
              message: 'Win rate below acceptable threshold',
              timestamp
            });
          }

          return alerts;
        };

        const newMetrics: PerformanceMetrics = {
          returns: calculateReturns(),
          risk_metrics: calculateRiskMetrics(),
          trade_metrics: calculateTradeMetrics(),
          position_metrics: calculatePositionMetrics()
        };

        setMetrics(newMetrics);
        setAlerts(generateAlerts(newMetrics));
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to monitor performance',
          code: 'MONITOR_ERROR'
        });
      } finally {
        setIsMonitoring(false);
      }
    }, 5000);

    return () => clearInterval(monitoringInterval);
  }, [strategyState, orders, orderMetrics, riskState]);

  const getMetricsByType = (type: PerformanceAlert['type']) => {
    return alerts.filter(alert => alert.type === type);
  };

  const getAlertsByLevel = (level: PerformanceAlert['level']) => {
    return alerts.filter(alert => alert.level === level);
  };

  const clearAlert = (timestamp: string) => {
    setAlerts(prev => prev.filter(alert => alert.timestamp !== timestamp));
  };

  return {
    metrics,
    alerts,
    error,
    isMonitoring,
    getMetricsByType,
    getAlertsByLevel,
    clearAlert
  };
};
