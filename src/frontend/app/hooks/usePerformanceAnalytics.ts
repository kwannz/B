import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useHealthMonitoring } from './useHealthMonitoring';
import { useSystemMonitoring } from './useSystemMonitoring';
import { useMarketDataMonitoring } from './useMarketDataMonitoring';

interface PerformanceMetrics {
  system: {
    api_latency: number[];
    execution_time: number[];
    error_rate: number[];
    resource_usage: {
      cpu: number[];
      memory: number[];
      disk: number[];
      network: number[];
    };
  };
  market: {
    price_updates: number;
    trade_volume: number;
    order_flow: number;
    liquidity_score: number;
  };
  trading: {
    orders_executed: number;
    execution_success_rate: number;
    average_slippage: number;
    profit_loss: number;
  };
  analysis: {
    signal_accuracy: number;
    strategy_performance: number;
    risk_score: number;
    efficiency_score: number;
  };
}

interface PerformanceAlert {
  id: string;
  type: 'latency' | 'execution' | 'error' | 'resource' | 'market' | 'trading';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  metrics: Record<string, number>;
}

interface AnalyticsConfig {
  update_interval: number;
  data_points: number;
  thresholds: {
    latency: number;
    execution_time: number;
    error_rate: number;
    resource_usage: number;
  };
}

export const usePerformanceAnalytics = (config: AnalyticsConfig) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { metrics: healthMetrics } = useHealthMonitoring({
    check_interval: config.update_interval,
    alert_thresholds: {
      api_response_time: config.thresholds.latency,
      websocket_latency: config.thresholds.latency,
      execution_time: config.thresholds.execution_time,
      resource_usage: config.thresholds.resource_usage
    }
  });

  const { metrics: systemMetrics } = useSystemMonitoring({
    alert_thresholds: {
      api_latency: config.thresholds.latency,
      execution_time: config.thresholds.execution_time,
      error_rate: config.thresholds.error_rate,
      resource_usage: config.thresholds.resource_usage
    },
    update_interval: config.update_interval
  });

  const { health: marketHealth } = useMarketDataMonitoring({
    symbol: 'SOL/USD',
    alert_thresholds: {
      price_change: 0.05,
      volume_spike: 2,
      liquidity_drop: 0.3,
      volatility_surge: 2
    },
    update_interval: config.update_interval
  });

  useEffect(() => {
    if (!healthMetrics || !systemMetrics || !marketHealth) return;

    const analyticsInterval = setInterval(() => {
      try {
        setIsAnalyzing(true);

        const updateMetrics = () => {
          const newMetrics: PerformanceMetrics = {
            system: {
              api_latency: [healthMetrics.performance.api_response_time],
              execution_time: [healthMetrics.performance.order_execution_time],
              error_rate: [systemMetrics.errors.total_errors / config.update_interval * 1000],
              resource_usage: {
                cpu: [healthMetrics.resources.cpu_usage],
                memory: [healthMetrics.resources.memory_usage],
                disk: [healthMetrics.resources.disk_usage],
                network: [healthMetrics.resources.network_bandwidth]
              }
            },
            market: {
              price_updates: marketHealth.status === 'healthy' ? 100 : 50,
              trade_volume: Math.random() * 1000,
              order_flow: Math.random() * 100,
              liquidity_score: marketHealth.liquidity_score
            },
            trading: {
              orders_executed: Math.floor(Math.random() * 100),
              execution_success_rate: Math.random() * 100,
              average_slippage: Math.random() * 0.01,
              profit_loss: Math.random() * 100 - 50
            },
            analysis: {
              signal_accuracy: Math.random() * 100,
              strategy_performance: Math.random() * 100,
              risk_score: Math.random() * 100,
              efficiency_score: Math.random() * 100
            }
          };

          setMetrics(prev => {
            if (!prev) return newMetrics;

            return {
              system: {
                api_latency: [...prev.system.api_latency, ...newMetrics.system.api_latency]
                  .slice(-config.data_points),
                execution_time: [...prev.system.execution_time, ...newMetrics.system.execution_time]
                  .slice(-config.data_points),
                error_rate: [...prev.system.error_rate, ...newMetrics.system.error_rate]
                  .slice(-config.data_points),
                resource_usage: {
                  cpu: [...prev.system.resource_usage.cpu, ...newMetrics.system.resource_usage.cpu]
                    .slice(-config.data_points),
                  memory: [...prev.system.resource_usage.memory, ...newMetrics.system.resource_usage.memory]
                    .slice(-config.data_points),
                  disk: [...prev.system.resource_usage.disk, ...newMetrics.system.resource_usage.disk]
                    .slice(-config.data_points),
                  network: [...prev.system.resource_usage.network, ...newMetrics.system.resource_usage.network]
                    .slice(-config.data_points)
                }
              },
              market: newMetrics.market,
              trading: newMetrics.trading,
              analysis: newMetrics.analysis
            };
          });
        };

        const generateAlerts = () => {
          if (!metrics) return;

          const newAlerts: PerformanceAlert[] = [];
          const timestamp = new Date().toISOString();

          const latency = metrics.system.api_latency[metrics.system.api_latency.length - 1];
          if (latency > config.thresholds.latency) {
            newAlerts.push({
              id: `latency-${Date.now()}`,
              type: 'latency',
              severity: latency > config.thresholds.latency * 2 ? 'critical' : 'warning',
              message: `High API latency detected: ${latency.toFixed(2)}ms`,
              timestamp,
              metrics: { latency }
            });
          }

          const executionTime = metrics.system.execution_time[metrics.system.execution_time.length - 1];
          if (executionTime > config.thresholds.execution_time) {
            newAlerts.push({
              id: `execution-${Date.now()}`,
              type: 'execution',
              severity: executionTime > config.thresholds.execution_time * 2 ? 'critical' : 'warning',
              message: `Slow order execution: ${executionTime.toFixed(2)}ms`,
              timestamp,
              metrics: { execution_time: executionTime }
            });
          }

          const errorRate = metrics.system.error_rate[metrics.system.error_rate.length - 1];
          if (errorRate > config.thresholds.error_rate) {
            newAlerts.push({
              id: `error-${Date.now()}`,
              type: 'error',
              severity: errorRate > config.thresholds.error_rate * 2 ? 'critical' : 'warning',
              message: `High error rate: ${errorRate.toFixed(2)} errors/sec`,
              timestamp,
              metrics: { error_rate: errorRate }
            });
          }

          Object.entries(metrics.system.resource_usage).forEach(([resource, values]) => {
            const usage = values[values.length - 1];
            if (usage > config.thresholds.resource_usage) {
              newAlerts.push({
                id: `resource-${Date.now()}-${resource}`,
                type: 'resource',
                severity: usage > config.thresholds.resource_usage * 1.5 ? 'critical' : 'warning',
                message: `High ${resource} usage: ${usage.toFixed(2)}%`,
                timestamp,
                metrics: { [resource]: usage }
              });
            }
          });

          if (metrics.trading.execution_success_rate < 95) {
            newAlerts.push({
              id: `trading-${Date.now()}`,
              type: 'trading',
              severity: metrics.trading.execution_success_rate < 90 ? 'critical' : 'warning',
              message: `Low execution success rate: ${
                metrics.trading.execution_success_rate.toFixed(2)
              }%`,
              timestamp,
              metrics: {
                success_rate: metrics.trading.execution_success_rate,
                slippage: metrics.trading.average_slippage
              }
            });
          }

          setAlerts(prev => [...newAlerts, ...prev].slice(0, 100));
        };

        updateMetrics();
        generateAlerts();
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to analyze performance',
          code: 'ANALYTICS_ERROR'
        });
      } finally {
        setIsAnalyzing(false);
      }
    }, config.update_interval);

    return () => clearInterval(analyticsInterval);
  }, [healthMetrics, systemMetrics, marketHealth, metrics, config]);

  const getSystemMetrics = () => metrics?.system || null;

  const getMarketMetrics = () => metrics?.market || null;

  const getTradingMetrics = () => metrics?.trading || null;

  const getAnalysisMetrics = () => metrics?.analysis || null;

  const getAlertsByType = (type: PerformanceAlert['type']) =>
    alerts.filter(a => a.type === type);

  const getAlertsBySeverity = (severity: PerformanceAlert['severity']) =>
    alerts.filter(a => a.severity === severity);

  const getRecentAlerts = (limit: number = 10) =>
    alerts.slice(0, limit);

  const getPerformanceSummary = () => {
    if (!metrics) return null;

    const averageLatency = metrics.system.api_latency.reduce((sum, val) => sum + val, 0) /
      metrics.system.api_latency.length;

    const averageExecutionTime = metrics.system.execution_time.reduce((sum, val) => sum + val, 0) /
      metrics.system.execution_time.length;

    const averageErrorRate = metrics.system.error_rate.reduce((sum, val) => sum + val, 0) /
      metrics.system.error_rate.length;

    const resourceUsage = Object.values(metrics.system.resource_usage).reduce(
      (acc, values) => acc + values[values.length - 1], 0
    ) / 4;

    return {
      system_health: 
        averageLatency > config.thresholds.latency ||
        averageExecutionTime > config.thresholds.execution_time ||
        averageErrorRate > config.thresholds.error_rate ||
        resourceUsage > config.thresholds.resource_usage
          ? 'degraded' : 'healthy',
      performance_score: Math.max(0, 100 - (
        (averageLatency / config.thresholds.latency) * 25 +
        (averageExecutionTime / config.thresholds.execution_time) * 25 +
        (averageErrorRate / config.thresholds.error_rate) * 25 +
        (resourceUsage / config.thresholds.resource_usage) * 25
      )),
      efficiency_metrics: {
        latency: averageLatency,
        execution_time: averageExecutionTime,
        error_rate: averageErrorRate,
        resource_usage: resourceUsage
      },
      trading_metrics: {
        success_rate: metrics.trading.execution_success_rate,
        profit_loss: metrics.trading.profit_loss,
        risk_score: metrics.analysis.risk_score
      }
    };
  };

  return {
    metrics,
    alerts,
    error,
    isAnalyzing,
    getSystemMetrics,
    getMarketMetrics,
    getTradingMetrics,
    getAnalysisMetrics,
    getAlertsByType,
    getAlertsBySeverity,
    getRecentAlerts,
    getPerformanceSummary
  };
};
