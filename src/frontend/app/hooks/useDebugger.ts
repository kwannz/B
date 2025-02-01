import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMetricsLogger } from './useMetricsLogger';
import { useMetricsAnalyzer } from './useMetricsAnalyzer';

interface DebugConfig {
  enabled: boolean;
  log_level: 'debug' | 'info' | 'warn' | 'error';
  retention_period: number;
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

interface DebugEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: 'system' | 'market' | 'trading' | 'wallet';
  message: string;
  data: Record<string, any>;
  stack?: string;
}

export const useDebugger = (config: DebugConfig) => {
  const [logs, setLogs] = useState<DebugEntry[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [isDebugging, setIsDebugging] = useState(false);

  const logger = useMetricsLogger({
    update_interval: config.update_interval,
    retention_period: config.retention_period,
    log_levels: {
      system: config.log_level,
      market: config.log_level,
      trading: config.log_level
    },
    thresholds: config.thresholds
  });

  const analyzer = useMetricsAnalyzer({
    update_interval: config.update_interval,
    window_size: Math.floor(config.retention_period / config.update_interval),
    thresholds: config.thresholds
  });

  useEffect(() => {
    if (!config.enabled) return;

    const debugInterval = setInterval(() => {
      try {
        setIsDebugging(true);

        const analysis = analyzer.getLatestAnalysis();
        if (!analysis) return;

        const debugEntries: DebugEntry[] = [];

        const checkSystemHealth = () => {
          if (analysis.system.health_score < 0.8) {
            debugEntries.push({
              timestamp: new Date().toISOString(),
              level: analysis.system.health_score < 0.6 ? 'error' : 'warn',
              category: 'system',
              message: `System health degraded: ${(analysis.system.health_score * 100).toFixed(2)}%`,
              data: {
                health_score: analysis.system.health_score,
                latency: analysis.system.performance_issues.find(i => i.type === 'high_latency')?.value,
                error_rate: analysis.system.performance_issues.find(i => i.type === 'high_error_rate')?.value,
                resource_usage: analysis.system.resource_usage
              }
            });
          }
        };

        const checkMarketConditions = () => {
          if (analysis.market.volatility > config.thresholds.market.price_change) {
            debugEntries.push({
              timestamp: new Date().toISOString(),
              level: 'warn',
              category: 'market',
              message: `High market volatility: ${(analysis.market.volatility * 100).toFixed(2)}%`,
              data: {
                volatility: analysis.market.volatility,
                trend: analysis.market.signals.trend,
                strength: analysis.market.signals.strength,
                volume_profile: analysis.market.signals.volume_profile
              }
            });
          }
        };

        const checkTradingStatus = () => {
          if (analysis.trading.risk_metrics.max_drawdown > config.thresholds.trading.drawdown) {
            debugEntries.push({
              timestamp: new Date().toISOString(),
              level: 'error',
              category: 'trading',
              message: `High drawdown detected: ${(analysis.trading.risk_metrics.max_drawdown * 100).toFixed(2)}%`,
              data: {
                drawdown: analysis.trading.risk_metrics.max_drawdown,
                var_95: analysis.trading.risk_metrics.var_95,
                sharpe_ratio: analysis.trading.risk_metrics.sharpe_ratio,
                sortino_ratio: analysis.trading.risk_metrics.sortino_ratio
              }
            });
          }
        };

        checkSystemHealth();
        checkMarketConditions();
        checkTradingStatus();

        setLogs(prev => [...debugEntries, ...prev].slice(0, 1000));
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to collect debug information',
          code: 'DEBUG_ERROR'
        });
      } finally {
        setIsDebugging(false);
      }
    }, config.update_interval);

    return () => clearInterval(debugInterval);
  }, [config, analyzer]);

  const getLogsByLevel = (level: 'debug' | 'info' | 'warn' | 'error') =>
    logs.filter(log => log.level === level);

  const getLogsByCategory = (category: 'system' | 'market' | 'trading' | 'wallet') =>
    logs.filter(log => log.category === category);

  const getLatestLogs = (limit?: number) =>
    limit ? logs.slice(0, limit) : logs;

  const clearLogs = () => setLogs([]);

  const addCustomLog = (entry: Omit<DebugEntry, 'timestamp'>) => {
    setLogs(prev => [{
      ...entry,
      timestamp: new Date().toISOString()
    }, ...prev].slice(0, 1000));
  };

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

  const getDebugSummary = () => {
    const errorCount = logs.filter(log => log.level === 'error').length;
    const warningCount = logs.filter(log => log.level === 'warn').length;
    const systemIssues = logs.filter(log => log.category === 'system').length;
    const marketIssues = logs.filter(log => log.category === 'market').length;
    const tradingIssues = logs.filter(log => log.category === 'trading').length;

    return {
      total_logs: logs.length,
      error_count: errorCount,
      warning_count: warningCount,
      issues_by_category: {
        system: systemIssues,
        market: marketIssues,
        trading: tradingIssues
      },
      latest_error: logs.find(log => log.level === 'error'),
      latest_warning: logs.find(log => log.level === 'warn')
    };
  };

  return {
    logs,
    error,
    isDebugging,
    getLogsByLevel,
    getLogsByCategory,
    getLatestLogs,
    clearLogs,
    addCustomLog,
    exportLogs,
    getDebugSummary
  };
};
