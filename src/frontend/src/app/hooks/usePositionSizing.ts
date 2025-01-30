import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useRiskStrategy } from './useRiskStrategy';
import { useMarketDataProvider } from './useMarketDataProvider';
import { useTradeMonitor } from './useTradeMonitor';

interface PositionConfig {
  maxRiskPerTrade: number;
  maxPositionSize: number;
  minPositionSize: number;
  riskAdjustmentFactor: number;
}

interface PositionSizing {
  optimal_size: number;
  max_allowed: number;
  current_risk: number;
  risk_adjusted_size: number;
  position_limits: {
    min: number;
    max: number;
    current: number;
  };
  volatility_adjustment: number;
  kelly_criterion: number;
  risk_metrics: {
    value_at_risk: number;
    expected_shortfall: number;
    position_concentration: number;
  };
}

export const usePositionSizing = (botId: string | null, config: Partial<PositionConfig> = {}) => {
  const [sizing, setSizing] = useState<PositionSizing | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const { strategy } = useRiskStrategy(botId);
  const { marketContext } = useMarketDataProvider(null, botId);
  const { monitorData } = useTradeMonitor(botId);

  const defaultConfig: PositionConfig = {
    maxRiskPerTrade: 0.02,
    maxPositionSize: 10,
    minPositionSize: 0.01,
    riskAdjustmentFactor: 0.8,
    ...config
  };

  useEffect(() => {
    if (!strategy || !marketContext || !monitorData) return;

    try {
      setIsCalculating(true);

      const calculateOptimalSize = () => {
        const volatility = strategy.risk_limits.max_drawdown;
        const accountValue = monitorData.performance.total_pnl;
        const riskAmount = accountValue * defaultConfig.maxRiskPerTrade;
        
        return Math.min(
          riskAmount / volatility,
          defaultConfig.maxPositionSize
        );
      };

      const calculateKellyCriterion = () => {
        const winRate = monitorData.performance.win_rate / 100;
        const avgWin = Math.abs(strategy.position_sizing.recommended_size);
        const avgLoss = Math.abs(strategy.risk_limits.stop_loss);
        
        if (avgLoss === 0) return 0;
        return Math.max(0, Math.min(1, (winRate * avgWin - (1 - winRate) * avgLoss) / avgWin));
      };

      const calculateValueAtRisk = (position: number) => {
        const confidence = 0.95;
        const volatility = marketContext.volatility || strategy.risk_limits.max_drawdown;
        const timeHorizon = 1;
        return position * volatility * Math.sqrt(timeHorizon) * 
               Math.abs(marketContext.price.current) * confidence;
      };

      const calculateExpectedShortfall = (var95: number) => {
        return var95 * 1.2;
      };

      const optimalSize = calculateOptimalSize();
      const kellySize = calculateKellyCriterion() * optimalSize;
      const volatilityAdjustment = 1 - (marketContext.volatility || 0);
      const riskAdjustedSize = Math.min(
        optimalSize,
        kellySize
      ) * volatilityAdjustment * defaultConfig.riskAdjustmentFactor;

      const valueAtRisk = calculateValueAtRisk(riskAdjustedSize);
      
      setSizing({
        optimal_size: optimalSize,
        max_allowed: defaultConfig.maxPositionSize,
        current_risk: monitorData.risk.current_exposure,
        risk_adjusted_size: riskAdjustedSize,
        position_limits: {
          min: defaultConfig.minPositionSize,
          max: defaultConfig.maxPositionSize,
          current: strategy.position_sizing.current_allocation
        },
        volatility_adjustment: volatilityAdjustment,
        kelly_criterion: calculateKellyCriterion(),
        risk_metrics: {
          value_at_risk: valueAtRisk,
          expected_shortfall: calculateExpectedShortfall(valueAtRisk),
          position_concentration: strategy.position_sizing.current_allocation / defaultConfig.maxPositionSize
        }
      });

      setError(null);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to calculate position sizing',
        code: 'SIZING_ERROR'
      });
      setSizing(null);
    } finally {
      setIsCalculating(false);
    }
  }, [strategy, marketContext, monitorData, defaultConfig]);

  return { sizing, error, isCalculating };
};
