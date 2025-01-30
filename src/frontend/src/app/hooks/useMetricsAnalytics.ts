import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMetricsStore } from './useMetricsStore';
import { useMetricsProcessor } from './useMetricsProcessor';
import { useMetricsVisualization } from './useMetricsVisualization';

interface AnalyticsConfig {
  update_interval: number;
  window_size: number;
  thresholds: {
    volatility: number;
    correlation: number;
    trend_strength: number;
    volume_impact: number;
  };
}

interface AnalyticsResult {
  timestamp: string;
  metrics: {
    volatility: number;
    correlation: number;
    trend_strength: number;
    volume_impact: number;
  };
  signals: {
    type: 'buy' | 'sell' | 'hold';
    strength: number;
    confidence: number;
    factors: string[];
  };
  risk: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
    exposure: number;
    var_95: number;
  };
}

export const useMetricsAnalytics = (config: AnalyticsConfig) => {
  const [results, setResults] = useState<AnalyticsResult[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const store = useMetricsStore();
  const { metrics: processedMetrics } = useMetricsProcessor({
    update_interval: config.update_interval,
    window_size: config.window_size,
    thresholds: {
      trend_significance: 0.1,
      score_weights: {
        system: {
          uptime: 0.4,
          error_rate: 0.3,
          service_availability: 0.3
        },
        market: {
          price_updates: 0.3,
          trade_volume: 0.4,
          liquidity: 0.3
        },
        trading: {
          success_rate: 0.4,
          slippage: 0.3,
          speed: 0.3
        }
      }
    }
  });

  useEffect(() => {
    if (!processedMetrics) return;

    const analyticsInterval = setInterval(() => {
      try {
        setIsAnalyzing(true);

        const calculateVolatility = (prices: number[]) => {
          if (prices.length < 2) return 0;
          const returns = prices.slice(1).map((price, i) => 
            Math.log(price / prices[i]));
          const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
          const variance = returns.reduce((sum, ret) => 
            sum + Math.pow(ret - mean, 2), 0) / returns.length;
          return Math.sqrt(variance * 252);
        };

        const calculateCorrelation = (x: number[], y: number[]) => {
          if (x.length !== y.length || x.length < 2) return 0;
          const xMean = x.reduce((sum, val) => sum + val, 0) / x.length;
          const yMean = y.reduce((sum, val) => sum + val, 0) / y.length;
          const numerator = x.reduce((sum, val, i) => 
            sum + (val - xMean) * (y[i] - yMean), 0);
          const xDev = Math.sqrt(x.reduce((sum, val) => 
            sum + Math.pow(val - xMean, 2), 0));
          const yDev = Math.sqrt(y.reduce((sum, val) => 
            sum + Math.pow(val - yMean, 2), 0));
          return numerator / (xDev * yDev);
        };

        const calculateTrendStrength = (prices: number[], volumes: number[]) => {
          if (prices.length < 2) return 0;
          const returns = prices.slice(1).map((price, i) => 
            Math.log(price / prices[i]));
          const volumeWeightedReturns = returns.map((ret, i) => 
            ret * volumes[i] / Math.max(...volumes));
          return volumeWeightedReturns.reduce((sum, ret) => sum + ret, 0) / 
            volumeWeightedReturns.length;
        };

        const calculateVolumeImpact = (prices: number[], volumes: number[]) => {
          if (prices.length < 2) return 0;
          const priceChanges = prices.slice(1).map((price, i) => 
            Math.abs(price - prices[i]));
          const volumeRatios = volumes.slice(1).map((vol, i) => 
            vol / volumes[i]);
          return calculateCorrelation(priceChanges, volumeRatios);
        };

        const generateSignals = (metrics: {
          volatility: number;
          correlation: number;
          trend_strength: number;
          volume_impact: number;
        }) => {
          const factors: string[] = [];
          let signalType: 'buy' | 'sell' | 'hold' = 'hold';
          let strength = 0;
          let confidence = 0;

          if (metrics.volatility < config.thresholds.volatility) {
            factors.push('Low volatility environment');
            confidence += 0.2;
          }

          if (Math.abs(metrics.correlation) > config.thresholds.correlation) {
            factors.push('Strong market correlation');
            confidence += 0.3;
          }

          if (Math.abs(metrics.trend_strength) > config.thresholds.trend_strength) {
            factors.push('Strong market trend');
            strength = metrics.trend_strength;
            signalType = metrics.trend_strength > 0 ? 'buy' : 'sell';
            confidence += 0.3;
          }

          if (Math.abs(metrics.volume_impact) > config.thresholds.volume_impact) {
            factors.push('Significant volume impact');
            confidence += 0.2;
          }

          return {
            type: signalType,
            strength: Math.abs(strength),
            confidence,
            factors
          };
        };

        const assessRisk = (metrics: {
          volatility: number;
          correlation: number;
          trend_strength: number;
          volume_impact: number;
        }) => {
          const factors: string[] = [];
          let riskLevel: 'low' | 'medium' | 'high' = 'low';
          let exposure = 0;

          if (metrics.volatility > config.thresholds.volatility * 1.5) {
            factors.push('High market volatility');
            exposure += 0.4;
            riskLevel = 'high';
          }

          if (Math.abs(metrics.correlation) > config.thresholds.correlation * 1.5) {
            factors.push('Strong market correlation increases systemic risk');
            exposure += 0.3;
            riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
          }

          if (Math.abs(metrics.volume_impact) > config.thresholds.volume_impact * 1.5) {
            factors.push('High volume impact on prices');
            exposure += 0.3;
            riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
          }

          return {
            level: riskLevel,
            factors,
            exposure,
            var_95: exposure * metrics.volatility * 1.645
          };
        };

        const prices = store.market.data.price_updates;
        const volumes = [store.market.data.trade_volume];

        const metrics = {
          volatility: calculateVolatility(prices),
          correlation: calculateCorrelation(prices, volumes),
          trend_strength: calculateTrendStrength(prices, volumes),
          volume_impact: calculateVolumeImpact(prices, volumes)
        };

        const signals = generateSignals(metrics);
        const risk = assessRisk(metrics);

        const result: AnalyticsResult = {
          timestamp: new Date().toISOString(),
          metrics,
          signals,
          risk
        };

        setResults(prev => [...prev, result].slice(-config.window_size));
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to analyze metrics',
          code: 'ANALYTICS_ERROR'
        });
      } finally {
        setIsAnalyzing(false);
      }
    }, config.update_interval);

    return () => clearInterval(analyticsInterval);
  }, [processedMetrics, store, config]);

  const getLatestResult = () => results[results.length - 1] || null;

  const getResultsInWindow = (windowSize: number) =>
    results.slice(-windowSize);

  const getSignalHistory = () =>
    results.map(result => ({
      timestamp: result.timestamp,
      signal: result.signals
    }));

  const getRiskHistory = () =>
    results.map(result => ({
      timestamp: result.timestamp,
      risk: result.risk
    }));

  const getMetricsSummary = () => {
    if (results.length === 0) return null;

    const latest = results[results.length - 1];
    return {
      current_volatility: latest.metrics.volatility,
      market_correlation: latest.metrics.correlation,
      trend_direction: latest.metrics.trend_strength > 0 ? 'up' : 'down',
      trend_strength: Math.abs(latest.metrics.trend_strength),
      volume_impact: latest.metrics.volume_impact,
      risk_level: latest.risk.level,
      signal: latest.signals.type,
      confidence: latest.signals.confidence
    };
  };

  return {
    results,
    error,
    isAnalyzing,
    getLatestResult,
    getResultsInWindow,
    getSignalHistory,
    getRiskHistory,
    getMetricsSummary
  };
};
