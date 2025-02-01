import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useRiskLimits } from './useRiskLimits';
import { usePositionSizing } from './usePositionSizing';
import { useRiskStrategy } from './useRiskStrategy';
import { useStrategyExecution } from './useStrategyExecution';

interface RiskManagerConfig {
  maxDrawdown: number;
  maxLeverage: number;
  minLiquidity: number;
  rebalanceThreshold: number;
  stopLossMultiplier: number;
}

interface RiskAction {
  type: 'reduce' | 'close' | 'hedge' | 'rebalance';
  urgency: 'low' | 'medium' | 'high';
  target_size?: number;
  target_price?: number;
  reason: string;
}

interface RiskState {
  status: 'safe' | 'warning' | 'danger';
  active_limits: string[];
  pending_actions: RiskAction[];
  last_check: string;
}

export const useRiskManager = (botId: string | null, config: Partial<RiskManagerConfig> = {}) => {
  const [state, setState] = useState<RiskState>({
    status: 'safe',
    active_limits: [],
    pending_actions: [],
    last_check: new Date().toISOString()
  });
  const [error, setError] = useState<ApiError | null>(null);
  const [isManaging, setIsManaging] = useState(false);

  const { limits, alerts } = useRiskLimits(botId);
  const { sizing } = usePositionSizing(botId);
  const { strategy, recommendations } = useRiskStrategy(botId);
  const { executeRecommendation } = useStrategyExecution(botId);

  const defaultConfig: RiskManagerConfig = {
    maxDrawdown: -0.15,
    maxLeverage: 3,
    minLiquidity: 2,
    rebalanceThreshold: 0.1,
    stopLossMultiplier: 2,
    ...config
  };

  useEffect(() => {
    if (!limits || !sizing || !strategy) return;

    try {
      setIsManaging(true);

      const checkRiskLevels = () => {
        const activeLimits: string[] = [];
        const actions: RiskAction[] = [];

        if (limits.position_limits.utilization > 0.9) {
          activeLimits.push('position_size');
          actions.push({
            type: 'reduce',
            urgency: 'high',
            target_size: limits.position_limits.max_size * 0.8,
            reason: 'Position size exceeding limits'
          });
        }

        if (Math.abs(limits.loss_limits.current_loss) > Math.abs(defaultConfig.maxDrawdown)) {
          activeLimits.push('drawdown');
          actions.push({
            type: 'close',
            urgency: 'high',
            reason: 'Maximum drawdown exceeded'
          });
        }

        if (limits.exposure_limits.exposure_ratio > 0.95) {
          activeLimits.push('exposure');
          actions.push({
            type: 'reduce',
            urgency: 'high',
            target_size: limits.exposure_limits.max_exposure * 0.8,
            reason: 'Total exposure near maximum'
          });
        }

        if (limits.volatility_limits.volatility_ratio > 1.2) {
          activeLimits.push('volatility');
          actions.push({
            type: 'hedge',
            urgency: 'medium',
            reason: 'High market volatility'
          });
        }

        return { activeLimits, actions };
      };

      const { activeLimits, actions } = checkRiskLevels();
      const status = activeLimits.length === 0 ? 'safe' :
        activeLimits.some(limit => ['drawdown', 'exposure'].includes(limit)) ? 'danger' : 'warning';

      setState({
        status,
        active_limits: activeLimits,
        pending_actions: actions,
        last_check: new Date().toISOString()
      });

      if (status === 'danger') {
        actions.forEach(async (action) => {
          try {
            if (action.type === 'close' || action.type === 'reduce') {
              const recommendation = recommendations.find(r => r.action === action.type);
              if (recommendation) {
                await executeRecommendation(recommendation);
              }
            }
          } catch (err) {
            console.error('Failed to execute risk action:', err);
          }
        });
      }

      setError(null);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to manage risk',
        code: 'RISK_MANAGER_ERROR'
      });
    } finally {
      setIsManaging(false);
    }
  }, [limits, sizing, strategy, recommendations, defaultConfig, executeRecommendation]);

  const executeAction = async (action: RiskAction) => {
    try {
      const matchingRecommendation = recommendations.find(r => r.action === action.type);
      if (matchingRecommendation) {
        await executeRecommendation(matchingRecommendation);
        setState(prev => ({
          ...prev,
          pending_actions: prev.pending_actions.filter(a => a !== action)
        }));
      }
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to execute risk action',
        code: 'ACTION_ERROR'
      });
    }
  };

  return {
    state,
    error,
    isManaging,
    executeAction
  };
};
