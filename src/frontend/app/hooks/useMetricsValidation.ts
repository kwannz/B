import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMetricsStore } from './useMetricsStore';
import { useMetricsProcessor } from './useMetricsProcessor';
import { useMetricsAnalytics } from './useMetricsAnalytics';

interface ValidationConfig {
  update_interval: number;
  thresholds: {
    data_quality: {
      missing_data_ratio: number;
      stale_data_age: number;
      anomaly_zscore: number;
    };
    performance: {
      latency: number;
      error_rate: number;
      timeout: number;
    };
    consistency: {
      price_deviation: number;
      volume_deviation: number;
      timestamp_gap: number;
    };
  };
}

interface ValidationResult {
  timestamp: string;
  is_valid: boolean;
  metrics: {
    data_quality: {
      missing_ratio: number;
      stale_ratio: number;
      anomaly_count: number;
    };
    performance: {
      avg_latency: number;
      error_rate: number;
      timeout_count: number;
    };
    consistency: {
      price_deviations: number[];
      volume_deviations: number[];
      timestamp_gaps: number[];
    };
  };
  issues: Array<{
    type: 'data_quality' | 'performance' | 'consistency';
    severity: 'warning' | 'error';
    message: string;
    details: Record<string, any>;
  }>;
}

export const useMetricsValidation = (config: ValidationConfig) => {
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const store = useMetricsStore();
  const { metrics: processedMetrics } = useMetricsProcessor({
    update_interval: config.update_interval,
    window_size: 100,
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

  const { results: analyticsResults } = useMetricsAnalytics({
    update_interval: config.update_interval,
    window_size: 100,
    thresholds: {
      volatility: 0.2,
      correlation: 0.7,
      trend_strength: 0.3,
      volume_impact: 0.4
    }
  });

  useEffect(() => {
    if (!processedMetrics || !analyticsResults) return;

    const validationInterval = setInterval(() => {
      try {
        setIsValidating(true);

        const validateDataQuality = () => {
          const metrics = store.market.data;
          const missingCount = Object.values(metrics).filter(v => v === null || v === undefined).length;
          const missingRatio = missingCount / Object.keys(metrics).length;

          const now = Date.now();
          const staleCount = Object.values(store.system.performance.api_latency)
            .filter(timestamp => (now - timestamp) > config.thresholds.data_quality.stale_data_age)
            .length;
          const staleRatio = staleCount / store.system.performance.api_latency.length;

          const prices = store.market.data.price_updates;
          const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
          const stdDev = Math.sqrt(
            prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length
          );
          const anomalyCount = prices.filter(price => 
            Math.abs((price - mean) / stdDev) > config.thresholds.data_quality.anomaly_zscore
          ).length;

          const issues: ValidationResult['issues'] = [];
          if (missingRatio > config.thresholds.data_quality.missing_data_ratio) {
            issues.push({
              type: 'data_quality',
              severity: 'error',
              message: `High ratio of missing data: ${(missingRatio * 100).toFixed(2)}%`,
              details: { missing_ratio: missingRatio, threshold: config.thresholds.data_quality.missing_data_ratio }
            });
          }

          if (staleRatio > 0.1) {
            issues.push({
              type: 'data_quality',
              severity: 'warning',
              message: `Significant amount of stale data detected: ${(staleRatio * 100).toFixed(2)}%`,
              details: { stale_ratio: staleRatio, age_threshold: config.thresholds.data_quality.stale_data_age }
            });
          }

          return {
            metrics: {
              missing_ratio: missingRatio,
              stale_ratio: staleRatio,
              anomaly_count: anomalyCount
            },
            issues
          };
        };

        const validatePerformance = () => {
          const latencies = store.system.performance.api_latency;
          const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
          const errorRate = store.system.performance.error_rate[
            store.system.performance.error_rate.length - 1
          ];
          const timeoutCount = latencies.filter(lat => lat > config.thresholds.performance.timeout).length;

          const issues: ValidationResult['issues'] = [];
          if (avgLatency > config.thresholds.performance.latency) {
            issues.push({
              type: 'performance',
              severity: 'warning',
              message: `High average latency: ${avgLatency.toFixed(2)}ms`,
              details: { avg_latency: avgLatency, threshold: config.thresholds.performance.latency }
            });
          }

          if (errorRate > config.thresholds.performance.error_rate) {
            issues.push({
              type: 'performance',
              severity: 'error',
              message: `High error rate: ${(errorRate * 100).toFixed(2)}%`,
              details: { error_rate: errorRate, threshold: config.thresholds.performance.error_rate }
            });
          }

          return {
            metrics: {
              avg_latency: avgLatency,
              error_rate: errorRate,
              timeout_count: timeoutCount
            },
            issues
          };
        };

        const validateConsistency = () => {
          const prices = store.market.data.price_updates;
          const volumes = [store.market.data.trade_volume];
          const timestamps = store.system.performance.api_latency;

          const priceDeviations = prices.slice(1).map((price, i) =>
            Math.abs((price - prices[i]) / prices[i])
          );

          const volumeDeviations = volumes.slice(1).map((vol, i) =>
            Math.abs((vol - volumes[i]) / volumes[i])
          );

          const timestampGaps = timestamps.slice(1).map((ts, i) =>
            ts - timestamps[i]
          );

          const issues: ValidationResult['issues'] = [];
          if (Math.max(...priceDeviations) > config.thresholds.consistency.price_deviation) {
            issues.push({
              type: 'consistency',
              severity: 'warning',
              message: `Large price deviation detected: ${(Math.max(...priceDeviations) * 100).toFixed(2)}%`,
              details: { max_deviation: Math.max(...priceDeviations), threshold: config.thresholds.consistency.price_deviation }
            });
          }

          if (Math.max(...volumeDeviations) > config.thresholds.consistency.volume_deviation) {
            issues.push({
              type: 'consistency',
              severity: 'warning',
              message: `Large volume deviation detected: ${(Math.max(...volumeDeviations) * 100).toFixed(2)}%`,
              details: { max_deviation: Math.max(...volumeDeviations), threshold: config.thresholds.consistency.volume_deviation }
            });
          }

          if (Math.max(...timestampGaps) > config.thresholds.consistency.timestamp_gap) {
            issues.push({
              type: 'consistency',
              severity: 'error',
              message: `Large timestamp gap detected: ${Math.max(...timestampGaps)}ms`,
              details: { max_gap: Math.max(...timestampGaps), threshold: config.thresholds.consistency.timestamp_gap }
            });
          }

          return {
            metrics: {
              price_deviations: priceDeviations,
              volume_deviations: volumeDeviations,
              timestamp_gaps: timestampGaps
            },
            issues
          };
        };

        const dataQualityResult = validateDataQuality();
        const performanceResult = validatePerformance();
        const consistencyResult = validateConsistency();

        const validationResult: ValidationResult = {
          timestamp: new Date().toISOString(),
          is_valid: dataQualityResult.issues.length === 0 &&
                   performanceResult.issues.length === 0 &&
                   consistencyResult.issues.length === 0,
          metrics: {
            data_quality: dataQualityResult.metrics,
            performance: performanceResult.metrics,
            consistency: consistencyResult.metrics
          },
          issues: [
            ...dataQualityResult.issues,
            ...performanceResult.issues,
            ...consistencyResult.issues
          ]
        };

        setResults(prev => [...prev, validationResult].slice(-100));
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to validate metrics',
          code: 'VALIDATION_ERROR'
        });
      } finally {
        setIsValidating(false);
      }
    }, config.update_interval);

    return () => clearInterval(validationInterval);
  }, [processedMetrics, analyticsResults, store, config]);

  const getLatestValidation = () => results[results.length - 1] || null;

  const getValidationHistory = () => results;

  const getIssuesByType = (type: 'data_quality' | 'performance' | 'consistency') =>
    results.flatMap(result => result.issues.filter(issue => issue.type === type));

  const getIssuesBySeverity = (severity: 'warning' | 'error') =>
    results.flatMap(result => result.issues.filter(issue => issue.severity === severity));

  const getValidationSummary = () => {
    if (results.length === 0) return null;

    const latest = results[results.length - 1];
    return {
      is_valid: latest.is_valid,
      total_issues: latest.issues.length,
      by_type: {
        data_quality: latest.issues.filter(i => i.type === 'data_quality').length,
        performance: latest.issues.filter(i => i.type === 'performance').length,
        consistency: latest.issues.filter(i => i.type === 'consistency').length
      },
      by_severity: {
        warning: latest.issues.filter(i => i.severity === 'warning').length,
        error: latest.issues.filter(i => i.severity === 'error').length
      },
      metrics: latest.metrics
    };
  };

  return {
    results,
    error,
    isValidating,
    getLatestValidation,
    getValidationHistory,
    getIssuesByType,
    getIssuesBySeverity,
    getValidationSummary
  };
};
