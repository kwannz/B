import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMetricsWebSocket } from './useMetricsWebSocket';
import { useMetricsStore } from './useMetricsStore';

interface SubscriptionConfig {
  ws_url: string;
  channels: {
    system: boolean;
    market: boolean;
    trading: boolean;
  };
  update_interval: number;
  batch_size: number;
}

interface MetricsUpdate {
  type: 'system' | 'market' | 'trading';
  data: Record<string, any>;
  timestamp: string;
}

export const useMetricsSubscription = (config: SubscriptionConfig) => {
  const [updates, setUpdates] = useState<MetricsUpdate[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const store = useMetricsStore();
  const { isConnected, sendMessage } = useMetricsWebSocket({
    url: config.ws_url,
    channels: config.channels,
    reconnect_interval: 5000,
    max_reconnect_attempts: 5
  });

  useEffect(() => {
    if (!isConnected) return;

    const subscriptionInterval = setInterval(() => {
      try {
        const batchUpdates: MetricsUpdate[] = [];

        const processSystemMetrics = () => {
          const latency = store.system.performance.api_latency[
            store.system.performance.api_latency.length - 1
          ];
          const errorRate = store.system.performance.error_rate[
            store.system.performance.error_rate.length - 1
          ];
          const cpuUsage = store.system.resources.cpu_usage[
            store.system.resources.cpu_usage.length - 1
          ];
          const memoryUsage = store.system.resources.memory_usage[
            store.system.resources.memory_usage.length - 1
          ];

          batchUpdates.push({
            type: 'system',
            timestamp: new Date().toISOString(),
            data: {
              performance: {
                latency,
                error_rate: errorRate,
                uptime: store.system.performance.uptime
              },
              resources: {
                cpu_usage: cpuUsage,
                memory_usage: memoryUsage,
                disk_usage: store.system.resources.disk_usage[
                  store.system.resources.disk_usage.length - 1
                ],
                network_bandwidth: store.system.resources.network_bandwidth[
                  store.system.resources.network_bandwidth.length - 1
                ]
              }
            }
          });
        };

        const processMarketMetrics = () => {
          batchUpdates.push({
            type: 'market',
            timestamp: new Date().toISOString(),
            data: {
              price_updates: store.market.data.price_updates,
              trade_volume: store.market.data.trade_volume,
              liquidity_score: store.market.data.liquidity_score,
              volatility: store.market.data.volatility,
              signals: {
                buy_pressure: store.market.signals.buy_pressure,
                sell_pressure: store.market.signals.sell_pressure,
                momentum: store.market.signals.momentum,
                trend: store.market.signals.trend
              }
            }
          });
        };

        const processTradingMetrics = () => {
          batchUpdates.push({
            type: 'trading',
            timestamp: new Date().toISOString(),
            data: {
              performance: {
                success_rate: store.trading.performance.success_rate,
                profit_loss: store.trading.performance.profit_loss,
                average_return: store.trading.performance.average_return,
                sharpe_ratio: store.trading.performance.sharpe_ratio
              },
              risk: {
                exposure: store.trading.risk.exposure,
                drawdown: store.trading.risk.drawdown,
                var_95: store.trading.risk.var_95,
                beta: store.trading.risk.beta
              },
              operations: {
                active_orders: store.trading.operations.active_orders,
                filled_orders: store.trading.operations.filled_orders,
                canceled_orders: store.trading.operations.canceled_orders,
                error_rate: store.trading.operations.error_rate
              }
            }
          });
        };

        if (config.channels.system) processSystemMetrics();
        if (config.channels.market) processMarketMetrics();
        if (config.channels.trading) processTradingMetrics();

        if (batchUpdates.length > 0) {
          setUpdates(prev => [...batchUpdates, ...prev].slice(0, config.batch_size));
          sendMessage({
            type: 'metrics_batch',
            data: batchUpdates,
            timestamp: new Date().toISOString()
          });
        }

        setIsSubscribed(true);
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to process metrics subscription',
          code: 'SUBSCRIPTION_ERROR'
        });
        setIsSubscribed(false);
      }
    }, config.update_interval);

    return () => clearInterval(subscriptionInterval);
  }, [isConnected, store, config, sendMessage]);

  const getLatestUpdate = (type?: 'system' | 'market' | 'trading') => {
    if (!type) return updates[0] || null;
    return updates.find(update => update.type === type) || null;
  };

  const getUpdatesByType = (type: 'system' | 'market' | 'trading') =>
    updates.filter(update => update.type === type);

  const getUpdateHistory = (limit?: number) =>
    limit ? updates.slice(0, limit) : updates;

  const getSubscriptionStatus = () => ({
    is_subscribed: isSubscribed,
    is_connected: isConnected,
    channels: config.channels,
    update_interval: config.update_interval,
    batch_size: config.batch_size,
    total_updates: updates.length,
    error: error?.message
  });

  const clearUpdateHistory = () => {
    setUpdates([]);
  };

  return {
    updates,
    error,
    isSubscribed,
    getLatestUpdate,
    getUpdatesByType,
    getUpdateHistory,
    getSubscriptionStatus,
    clearUpdateHistory
  };
};
