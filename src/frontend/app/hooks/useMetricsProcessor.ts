import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMetricsStore } from './useMetricsStore';
import { useMetricsAggregator } from './useMetricsAggregator';
import { useMetricsVisualization } from './useMetricsVisualization';

interface ProcessedMetrics {
  system: {
    health_score: number;
    performance_score: number;
    resource_score: number;
    service_score: number;
    trends: {
      latency: 'improving' | 'stable' | 'degrading';
      errors: 'improving' | 'stable' | 'degrading';
      resources: 'improving' | 'stable' | 'degrading';
    };
  };
  market: {
    efficiency_score: number;
    liquidity_score: number;
    volatility_score: number;
    sentiment_score: number;
    trends: {
      volume: 'increasing' | 'stable' | 'decreasing';
      price: 'bullish' | 'neutral' | 'bearish';
      momentum: 'positive' | 'neutral' | 'negative';
    };
  };
  trading: {
    execution_score: number;
    risk_score: number;
    profit_score: number;
    strategy_score: number;
    trends: {
      returns: 'improving' | 'stable' | 'declining';
      risk: 'increasing' | 'stable' | 'decreasing';
      efficiency: 'improving' | 'stable' | 'degrading';
    };
  };
}

interface ProcessorConfig {
  update_interval: number;
  window_size: number;
  thresholds: {
    trend_significance: number;
    score_weights: {
      system: Record<string, number>;
      market: Record<string, number>;
      trading: Record<string, number>;
    };
  };
}

export const useMetricsProcessor = (config: ProcessorConfig) => {
  const [metrics, setMetrics] = useState<ProcessedMetrics | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const store = useMetricsStore();
  const { metrics: aggregatedMetrics } = useMetricsAggregator({
    update_interval: config.update_interval,
    alert_thresholds: {
      system_latency: 1000,
      error_rate: 0.1,
      resource_usage: 80,
      price_delay: 5000,
      trade_volume: 1000,
      drawdown: 0.1
    }
  });
  const { datasets } = useMetricsVisualization({
    update_interval: config.update_interval,
    data_points: config.window_size,
    chart_colors: {
      primary: '#4CAF50',
      secondary: '#2196F3',
      success: '#8BC34A',
      warning: '#FFC107',
      error: '#F44336'
    }
  });

  useEffect(() => {
    if (!aggregatedMetrics || !datasets) return;

    const processingInterval = setInterval(() => {
      try {
        setIsProcessing(true);

        const calculateTrend = (values: number[], threshold: number) => {
          if (values.length < 2) return 'stable';
          const recent = values.slice(-Math.floor(values.length / 2));
          const older = values.slice(0, Math.floor(values.length / 2));
          const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
          const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
          const change = (recentAvg - olderAvg) / olderAvg;
          return Math.abs(change) < threshold ? 'stable' :
                 change > 0 ? 'improving' : 'degrading';
        };

        const calculateScore = (metrics: Record<string, number>, weights: Record<string, number>) => {
          const weightSum = Object.values(weights).reduce((sum, w) => sum + w, 0);
          return Object.entries(metrics).reduce((score, [key, value]) => 
            score + (value * (weights[key] || 0)), 0) / weightSum;
        };

        const systemMetrics: ProcessedMetrics['system'] = {
          health_score: calculateScore({
            uptime: store.system.performance.uptime,
            error_rate: 1 - store.system.performance.error_rate[
              store.system.performance.error_rate.length - 1
            ] / 100,
            service_availability: Object.values(aggregatedMetrics.system.services)
              .filter(status => status).length / 
              Object.values(aggregatedMetrics.system.services).length
          }, config.thresholds.score_weights.system),
          performance_score: calculateScore({
            latency: 1 - store.system.performance.api_latency[
              store.system.performance.api_latency.length - 1
            ] / 1000,
            execution_time: 1 - store.system.performance.execution_time[
              store.system.performance.execution_time.length - 1
            ] / 1000
          }, config.thresholds.score_weights.system),
          resource_score: calculateScore({
            cpu: 1 - store.system.resources.cpu_usage[
              store.system.resources.cpu_usage.length - 1
            ] / 100,
            memory: 1 - store.system.resources.memory_usage[
              store.system.resources.memory_usage.length - 1
            ] / 100,
            disk: 1 - store.system.resources.disk_usage[
              store.system.resources.disk_usage.length - 1
            ] / 100
          }, config.thresholds.score_weights.system),
          service_score: Object.values(aggregatedMetrics.system.services)
            .filter(status => status).length / 
            Object.values(aggregatedMetrics.system.services).length,
          trends: {
            latency: calculateTrend(
              store.system.performance.api_latency,
              config.thresholds.trend_significance
            ) as 'improving' | 'stable' | 'degrading',
            errors: calculateTrend(
              store.system.performance.error_rate,
              config.thresholds.trend_significance
            ) as 'improving' | 'stable' | 'degrading',
            resources: calculateTrend(
              store.system.resources.cpu_usage,
              config.thresholds.trend_significance
            ) as 'improving' | 'stable' | 'degrading'
          }
        };

        const marketMetrics: ProcessedMetrics['market'] = {
          efficiency_score: calculateScore({
            price_updates: aggregatedMetrics.market.data.price_updates / 100,
            trade_volume: aggregatedMetrics.market.data.trade_volume / 1000,
            liquidity: aggregatedMetrics.market.data.liquidity_score
          }, config.thresholds.score_weights.market),
          liquidity_score: aggregatedMetrics.market.data.liquidity_score,
          volatility_score: 1 - aggregatedMetrics.market.data.volatility / 100,
          sentiment_score: (
            aggregatedMetrics.market.signals.buy_pressure -
            aggregatedMetrics.market.signals.sell_pressure
          ) / Math.max(
            Math.abs(aggregatedMetrics.market.signals.buy_pressure),
            Math.abs(aggregatedMetrics.market.signals.sell_pressure),
            1
          ),
          trends: {
            volume: aggregatedMetrics.market.signals.momentum > 0.1 ? 'increasing' :
                   aggregatedMetrics.market.signals.momentum < -0.1 ? 'decreasing' :
                   'stable',
            price: aggregatedMetrics.market.signals.trend,
            momentum: aggregatedMetrics.market.signals.momentum > 0.1 ? 'positive' :
                     aggregatedMetrics.market.signals.momentum < -0.1 ? 'negative' :
                     'neutral'
          }
        };

        const tradingMetrics: ProcessedMetrics['trading'] = {
          execution_score: calculateScore({
            success_rate: aggregatedMetrics.trading.performance.success_rate / 100,
            slippage: 1 - aggregatedMetrics.trading.performance.average_return,
            speed: 1 - store.system.performance.execution_time[
              store.system.performance.execution_time.length - 1
            ] / 1000
          }, config.thresholds.score_weights.trading),
          risk_score: calculateScore({
            exposure: 1 - aggregatedMetrics.trading.risk.exposure / 100,
            drawdown: 1 - aggregatedMetrics.trading.risk.drawdown,
            var: 1 - aggregatedMetrics.trading.risk.var_95
          }, config.thresholds.score_weights.trading),
          profit_score: calculateScore({
            returns: aggregatedMetrics.trading.performance.average_return,
            sharpe: aggregatedMetrics.trading.performance.sharpe_ratio / 3,
            success: aggregatedMetrics.trading.performance.success_rate / 100
          }, config.thresholds.score_weights.trading),
          strategy_score: calculateScore({
            efficiency: aggregatedMetrics.trading.performance.sharpe_ratio / 3,
            consistency: aggregatedMetrics.trading.performance.success_rate / 100,
            risk_adjusted: 1 - aggregatedMetrics.trading.risk.drawdown
          }, config.thresholds.score_weights.trading),
          trends: {
            returns: calculateTrend(
              [aggregatedMetrics.trading.performance.profit_loss],
              config.thresholds.trend_significance
            ) as 'improving' | 'stable' | 'declining',
            risk: calculateTrend(
              [aggregatedMetrics.trading.risk.exposure],
              config.thresholds.trend_significance
            ) as 'increasing' | 'stable' | 'decreasing',
            efficiency: calculateTrend(
              [aggregatedMetrics.trading.performance.sharpe_ratio],
              config.thresholds.trend_significance
            ) as 'improving' | 'stable' | 'degrading'
          }
        };

        setMetrics({
          system: systemMetrics,
          market: marketMetrics,
          trading: tradingMetrics
        });
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to process metrics',
          code: 'PROCESSING_ERROR'
        });
      } finally {
        setIsProcessing(false);
      }
    }, config.update_interval);

    return () => clearInterval(processingInterval);
  }, [aggregatedMetrics, datasets, store, config]);

  const getSystemMetrics = () => metrics?.system || null;

  const getMarketMetrics = () => metrics?.market || null;

  const getTradingMetrics = () => metrics?.trading || null;

  const getOverallHealth = () => {
    if (!metrics) return null;

    const systemScore = (
      metrics.system.health_score +
      metrics.system.performance_score +
      metrics.system.resource_score +
      metrics.system.service_score
    ) / 4;

    const marketScore = (
      metrics.market.efficiency_score +
      metrics.market.liquidity_score +
      metrics.market.sentiment_score
    ) / 3;

    const tradingScore = (
      metrics.trading.execution_score +
      metrics.trading.risk_score +
      metrics.trading.profit_score +
      metrics.trading.strategy_score
    ) / 4;

    return {
      system_health: systemScore > 0.8 ? 'healthy' :
                    systemScore > 0.6 ? 'degraded' : 'critical',
      market_health: marketScore > 0.8 ? 'healthy' :
                    marketScore > 0.6 ? 'degraded' : 'critical',
      trading_health: tradingScore > 0.8 ? 'healthy' :
                     tradingScore > 0.6 ? 'degraded' : 'critical',
      overall_score: (systemScore + marketScore + tradingScore) / 3
    };
  };

  return {
    metrics,
    error,
    isProcessing,
    getSystemMetrics,
    getMarketMetrics,
    getTradingMetrics,
    getOverallHealth
  };
};
