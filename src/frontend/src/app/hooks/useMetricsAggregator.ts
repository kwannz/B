import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { usePerformanceAnalytics } from './usePerformanceAnalytics';
import { useSystemMonitoring } from './useSystemMonitoring';
import { useMarketDataMonitoring } from './useMarketDataMonitoring';

interface AggregatedMetrics {
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
}

interface MetricsAlert {
  id: string;
  type: 'system' | 'market' | 'trading';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  metrics: Record<string, number>;
}

interface AggregatorConfig {
  update_interval: number;
  alert_thresholds: {
    system_latency: number;
    error_rate: number;
    resource_usage: number;
    price_delay: number;
    trade_volume: number;
    drawdown: number;
  };
}

export const useMetricsAggregator = (config: AggregatorConfig) => {
  const [metrics, setMetrics] = useState<AggregatedMetrics | null>(null);
  const [alerts, setAlerts] = useState<MetricsAlert[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [isAggregating, setIsAggregating] = useState(false);

  const { metrics: performanceMetrics } = usePerformanceAnalytics({
    update_interval: config.update_interval,
    data_points: 100,
    thresholds: {
      latency: config.alert_thresholds.system_latency,
      execution_time: config.alert_thresholds.system_latency * 2,
      error_rate: config.alert_thresholds.error_rate,
      resource_usage: config.alert_thresholds.resource_usage
    }
  });

  const { metrics: systemMetrics } = useSystemMonitoring({
    alert_thresholds: {
      api_latency: config.alert_thresholds.system_latency,
      execution_time: config.alert_thresholds.system_latency * 2,
      error_rate: config.alert_thresholds.error_rate,
      resource_usage: config.alert_thresholds.resource_usage
    },
    update_interval: config.update_interval
  });

  const { health: marketHealth } = useMarketDataMonitoring({
    symbol: 'SOL/USD',
    alert_thresholds: {
      price_change: 0.05,
      volume_spike: config.alert_thresholds.trade_volume,
      liquidity_drop: 0.3,
      volatility_surge: 2
    },
    update_interval: config.update_interval
  });

  useEffect(() => {
    if (!performanceMetrics || !systemMetrics || !marketHealth) return;

    const aggregationInterval = setInterval(() => {
      try {
        setIsAggregating(true);

        const aggregateMetrics = () => {
          const systemHealth = systemMetrics.errors.total_errors > 
            config.alert_thresholds.error_rate * 2 ? 'critical' :
            systemMetrics.errors.total_errors > 
            config.alert_thresholds.error_rate ? 'degraded' : 'healthy';

          return {
            system: {
              health: systemHealth,
              performance: {
                api_latency: performanceMetrics.system.api_latency[
                  performanceMetrics.system.api_latency.length - 1
                ],
                execution_time: performanceMetrics.system.execution_time[
                  performanceMetrics.system.execution_time.length - 1
                ],
                error_rate: systemMetrics.errors.total_errors / 
                  config.update_interval * 1000,
                uptime: 100 - (systemMetrics.errors.total_errors / 1000)
              },
              resources: {
                cpu_usage: systemMetrics.resources.cpu_usage,
                memory_usage: systemMetrics.resources.memory_usage,
                disk_usage: systemMetrics.resources.disk_usage,
                network_bandwidth: systemMetrics.resources.network_bandwidth
              }
            },
            market: {
              status: marketHealth.status === 'healthy' ? 'active' : 
                     marketHealth.status === 'warning' ? 'inactive' : 'error',
              data: {
                price_updates: performanceMetrics.market.price_updates,
                trade_volume: performanceMetrics.market.trade_volume,
                liquidity_score: marketHealth.liquidity_score,
                volatility: marketHealth.volatility_score
              },
              signals: {
                buy_pressure: performanceMetrics.trading.orders_executed * 
                  (performanceMetrics.trading.profit_loss > 0 ? 1 : -1),
                sell_pressure: performanceMetrics.trading.orders_executed * 
                  (performanceMetrics.trading.profit_loss < 0 ? 1 : -1),
                momentum: performanceMetrics.analysis.signal_accuracy * 
                  performanceMetrics.trading.execution_success_rate / 100,
                trend: performanceMetrics.trading.profit_loss > 0 ? 'bullish' :
                       performanceMetrics.trading.profit_loss < 0 ? 'bearish' : 
                       'neutral'
              }
            },
            trading: {
              performance: {
                success_rate: performanceMetrics.trading.execution_success_rate,
                profit_loss: performanceMetrics.trading.profit_loss,
                average_return: performanceMetrics.trading.profit_loss / 
                  Math.max(1, performanceMetrics.trading.orders_executed),
                sharpe_ratio: performanceMetrics.analysis.efficiency_score
              },
              risk: {
                exposure: performanceMetrics.analysis.risk_score,
                drawdown: Math.abs(performanceMetrics.trading.profit_loss) / 
                  performanceMetrics.trading.orders_executed,
                var_95: performanceMetrics.analysis.risk_score * 
                  performanceMetrics.trading.average_slippage,
                beta: performanceMetrics.analysis.strategy_performance / 100
              },
              operations: {
                active_orders: performanceMetrics.trading.orders_executed,
                filled_orders: performanceMetrics.trading.orders_executed * 
                  (performanceMetrics.trading.execution_success_rate / 100),
                canceled_orders: performanceMetrics.trading.orders_executed * 
                  (1 - performanceMetrics.trading.execution_success_rate / 100),
                error_rate: (1 - performanceMetrics.trading.execution_success_rate / 100)
              }
            }
          };
        };

        const generateAlerts = (aggregatedMetrics: AggregatedMetrics) => {
          const newAlerts: MetricsAlert[] = [];
          const timestamp = new Date().toISOString();

          if (aggregatedMetrics.system.performance.api_latency > 
              config.alert_thresholds.system_latency) {
            newAlerts.push({
              id: `system-${Date.now()}`,
              type: 'system',
              severity: 'warning',
              message: `High system latency: ${
                aggregatedMetrics.system.performance.api_latency.toFixed(2)
              }ms`,
              timestamp,
              metrics: {
                latency: aggregatedMetrics.system.performance.api_latency
              }
            });
          }

          if (aggregatedMetrics.system.performance.error_rate > 
              config.alert_thresholds.error_rate) {
            newAlerts.push({
              id: `error-${Date.now()}`,
              type: 'system',
              severity: 'critical',
              message: `High error rate: ${
                aggregatedMetrics.system.performance.error_rate.toFixed(2)
              }/sec`,
              timestamp,
              metrics: {
                error_rate: aggregatedMetrics.system.performance.error_rate
              }
            });
          }

          if (aggregatedMetrics.market.data.trade_volume > 
              config.alert_thresholds.trade_volume) {
            newAlerts.push({
              id: `market-${Date.now()}`,
              type: 'market',
              severity: 'info',
              message: `High trading volume: ${
                aggregatedMetrics.market.data.trade_volume.toFixed(2)
              }`,
              timestamp,
              metrics: {
                volume: aggregatedMetrics.market.data.trade_volume
              }
            });
          }

          if (aggregatedMetrics.trading.risk.drawdown > 
              config.alert_thresholds.drawdown) {
            newAlerts.push({
              id: `trading-${Date.now()}`,
              type: 'trading',
              severity: 'critical',
              message: `High drawdown: ${
                (aggregatedMetrics.trading.risk.drawdown * 100).toFixed(2)
              }%`,
              timestamp,
              metrics: {
                drawdown: aggregatedMetrics.trading.risk.drawdown
              }
            });
          }

          setAlerts(prev => [...newAlerts, ...prev].slice(0, 100));
        };

        const newMetrics = aggregateMetrics();
        setMetrics(newMetrics);
        generateAlerts(newMetrics);
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to aggregate metrics',
          code: 'AGGREGATION_ERROR'
        });
      } finally {
        setIsAggregating(false);
      }
    }, config.update_interval);

    return () => clearInterval(aggregationInterval);
  }, [performanceMetrics, systemMetrics, marketHealth, config]);

  const getSystemMetrics = () => metrics?.system || null;

  const getMarketMetrics = () => metrics?.market || null;

  const getTradingMetrics = () => metrics?.trading || null;

  const getAlertsByType = (type: MetricsAlert['type']) =>
    alerts.filter(a => a.type === type);

  const getAlertsBySeverity = (severity: MetricsAlert['severity']) =>
    alerts.filter(a => a.severity === severity);

  const getRecentAlerts = (limit: number = 10) =>
    alerts.slice(0, limit);

  const getMetricsSummary = () => {
    if (!metrics) return null;

    return {
      system_health: metrics.system.health,
      market_status: metrics.market.status,
      trading_performance: {
        success_rate: metrics.trading.performance.success_rate,
        profit_loss: metrics.trading.performance.profit_loss,
        risk_exposure: metrics.trading.risk.exposure
      },
      alerts_summary: {
        critical: alerts.filter(a => a.severity === 'critical').length,
        warning: alerts.filter(a => a.severity === 'warning').length,
        info: alerts.filter(a => a.severity === 'info').length
      }
    };
  };

  return {
    metrics,
    alerts,
    error,
    isAggregating,
    getSystemMetrics,
    getMarketMetrics,
    getTradingMetrics,
    getAlertsByType,
    getAlertsBySeverity,
    getRecentAlerts,
    getMetricsSummary
  };
};
