import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMetricsStore } from './useMetricsStore';
import { useMetricsProcessor } from './useMetricsProcessor';
import { useMetricsVisualization } from './useMetricsVisualization';

interface ExportConfig {
  format: 'json' | 'csv';
  metrics: {
    system: boolean;
    market: boolean;
    trading: boolean;
  };
  interval: number;
  retention_period: number;
}

interface ExportedData {
  timestamp: string;
  system?: {
    health: string;
    performance: Record<string, number>;
    resources: Record<string, number>;
  };
  market?: {
    status: string;
    data: Record<string, number>;
    signals: Record<string, number | string>;
  };
  trading?: {
    performance: Record<string, number>;
    risk: Record<string, number>;
    operations: Record<string, number>;
  };
}

export const useMetricsExport = (config: ExportConfig) => {
  const [data, setData] = useState<ExportedData[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const store = useMetricsStore();
  const { metrics: processedMetrics } = useMetricsProcessor({
    update_interval: config.interval,
    window_size: Math.ceil(config.retention_period / config.interval),
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

    const exportInterval = setInterval(() => {
      try {
        setIsExporting(true);

        const timestamp = new Date().toISOString();
        const exportData: ExportedData = { timestamp };

        if (config.metrics.system) {
          exportData.system = {
            health: processedMetrics.system.health_score > 0.8 ? 'healthy' :
                   processedMetrics.system.health_score > 0.6 ? 'degraded' : 'critical',
            performance: {
              api_latency: store.system.performance.api_latency[
                store.system.performance.api_latency.length - 1
              ],
              execution_time: store.system.performance.execution_time[
                store.system.performance.execution_time.length - 1
              ],
              error_rate: store.system.performance.error_rate[
                store.system.performance.error_rate.length - 1
              ],
              uptime: store.system.performance.uptime
            },
            resources: {
              cpu_usage: store.system.resources.cpu_usage[
                store.system.resources.cpu_usage.length - 1
              ],
              memory_usage: store.system.resources.memory_usage[
                store.system.resources.memory_usage.length - 1
              ],
              disk_usage: store.system.resources.disk_usage[
                store.system.resources.disk_usage.length - 1
              ],
              network_bandwidth: store.system.resources.network_bandwidth[
                store.system.resources.network_bandwidth.length - 1
              ]
            }
          };
        }

        if (config.metrics.market) {
          exportData.market = {
            status: processedMetrics.market.efficiency_score > 0.8 ? 'active' :
                   processedMetrics.market.efficiency_score > 0.6 ? 'inactive' : 'error',
            data: {
              price_updates: processedMetrics.market.efficiency_score * 100,
              trade_volume: processedMetrics.market.liquidity_score * 1000,
              liquidity_score: processedMetrics.market.liquidity_score,
              volatility: (1 - processedMetrics.market.volatility_score) * 100
            },
            signals: {
              buy_pressure: Math.max(0, processedMetrics.market.sentiment_score) * 100,
              sell_pressure: Math.max(0, -processedMetrics.market.sentiment_score) * 100,
              momentum: processedMetrics.market.sentiment_score * 100,
              trend: processedMetrics.market.trends.price
            }
          };
        }

        if (config.metrics.trading) {
          exportData.trading = {
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
            }
          };
        }

        setData(prev => [...prev, exportData].slice(-Math.ceil(
          config.retention_period / config.interval
        )));
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to export metrics',
          code: 'EXPORT_ERROR'
        });
      } finally {
        setIsExporting(false);
      }
    }, config.interval);

    return () => clearInterval(exportInterval);
  }, [processedMetrics, store, config]);

  const exportToJson = () => {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `metrics_export_${new Date().toISOString()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to export JSON',
        code: 'JSON_EXPORT_ERROR'
      });
    }
  };

  const exportToCsv = () => {
    try {
      const headers = ['timestamp'];
      const rows: string[][] = [headers];

      if (config.metrics.system) {
        headers.push(
          'system.health',
          'system.performance.api_latency',
          'system.performance.execution_time',
          'system.performance.error_rate',
          'system.performance.uptime',
          'system.resources.cpu_usage',
          'system.resources.memory_usage',
          'system.resources.disk_usage',
          'system.resources.network_bandwidth'
        );
      }

      if (config.metrics.market) {
        headers.push(
          'market.status',
          'market.data.price_updates',
          'market.data.trade_volume',
          'market.data.liquidity_score',
          'market.data.volatility',
          'market.signals.buy_pressure',
          'market.signals.sell_pressure',
          'market.signals.momentum',
          'market.signals.trend'
        );
      }

      if (config.metrics.trading) {
        headers.push(
          'trading.performance.success_rate',
          'trading.performance.profit_loss',
          'trading.performance.average_return',
          'trading.performance.sharpe_ratio',
          'trading.risk.exposure',
          'trading.risk.drawdown',
          'trading.risk.var_95',
          'trading.risk.beta',
          'trading.operations.active_orders',
          'trading.operations.filled_orders',
          'trading.operations.canceled_orders',
          'trading.operations.error_rate'
        );
      }

      data.forEach(record => {
        const row: string[] = [record.timestamp];

        if (config.metrics.system && record.system) {
          row.push(
            record.system.health,
            record.system.performance.api_latency.toString(),
            record.system.performance.execution_time.toString(),
            record.system.performance.error_rate.toString(),
            record.system.performance.uptime.toString(),
            record.system.resources.cpu_usage.toString(),
            record.system.resources.memory_usage.toString(),
            record.system.resources.disk_usage.toString(),
            record.system.resources.network_bandwidth.toString()
          );
        }

        if (config.metrics.market && record.market) {
          row.push(
            record.market.status,
            record.market.data.price_updates.toString(),
            record.market.data.trade_volume.toString(),
            record.market.data.liquidity_score.toString(),
            record.market.data.volatility.toString(),
            record.market.signals.buy_pressure.toString(),
            record.market.signals.sell_pressure.toString(),
            record.market.signals.momentum.toString(),
            record.market.signals.trend.toString()
          );
        }

        if (config.metrics.trading && record.trading) {
          row.push(
            record.trading.performance.success_rate.toString(),
            record.trading.performance.profit_loss.toString(),
            record.trading.performance.average_return.toString(),
            record.trading.performance.sharpe_ratio.toString(),
            record.trading.risk.exposure.toString(),
            record.trading.risk.drawdown.toString(),
            record.trading.risk.var_95.toString(),
            record.trading.risk.beta.toString(),
            record.trading.operations.active_orders.toString(),
            record.trading.operations.filled_orders.toString(),
            record.trading.operations.canceled_orders.toString(),
            record.trading.operations.error_rate.toString()
          );
        }

        rows.push(row);
      });

      const csvContent = rows.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `metrics_export_${new Date().toISOString()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to export CSV',
        code: 'CSV_EXPORT_ERROR'
      });
    }
  };

  const exportData = () => {
    if (config.format === 'json') {
      exportToJson();
    } else {
      exportToCsv();
    }
  };

  const getLatestData = () => data[data.length - 1] || null;

  const getDataInRange = (startTime: string, endTime: string) =>
    data.filter(record =>
      record.timestamp >= startTime && record.timestamp <= endTime
    );

  const getExportSummary = () => ({
    total_records: data.length,
    start_time: data[0]?.timestamp,
    end_time: data[data.length - 1]?.timestamp,
    metrics_included: {
      system: config.metrics.system,
      market: config.metrics.market,
      trading: config.metrics.trading
    },
    format: config.format
  });

  return {
    data,
    error,
    isExporting,
    exportData,
    getLatestData,
    getDataInRange,
    getExportSummary
  };
};
