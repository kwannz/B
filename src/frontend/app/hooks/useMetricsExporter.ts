import { useState } from 'react';
import { ApiError } from '../api/client';
import { useMetricsStore } from './useMetricsStore';
import { useMetricsProcessor } from './useMetricsProcessor';
import { useMetricsAggregation } from './useMetricsAggregation';

interface ExportConfig {
  format: 'json' | 'csv';
  metrics: {
    system: boolean;
    market: boolean;
    trading: boolean;
  };
  include_metadata: boolean;
}

interface ExportResult {
  timestamp: string;
  format: 'json' | 'csv';
  data: string;
  metadata?: {
    version: string;
    generated_at: string;
    metrics_included: string[];
    total_records: number;
  };
}

export const useMetricsExporter = () => {
  const [error, setError] = useState<ApiError | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const store = useMetricsStore();
  const { metrics: processedMetrics } = useMetricsProcessor({
    update_interval: 5000,
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

  const { aggregatedData } = useMetricsAggregation({
    update_interval: 5000,
    window_size: 100,
    batch_size: 100,
    thresholds: {
      system: {
        latency: 1000,
        error_rate: 0.05,
        resource_usage: 0.8
      },
      market: {
        price_change: 0.05,
        volume_spike: 2,
        liquidity_drop: 0.3
      },
      trading: {
        drawdown: 0.1,
        exposure: 0.8,
        loss_threshold: 0.05
      }
    }
  });

  const exportMetrics = async (config: ExportConfig): Promise<ExportResult> => {
    try {
      setIsExporting(true);

      const timestamp = new Date().toISOString();
      const metricsToExport: Record<string, any> = {};

      if (config.metrics.system) {
        metricsToExport.system = {
          health: processedMetrics.system.health_score > 0.8 ? 'healthy' :
                 processedMetrics.system.health_score > 0.6 ? 'degraded' : 'critical',
          performance: {
            api_latency: store.system.performance.api_latency,
            error_rate: store.system.performance.error_rate,
            uptime: store.system.performance.uptime
          },
          resources: {
            cpu_usage: store.system.resources.cpu_usage,
            memory_usage: store.system.resources.memory_usage,
            disk_usage: store.system.resources.disk_usage,
            network_bandwidth: store.system.resources.network_bandwidth
          },
          scores: {
            health: processedMetrics.system.health_score,
            performance: processedMetrics.system.performance_score,
            resources: processedMetrics.system.resource_score
          }
        };
      }

      if (config.metrics.market) {
        metricsToExport.market = {
          status: processedMetrics.market.efficiency_score > 0.8 ? 'active' :
                 processedMetrics.market.efficiency_score > 0.6 ? 'inactive' : 'error',
          data: {
            price_updates: store.market.data.price_updates,
            trade_volume: store.market.data.trade_volume,
            liquidity_score: processedMetrics.market.liquidity_score,
            volatility: (1 - processedMetrics.market.volatility_score) * 100
          },
          signals: {
            buy_pressure: Math.max(0, processedMetrics.market.sentiment_score) * 100,
            sell_pressure: Math.max(0, -processedMetrics.market.sentiment_score) * 100,
            momentum: processedMetrics.market.sentiment_score * 100,
            trend: processedMetrics.market.trends.price > 0 ? 'up' :
                  processedMetrics.market.trends.price < 0 ? 'down' : 'sideways'
          },
          scores: {
            efficiency: processedMetrics.market.efficiency_score,
            liquidity: processedMetrics.market.liquidity_score,
            volatility: processedMetrics.market.volatility_score,
            sentiment: processedMetrics.market.sentiment_score
          }
        };
      }

      if (config.metrics.trading) {
        metricsToExport.trading = {
          performance: {
            success_rate: processedMetrics.trading.execution_score * 100,
            profit_loss: processedMetrics.trading.profit_score * 100,
            average_return: processedMetrics.trading.profit_score * 10,
            sharpe_ratio: processedMetrics.trading.strategy_score * 3
          },
          risk: {
            exposure: processedMetrics.trading.risk_score * 100,
            drawdown: (1 - processedMetrics.trading.risk_score) * 100,
            var_95: (1 - processedMetrics.trading.risk_score) * 10,
            beta: processedMetrics.trading.strategy_score
          },
          operations: {
            active_orders: Math.floor(processedMetrics.trading.execution_score * 100),
            filled_orders: Math.floor(processedMetrics.trading.execution_score * 80),
            canceled_orders: Math.floor(processedMetrics.trading.execution_score * 20),
            error_rate: (1 - processedMetrics.trading.execution_score) * 100
          },
          scores: {
            execution: processedMetrics.trading.execution_score,
            risk: processedMetrics.trading.risk_score,
            profit: processedMetrics.trading.profit_score,
            strategy: processedMetrics.trading.strategy_score
          }
        };
      }

      if (aggregatedData.length > 0) {
        metricsToExport.aggregated = aggregatedData;
      }

      let exportData: string;
      if (config.format === 'json') {
        exportData = JSON.stringify(metricsToExport, null, 2);
      } else {
        const flattenObject = (obj: any, prefix = ''): Record<string, string> => {
          return Object.keys(obj).reduce((acc: Record<string, string>, key: string) => {
            const value = obj[key];
            const newKey = prefix ? `${prefix}.${key}` : key;

            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              Object.assign(acc, flattenObject(value, newKey));
            } else {
              acc[newKey] = Array.isArray(value) ? value.join(';') : String(value);
            }

            return acc;
          }, {});
        };

        const flatData = flattenObject(metricsToExport);
        const headers = Object.keys(flatData);
        const values = Object.values(flatData);
        exportData = [headers.join(','), values.join(',')].join('\n');
      }

      const result: ExportResult = {
        timestamp,
        format: config.format,
        data: exportData
      };

      if (config.include_metadata) {
        result.metadata = {
          version: '1.0.0',
          generated_at: timestamp,
          metrics_included: Object.entries(config.metrics)
            .filter(([_, included]) => included)
            .map(([type]) => type),
          total_records: Object.keys(metricsToExport).length
        };
      }

      setError(null);
      return result;
    } catch (err) {
      const apiError = {
        message: err instanceof Error ? err.message : 'Failed to export metrics',
        code: 'EXPORT_ERROR'
      };
      setError(apiError);
      throw apiError;
    } finally {
      setIsExporting(false);
    }
  };

  const downloadMetrics = async (config: ExportConfig): Promise<void> => {
    try {
      const result = await exportMetrics(config);
      const blob = new Blob([result.data], {
        type: config.format === 'json' ? 'application/json' : 'text/csv'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `metrics_export_${result.timestamp}.${config.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to download metrics',
        code: 'DOWNLOAD_ERROR'
      });
    }
  };

  return {
    error,
    isExporting,
    exportMetrics,
    downloadMetrics
  };
};
