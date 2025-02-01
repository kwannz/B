import { useCallback, useEffect } from 'react';
import { useMetricsStore } from '../stores/metricsStore';
import { useDebugMetrics as useDebugMetricsProvider } from '../providers/DebugMetricsProvider';
import { DEBUG_CONFIG } from '../config/debug.config';

export const useDebugMetrics = () => {
  const store = useMetricsStore();
  const provider = useDebugMetricsProvider();

  const addPerformanceMetric = useCallback((data: {
    apiLatency?: number;
    memoryUsage?: number;
    errorRate?: number;
    systemHealth?: number;
  }) => {
    store.addMetric('performance', data);
  }, [store]);

  const addTradingMetric = useCallback((data: {
    botId: string;
    status: string;
    positions?: number;
    trades?: number;
    successRate?: number;
  }) => {
    store.addMetric('trading', {
      botStatuses: { [data.botId]: data.status },
      activePositions: data.positions,
      totalTrades: data.trades,
      successRate: data.successRate
    });
  }, [store]);

  const addWalletMetric = useCallback((data: {
    address: string;
    balance: number;
    transactions?: number;
  }) => {
    store.addMetric('wallet', {
      balances: { [data.address]: data.balance },
      transactions: data.transactions,
      lastUpdate: new Date().toISOString()
    });
  }, [store]);

  const exportMetrics = useCallback(() => {
    const metrics = store.exportMetrics();
    provider.exportMetrics();
    return metrics;
  }, [store, provider]);

  const clearMetrics = useCallback(() => {
    store.clearMetrics();
    provider.clearMetrics();
  }, [store, provider]);

  const getMetricsSnapshot = useCallback(() => {
    return store.getLatestMetrics();
  }, [store]);

  useEffect(() => {
    const interval = setInterval(() => {
      const metrics = getMetricsSnapshot();
      if (window.__DEBUG_METRICS__) {
        window.__DEBUG_METRICS__.debug.updateMetrics(metrics);
      }
    }, DEBUG_CONFIG.update_interval);

    return () => clearInterval(interval);
  }, [getMetricsSnapshot]);

  return {
    addPerformanceMetric,
    addTradingMetric,
    addWalletMetric,
    exportMetrics,
    clearMetrics,
    getMetricsSnapshot,
    metrics: store.metrics
  };
};

export type UseDebugMetricsReturn = ReturnType<typeof useDebugMetrics>;
