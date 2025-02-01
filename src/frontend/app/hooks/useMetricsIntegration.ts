import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMetricsStore } from './useMetricsStore';
import { useMetricsProcessor } from './useMetricsProcessor';
import { useMetricsWebSocket } from './useMetricsWebSocket';
import { useMetricsAnalytics } from './useMetricsAnalytics';
import { useMetricsNotifications } from './useMetricsNotifications';

interface IntegrationConfig {
  api_url: string;
  ws_url: string;
  update_interval: number;
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

export const useMetricsIntegration = (config: IntegrationConfig) => {
  const [error, setError] = useState<ApiError | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const store = useMetricsStore();
  const { isConnected, sendMessage } = useMetricsWebSocket({
    url: config.ws_url,
    channels: {
      system: true,
      market: true,
      trading: true
    },
    reconnect_interval: 5000,
    max_reconnect_attempts: 5
  });

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

  const { notifications } = useMetricsNotifications({
    update_interval: config.update_interval,
    thresholds: config.thresholds,
    channels: {
      browser: true,
      console: true,
      store: true
    }
  });

  useEffect(() => {
    if (!isConnected || !processedMetrics || !analyticsResults) return;

    const integrationInterval = setInterval(() => {
      try {
        const systemMetrics = {
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
            ]
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
            ]
          }
        };

        const marketMetrics = {
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

        const tradingMetrics = {
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
          }
        };

        const analyticsMetrics = {
          volatility: analyticsResults[analyticsResults.length - 1].metrics.volatility,
          correlation: analyticsResults[analyticsResults.length - 1].metrics.correlation,
          trend_strength: analyticsResults[analyticsResults.length - 1].metrics.trend_strength,
          volume_impact: analyticsResults[analyticsResults.length - 1].metrics.volume_impact,
          signals: analyticsResults[analyticsResults.length - 1].signals,
          risk: analyticsResults[analyticsResults.length - 1].risk
        };

        const alertMetrics = notifications
          .filter(n => !n.acknowledged)
          .map(n => ({
            id: n.id,
            type: n.type,
            severity: n.severity,
            message: n.message,
            timestamp: n.timestamp,
            data: n.data
          }));

        sendMessage({
          type: 'metrics_update',
          data: {
            system: systemMetrics,
            market: marketMetrics,
            trading: tradingMetrics,
            analytics: analyticsMetrics,
            alerts: alertMetrics,
            timestamp: new Date().toISOString()
          }
        });

        setIsInitialized(true);
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to integrate metrics',
          code: 'INTEGRATION_ERROR'
        });
      }
    }, config.update_interval);

    return () => clearInterval(integrationInterval);
  }, [isConnected, processedMetrics, analyticsResults, notifications, store, sendMessage, config]);

  const getIntegrationStatus = () => ({
    initialized: isInitialized,
    connected: isConnected,
    has_metrics: !!processedMetrics,
    has_analytics: !!analyticsResults,
    has_notifications: notifications.length > 0,
    error: error?.message
  });

  const getLatestMetrics = () => {
    if (!processedMetrics || !analyticsResults) return null;

    return {
      system: {
        health: processedMetrics.system.health_score > 0.8 ? 'healthy' :
               processedMetrics.system.health_score > 0.6 ? 'degraded' : 'critical',
        scores: {
          health: processedMetrics.system.health_score,
          performance: processedMetrics.system.performance_score,
          resources: processedMetrics.system.resource_score,
          services: processedMetrics.system.service_score
        }
      },
      market: {
        status: processedMetrics.market.efficiency_score > 0.8 ? 'active' :
               processedMetrics.market.efficiency_score > 0.6 ? 'inactive' : 'error',
        scores: {
          efficiency: processedMetrics.market.efficiency_score,
          liquidity: processedMetrics.market.liquidity_score,
          volatility: processedMetrics.market.volatility_score,
          sentiment: processedMetrics.market.sentiment_score
        }
      },
      trading: {
        performance: {
          execution: processedMetrics.trading.execution_score,
          risk: processedMetrics.trading.risk_score,
          profit: processedMetrics.trading.profit_score,
          strategy: processedMetrics.trading.strategy_score
        },
        analytics: {
          volatility: analyticsResults[analyticsResults.length - 1].metrics.volatility,
          correlation: analyticsResults[analyticsResults.length - 1].metrics.correlation,
          trend_strength: analyticsResults[analyticsResults.length - 1].metrics.trend_strength,
          volume_impact: analyticsResults[analyticsResults.length - 1].metrics.volume_impact
        }
      }
    };
  };

  return {
    isInitialized,
    error,
    getIntegrationStatus,
    getLatestMetrics
  };
};
