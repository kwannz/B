import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useRiskManager } from './useRiskManager';
import { useRiskLimits } from './useRiskLimits';
import { usePositionSizing } from './usePositionSizing';
import { useStrategyExecution } from './useStrategyExecution';

interface RiskControlConfig {
  maxDrawdownLimit: number;
  maxLeverageLimit: number;
  minLiquidityRatio: number;
  volatilityThreshold: number;
  riskToleranceLevel: 'conservative' | 'moderate' | 'aggressive';
}

interface RiskControlAction {
  type: 'reduce_exposure' | 'increase_hedge' | 'close_positions' | 'adjust_limits';
  priority: 'immediate' | 'high' | 'medium' | 'low';
  target: {
    exposure?: number;
    hedge_ratio?: number;
    position_size?: number;
  };
  reason: string;
}

interface RiskControlState {
  status: 'monitoring' | 'adjusting' | 'emergency';
  active_controls: string[];
  pending_actions: RiskControlAction[];
  last_update: string;
  metrics: {
    risk_score: number;
    exposure_level: number;
    hedge_effectiveness: number;
    control_efficiency: number;
  };
}

export const useRiskController = (botId: string | null, config: Partial<RiskControlConfig> = {}) => {
  const [state, setState] = useState<RiskControlState>({
    status: 'monitoring',
    active_controls: [],
    pending_actions: [],
    last_update: new Date().toISOString(),
    metrics: {
      risk_score: 0,
      exposure_level: 0,
      hedge_effectiveness: 0,
      control_efficiency: 0
    }
  });
  const [error, setError] = useState<ApiError | null>(null);
  const [isControlling, setIsControlling] = useState(false);

  const { state: riskState } = useRiskManager(botId);
  const { limits, alerts } = useRiskLimits(botId);
  const { sizing } = usePositionSizing(botId);
  const { executeRecommendation } = useStrategyExecution(botId);

  const defaultConfig: RiskControlConfig = {
    maxDrawdownLimit: -0.15,
    maxLeverageLimit: 3,
    minLiquidityRatio: 2,
    volatilityThreshold: 0.2,
    riskToleranceLevel: 'moderate',
    ...config
  };

  useEffect(() => {
    if (!riskState || !limits || !sizing) return;

    try {
      setIsControlling(true);

      const assessRiskLevel = () => {
        const riskScore = (
          (Math.abs(limits.loss_limits.current_loss) / Math.abs(defaultConfig.maxDrawdownLimit)) +
          (limits.exposure_limits.exposure_ratio / defaultConfig.maxLeverageLimit) +
          (defaultConfig.minLiquidityRatio / limits.volatility_limits.volatility_ratio)
        ) / 3;

        return {
          score: riskScore,
          level: riskScore > 0.8 ? 'emergency' :
                 riskScore > 0.6 ? 'adjusting' : 'monitoring'
        };
      };

      const generateControlActions = (riskLevel: string): RiskControlAction[] => {
        const actions: RiskControlAction[] = [];

        if (limits.exposure_limits.exposure_ratio > 0.9) {
          actions.push({
            type: 'reduce_exposure',
            priority: 'immediate',
            target: {
              exposure: limits.exposure_limits.max_exposure * 0.7
            },
            reason: 'Critical exposure level detected'
          });
        }

        if (limits.volatility_limits.volatility_ratio > 1.2) {
          actions.push({
            type: 'increase_hedge',
            priority: 'high',
            target: {
              hedge_ratio: 0.3
            },
            reason: 'High market volatility'
          });
        }

        if (Math.abs(limits.loss_limits.current_loss) > Math.abs(defaultConfig.maxDrawdownLimit)) {
          actions.push({
            type: 'close_positions',
            priority: 'immediate',
            reason: 'Maximum drawdown limit breached'
          });
        }

        return actions;
      };

      const calculateMetrics = () => ({
        risk_score: assessRiskLevel().score,
        exposure_level: limits.exposure_limits.exposure_ratio,
        hedge_effectiveness: 1 - (limits.loss_limits.current_loss / limits.loss_limits.max_drawdown),
        control_efficiency: alerts.length ? 1 - (alerts.length / 10) : 1
      });

      const { level: riskLevel, score: riskScore } = assessRiskLevel();
      const controlActions = generateControlActions(riskLevel);
      const metrics = calculateMetrics();

      setState({
        status: riskLevel as 'monitoring' | 'adjusting' | 'emergency',
        active_controls: controlActions.map(action => action.type),
        pending_actions: controlActions,
        last_update: new Date().toISOString(),
        metrics
      });

      if (riskLevel === 'emergency') {
        controlActions.forEach(async (action) => {
          if (action.priority === 'immediate') {
            try {
              await executeRecommendation({
                action: action.type === 'close_positions' ? 'close' : 'decrease',
                urgency: 'high',
                target_allocation: action.target?.exposure || 0,
                rationale: action.reason,
                expected_impact: {
                  risk_reduction: 0.3,
                  return_potential: -0.1
                }
              });
            } catch (err) {
              console.error('Failed to execute control action:', err);
            }
          }
        });
      }

      setError(null);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to control risk',
        code: 'CONTROL_ERROR'
      });
    } finally {
      setIsControlling(false);
    }
  }, [riskState, limits, sizing, alerts, defaultConfig, executeRecommendation]);

  const executeControlAction = async (action: RiskControlAction) => {
    try {
      await executeRecommendation({
        action: action.type === 'close_positions' ? 'close' :
               action.type === 'reduce_exposure' ? 'decrease' : 'hedge',
        urgency: action.priority === 'immediate' ? 'high' : 'medium',
        target_allocation: action.target?.exposure || action.target?.position_size || 0,
        rationale: action.reason,
        expected_impact: {
          risk_reduction: 0.2,
          return_potential: 0
        }
      });

      setState(prev => ({
        ...prev,
        pending_actions: prev.pending_actions.filter(a => a !== action)
      }));
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to execute control action',
        code: 'ACTION_ERROR'
      });
    }
  };

  return {
    state,
    error,
    isControlling,
    executeControlAction
  };
};
