import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useRiskAssessment } from './useRiskAssessment';
import { useRiskMetrics } from './useRiskMetrics';
import { useTradeMonitor } from './useTradeMonitor';

interface RiskStrategy {
  position_sizing: {
    max_position_size: number;
    current_allocation: number;
    recommended_size: number;
  };
  risk_limits: {
    stop_loss: number;
    take_profit: number;
    max_drawdown: number;
    position_limits: {
      min: number;
      max: number;
    };
  };
  hedging: {
    hedge_ratio: number;
    recommended_instruments: string[];
    correlation_matrix: Record<string, number>;
  };
  diversification: {
    current_score: number;
    optimal_weights: Record<string, number>;
    rebalance_threshold: number;
  };
}

interface StrategyRecommendation {
  action: 'increase' | 'decrease' | 'hedge' | 'rebalance' | 'close';
  urgency: 'low' | 'medium' | 'high';
  target_allocation: number;
  rationale: string;
  expected_impact: {
    risk_reduction: number;
    return_potential: number;
  };
}

export const useRiskStrategy = (botId: string | null) => {
  const [strategy, setStrategy] = useState<RiskStrategy | null>(null);
  const [recommendations, setRecommendations] = useState<StrategyRecommendation[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { assessment } = useRiskAssessment(botId);
  const { riskMetrics } = useRiskMetrics(botId);
  const { monitorData } = useTradeMonitor(botId);

  useEffect(() => {
    if (!assessment || !riskMetrics || !monitorData) return;

    try {
      setIsLoading(true);

      const calculatePositionSize = () => {
        const volatility = riskMetrics.volatility.current;
        const maxRiskPerTrade = 0.02; // 2% max risk per trade
        const accountValue = monitorData.performance.total_pnl;
        const maxPositionSize = (accountValue * maxRiskPerTrade) / volatility;

        return {
          max_position_size: maxPositionSize,
          current_allocation: monitorData.risk.current_exposure,
          recommended_size: maxPositionSize * (1 - volatility)
        };
      };

      const calculateRiskLimits = () => {
        const atr = riskMetrics.volatility.current * monitorData.market.current_price;
        return {
          stop_loss: monitorData.market.current_price - (2 * atr),
          take_profit: monitorData.market.current_price + (3 * atr),
          max_drawdown: -0.15,
          position_limits: {
            min: 0.01,
            max: calculatePositionSize().max_position_size
          }
        };
      };

      const calculateHedging = () => {
        const marketBeta = assessment.metrics.volatility.current / 
          assessment.metrics.volatility.threshold;
        return {
          hedge_ratio: Math.max(0, Math.min(1, marketBeta - 1)),
          recommended_instruments: ['SOL-PERP', 'SOL-USDC'],
          correlation_matrix: {
            'SOL-PERP': 1,
            'SOL-USDC': -0.8
          }
        };
      };

      const calculateDiversification = () => {
        const currentExposure = monitorData.risk.current_exposure;
        const optimalExposure = 1 / Math.sqrt(riskMetrics.volatility.current);
        return {
          current_score: 1 - Math.abs(currentExposure - optimalExposure),
          optimal_weights: {
            'SOL-PERP': optimalExposure,
            'SOL-USDC': 1 - optimalExposure
          },
          rebalance_threshold: 0.1
        };
      };

      const newStrategy: RiskStrategy = {
        position_sizing: calculatePositionSize(),
        risk_limits: calculateRiskLimits(),
        hedging: calculateHedging(),
        diversification: calculateDiversification()
      };

      setStrategy(newStrategy);

      const generateRecommendations = (): StrategyRecommendation[] => {
        const recommendations: StrategyRecommendation[] = [];
        const currentAllocation = newStrategy.position_sizing.current_allocation;
        const recommendedSize = newStrategy.position_sizing.recommended_size;

        if (currentAllocation > recommendedSize * 1.2) {
          recommendations.push({
            action: 'decrease',
            urgency: 'high',
            target_allocation: recommendedSize,
            rationale: 'Position size exceeds risk tolerance',
            expected_impact: {
              risk_reduction: 0.3,
              return_potential: -0.1
            }
          });
        }

        if (newStrategy.hedging.hedge_ratio > 0.2) {
          recommendations.push({
            action: 'hedge',
            urgency: 'medium',
            target_allocation: newStrategy.hedging.hedge_ratio,
            rationale: 'High market volatility suggests hedging',
            expected_impact: {
              risk_reduction: 0.2,
              return_potential: 0.1
            }
          });
        }

        if (Math.abs(1 - newStrategy.diversification.current_score) > 
            newStrategy.diversification.rebalance_threshold) {
          recommendations.push({
            action: 'rebalance',
            urgency: 'medium',
            target_allocation: newStrategy.diversification.optimal_weights['SOL-PERP'],
            rationale: 'Portfolio requires rebalancing',
            expected_impact: {
              risk_reduction: 0.15,
              return_potential: 0.15
            }
          });
        }

        return recommendations;
      };

      setRecommendations(generateRecommendations());
      setError(null);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to calculate risk strategy',
        code: 'STRATEGY_ERROR'
      });
      setStrategy(null);
      setRecommendations([]);
    } finally {
      setIsLoading(false);
    }
  }, [assessment, riskMetrics, monitorData]);

  return {
    strategy,
    recommendations,
    error,
    isLoading
  };
};
