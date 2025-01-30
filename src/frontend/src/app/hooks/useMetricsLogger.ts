import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMetricsStore } from './useMetricsStore';
import { useMetricsProcessor } from './useMetricsProcessor';

interface LoggerConfig {
  update_interval: number;
  retention_period: number;
  log_levels: {
    system: 'debug' | 'info' | 'warn' | 'error';
    market: 'debug' | 'info' | 'warn' | 'error';
    trading: 'debug' | 'info' | 'warn' | 'error';
  };
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

interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: 'system' | 'market' | 'trading';
  message: string;
  data: Record<string, any>;
}

export const useMetricsLogger = (config: LoggerConfig) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLogging, setIsLogging] = useState(false);

  const store = useMetricsStore();
  const { metrics } = useMetricsProcessor({
    update_interval: config.update_interval,
    window_size: Math.floor(config.retention_period / config.update_interval),
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

  useEffect(() => {
    const loggingInterval = setInterval(() => {
      try {
        setIsLogging(true);

        const logSystemMetrics = () => {
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

          const entries: LogEntry[] = [];

          if (latency > config.thresholds.system.latency) {
            entries.push({
              timestamp: new Date().toISOString(),
              level: latency > config.thresholds.system.latency * 2 ? 'error' : 'warn',
              category: 'system',
              message: `High API latency detected: ${latency}ms`,
              data: { latency, threshold: config.thresholds.system.latency }
            });
          }

          if (errorRate > config.thresholds.system.error_rate) {
            entries.push({
              timestamp: new Date().toISOString(),
              level: errorRate > config.thresholds.system.error_rate * 2 ? 'error' : 'warn',
              category: 'system',
              message: `High error rate detected: ${(errorRate * 100).toFixed(2)}%`,
              data: { error_rate: errorRate, threshold: config.thresholds.system.error_rate }
            });
          }

          if (cpuUsage > config.thresholds.system.resource_usage ||
              memoryUsage > config.thresholds.system.resource_usage) {
            entries.push({
              timestamp: new Date().toISOString(),
              level: 'warn',
              category: 'system',
              message: 'High resource usage detected',
              data: {
                cpu_usage: cpuUsage,
                memory_usage: memoryUsage,
                threshold: config.thresholds.system.resource_usage
              }
            });
          }

          return entries;
        };

        const logMarketMetrics = () => {
          const entries: LogEntry[] = [];
          const priceChange = Math.abs(
            store.market.data.price_updates[store.market.data.price_updates.length - 1] -
            store.market.data.price_updates[store.market.data.price_updates.length - 2]
          ) / store.market.data.price_updates[store.market.data.price_updates.length - 2];

          const volumeChange = store.market.data.trade_volume;
          const liquidityScore = store.market.data.liquidity_score;

          if (priceChange > config.thresholds.market.price_change) {
            entries.push({
              timestamp: new Date().toISOString(),
              level: priceChange > config.thresholds.market.price_change * 2 ? 'warn' : 'info',
              category: 'market',
              message: `Significant price change detected: ${(priceChange * 100).toFixed(2)}%`,
              data: { price_change: priceChange, threshold: config.thresholds.market.price_change }
            });
          }

          if (volumeChange > config.thresholds.market.volume_spike) {
            entries.push({
              timestamp: new Date().toISOString(),
              level: 'info',
              category: 'market',
              message: `Volume spike detected: ${volumeChange.toFixed(2)}x average`,
              data: { volume_change: volumeChange, threshold: config.thresholds.market.volume_spike }
            });
          }

          if (liquidityScore < config.thresholds.market.liquidity_drop) {
            entries.push({
              timestamp: new Date().toISOString(),
              level: 'warn',
              category: 'market',
              message: `Low liquidity detected: ${(liquidityScore * 100).toFixed(2)}%`,
              data: { liquidity: liquidityScore, threshold: config.thresholds.market.liquidity_drop }
            });
          }

          return entries;
        };

        const logTradingMetrics = () => {
          const entries: LogEntry[] = [];
          const drawdown = store.trading.risk.drawdown;
          const exposure = store.trading.risk.exposure;
          const profitLoss = store.trading.performance.profit_loss;

          if (drawdown > config.thresholds.trading.drawdown) {
            entries.push({
              timestamp: new Date().toISOString(),
              level: drawdown > config.thresholds.trading.drawdown * 2 ? 'error' : 'warn',
              category: 'trading',
              message: `High drawdown detected: ${(drawdown * 100).toFixed(2)}%`,
              data: { drawdown, threshold: config.thresholds.trading.drawdown }
            });
          }

          if (exposure > config.thresholds.trading.exposure) {
            entries.push({
              timestamp: new Date().toISOString(),
              level: exposure > config.thresholds.trading.exposure * 1.5 ? 'error' : 'warn',
              category: 'trading',
              message: `High market exposure: ${(exposure * 100).toFixed(2)}%`,
              data: { exposure, threshold: config.thresholds.trading.exposure }
            });
          }

          if (profitLoss < -config.thresholds.trading.loss_threshold) {
            entries.push({
              timestamp: new Date().toISOString(),
              level: 'warn',
              category: 'trading',
              message: `Significant loss detected: ${profitLoss.toFixed(2)}%`,
              data: { profit_loss: profitLoss, threshold: config.thresholds.trading.loss_threshold }
            });
          }

          return entries;
        };

        const newLogs = [
          ...logSystemMetrics(),
          ...logMarketMetrics(),
          ...logTradingMetrics()
        ].filter(entry => config.log_levels[entry.category] === entry.level);

        setLogs(prev => [...newLogs, ...prev].slice(0, 1000));
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to log metrics',
          code: 'LOGGING_ERROR'
        });
      } finally {
        setIsLogging(false);
      }
    }, config.update_interval);

    return () => clearInterval(loggingInterval);
  }, [store, metrics, config]);

  const getLogsByLevel = (level: 'debug' | 'info' | 'warn' | 'error') =>
    logs.filter(log => log.level === level);

  const getLogsByCategory = (category: 'system' | 'market' | 'trading') =>
    logs.filter(log => log.category === category);

  const getLatestLogs = (limit?: number) =>
    limit ? logs.slice(0, limit) : logs;

  const clearLogs = () => setLogs([]);

  const exportLogs = (format: 'json' | 'csv' = 'json') => {
    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    }

    const headers = ['timestamp', 'level', 'category', 'message'];
    const rows = logs.map(log =>
      [log.timestamp, log.level, log.category, log.message].join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  };

  return {
    logs,
    error,
    isLogging,
    getLogsByLevel,
    getLogsByCategory,
    getLatestLogs,
    clearLogs,
    exportLogs
  };
};
