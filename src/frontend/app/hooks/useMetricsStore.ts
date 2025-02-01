import create from 'zustand';
import { ApiError } from '../api/client';
import { useMetricsAggregator } from './useMetricsAggregator';
import { useSystemMonitoring } from './useSystemMonitoring';
import { useMarketDataMonitoring } from './useMarketDataMonitoring';

interface MetricsState {
  system: {
    health: 'healthy' | 'degraded' | 'critical';
    performance: {
      api_latency: number[];
      execution_time: number[];
      error_rate: number[];
      uptime: number;
    };
    resources: {
      cpu_usage: number[];
      memory_usage: number[];
      disk_usage: number[];
      network_bandwidth: number[];
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
  alerts: Array<{
    id: string;
    type: 'system' | 'market' | 'trading';
    severity: 'info' | 'warning' | 'critical';
    message: string;
    timestamp: string;
    metrics: Record<string, number>;
  }>;
  error: ApiError | null;
  isLoading: boolean;
  updateMetrics: (metrics: Partial<MetricsState>) => void;
  addAlert: (alert: MetricsState['alerts'][0]) => void;
  clearAlerts: () => void;
  setError: (error: ApiError | null) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useMetricsStore = create<MetricsState>((set) => ({
  system: {
    health: 'healthy',
    performance: {
      api_latency: [],
      execution_time: [],
      error_rate: [],
      uptime: 100
    },
    resources: {
      cpu_usage: [],
      memory_usage: [],
      disk_usage: [],
      network_bandwidth: []
    }
  },
  market: {
    status: 'active',
    data: {
      price_updates: 0,
      trade_volume: 0,
      liquidity_score: 0,
      volatility: 0
    },
    signals: {
      buy_pressure: 0,
      sell_pressure: 0,
      momentum: 0,
      trend: 'neutral'
    }
  },
  trading: {
    performance: {
      success_rate: 0,
      profit_loss: 0,
      average_return: 0,
      sharpe_ratio: 0
    },
    risk: {
      exposure: 0,
      drawdown: 0,
      var_95: 0,
      beta: 0
    },
    operations: {
      active_orders: 0,
      filled_orders: 0,
      canceled_orders: 0,
      error_rate: 0
    }
  },
  alerts: [],
  error: null,
  isLoading: false,
  updateMetrics: (metrics) => set((state) => ({
    ...state,
    ...metrics,
    system: {
      ...state.system,
      ...metrics.system,
      performance: {
        ...state.system.performance,
        ...metrics.system?.performance,
        api_latency: [...state.system.performance.api_latency, 
          ...(metrics.system?.performance?.api_latency || [])].slice(-100),
        execution_time: [...state.system.performance.execution_time,
          ...(metrics.system?.performance?.execution_time || [])].slice(-100),
        error_rate: [...state.system.performance.error_rate,
          ...(metrics.system?.performance?.error_rate || [])].slice(-100)
      },
      resources: {
        ...state.system.resources,
        ...metrics.system?.resources,
        cpu_usage: [...state.system.resources.cpu_usage,
          ...(metrics.system?.resources?.cpu_usage || [])].slice(-100),
        memory_usage: [...state.system.resources.memory_usage,
          ...(metrics.system?.resources?.memory_usage || [])].slice(-100),
        disk_usage: [...state.system.resources.disk_usage,
          ...(metrics.system?.resources?.disk_usage || [])].slice(-100),
        network_bandwidth: [...state.system.resources.network_bandwidth,
          ...(metrics.system?.resources?.network_bandwidth || [])].slice(-100)
      }
    }
  })),
  addAlert: (alert) => set((state) => ({
    alerts: [alert, ...state.alerts].slice(0, 100)
  })),
  clearAlerts: () => set({ alerts: [] }),
  setError: (error) => set({ error }),
  setLoading: (isLoading) => set({ isLoading })
}));

export const useMetricsSync = (config: {
  update_interval: number;
  alert_thresholds: {
    system_latency: number;
    error_rate: number;
    resource_usage: number;
    price_delay: number;
    trade_volume: number;
    drawdown: number;
  };
}) => {
  const store = useMetricsStore();
  const { metrics: aggregatedMetrics } = useMetricsAggregator(config);
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
    if (!aggregatedMetrics || !systemMetrics || !marketHealth) return;

    store.updateMetrics({
      system: aggregatedMetrics.system,
      market: aggregatedMetrics.market,
      trading: aggregatedMetrics.trading
    });
  }, [aggregatedMetrics, systemMetrics, marketHealth]);

  return store;
};
