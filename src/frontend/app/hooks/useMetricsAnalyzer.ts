import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMetricsStore } from './useMetricsStore';
import { useMetricsProcessor } from './useMetricsProcessor';
import { useMetricsValidation } from './useMetricsValidation';

interface AnalyzerConfig {
  update_interval: number;
  window_size: number;
  thresholds: {
    system: {
      latency: number;
      error_rate: number;
      resource_usage: number;
    };
    market: {
      price_change: number;
      volume_spike: number;
      liquidity_drop: number;
    };
    trading: {
      drawdown: number;
      exposure: number;
      loss_threshold: number;
    };
  };
}

interface AnalysisResult {
  timestamp: string;
  system: {
    health_score: number;
    performance_issues: Array<{
      type: string;
      severity: 'warning' | 'error';
      message: string;
      value: number;
      threshold: number;
    }>;
    resource_usage: {
      cpu: number;
      memory: number;
      disk: number;
      network: number;
    };
  };
  market: {
    efficiency_score: number;
    volatility: number;
    liquidity: number;
    signals: {
      trend: 'bullish' | 'bearish' | 'neutral';
      strength: number;
      momentum: number;
      volume_profile: 'increasing' | 'decreasing' | 'stable';
    };
  };
  trading: {
    performance_score: number;
    risk_metrics: {
      var_95: number;
      max_drawdown: number;
      sharpe_ratio: number;
      sortino_ratio: number;
    };
    execution_metrics: {
      fill_rate: number;
      slippage: number;
      latency: number;
      success_rate: number;
    };
  };
}

export const useMetricsAnalyzer = (config: AnalyzerConfig) => {
  const [results, setResults] = useState<AnalysisResult[]>([]);
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

  const { results: validationResults } = useMetricsValidation({
    update_interval: config.update_interval,
    thresholds: {
      data_quality: {
        missing_data_ratio: 0.1,
        stale_data_age: 300000,
        anomaly_zscore: 3
      },
      performance: {
        latency: config.thresholds.system.latency,
        error_rate: config.thresholds.system.error_rate,
        timeout: 30000
      },
      consistency: {
        price_deviation: config.thresholds.market.price_change,
        volume_deviation: config.thresholds.market.volume_spike,
        timestamp_gap: 60000
      }
    }
  });

  useEffect(() => {
    if (!processedMetrics || !validationResults) return;

    const analysisInterval = setInterval(() => {
      try {
        setIsAnalyzing(true);

        const latestValidation = validationResults[validationResults.length - 1];
        if (!latestValidation) return;

        const calculateSystemHealth = () => {
          const latency = store.system.performance.api_latency[
            store.system.performance.api_latency.length - 1
          ];
          const errorRate = store.system.performance.error_rate[
            store.system.performance.error_rate.length - 1
          ];
          const cpuUsage = store.system.resources.cpu_usage[
            store.system.resources.cpu_usage.length - 1
          ];
          const memoryUsage = store.system.resources.memory_usage[
            store.system.resources.memory_usage.length - 1
          ];

          const performanceIssues = [];
          if (latency > config.thresholds.system.latency) {
            performanceIssues.push({
              type: 'high_latency',
              severity: 'warning',
              message: `High API latency: ${latency}ms`,
              value: latency,
              threshold: config.thresholds.system.latency
            });
          }

          if (errorRate > config.thresholds.system.error_rate) {
            performanceIssues.push({
              type: 'high_error_rate',
              severity: 'error',
              message: `High error rate: ${(errorRate * 100).toFixed(2)}%`,
              value: errorRate,
              threshold: config.thresholds.system.error_rate
            });
          }

          const healthScore = 1 - (
            (latency / config.thresholds.system.latency) * 0.3 +
            (errorRate / config.thresholds.system.error_rate) * 0.4 +
            (Math.max(cpuUsage, memoryUsage) / config.thresholds.system.resource_usage) * 0.3
          );

          return {
            health_score: Math.max(0, Math.min(1, healthScore)),
            performance_issues: performanceIssues,
            resource_usage: {
              cpu: cpuUsage,
              memory: memoryUsage,
              disk: store.system.resources.disk_usage[
                store.system.resources.disk_usage.length - 1
              ],
              network: store.system.resources.network_bandwidth[
                store.system.resources.network_bandwidth.length - 1
              ]
            }
          };
        };

        const calculateMarketMetrics = () => {
          const prices = store.market.data.price_updates;
          const volumes = [store.market.data.trade_volume];

          const priceChanges = prices.slice(1).map((price, i) =>
            (price - prices[i]) / prices[i]
          );
          const volumeChanges = volumes.slice(1).map((vol, i) =>
            (vol - volumes[i]) / volumes[i]
          );

          const volatility = Math.sqrt(
            priceChanges.reduce((sum, change) => sum + Math.pow(change, 2), 0) /
            priceChanges.length
          );

          const trend = priceChanges.reduce((sum, change) => sum + change, 0) > 0 ?
            'bullish' : priceChanges.reduce((sum, change) => sum + change, 0) < 0 ?
            'bearish' : 'neutral';

          const momentum = priceChanges.slice(-5).reduce((sum, change) => sum + change, 0);
          const volumeProfile = volumeChanges.slice(-5).reduce((sum, change) => sum + change, 0) > 0 ?
            'increasing' : volumeChanges.slice(-5).reduce((sum, change) => sum + change, 0) < 0 ?
            'decreasing' : 'stable';

          return {
            efficiency_score: processedMetrics.market.efficiency_score,
            volatility,
            liquidity: processedMetrics.market.liquidity_score,
            signals: {
              trend,
              strength: Math.abs(momentum),
              momentum,
              volume_profile
            }
          };
        };

        const calculateTradingMetrics = () => {
          const returns = store.trading.performance.profit_loss;
          const avgReturn = returns / 100;
          const stdDev = Math.sqrt(
            Math.pow(returns - avgReturn, 2) / (returns || 1)
          );

          const sharpeRatio = avgReturn / (stdDev || 1);
          const negativeReturns = returns < 0 ? Math.pow(returns, 2) : 0;
          const sortinoRatio = avgReturn / (Math.sqrt(negativeReturns) || 1);

          return {
            performance_score: processedMetrics.trading.execution_score,
            risk_metrics: {
              var_95: processedMetrics.trading.risk_score * 10,
              max_drawdown: (1 - processedMetrics.trading.risk_score) * 100,
              sharpe_ratio: sharpeRatio,
              sortino_ratio: sortinoRatio
            },
            execution_metrics: {
              fill_rate: store.trading.operations.filled_orders /
                        (store.trading.operations.active_orders || 1),
              slippage: (1 - processedMetrics.trading.execution_score) * 100,
              latency: store.system.performance.api_latency[
                store.system.performance.api_latency.length - 1
              ],
              success_rate: processedMetrics.trading.execution_score * 100
            }
          };
        };

        const analysisResult: AnalysisResult = {
          timestamp: new Date().toISOString(),
          system: calculateSystemHealth(),
          market: calculateMarketMetrics(),
          trading: calculateTradingMetrics()
        };

        setResults(prev => [...prev, analysisResult].slice(-config.window_size));
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to analyze metrics',
          code: 'ANALYSIS_ERROR'
        });
      } finally {
        setIsAnalyzing(false);
      }
    }, config.update_interval);

    return () => clearInterval(analysisInterval);
  }, [processedMetrics, validationResults, store, config]);

  const getLatestAnalysis = () => results[results.length - 1] || null;

  const getAnalysisHistory = (limit?: number) =>
    limit ? results.slice(-limit) : results;

  const getSystemAnalysis = () => {
    if (results.length === 0) return null;
    return results[results.length - 1].system;
  };

  const getMarketAnalysis = () => {
    if (results.length === 0) return null;
    return results[results.length - 1].market;
  };

  const getTradingAnalysis = () => {
    if (results.length === 0) return null;
    return results[results.length - 1].trading;
  };

  const getAnalysisSummary = () => {
    if (results.length === 0) return null;

    const latest = results[results.length - 1];
    return {
      system_health: latest.system.health_score > 0.8 ? 'healthy' :
                    latest.system.health_score > 0.6 ? 'degraded' : 'critical',
      market_efficiency: latest.market.efficiency_score > 0.8 ? 'high' :
                        latest.market.efficiency_score > 0.6 ? 'medium' : 'low',
      trading_performance: latest.trading.performance_score > 0.8 ? 'excellent' :
                         latest.trading.performance_score > 0.6 ? 'good' : 'poor',
      alerts: {
        system: latest.system.performance_issues.length > 0,
        market: latest.market.volatility > config.thresholds.market.price_change,
        trading: latest.trading.risk_metrics.max_drawdown > config.thresholds.trading.drawdown
      }
    };
  };

  return {
    results,
    error,
    isAnalyzing,
    getLatestAnalysis,
    getAnalysisHistory,
    getSystemAnalysis,
    getMarketAnalysis,
    getTradingAnalysis,
    getAnalysisSummary
  };
};
