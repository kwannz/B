import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMetricsManager } from './useMetricsManager';
import { useMetricsAnalytics } from './useMetricsAnalytics';
import { useMetricsNotifications } from './useMetricsNotifications';
import { useMetricsWebSocket } from './useMetricsWebSocket';
import { useMetricsIntegration } from './useMetricsIntegration';

interface MonitoringConfig {
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
}

export const useMetricsMonitoring = (config: MonitoringConfig) => {
  const [error, setError] = useState<ApiError | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const { store, processedMetrics, datasets } = useMetricsManager({
    update_interval: config.update_interval,
    retention_period: config.update_interval * 100,
    alert_thresholds: config.thresholds,
    visualization: config.visualization,
    export: {
      format: 'json',
      metrics: {
        system: true,
        market: true,
        trading: true
      }
    }
  });

  const { results: analyticsResults } = useMetricsAnalytics({
    update_interval: config.update_interval,
    window_size: 100,
    thresholds: {
      volatility: config.thresholds.market.price_change,
      correlation: 0.7,
      trend_strength: 0.3,
      volume_impact: config.thresholds.market.volume_spike
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

  const { isConnected } = useMetricsWebSocket({
    url: config.ws_url,
    channels: {
      system: true,
      market: true,
      trading: true
    },
    reconnect_interval: 5000,
    max_reconnect_attempts: 5
  });

  const { isInitialized } = useMetricsIntegration({
    api_url: config.api_url,
    ws_url: config.ws_url,
    update_interval: config.update_interval,
    thresholds: config.thresholds
  });

  useEffect(() => {
    if (!isConnected || !isInitialized || !processedMetrics || !analyticsResults) return;

    const monitoringInterval = setInterval(() => {
      try {
        setIsMonitoring(true);

        const systemHealth = processedMetrics.system.health_score > 0.8 ? 'healthy' :
                           processedMetrics.system.health_score > 0.6 ? 'degraded' : 'critical';

        const marketStatus = processedMetrics.market.efficiency_score > 0.8 ? 'active' :
                           processedMetrics.market.efficiency_score > 0.6 ? 'inactive' : 'error';

        const latestAnalytics = analyticsResults[analyticsResults.length - 1];

        const monitoringData = {
          timestamp: new Date().toISOString(),
          system: {
            health: systemHealth,
            metrics: {
              latency: store.system.performance.api_latency[
                store.system.performance.api_latency.length - 1
              ],
              error_rate: store.system.performance.error_rate[
                store.system.performance.error_rate.length - 1
              ],
              resource_usage: Math.max(
                store.system.resources.cpu_usage[store.system.resources.cpu_usage.length - 1],
                store.system.resources.memory_usage[store.system.resources.memory_usage.length - 1]
              )
            },
            alerts: notifications.filter(n => n.type === 'system' && !n.acknowledged)
          },
          market: {
            status: marketStatus,
            metrics: {
              price_volatility: latestAnalytics.metrics.volatility,
              volume_impact: latestAnalytics.metrics.volume_impact,
              liquidity: processedMetrics.market.liquidity_score
            },
            signals: latestAnalytics.signals,
            alerts: notifications.filter(n => n.type === 'market' && !n.acknowledged)
          },
          trading: {
            performance: {
              success_rate: processedMetrics.trading.execution_score * 100,
              profit_loss: processedMetrics.trading.profit_score * 100,
              drawdown: (1 - processedMetrics.trading.risk_score) * 100
            },
            risk: latestAnalytics.risk,
            alerts: notifications.filter(n => n.type === 'trading' && !n.acknowledged)
          }
        };

        store.updateMetrics({
          system: {
            health: monitoringData.system.health,
            performance: {
              api_latency: [monitoringData.system.metrics.latency],
              execution_time: store.system.performance.execution_time,
              error_rate: [monitoringData.system.metrics.error_rate],
              uptime: store.system.performance.uptime
            },
            resources: {
              cpu_usage: store.system.resources.cpu_usage,
              memory_usage: store.system.resources.memory_usage,
              disk_usage: store.system.resources.disk_usage,
              network_bandwidth: store.system.resources.network_bandwidth
            }
          },
          market: {
            status: monitoringData.market.status,
            data: {
              price_updates: processedMetrics.market.efficiency_score * 100,
              trade_volume: processedMetrics.market.liquidity_score * 1000,
              liquidity_score: monitoringData.market.metrics.liquidity,
              volatility: monitoringData.market.metrics.price_volatility * 100
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
              success_rate: monitoringData.trading.performance.success_rate,
              profit_loss: monitoringData.trading.performance.profit_loss,
              average_return: processedMetrics.trading.profit_score * 10,
              sharpe_ratio: processedMetrics.trading.strategy_score * 3
            },
            risk: {
              exposure: processedMetrics.trading.risk_score * 100,
              drawdown: monitoringData.trading.performance.drawdown,
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

        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to monitor metrics',
          code: 'MONITORING_ERROR'
        });
      } finally {
        setIsMonitoring(false);
      }
    }, config.update_interval);

    return () => clearInterval(monitoringInterval);
  }, [isConnected, isInitialized, processedMetrics, analyticsResults, notifications, store, config]);

  const getMonitoringStatus = () => ({
    is_monitoring: isMonitoring,
    is_connected: isConnected,
    is_initialized: isInitialized,
    has_metrics: !!processedMetrics,
    has_analytics: !!analyticsResults,
    has_notifications: notifications.length > 0,
    error: error?.message
  });

  const getSystemStatus = () => {
    if (!processedMetrics) return null;

    return {
      health: processedMetrics.system.health_score > 0.8 ? 'healthy' :
              processedMetrics.system.health_score > 0.6 ? 'degraded' : 'critical',
      scores: {
        health: processedMetrics.system.health_score,
        performance: processedMetrics.system.performance_score,
        resources: processedMetrics.system.resource_score
      },
      alerts: notifications.filter(n => n.type === 'system' && !n.acknowledged).length
    };
  };

  const getMarketStatus = () => {
    if (!processedMetrics || !analyticsResults) return null;

    const latestAnalytics = analyticsResults[analyticsResults.length - 1];

    return {
      status: processedMetrics.market.efficiency_score > 0.8 ? 'active' :
              processedMetrics.market.efficiency_score > 0.6 ? 'inactive' : 'error',
      metrics: {
        efficiency: processedMetrics.market.efficiency_score,
        liquidity: processedMetrics.market.liquidity_score,
        volatility: latestAnalytics.metrics.volatility,
        volume_impact: latestAnalytics.metrics.volume_impact
      },
      signals: latestAnalytics.signals,
      alerts: notifications.filter(n => n.type === 'market' && !n.acknowledged).length
    };
  };

  const getTradingStatus = () => {
    if (!processedMetrics || !analyticsResults) return null;

    return {
      performance: {
        success_rate: processedMetrics.trading.execution_score * 100,
        profit_loss: processedMetrics.trading.profit_score * 100,
        drawdown: (1 - processedMetrics.trading.risk_score) * 100
      },
      risk: analyticsResults[analyticsResults.length - 1].risk,
      alerts: notifications.filter(n => n.type === 'trading' && !n.acknowledged).length
    };
  };

  return {
    error,
    isMonitoring,
    getMonitoringStatus,
    getSystemStatus,
    getMarketStatus,
    getTradingStatus
  };
};
