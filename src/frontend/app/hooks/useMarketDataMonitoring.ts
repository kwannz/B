import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMarketDataSubscription } from './useMarketDataSubscription';
import { useOrderFlow } from './useOrderFlow';
import { useMarketMakerAnalysis } from './useMarketMakerAnalysis';

interface MarketAlert {
  id: string;
  type: 'price' | 'volume' | 'liquidity' | 'volatility';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  metadata: Record<string, any>;
}

interface MarketHealth {
  status: 'healthy' | 'warning' | 'critical';
  liquidity_score: number;
  volatility_score: number;
  efficiency_score: number;
  composite_score: number;
}

interface MonitoringConfig {
  symbol: string;
  alert_thresholds: {
    price_change: number;
    volume_spike: number;
    liquidity_drop: number;
    volatility_surge: number;
  };
  update_interval: number;
}

export const useMarketDataMonitoring = (config: MonitoringConfig) => {
  const [alerts, setAlerts] = useState<MarketAlert[]>([]);
  const [health, setHealth] = useState<MarketHealth | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const { data: marketData } = useMarketDataSubscription({
    symbol: config.symbol,
    channels: ['price', 'trades', 'orderbook', 'volume'],
    interval: config.update_interval
  });

  const { metrics: flowMetrics } = useOrderFlow(config.symbol);
  const { metrics: makerMetrics } = useMarketMakerAnalysis(null);

  useEffect(() => {
    if (!marketData || !flowMetrics || !makerMetrics) return;

    const monitoringInterval = setInterval(() => {
      try {
        setIsMonitoring(true);

        const generateAlerts = () => {
          const newAlerts: MarketAlert[] = [];
          const timestamp = new Date().toISOString();

          const priceChange = Math.abs(marketData.price.change_percent);
          if (priceChange > config.alert_thresholds.price_change) {
            newAlerts.push({
              id: `price-${Date.now()}`,
              type: 'price',
              severity: priceChange > config.alert_thresholds.price_change * 2 ? 
                'critical' : 'warning',
              message: `Large price movement detected: ${priceChange.toFixed(2)}%`,
              timestamp,
              metadata: { 
                change: priceChange,
                current_price: marketData.price.current
              }
            });
          }

          const volumeSpike = flowMetrics.volume.relative_volume;
          if (volumeSpike > config.alert_thresholds.volume_spike) {
            newAlerts.push({
              id: `volume-${Date.now()}`,
              type: 'volume',
              severity: volumeSpike > config.alert_thresholds.volume_spike * 2 ?
                'critical' : 'warning',
              message: `Unusual volume activity: ${volumeSpike.toFixed(2)}x average`,
              timestamp,
              metadata: {
                relative_volume: volumeSpike,
                current_volume: flowMetrics.volume.total
              }
            });
          }

          const liquidityDrop = 1 - (makerMetrics.depth.total_depth / 
            (makerMetrics.depth.bid_depth + makerMetrics.depth.ask_depth));
          if (liquidityDrop > config.alert_thresholds.liquidity_drop) {
            newAlerts.push({
              id: `liquidity-${Date.now()}`,
              type: 'liquidity',
              severity: liquidityDrop > config.alert_thresholds.liquidity_drop * 2 ?
                'critical' : 'warning',
              message: `Significant liquidity reduction: ${(liquidityDrop * 100).toFixed(2)}%`,
              timestamp,
              metadata: {
                drop_percentage: liquidityDrop,
                current_depth: makerMetrics.depth.total_depth
              }
            });
          }

          const volatilitySurge = marketData.price.volatility / 
            makerMetrics.volatility.historical;
          if (volatilitySurge > config.alert_thresholds.volatility_surge) {
            newAlerts.push({
              id: `volatility-${Date.now()}`,
              type: 'volatility',
              severity: volatilitySurge > config.alert_thresholds.volatility_surge * 2 ?
                'critical' : 'warning',
              message: `Elevated market volatility: ${volatilitySurge.toFixed(2)}x normal`,
              timestamp,
              metadata: {
                surge_factor: volatilitySurge,
                current_volatility: marketData.price.volatility
              }
            });
          }

          setAlerts(prev => [...newAlerts, ...prev].slice(0, 100));
        };

        const calculateHealth = () => {
          const liquidityScore = Math.max(0, Math.min(1,
            makerMetrics.depth.total_depth / 
            (makerMetrics.depth.bid_depth + makerMetrics.depth.ask_depth)
          ));

          const volatilityScore = Math.max(0, Math.min(1,
            1 - (marketData.price.volatility / 
            (makerMetrics.volatility.historical * 2))
          ));

          const efficiencyScore = Math.max(0, Math.min(1,
            1 - Math.abs(flowMetrics.imbalance.volume_imbalance)
          ));

          const compositeScore = (
            liquidityScore * 0.4 +
            volatilityScore * 0.3 +
            efficiencyScore * 0.3
          );

          setHealth({
            status: 
              compositeScore > 0.7 ? 'healthy' :
              compositeScore > 0.4 ? 'warning' : 'critical',
            liquidity_score: liquidityScore,
            volatility_score: volatilityScore,
            efficiency_score: efficiencyScore,
            composite_score: compositeScore
          });
        };

        generateAlerts();
        calculateHealth();
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to monitor market data',
          code: 'MONITORING_ERROR'
        });
      } finally {
        setIsMonitoring(false);
      }
    }, config.update_interval);

    return () => clearInterval(monitoringInterval);
  }, [marketData, flowMetrics, makerMetrics, config]);

  const getAlertsByType = (type: MarketAlert['type']) =>
    alerts.filter(a => a.type === type);

  const getAlertsBySeverity = (severity: MarketAlert['severity']) =>
    alerts.filter(a => a.severity === severity);

  const getRecentAlerts = (limit: number = 10) =>
    alerts.slice(0, limit);

  const getMarketHealth = () => health;

  const getHealthStatus = () => health?.status || 'unknown';

  const getMonitoringSummary = () => {
    if (!health) return null;

    return {
      market_state: health.status,
      risk_level: 
        health.composite_score < 0.3 ? 'extreme' :
        health.composite_score < 0.5 ? 'high' :
        health.composite_score < 0.7 ? 'moderate' : 'low',
      primary_concerns: alerts
        .filter(a => a.severity === 'critical')
        .map(a => a.type)
    };
  };

  return {
    alerts,
    health,
    error,
    isMonitoring,
    getAlertsByType,
    getAlertsBySeverity,
    getRecentAlerts,
    getMarketHealth,
    getHealthStatus,
    getMonitoringSummary
  };
};
