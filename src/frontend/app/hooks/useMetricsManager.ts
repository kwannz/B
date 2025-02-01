import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMetricsStore } from './useMetricsStore';
import { useMetricsProcessor } from './useMetricsProcessor';
import { useMetricsVisualization } from './useMetricsVisualization';
import { useMetricsExport } from './useMetricsExport';

interface MetricsConfig {
  update_interval: number;
  retention_period: number;
  alert_thresholds: {
    system_latency: number;
    error_rate: number;
    resource_usage: number;
    price_delay: number;
    trade_volume: number;
    drawdown: number;
  };
  visualization: {
    data_points: number;
    chart_colors: {
      primary: string;
      secondary: string;
      success: string;
      warning: string;
      error: string;
    };
  };
  export: {
    format: 'json' | 'csv';
    metrics: {
      system: boolean;
      market: boolean;
      trading: boolean;
    };
  };
}

export const useMetricsManager = (config: MetricsConfig) => {
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const store = useMetricsStore();
  const { metrics: processedMetrics } = useMetricsProcessor({
    update_interval: config.update_interval,
    window_size: Math.ceil(config.retention_period / config.update_interval),
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

  const { datasets, getChartOptions } = useMetricsVisualization({
    update_interval: config.update_interval,
    data_points: config.visualization.data_points,
    chart_colors: config.visualization.chart_colors
  });

  const { exportData, getExportSummary } = useMetricsExport({
    format: config.export.format,
    metrics: config.export.metrics,
    interval: config.update_interval,
    retention_period: config.retention_period
  });

  useEffect(() => {
    if (!processedMetrics || !datasets) return;

    const managementInterval = setInterval(() => {
      try {
        setIsLoading(true);

        const updateMetrics = () => {
          if (!processedMetrics) return;

          store.updateMetrics({
            system: {
              health: processedMetrics.system.health_score > 0.8 ? 'healthy' :
                     processedMetrics.system.health_score > 0.6 ? 'degraded' : 'critical',
              performance: {
                api_latency: [processedMetrics.system.performance_score * 1000],
                execution_time: [processedMetrics.system.performance_score * 2000],
                error_rate: [processedMetrics.system.health_score * 100],
                uptime: processedMetrics.system.health_score * 100
              },
              resources: {
                cpu_usage: [processedMetrics.system.resource_score * 100],
                memory_usage: [processedMetrics.system.resource_score * 100],
                disk_usage: [processedMetrics.system.resource_score * 100],
                network_bandwidth: [processedMetrics.system.resource_score * 1000]
              }
            },
            market: {
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
            },
            trading: {
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
            }
          });
        };

        updateMetrics();
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to manage metrics',
          code: 'MANAGEMENT_ERROR'
        });
      } finally {
        setIsLoading(false);
      }
    }, config.update_interval);

    return () => clearInterval(managementInterval);
  }, [processedMetrics, datasets, store, config]);

  const getSystemOverview = () => {
    if (!processedMetrics) return null;

    return {
      health: processedMetrics.system.health_score > 0.8 ? 'healthy' :
              processedMetrics.system.health_score > 0.6 ? 'degraded' : 'critical',
      performance_score: processedMetrics.system.performance_score,
      resource_utilization: processedMetrics.system.resource_score,
      service_status: processedMetrics.system.service_score > 0.8 ? 'operational' :
                     processedMetrics.system.service_score > 0.6 ? 'degraded' : 'critical'
    };
  };

  const getMarketOverview = () => {
    if (!processedMetrics) return null;

    return {
      status: processedMetrics.market.efficiency_score > 0.8 ? 'active' :
              processedMetrics.market.efficiency_score > 0.6 ? 'inactive' : 'error',
      efficiency: processedMetrics.market.efficiency_score,
      liquidity: processedMetrics.market.liquidity_score,
      sentiment: processedMetrics.market.sentiment_score,
      trend: processedMetrics.market.trends.price
    };
  };

  const getTradingOverview = () => {
    if (!processedMetrics) return null;

    return {
      performance: {
        execution: processedMetrics.trading.execution_score,
        profit: processedMetrics.trading.profit_score,
        strategy: processedMetrics.trading.strategy_score
      },
      risk: {
        score: processedMetrics.trading.risk_score,
        exposure: processedMetrics.trading.risk_score * 100,
        drawdown: (1 - processedMetrics.trading.risk_score) * 100
      },
      trends: {
        returns: processedMetrics.trading.trends.returns,
        risk: processedMetrics.trading.trends.risk,
        efficiency: processedMetrics.trading.trends.efficiency
      }
    };
  };

  const getMetricsOverview = () => ({
    system: getSystemOverview(),
    market: getMarketOverview(),
    trading: getTradingOverview(),
    export_summary: getExportSummary(),
    update_frequency: config.update_interval,
    retention_period: config.retention_period
  });

  return {
    store,
    processedMetrics,
    datasets,
    error,
    isLoading,
    getSystemOverview,
    getMarketOverview,
    getTradingOverview,
    getMetricsOverview,
    getChartOptions,
    exportData
  };
};
