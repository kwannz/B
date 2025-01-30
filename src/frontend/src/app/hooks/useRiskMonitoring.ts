import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useRiskAnalyzer } from './useRiskAnalyzer';
import { useRiskController } from './useRiskController';
import { useMarketDataProvider } from './useMarketDataProvider';

interface RiskMonitoringConfig {
  updateInterval: number;
  alertThreshold: number;
  maxRiskLevel: number;
  monitoringMode: 'active' | 'passive';
}

interface MonitoringMetrics {
  risk_level: number;
  exposure_ratio: number;
  volatility_level: number;
  liquidity_ratio: number;
  market_impact: number;
  correlation_factor: number;
  momentum_score: number;
  sentiment_score: number;
}

interface MonitoringAlert {
  id: string;
  type: 'risk' | 'market' | 'system';
  level: 'info' | 'warning' | 'critical';
  message: string;
  metrics: Partial<MonitoringMetrics>;
  timestamp: string;
}

interface MonitoringState {
  status: 'monitoring' | 'paused' | 'error';
  metrics: MonitoringMetrics;
  alerts: MonitoringAlert[];
  last_update: string;
}

export const useRiskMonitoring = (botId: string | null, config: Partial<RiskMonitoringConfig> = {}) => {
  const [state, setState] = useState<MonitoringState>({
    status: 'monitoring',
    metrics: {
      risk_level: 0,
      exposure_ratio: 0,
      volatility_level: 0,
      liquidity_ratio: 0,
      market_impact: 0,
      correlation_factor: 0,
      momentum_score: 0,
      sentiment_score: 0
    },
    alerts: [],
    last_update: new Date().toISOString()
  });
  const [error, setError] = useState<ApiError | null>(null);

  const { analysis, score } = useRiskAnalyzer(botId);
  const { state: controlState } = useRiskController(botId);
  const { marketContext } = useMarketDataProvider(null, botId);

  const defaultConfig: RiskMonitoringConfig = {
    updateInterval: 5000,
    alertThreshold: 0.7,
    maxRiskLevel: 0.85,
    monitoringMode: 'active',
    ...config
  };

  useEffect(() => {
    if (!analysis || !score || !marketContext) return;

    const monitoringInterval = setInterval(() => {
      try {
        const calculateMetrics = (): MonitoringMetrics => ({
          risk_level: score.total_score,
          exposure_ratio: analysis.position_risk.size_risk,
          volatility_level: analysis.market_risk.volatility_impact,
          liquidity_ratio: 1 - analysis.market_risk.liquidity_risk,
          market_impact: analysis.execution_risk.slippage_risk,
          correlation_factor: analysis.market_risk.correlation_risk,
          momentum_score: marketContext.technical.momentum || 0,
          sentiment_score: marketContext.sentiment.score || 0
        });

        const generateAlerts = (metrics: MonitoringMetrics): MonitoringAlert[] => {
          const alerts: MonitoringAlert[] = [];
          const timestamp = new Date().toISOString();

          if (metrics.risk_level > defaultConfig.maxRiskLevel) {
            alerts.push({
              id: `risk-${timestamp}`,
              type: 'risk',
              level: 'critical',
              message: 'Critical risk level exceeded',
              metrics: { risk_level: metrics.risk_level },
              timestamp
            });
          }

          if (metrics.volatility_level > defaultConfig.alertThreshold) {
            alerts.push({
              id: `market-${timestamp}`,
              type: 'market',
              level: 'warning',
              message: 'High market volatility detected',
              metrics: { volatility_level: metrics.volatility_level },
              timestamp
            });
          }

          if (metrics.liquidity_ratio < 1 - defaultConfig.alertThreshold) {
            alerts.push({
              id: `market-${timestamp}`,
              type: 'market',
              level: 'warning',
              message: 'Low market liquidity',
              metrics: { liquidity_ratio: metrics.liquidity_ratio },
              timestamp
            });
          }

          return alerts;
        };

        const newMetrics = calculateMetrics();
        const newAlerts = generateAlerts(newMetrics);

        setState(prev => ({
          status: 'monitoring',
          metrics: newMetrics,
          alerts: [...newAlerts, ...prev.alerts].slice(0, 50),
          last_update: new Date().toISOString()
        }));

        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to monitor risk',
          code: 'MONITORING_ERROR'
        });
        setState(prev => ({ ...prev, status: 'error' }));
      }
    }, defaultConfig.updateInterval);

    return () => clearInterval(monitoringInterval);
  }, [analysis, score, marketContext, defaultConfig]);

  const clearAlert = (alertId: string) => {
    setState(prev => ({
      ...prev,
      alerts: prev.alerts.filter(alert => alert.id !== alertId)
    }));
  };

  const clearAllAlerts = () => {
    setState(prev => ({ ...prev, alerts: [] }));
  };

  const pauseMonitoring = () => {
    setState(prev => ({ ...prev, status: 'paused' }));
  };

  const resumeMonitoring = () => {
    setState(prev => ({ ...prev, status: 'monitoring' }));
  };

  return {
    state,
    error,
    clearAlert,
    clearAllAlerts,
    pauseMonitoring,
    resumeMonitoring
  };
};
