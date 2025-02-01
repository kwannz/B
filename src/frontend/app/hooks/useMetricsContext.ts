import { createContext, useContext, useEffect, useState } from 'react';
import { useMetricsStore } from './useMetricsStore';
import { useMetricsProcessor } from './useMetricsProcessor';
import { useMetricsDisplay } from './useMetricsDisplay';
import { useMetricsVisualization } from './useMetricsVisualization';

interface MetricsContextValue {
  system: {
    health: 'healthy' | 'degraded' | 'critical';
    performance: {
      api_latency: number;
      execution_time: number;
      error_rate: number;
      uptime: number;
    };
    resources: {
      cpu_usage: number;
      memory_usage: number;
      disk_usage: number;
      network_bandwidth: number;
    };
  };
  market: {
    status: 'active' | 'inactive' | 'error';
    data: {
      price_updates: number;
      trade_volume: number;
      liquidity_score: number;
      volatility: number;
    };
    signals: {
      buy_pressure: number;
      sell_pressure: number;
      momentum: number;
      trend: 'bullish' | 'bearish' | 'neutral';
    };
  };
  trading: {
    performance: {
      success_rate: number;
      profit_loss: number;
      average_return: number;
      sharpe_ratio: number;
    };
    risk: {
      exposure: number;
      drawdown: number;
      var_95: number;
      beta: number;
    };
    operations: {
      active_orders: number;
      filled_orders: number;
      canceled_orders: number;
      error_rate: number;
    };
  };
  visualization: {
    panels: Array<{
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
      options: Record<string, any>;
    }>;
  };
  alerts: Array<{
    id: string;
    type: 'system' | 'market' | 'trading';
    severity: 'info' | 'warning' | 'critical';
    message: string;
    timestamp: string;
    metrics: Record<string, number>;
  }>;
  isLoading: boolean;
  error: { message: string; code: string } | null;
}

const MetricsContext = createContext<MetricsContextValue | null>(null);

export const MetricsProvider = ({ children }: { children: React.ReactNode }) => {
  const [error, setError] = useState<{ message: string; code: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  const { panels } = useMetricsDisplay({
    refresh_interval: 5000,
    chart_colors: {
      primary: '#4CAF50',
      secondary: '#2196F3',
      success: '#8BC34A',
      warning: '#FFC107',
      error: '#F44336',
      background: '#1E1E1E',
      grid: '#333333'
    },
    layout: {
      system_metrics: true,
      market_metrics: true,
      trading_metrics: true,
      alerts_panel: true
    }
  });

  useEffect(() => {
    if (!processedMetrics || !panels) return;

    try {
      setIsLoading(true);

      const contextValue: MetricsContextValue = {
        system: {
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
        },
        visualization: {
          panels
        },
        alerts: store.alerts,
        isLoading,
        error
      };

      return contextValue;
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to update metrics context',
        code: 'CONTEXT_ERROR'
      });
    } finally {
      setIsLoading(false);
    }
  }, [processedMetrics, panels, store, error, isLoading]);

  return (
    <MetricsContext.Provider value={null}>
      {children}
    </MetricsContext.Provider>
  );
};

export const useMetricsContext = () => {
  const context = useContext(MetricsContext);
  if (!context) {
    throw new Error('useMetricsContext must be used within a MetricsProvider');
  }
  return context;
};
