import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMetricsStore } from './useMetricsStore';
import { useMetricsProcessor } from './useMetricsProcessor';
import { useMetricsSubscription } from './useMetricsSubscription';

interface AggregationConfig {
  update_interval: number;
  window_size: number;
  batch_size: number;
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

interface AggregatedMetrics {
  timestamp: string;
  system: {
    health: 'healthy' | 'degraded' | 'critical';
    performance: {
      avg_latency: number;
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
      price_updates: number[];
      trade_volume: number[];
      liquidity_score: number;
      volatility: number;
    };
    signals: {
      buy_pressure: number;
      sell_pressure: number;
      momentum: number;
      trend: 'up' | 'down' | 'sideways';
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

export const useMetricsAggregation = (config: AggregationConfig) => {
  const [aggregatedData, setAggregatedData] = useState<AggregatedMetrics[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [isAggregating, setIsAggregating] = useState(false);

  const store = useMetricsStore();
  const { metrics: processedMetrics } = useMetricsProcessor({
    update_interval: config.update_interval,
    window_size: config.window_size,
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

  const { updates } = useMetricsSubscription({
    ws_url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000',
    channels: {
      system: true,
      market: true,
      trading: true
    },
    update_interval: config.update_interval,
    batch_size: config.batch_size
  });

  useEffect(() => {
    if (!processedMetrics || updates.length === 0) return;

    const aggregationInterval = setInterval(() => {
      try {
        setIsAggregating(true);

        const latestSystemUpdate = updates.find(u => u.type === 'system');
        const latestMarketUpdate = updates.find(u => u.type === 'market');
        const latestTradingUpdate = updates.find(u => u.type === 'trading');

        if (!latestSystemUpdate || !latestMarketUpdate || !latestTradingUpdate) return;

        const aggregatedMetrics: AggregatedMetrics = {
          timestamp: new Date().toISOString(),
          system: {
            health: processedMetrics.system.health_score > 0.8 ? 'healthy' :
                   processedMetrics.system.health_score > 0.6 ? 'degraded' : 'critical',
            performance: {
              avg_latency: store.system.performance.api_latency.reduce((sum, val) => sum + val, 0) /
                          store.system.performance.api_latency.length,
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
              price_updates: store.market.data.price_updates,
              trade_volume: [store.market.data.trade_volume],
              liquidity_score: processedMetrics.market.liquidity_score,
              volatility: (1 - processedMetrics.market.volatility_score) * 100
            },
            signals: {
              buy_pressure: Math.max(0, processedMetrics.market.sentiment_score) * 100,
              sell_pressure: Math.max(0, -processedMetrics.market.sentiment_score) * 100,
              momentum: processedMetrics.market.sentiment_score * 100,
              trend: processedMetrics.market.trends.price > 0 ? 'up' :
                    processedMetrics.market.trends.price < 0 ? 'down' : 'sideways'
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
        };

        setAggregatedData(prev => [...prev, aggregatedMetrics].slice(-config.window_size));
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
  }, [processedMetrics, updates, store, config]);

  const getLatestAggregation = () => aggregatedData[aggregatedData.length - 1] || null;

  const getAggregationHistory = (limit?: number) =>
    limit ? aggregatedData.slice(-limit) : aggregatedData;

  const getSystemMetrics = () => {
    if (aggregatedData.length === 0) return null;
    return aggregatedData[aggregatedData.length - 1].system;
  };

  const getMarketMetrics = () => {
    if (aggregatedData.length === 0) return null;
    return aggregatedData[aggregatedData.length - 1].market;
  };

  const getTradingMetrics = () => {
    if (aggregatedData.length === 0) return null;
    return aggregatedData[aggregatedData.length - 1].trading;
  };

  const getAggregationSummary = () => {
    if (aggregatedData.length === 0) return null;

    const latest = aggregatedData[aggregatedData.length - 1];
    return {
      system_health: latest.system.health,
      market_status: latest.market.status,
      trading_performance: {
        success_rate: latest.trading.performance.success_rate,
        profit_loss: latest.trading.performance.profit_loss,
        risk_exposure: latest.trading.risk.exposure
      },
      alerts: {
        system: latest.system.health === 'critical',
        market: latest.market.status === 'error',
        trading: latest.trading.risk.drawdown > config.thresholds.trading.drawdown
      }
    };
  };

  return {
    aggregatedData,
    error,
    isAggregating,
    getLatestAggregation,
    getAggregationHistory,
    getSystemMetrics,
    getMarketMetrics,
    getTradingMetrics,
    getAggregationSummary
  };
};
