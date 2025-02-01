import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useBacktesting } from './useBacktesting';
import { useStrategyManager } from './useStrategyManager';
import { useMarketAnalysis } from './useMarketAnalysis';

interface ValidationConfig {
  min_trades: number;
  min_win_rate: number;
  max_drawdown: number;
  min_profit_factor: number;
  risk_limits: {
    max_position_size: number;
    max_leverage: number;
    max_daily_loss: number;
  };
}

interface ValidationResult {
  is_valid: boolean;
  metrics: {
    trades_count: number;
    win_rate: number;
    max_drawdown: number;
    profit_factor: number;
    risk_exposure: {
      position_size: number;
      leverage: number;
      daily_loss: number;
    };
  };
  violations: Array<{
    type: 'critical' | 'warning';
    metric: string;
    value: number;
    threshold: number;
    message: string;
  }>;
  recommendations: Array<{
    parameter: string;
    current_value: number;
    suggested_value: number;
    reason: string;
  }>;
}

export const useStrategyValidation = (botId: string | null) => {
  const [config, setConfig] = useState<ValidationConfig>({
    min_trades: 30,
    min_win_rate: 0.5,
    max_drawdown: -0.2,
    min_profit_factor: 1.5,
    risk_limits: {
      max_position_size: 1000,
      max_leverage: 2,
      max_daily_loss: 100
    }
  });
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const { results: backtestResults } = useBacktesting(botId);
  const { strategy } = useStrategyManager(botId);
  const { analysis: marketAnalysis } = useMarketAnalysis(botId);

  useEffect(() => {
    if (!backtestResults || !strategy || !marketAnalysis) return;

    const validationInterval = setInterval(() => {
      try {
        setIsValidating(true);

        const validateMetrics = () => {
          const metrics = {
            trades_count: backtestResults.trade_metrics.total_trades,
            win_rate: backtestResults.trade_metrics.winning_trades / 
                     backtestResults.trade_metrics.total_trades,
            max_drawdown: backtestResults.performance_metrics.max_drawdown,
            profit_factor: backtestResults.performance_metrics.profit_factor,
            risk_exposure: {
              position_size: Math.max(...backtestResults.trades.map(t => t.size)),
              leverage: strategy.parameters.risk_management.max_leverage,
              daily_loss: Math.abs(Math.min(
                ...backtestResults.equity_curve.map(p => p.drawdown)
              )) * config.risk_limits.max_daily_loss
            }
          };

          const violations = [];
          if (metrics.trades_count < config.min_trades) {
            violations.push({
              type: 'warning',
              metric: 'trades_count',
              value: metrics.trades_count,
              threshold: config.min_trades,
              message: 'Insufficient number of trades for reliable validation'
            });
          }

          if (metrics.win_rate < config.min_win_rate) {
            violations.push({
              type: 'critical',
              metric: 'win_rate',
              value: metrics.win_rate,
              threshold: config.min_win_rate,
              message: 'Win rate below minimum threshold'
            });
          }

          if (metrics.max_drawdown < config.max_drawdown) {
            violations.push({
              type: 'critical',
              metric: 'max_drawdown',
              value: metrics.max_drawdown,
              threshold: config.max_drawdown,
              message: 'Maximum drawdown exceeds allowed limit'
            });
          }

          if (metrics.profit_factor < config.min_profit_factor) {
            violations.push({
              type: 'warning',
              metric: 'profit_factor',
              value: metrics.profit_factor,
              threshold: config.min_profit_factor,
              message: 'Profit factor below recommended threshold'
            });
          }

          return { metrics, violations };
        };

        const generateRecommendations = (metrics: ValidationResult['metrics']) => {
          const recommendations = [];

          if (metrics.win_rate < config.min_win_rate) {
            const suggestedStopLoss = backtestResults.risk_metrics.value_at_risk * 1.5;
            recommendations.push({
              parameter: 'stop_loss',
              current_value: strategy.parameters.exit_conditions.stop_loss || 0,
              suggested_value: suggestedStopLoss,
              reason: 'Tighter stop loss may improve win rate'
            });
          }

          if (metrics.max_drawdown < config.max_drawdown) {
            const suggestedPositionSize = metrics.risk_exposure.position_size * 0.8;
            recommendations.push({
              parameter: 'position_size',
              current_value: metrics.risk_exposure.position_size,
              suggested_value: suggestedPositionSize,
              reason: 'Smaller position size may reduce drawdown'
            });
          }

          if (metrics.profit_factor < config.min_profit_factor) {
            const suggestedTakeProfit = backtestResults.trade_metrics.average_win * 1.2;
            recommendations.push({
              parameter: 'take_profit',
              current_value: strategy.parameters.exit_conditions.take_profit || 0,
              suggested_value: suggestedTakeProfit,
              reason: 'Higher take profit may improve profit factor'
            });
          }

          return recommendations;
        };

        const { metrics, violations } = validateMetrics();
        const recommendations = generateRecommendations(metrics);

        setResult({
          is_valid: violations.filter(v => v.type === 'critical').length === 0,
          metrics,
          violations,
          recommendations
        });

        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to validate strategy',
          code: 'VALIDATION_ERROR'
        });
      } finally {
        setIsValidating(false);
      }
    }, 10000);

    return () => clearInterval(validationInterval);
  }, [backtestResults, strategy, marketAnalysis, config]);

  const updateConfig = (newConfig: Partial<ValidationConfig>) => {
    setConfig(prev => ({
      ...prev,
      ...newConfig,
      risk_limits: { ...prev.risk_limits, ...newConfig.risk_limits }
    }));
  };

  const getCriticalViolations = () => {
    return result?.violations.filter(v => v.type === 'critical') || [];
  };

  const getWarnings = () => {
    return result?.violations.filter(v => v.type === 'warning') || [];
  };

  const getTopRecommendations = (limit: number = 3) => {
    return result?.recommendations.slice(0, limit) || [];
  };

  return {
    config,
    result,
    error,
    isValidating,
    updateConfig,
    getCriticalViolations,
    getWarnings,
    getTopRecommendations
  };
};
