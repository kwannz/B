import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMetricsVisualization } from './useMetricsVisualization';
import { useMetricsStore } from './useMetricsStore';
import { useMetricsAggregator } from './useMetricsAggregator';

interface DisplayConfig {
  refresh_interval: number;
  chart_colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    background: string;
    grid: string;
  };
  layout: {
    system_metrics: boolean;
    market_metrics: boolean;
    trading_metrics: boolean;
    alerts_panel: boolean;
  };
}

interface MetricsPanel {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'area';
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      borderColor: string;
      backgroundColor: string;
    }>;
  };
  options: {
    responsive: boolean;
    plugins: Record<string, any>;
    scales: Record<string, any>;
  };
}

export const useMetricsDisplay = (config: DisplayConfig) => {
  const [panels, setPanels] = useState<MetricsPanel[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const store = useMetricsStore();
  const { datasets, getChartOptions } = useMetricsVisualization({
    update_interval: config.refresh_interval,
    data_points: 100,
    chart_colors: {
      primary: config.chart_colors.primary,
      secondary: config.chart_colors.secondary,
      success: config.chart_colors.success,
      warning: config.chart_colors.warning,
      error: config.chart_colors.error
    }
  });
  const { metrics: aggregatedMetrics } = useMetricsAggregator({
    update_interval: config.refresh_interval,
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
    if (!datasets || !aggregatedMetrics) return;

    const displayInterval = setInterval(() => {
      try {
        setIsLoading(true);

        const generatePanels = () => {
          const newPanels: MetricsPanel[] = [];

          if (config.layout.system_metrics) {
            newPanels.push({
              id: 'system-performance',
              title: 'System Performance',
              type: 'line',
              data: datasets.system.performance,
              options: {
                ...getChartOptions('System Performance'),
                scales: {
                  x: {
                    grid: {
                      color: config.chart_colors.grid
                    }
                  },
                  y: {
                    grid: {
                      color: config.chart_colors.grid
                    },
                    beginAtZero: true
                  }
                }
              }
            });

            newPanels.push({
              id: 'system-resources',
              title: 'Resource Usage',
              type: 'area',
              data: datasets.system.resources,
              options: {
                ...getChartOptions('Resource Usage'),
                scales: {
                  x: {
                    grid: {
                      color: config.chart_colors.grid
                    }
                  },
                  y: {
                    grid: {
                      color: config.chart_colors.grid
                    },
                    beginAtZero: true,
                    max: 100
                  }
                }
              }
            });
          }

          if (config.layout.market_metrics) {
            newPanels.push({
              id: 'market-volume',
              title: 'Market Volume',
              type: 'bar',
              data: datasets.market.volume,
              options: {
                ...getChartOptions('Market Volume'),
                scales: {
                  x: {
                    grid: {
                      color: config.chart_colors.grid
                    }
                  },
                  y: {
                    grid: {
                      color: config.chart_colors.grid
                    },
                    beginAtZero: true
                  }
                }
              }
            });

            newPanels.push({
              id: 'market-signals',
              title: 'Market Signals',
              type: 'line',
              data: datasets.market.signals,
              options: {
                ...getChartOptions('Market Signals'),
                scales: {
                  x: {
                    grid: {
                      color: config.chart_colors.grid
                    }
                  },
                  y: {
                    grid: {
                      color: config.chart_colors.grid
                    },
                    beginAtZero: true
                  }
                }
              }
            });
          }

          if (config.layout.trading_metrics) {
            newPanels.push({
              id: 'trading-performance',
              title: 'Trading Performance',
              type: 'line',
              data: datasets.trading.performance,
              options: {
                ...getChartOptions('Trading Performance'),
                scales: {
                  x: {
                    grid: {
                      color: config.chart_colors.grid
                    }
                  },
                  y: {
                    grid: {
                      color: config.chart_colors.grid
                    }
                  }
                }
              }
            });

            newPanels.push({
              id: 'trading-risk',
              title: 'Risk Metrics',
              type: 'area',
              data: datasets.trading.risk,
              options: {
                ...getChartOptions('Risk Metrics'),
                scales: {
                  x: {
                    grid: {
                      color: config.chart_colors.grid
                    }
                  },
                  y: {
                    grid: {
                      color: config.chart_colors.grid
                    },
                    beginAtZero: true
                  }
                }
              }
            });
          }

          setPanels(newPanels);
        };

        generatePanels();
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to update metrics display',
          code: 'DISPLAY_ERROR'
        });
      } finally {
        setIsLoading(false);
      }
    }, config.refresh_interval);

    return () => clearInterval(displayInterval);
  }, [datasets, aggregatedMetrics, config, getChartOptions]);

  const getPanelById = (id: string) =>
    panels.find(panel => panel.id === id);

  const getPanelsByType = (type: MetricsPanel['type']) =>
    panels.filter(panel => panel.type === type);

  const getSystemPanels = () =>
    panels.filter(panel => panel.id.startsWith('system-'));

  const getMarketPanels = () =>
    panels.filter(panel => panel.id.startsWith('market-'));

  const getTradingPanels = () =>
    panels.filter(panel => panel.id.startsWith('trading-'));

  const getDisplaySummary = () => {
    if (!aggregatedMetrics) return null;

    return {
      system_status: aggregatedMetrics.system.health,
      active_panels: panels.length,
      metrics_coverage: {
        system: config.layout.system_metrics,
        market: config.layout.market_metrics,
        trading: config.layout.trading_metrics
      },
      refresh_rate: config.refresh_interval
    };
  };

  return {
    panels,
    error,
    isLoading,
    getPanelById,
    getPanelsByType,
    getSystemPanels,
    getMarketPanels,
    getTradingPanels,
    getDisplaySummary
  };
};
