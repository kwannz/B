import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useRiskMonitor } from './useRiskMonitor';
import { useRiskMetrics } from './useRiskMetrics';
import { useTradeAnalytics } from './useTradeAnalytics';

interface RiskAssessmentResult {
  overall_status: {
    level: 'safe' | 'caution' | 'warning' | 'danger';
    score: number;
    trend: 'improving' | 'stable' | 'deteriorating';
  };
  position_risk: {
    exposure_level: number;
    concentration_risk: number;
    leverage_ratio: number;
    margin_usage: number;
  };
  market_risk: {
    volatility_exposure: number;
    correlation_risk: number;
    liquidity_risk: number;
    gap_risk: number;
  };
  operational_risk: {
    execution_quality: number;
    system_health: number;
    compliance_status: 'compliant' | 'at_risk' | 'non_compliant';
    control_effectiveness: number;
  };
  recommendations: {
    action: 'increase' | 'maintain' | 'reduce' | 'close';
    urgency: 'low' | 'medium' | 'high';
    rationale: string;
    impact_estimate: number;
  }[];
}

export const useRiskAssessment = (botId: string | null) => {
  const [assessment, setAssessment] = useState<RiskAssessmentResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isAssessing, setIsAssessing] = useState(false);

  const { riskMetrics, alerts } = useRiskMonitor(botId);
  const { assessment: riskMetricsAssessment } = useRiskMetrics(botId);
  const { analytics } = useTradeAnalytics(botId);

  useEffect(() => {
    if (!riskMetrics || !riskMetricsAssessment || !analytics) return;

    const calculateOverallScore = () => {
      const weights = {
        drawdown: 0.25,
        volatility: 0.2,
        exposure: 0.3,
        liquidity: 0.25
      };

      const metrics = {
        drawdown: Math.min(1, Math.abs(riskMetrics.drawdown.current) / Math.abs(riskMetrics.drawdown.threshold)),
        volatility: riskMetrics.volatility.current / riskMetrics.volatility.threshold,
        exposure: riskMetrics.exposure.current_ratio,
        liquidity: Math.min(1, riskMetrics.liquidity.quick_ratio / 2)
      };

      return Object.entries(weights).reduce((score, [key, weight]) => 
        score + metrics[key as keyof typeof metrics] * weight, 0);
    };

    const determineRiskLevel = (score: number): RiskAssessmentResult['overall_status']['level'] => {
      if (score > 0.8) return 'danger';
      if (score > 0.6) return 'warning';
      if (score > 0.4) return 'caution';
      return 'safe';
    };

    const generateRecommendations = (score: number): RiskAssessmentResult['recommendations'] => {
      const recommendations: RiskAssessmentResult['recommendations'] = [];

      if (score > 0.8) {
        recommendations.push({
          action: 'close',
          urgency: 'high',
          rationale: 'Critical risk levels detected across multiple metrics',
          impact_estimate: -score
        });
      } else if (score > 0.6) {
        recommendations.push({
          action: 'reduce',
          urgency: 'high',
          rationale: 'High risk exposure requires immediate position reduction',
          impact_estimate: -(score - 0.6)
        });
      } else if (score > 0.4) {
        recommendations.push({
          action: 'maintain',
          urgency: 'medium',
          rationale: 'Monitor current positions closely',
          impact_estimate: 0
        });
      } else {
        recommendations.push({
          action: 'increase',
          urgency: 'low',
          rationale: 'Risk levels within acceptable range',
          impact_estimate: 0.2
        });
      }

      return recommendations;
    };

    try {
      setIsAssessing(true);
      const overallScore = calculateOverallScore();
      const riskLevel = determineRiskLevel(overallScore);
      const recommendations = generateRecommendations(overallScore);

      setAssessment({
        overall_status: {
          level: riskLevel,
          score: overallScore,
          trend: alerts.length > 0 ? 'deteriorating' : 'stable'
        },
        position_risk: {
          exposure_level: riskMetrics.exposure.current_ratio,
          concentration_risk: riskMetrics.concentration.risk_concentration,
          leverage_ratio: analytics.risk_metrics.beta,
          margin_usage: riskMetrics.exposure.total / riskMetrics.exposure.max_allowed
        },
        market_risk: {
          volatility_exposure: riskMetrics.volatility.current,
          correlation_risk: analytics.risk_metrics.correlation,
          liquidity_risk: 1 - riskMetrics.liquidity.current_ratio,
          gap_risk: analytics.market_impact.price_impact
        },
        operational_risk: {
          execution_quality: analytics.market_impact.execution_quality,
          system_health: alerts.length === 0 ? 1 : 1 - (alerts.length / 10),
          compliance_status: riskMetricsAssessment.overall_risk === 'low' ? 'compliant' : 
            riskMetricsAssessment.overall_risk === 'critical' ? 'non_compliant' : 'at_risk',
          control_effectiveness: 1 - overallScore
        },
        recommendations
      });

      setError(null);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to assess risk',
        code: 'ASSESSMENT_ERROR'
      });
      setAssessment(null);
    } finally {
      setIsAssessing(false);
    }
  }, [riskMetrics, riskMetricsAssessment, analytics, alerts]);

  return { assessment, error, isAssessing };
};
