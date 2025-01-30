import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useTradeMonitor } from './useTradeMonitor';
import { useTradeAnalytics } from './useTradeAnalytics';
import { useMarketDataProvider } from './useMarketDataProvider';

interface RiskMetrics {
  exposure: {
    total: number;
    per_asset: Record<string, number>;
    max_allowed: number;
    current_ratio: number;
  };
  volatility: {
    current: number;
    historical: number;
    threshold: number;
    status: 'low' | 'medium' | 'high';
  };
  drawdown: {
    current: number;
    max_historical: number;
    threshold: number;
    recovery_time: number;
  };
  concentration: {
    highest_allocation: number;
    diversification_score: number;
    risk_concentration: number;
  };
  liquidity: {
    current_ratio: number;
    quick_ratio: number;
    market_impact: number;
  };
}

interface RiskAlert {
  id: string;
  type: 'exposure' | 'volatility' | 'drawdown' | 'concentration' | 'liquidity';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  metrics: Partial<RiskMetrics>;
}

export const useRiskMonitor = (botId: string | null) => {
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const { monitorData } = useTradeMonitor(botId);
  const { analytics } = useTradeAnalytics(botId);
  const { marketContext } = useMarketDataProvider(null, botId);

  useEffect(() => {
    if (!monitorData || !analytics || !marketContext) return;

    const calculateRiskMetrics = (): RiskMetrics => {
      const totalExposure = monitorData.risk.current_exposure;
      const maxAllowedExposure = totalExposure * 1.5;
      const exposureRatio = totalExposure / maxAllowedExposure;

      const currentVolatility = analytics.risk_metrics.volatility;
      const volatilityThreshold = 0.2;
      const volatilityStatus = currentVolatility > volatilityThreshold ? 'high' :
        currentVolatility > volatilityThreshold / 2 ? 'medium' : 'low';

      const currentDrawdown = monitorData.risk.max_drawdown;
      const drawdownThreshold = -0.15;
      const recoveryTime = currentDrawdown < 0 ? 
        Math.ceil(Math.abs(currentDrawdown) / (analytics.performance.average_return || 0.01)) : 0;

      return {
        exposure: {
          total: totalExposure,
          per_asset: {},
          max_allowed: maxAllowedExposure,
          current_ratio: exposureRatio
        },
        volatility: {
          current: currentVolatility,
          historical: analytics.risk_metrics.volatility,
          threshold: volatilityThreshold,
          status: volatilityStatus
        },
        drawdown: {
          current: currentDrawdown,
          max_historical: analytics.performance.max_drawdown,
          threshold: drawdownThreshold,
          recovery_time: recoveryTime
        },
        concentration: {
          highest_allocation: analytics.market_impact.liquidity_score,
          diversification_score: 1 - analytics.market_impact.price_impact,
          risk_concentration: analytics.risk_metrics.beta
        },
        liquidity: {
          current_ratio: marketContext.volume.current_24h / totalExposure,
          quick_ratio: marketContext.volume.current_24h / (totalExposure * 2),
          market_impact: analytics.market_impact.price_impact
        }
      };
    };

    const generateAlerts = (metrics: RiskMetrics): RiskAlert[] => {
      const newAlerts: RiskAlert[] = [];
      const timestamp = new Date().toISOString();

      if (metrics.exposure.current_ratio > 0.9) {
        newAlerts.push({
          id: `exposure-${timestamp}`,
          type: 'exposure',
          severity: 'critical',
          message: `High exposure: ${(metrics.exposure.current_ratio * 100).toFixed(2)}% of maximum allowed`,
          timestamp,
          metrics: { exposure: metrics.exposure }
        });
      }

      if (metrics.volatility.status === 'high') {
        newAlerts.push({
          id: `volatility-${timestamp}`,
          type: 'volatility',
          severity: 'warning',
          message: `High volatility: ${(metrics.volatility.current * 100).toFixed(2)}%`,
          timestamp,
          metrics: { volatility: metrics.volatility }
        });
      }

      if (metrics.drawdown.current < metrics.drawdown.threshold) {
        newAlerts.push({
          id: `drawdown-${timestamp}`,
          type: 'drawdown',
          severity: 'critical',
          message: `Maximum drawdown exceeded: ${(metrics.drawdown.current * 100).toFixed(2)}%`,
          timestamp,
          metrics: { drawdown: metrics.drawdown }
        });
      }

      if (metrics.liquidity.current_ratio < 2) {
        newAlerts.push({
          id: `liquidity-${timestamp}`,
          type: 'liquidity',
          severity: 'warning',
          message: `Low liquidity ratio: ${metrics.liquidity.current_ratio.toFixed(2)}`,
          timestamp,
          metrics: { liquidity: metrics.liquidity }
        });
      }

      return newAlerts;
    };

    try {
      const metrics = calculateRiskMetrics();
      setRiskMetrics(metrics);
      setAlerts(prev => [...generateAlerts(metrics), ...prev].slice(0, 50));
      setError(null);
      setIsMonitoring(true);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to calculate risk metrics',
        code: 'RISK_ERROR'
      });
      setIsMonitoring(false);
    }
  }, [monitorData, analytics, marketContext]);

  const clearAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const clearAllAlerts = () => {
    setAlerts([]);
  };

  return {
    riskMetrics,
    alerts,
    error,
    isMonitoring,
    clearAlert,
    clearAllAlerts
  };
};
