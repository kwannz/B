import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useRiskStrategy } from './useRiskStrategy';
import { usePositionSizing } from './usePositionSizing';
import { useMarketDataProvider } from './useMarketDataProvider';

interface RiskLimits {
  position_limits: {
    max_size: number;
    min_size: number;
    current_size: number;
    utilization: number;
  };
  loss_limits: {
    stop_loss: number;
    trailing_stop: number;
    max_drawdown: number;
    current_loss: number;
  };
  exposure_limits: {
    max_exposure: number;
    current_exposure: number;
    exposure_ratio: number;
    risk_weighted_exposure: number;
  };
  volatility_limits: {
    max_volatility: number;
    current_volatility: number;
    volatility_ratio: number;
    risk_adjusted_limits: number;
  };
}

interface LimitBreachAlert {
  type: 'position' | 'loss' | 'exposure' | 'volatility';
  severity: 'warning' | 'critical';
  message: string;
  current_value: number;
  limit_value: number;
  timestamp: string;
}

export const useRiskLimits = (botId: string | null) => {
  const [limits, setLimits] = useState<RiskLimits | null>(null);
  const [alerts, setAlerts] = useState<LimitBreachAlert[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const { strategy } = useRiskStrategy(botId);
  const { sizing } = usePositionSizing(botId);
  const { marketContext } = useMarketDataProvider(null, botId);

  useEffect(() => {
    if (!strategy || !sizing || !marketContext) return;

    try {
      setIsMonitoring(true);

      const calculatePositionLimits = () => {
        const currentSize = sizing.position_limits.current;
        const maxSize = sizing.max_allowed;
        return {
          max_size: maxSize,
          min_size: sizing.position_limits.min,
          current_size: currentSize,
          utilization: currentSize / maxSize
        };
      };

      const calculateLossLimits = () => {
        const currentPrice = marketContext.price.current;
        const atr = marketContext.volatility || strategy.risk_limits.max_drawdown;
        return {
          stop_loss: currentPrice * (1 - strategy.risk_limits.stop_loss),
          trailing_stop: currentPrice * (1 - atr * 2),
          max_drawdown: strategy.risk_limits.max_drawdown,
          current_loss: sizing.risk_metrics.value_at_risk
        };
      };

      const calculateExposureLimits = () => {
        const maxExposure = strategy.position_sizing.max_position_size;
        const currentExposure = strategy.position_sizing.current_allocation;
        return {
          max_exposure: maxExposure,
          current_exposure: currentExposure,
          exposure_ratio: currentExposure / maxExposure,
          risk_weighted_exposure: currentExposure * marketContext.volatility
        };
      };

      const calculateVolatilityLimits = () => {
        const maxVol = strategy.risk_limits.max_drawdown;
        const currentVol = marketContext.volatility || 0;
        return {
          max_volatility: maxVol,
          current_volatility: currentVol,
          volatility_ratio: currentVol / maxVol,
          risk_adjusted_limits: maxVol * (1 - currentVol)
        };
      };

      const newLimits: RiskLimits = {
        position_limits: calculatePositionLimits(),
        loss_limits: calculateLossLimits(),
        exposure_limits: calculateExposureLimits(),
        volatility_limits: calculateVolatilityLimits()
      };

      setLimits(newLimits);

      const checkLimitBreaches = (limits: RiskLimits): LimitBreachAlert[] => {
        const newAlerts: LimitBreachAlert[] = [];
        const timestamp = new Date().toISOString();

        if (limits.position_limits.utilization > 0.9) {
          newAlerts.push({
            type: 'position',
            severity: 'critical',
            message: 'Position size approaching maximum limit',
            current_value: limits.position_limits.current_size,
            limit_value: limits.position_limits.max_size,
            timestamp
          });
        }

        if (Math.abs(limits.loss_limits.current_loss) > Math.abs(limits.loss_limits.max_drawdown)) {
          newAlerts.push({
            type: 'loss',
            severity: 'critical',
            message: 'Maximum drawdown limit exceeded',
            current_value: limits.loss_limits.current_loss,
            limit_value: limits.loss_limits.max_drawdown,
            timestamp
          });
        }

        if (limits.exposure_limits.exposure_ratio > 0.95) {
          newAlerts.push({
            type: 'exposure',
            severity: 'warning',
            message: 'Total exposure nearing maximum limit',
            current_value: limits.exposure_limits.current_exposure,
            limit_value: limits.exposure_limits.max_exposure,
            timestamp
          });
        }

        if (limits.volatility_limits.volatility_ratio > 1.1) {
          newAlerts.push({
            type: 'volatility',
            severity: 'warning',
            message: 'Market volatility exceeding threshold',
            current_value: limits.volatility_limits.current_volatility,
            limit_value: limits.volatility_limits.max_volatility,
            timestamp
          });
        }

        return newAlerts;
      };

      const newAlerts = checkLimitBreaches(newLimits);
      if (newAlerts.length > 0) {
        setAlerts(prev => [...newAlerts, ...prev].slice(0, 50));
      }

      setError(null);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to calculate risk limits',
        code: 'LIMITS_ERROR'
      });
      setLimits(null);
      setAlerts([]);
      setIsMonitoring(false);
    }
  }, [strategy, sizing, marketContext]);

  const clearAlert = (timestamp: string) => {
    setAlerts(prev => prev.filter(alert => alert.timestamp !== timestamp));
  };

  const clearAllAlerts = () => {
    setAlerts([]);
  };

  return {
    limits,
    alerts,
    error,
    isMonitoring,
    clearAlert,
    clearAllAlerts
  };
};
