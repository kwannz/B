import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useRiskMonitor } from './useRiskMonitor';
import { useTradeAnalytics } from './useTradeAnalytics';
import { useMarketDataProvider } from './useMarketDataProvider';

interface RiskMetricsConfig {
  maxDrawdown: number;
  maxVolatility: number;
  maxExposure: number;
  minLiquidity: number;
  riskToleranceLevel: 'conservative' | 'moderate' | 'aggressive';
}

interface RiskAssessment {
  overall_risk: 'low' | 'medium' | 'high' | 'critical';
  metrics: {
    drawdown: {
      current: number;
      threshold: number;
      status: 'safe' | 'warning' | 'danger';
    };
    volatility: {
      current: number;
      threshold: number;
      status: 'safe' | 'warning' | 'danger';
    };
    exposure: {
      current: number;
      threshold: number;
      status: 'safe' | 'warning' | 'danger';
    };
    liquidity: {
      current: number;
      threshold: number;
      status: 'safe' | 'warning' | 'danger';
    };
  };
  recommendations: {
    action: 'increase' | 'maintain' | 'reduce' | 'close';
    reason: string;
    urgency: 'low' | 'medium' | 'high';
  }[];
}

export const useRiskMetrics = (botId: string | null, config: Partial<RiskMetricsConfig> = {}) => {
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const { riskMetrics } = useRiskMonitor(botId);
  const { analytics } = useTradeAnalytics(botId);
  const { marketContext } = useMarketDataProvider(null, botId);

  const defaultConfig: RiskMetricsConfig = {
    maxDrawdown: -0.15,
    maxVolatility: 0.2,
    maxExposure: 0.8,
    minLiquidity: 2.0,
    riskToleranceLevel: 'moderate',
    ...config
  };

  useEffect(() => {
    if (!riskMetrics || !analytics || !marketContext) return;

    const assessMetricStatus = (current: number, threshold: number, isReverse = false): 'safe' | 'warning' | 'danger' => {
      const ratio = isReverse ? threshold / current : current / threshold;
      if (ratio > 0.9) return 'danger';
      if (ratio > 0.7) return 'warning';
      return 'safe';
    };

    const generateRecommendations = (metrics: RiskAssessment['metrics']): RiskAssessment['recommendations'] => {
      const recommendations: RiskAssessment['recommendations'] = [];

      if (metrics.drawdown.status === 'danger') {
        recommendations.push({
          action: 'close',
          reason: 'Maximum drawdown threshold exceeded',
          urgency: 'high'
        });
      }

      if (metrics.volatility.status === 'danger') {
        recommendations.push({
          action: 'reduce',
          reason: 'Excessive market volatility',
          urgency: 'high'
        });
      }

      if (metrics.exposure.status === 'warning') {
        recommendations.push({
          action: 'reduce',
          reason: 'High position exposure',
          urgency: 'medium'
        });
      }

      if (metrics.liquidity.status === 'warning') {
        recommendations.push({
          action: 'maintain',
          reason: 'Decreasing market liquidity',
          urgency: 'medium'
        });
      }

      return recommendations;
    };

    const metrics: RiskAssessment['metrics'] = {
      drawdown: {
        current: riskMetrics.drawdown.current,
        threshold: defaultConfig.maxDrawdown,
        status: assessMetricStatus(riskMetrics.drawdown.current, defaultConfig.maxDrawdown)
      },
      volatility: {
        current: riskMetrics.volatility.current,
        threshold: defaultConfig.maxVolatility,
        status: assessMetricStatus(riskMetrics.volatility.current, defaultConfig.maxVolatility)
      },
      exposure: {
        current: riskMetrics.exposure.current_ratio,
        threshold: defaultConfig.maxExposure,
        status: assessMetricStatus(riskMetrics.exposure.current_ratio, defaultConfig.maxExposure)
      },
      liquidity: {
        current: riskMetrics.liquidity.current_ratio,
        threshold: defaultConfig.minLiquidity,
        status: assessMetricStatus(riskMetrics.liquidity.current_ratio, defaultConfig.minLiquidity, true)
      }
    };

    const recommendations = generateRecommendations(metrics);
    const riskLevels = Object.values(metrics).map(m => m.status);
    const overallRisk = riskLevels.includes('danger') ? 'critical' :
      riskLevels.includes('warning') ? 'high' :
      riskLevels.filter(s => s === 'safe').length === riskLevels.length ? 'low' : 'medium';

    setAssessment({
      overall_risk: overallRisk,
      metrics,
      recommendations
    });

    setError(null);
    setIsMonitoring(true);
  }, [riskMetrics, analytics, marketContext, defaultConfig]);

  return { assessment, error, isMonitoring };
};
