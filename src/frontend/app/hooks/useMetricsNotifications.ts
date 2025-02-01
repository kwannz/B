import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMetricsStore } from './useMetricsStore';
import { useMetricsProcessor } from './useMetricsProcessor';
import { useMetricsAnalytics } from './useMetricsAnalytics';

interface NotificationConfig {
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
  channels: {
    browser: boolean;
    console: boolean;
    store: boolean;
  };
}

interface Notification {
  id: string;
  timestamp: string;
  type: 'system' | 'market' | 'trading';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  data: Record<string, any>;
  acknowledged: boolean;
}

export const useMetricsNotifications = (config: NotificationConfig) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const store = useMetricsStore();
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

  useEffect(() => {
    if (!processedMetrics || !analyticsResults) return;

    const notificationInterval = setInterval(() => {
      try {
        setIsMonitoring(true);

        const createNotification = (
          type: 'system' | 'market' | 'trading',
          severity: 'info' | 'warning' | 'critical',
          title: string,
          message: string,
          data: Record<string, any>
        ): Notification => ({
          id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          type,
          severity,
          title,
          message,
          data,
          acknowledged: false
        });

        const checkSystemMetrics = () => {
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

          if (latency > config.thresholds.system.latency * 2) {
            return createNotification(
              'system',
              'critical',
              'High System Latency',
              `API latency (${latency.toFixed(2)}ms) exceeds critical threshold`,
              { latency, threshold: config.thresholds.system.latency }
            );
          }

          if (errorRate > config.thresholds.system.error_rate * 2) {
            return createNotification(
              'system',
              'critical',
              'High Error Rate',
              `System error rate (${errorRate.toFixed(2)}%) is critically high`,
              { error_rate: errorRate, threshold: config.thresholds.system.error_rate }
            );
          }

          if (cpuUsage > config.thresholds.system.resource_usage ||
              memoryUsage > config.thresholds.system.resource_usage) {
            return createNotification(
              'system',
              'warning',
              'High Resource Usage',
              `System resources approaching capacity (CPU: ${cpuUsage.toFixed(2)}%, Memory: ${memoryUsage.toFixed(2)}%)`,
              { cpu_usage: cpuUsage, memory_usage: memoryUsage }
            );
          }

          return null;
        };

        const checkMarketMetrics = () => {
          const latestAnalytics = analyticsResults[analyticsResults.length - 1];
          if (!latestAnalytics) return null;

          if (Math.abs(latestAnalytics.metrics.volatility) > config.thresholds.market.price_change) {
            return createNotification(
              'market',
              'warning',
              'High Market Volatility',
              `Market volatility (${(latestAnalytics.metrics.volatility * 100).toFixed(2)}%) exceeds threshold`,
              { volatility: latestAnalytics.metrics.volatility }
            );
          }

          if (Math.abs(latestAnalytics.metrics.volume_impact) > config.thresholds.market.volume_spike) {
            return createNotification(
              'market',
              'warning',
              'Unusual Volume Activity',
              `Volume impact (${(latestAnalytics.metrics.volume_impact * 100).toFixed(2)}%) indicates unusual trading activity`,
              { volume_impact: latestAnalytics.metrics.volume_impact }
            );
          }

          if (processedMetrics.market.liquidity_score < 1 - config.thresholds.market.liquidity_drop) {
            return createNotification(
              'market',
              'critical',
              'Low Market Liquidity',
              `Market liquidity score (${(processedMetrics.market.liquidity_score * 100).toFixed(2)}%) has dropped significantly`,
              { liquidity_score: processedMetrics.market.liquidity_score }
            );
          }

          return null;
        };

        const checkTradingMetrics = () => {
          if (processedMetrics.trading.risk_score < 1 - config.thresholds.trading.drawdown) {
            return createNotification(
              'trading',
              'critical',
              'High Drawdown',
              `Current drawdown (${((1 - processedMetrics.trading.risk_score) * 100).toFixed(2)}%) exceeds risk threshold`,
              { drawdown: 1 - processedMetrics.trading.risk_score }
            );
          }

          if (processedMetrics.trading.risk_score * 100 > config.thresholds.trading.exposure) {
            return createNotification(
              'trading',
              'warning',
              'High Risk Exposure',
              `Current risk exposure (${(processedMetrics.trading.risk_score * 100).toFixed(2)}%) exceeds threshold`,
              { exposure: processedMetrics.trading.risk_score }
            );
          }

          const profitLoss = processedMetrics.trading.profit_score * 100;
          if (profitLoss < -config.thresholds.trading.loss_threshold) {
            return createNotification(
              'trading',
              'critical',
              'Significant Trading Loss',
              `Current loss (${profitLoss.toFixed(2)}%) exceeds threshold`,
              { profit_loss: profitLoss }
            );
          }

          return null;
        };

        const systemNotification = checkSystemMetrics();
        const marketNotification = checkMarketMetrics();
        const tradingNotification = checkTradingMetrics();

        const newNotifications = [
          systemNotification,
          marketNotification,
          tradingNotification
        ].filter((n): n is Notification => n !== null);

        if (newNotifications.length > 0) {
          setNotifications(prev => [...newNotifications, ...prev].slice(0, 100));

          if (config.channels.browser && 'Notification' in window) {
            newNotifications.forEach(notification => {
              if (Notification.permission === 'granted') {
                new Notification(notification.title, {
                  body: notification.message,
                  tag: notification.id
                });
              }
            });
          }

          if (config.channels.console) {
            newNotifications.forEach(notification => {
              const logMethod = notification.severity === 'critical' ? console.error :
                              notification.severity === 'warning' ? console.warn :
                              console.info;
              logMethod(`[${notification.type.toUpperCase()}] ${notification.title}:`, 
                       notification.message, notification.data);
            });
          }

          if (config.channels.store) {
            store.addAlert(newNotifications.map(notification => ({
              id: notification.id,
              type: notification.type,
              severity: notification.severity,
              message: `${notification.title}: ${notification.message}`,
              timestamp: notification.timestamp,
              metrics: notification.data
            })));
          }
        }

        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to process notifications',
          code: 'NOTIFICATION_ERROR'
        });
      } finally {
        setIsMonitoring(false);
      }
    }, config.update_interval);

    return () => clearInterval(notificationInterval);
  }, [processedMetrics, analyticsResults, store, config]);

  const acknowledgeNotification = (id: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id
          ? { ...notification, acknowledged: true }
          : notification
      )
    );
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const getUnacknowledgedNotifications = () =>
    notifications.filter(notification => !notification.acknowledged);

  const getNotificationsByType = (type: 'system' | 'market' | 'trading') =>
    notifications.filter(notification => notification.type === type);

  const getNotificationsBySeverity = (severity: 'info' | 'warning' | 'critical') =>
    notifications.filter(notification => notification.severity === severity);

  const getNotificationSummary = () => ({
    total: notifications.length,
    unacknowledged: getUnacknowledgedNotifications().length,
    by_type: {
      system: getNotificationsByType('system').length,
      market: getNotificationsByType('market').length,
      trading: getNotificationsByType('trading').length
    },
    by_severity: {
      info: getNotificationsBySeverity('info').length,
      warning: getNotificationsBySeverity('warning').length,
      critical: getNotificationsBySeverity('critical').length
    }
  });

  return {
    notifications,
    error,
    isMonitoring,
    acknowledgeNotification,
    clearNotifications,
    getUnacknowledgedNotifications,
    getNotificationsByType,
    getNotificationsBySeverity,
    getNotificationSummary
  };
};
