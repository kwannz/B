import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMetricsStore } from './useMetricsStore';
import { useMetricsAggregator } from './useMetricsAggregator';

interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
  }>;
}

interface MetricsDataset {
  system: {
    performance: ChartData;
    resources: ChartData;
    errors: ChartData;
  };
  market: {
    price: ChartData;
    volume: ChartData;
    signals: ChartData;
  };
  trading: {
    performance: ChartData;
    risk: ChartData;
    operations: ChartData;
  };
}

interface VisualizationConfig {
  update_interval: number;
  data_points: number;
  chart_colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
  };
}

export const useMetricsVisualization = (config: VisualizationConfig) => {
  const [datasets, setDatasets] = useState<MetricsDataset | null>(null);
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

  useEffect(() => {
    if (!aggregatedMetrics) return;

    const visualizationInterval = setInterval(() => {
      try {
        setIsProcessing(true);

        const generateTimestamps = (count: number) => {
          const now = new Date();
          return Array.from({ length: count }, (_, i) => {
            const date = new Date(now.getTime() - (count - i - 1) * config.update_interval);
            return date.toLocaleTimeString();
          });
        };

        const timestamps = generateTimestamps(config.data_points);

        const createDataset = (
          label: string,
          data: number[],
          color: string,
          fillColor?: string
        ) => ({
          label,
          data: data.slice(-config.data_points),
          borderColor: color,
          backgroundColor: fillColor || color + '40'
        });

        const systemDatasets: MetricsDataset['system'] = {
          performance: {
            labels: timestamps,
            datasets: [
              createDataset(
                'API Latency',
                store.system.performance.api_latency,
                config.chart_colors.primary
              ),
              createDataset(
                'Execution Time',
                store.system.performance.execution_time,
                config.chart_colors.secondary
              ),
              createDataset(
                'Error Rate',
                store.system.performance.error_rate,
                config.chart_colors.error
              )
            ]
          },
          resources: {
            labels: timestamps,
            datasets: [
              createDataset(
                'CPU Usage',
                store.system.resources.cpu_usage,
                config.chart_colors.primary
              ),
              createDataset(
                'Memory Usage',
                store.system.resources.memory_usage,
                config.chart_colors.secondary
              ),
              createDataset(
                'Disk Usage',
                store.system.resources.disk_usage,
                config.chart_colors.warning
              ),
              createDataset(
                'Network',
                store.system.resources.network_bandwidth,
                config.chart_colors.success
              )
            ]
          },
          errors: {
            labels: timestamps,
            datasets: [
              createDataset(
                'System Errors',
                store.system.performance.error_rate,
                config.chart_colors.error
              )
            ]
          }
        };

        const marketDatasets: MetricsDataset['market'] = {
          price: {
            labels: timestamps,
            datasets: [
              createDataset(
                'Price Updates',
                [aggregatedMetrics.market.data.price_updates],
                config.chart_colors.primary
              )
            ]
          },
          volume: {
            labels: timestamps,
            datasets: [
              createDataset(
                'Trade Volume',
                [aggregatedMetrics.market.data.trade_volume],
                config.chart_colors.secondary
              ),
              createDataset(
                'Liquidity Score',
                [aggregatedMetrics.market.data.liquidity_score],
                config.chart_colors.success
              )
            ]
          },
          signals: {
            labels: timestamps,
            datasets: [
              createDataset(
                'Buy Pressure',
                [aggregatedMetrics.market.signals.buy_pressure],
                config.chart_colors.success
              ),
              createDataset(
                'Sell Pressure',
                [aggregatedMetrics.market.signals.sell_pressure],
                config.chart_colors.error
              ),
              createDataset(
                'Momentum',
                [aggregatedMetrics.market.signals.momentum],
                config.chart_colors.warning
              )
            ]
          }
        };

        const tradingDatasets: MetricsDataset['trading'] = {
          performance: {
            labels: timestamps,
            datasets: [
              createDataset(
                'Success Rate',
                [aggregatedMetrics.trading.performance.success_rate],
                config.chart_colors.success
              ),
              createDataset(
                'Profit/Loss',
                [aggregatedMetrics.trading.performance.profit_loss],
                config.chart_colors.primary
              ),
              createDataset(
                'Sharpe Ratio',
                [aggregatedMetrics.trading.performance.sharpe_ratio],
                config.chart_colors.secondary
              )
            ]
          },
          risk: {
            labels: timestamps,
            datasets: [
              createDataset(
                'Exposure',
                [aggregatedMetrics.trading.risk.exposure],
                config.chart_colors.warning
              ),
              createDataset(
                'Drawdown',
                [aggregatedMetrics.trading.risk.drawdown],
                config.chart_colors.error
              ),
              createDataset(
                'VaR',
                [aggregatedMetrics.trading.risk.var_95],
                config.chart_colors.primary
              )
            ]
          },
          operations: {
            labels: timestamps,
            datasets: [
              createDataset(
                'Active Orders',
                [aggregatedMetrics.trading.operations.active_orders],
                config.chart_colors.primary
              ),
              createDataset(
                'Filled Orders',
                [aggregatedMetrics.trading.operations.filled_orders],
                config.chart_colors.success
              ),
              createDataset(
                'Canceled Orders',
                [aggregatedMetrics.trading.operations.canceled_orders],
                config.chart_colors.error
              )
            ]
          }
        };

        setDatasets({
          system: systemDatasets,
          market: marketDatasets,
          trading: tradingDatasets
        });
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to process metrics visualization',
          code: 'VISUALIZATION_ERROR'
        });
      } finally {
        setIsProcessing(false);
      }
    }, config.update_interval);

    return () => clearInterval(visualizationInterval);
  }, [aggregatedMetrics, store, config]);

  const getSystemCharts = () => datasets?.system || null;

  const getMarketCharts = () => datasets?.market || null;

  const getTradingCharts = () => datasets?.trading || null;

  const getChartData = (category: keyof MetricsDataset, chart: string) => {
    if (!datasets) return null;
    return datasets[category][chart as keyof MetricsDataset[typeof category]];
  };

  const getLatestValues = (category: keyof MetricsDataset, chart: string) => {
    const data = getChartData(category, chart);
    if (!data) return null;

    return data.datasets.reduce((values, dataset) => ({
      ...values,
      [dataset.label]: dataset.data[dataset.data.length - 1]
    }), {});
  };

  const getChartOptions = (title: string) => ({
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: title
      },
      tooltip: {
        mode: 'index',
        intersect: false
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Time'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Value'
        }
      }
    }
  });

  return {
    datasets,
    error,
    isProcessing,
    getSystemCharts,
    getMarketCharts,
    getTradingCharts,
    getChartData,
    getLatestValues,
    getChartOptions
  };
};
