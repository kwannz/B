import * as React from 'react';
import { createContext, useContext, type ReactNode } from 'react';
import { useMetricsStore } from './useMetricsStore';
import { useMetricsProcessor } from './useMetricsProcessor';
import { useMetricsAnalytics } from './useMetricsAnalytics';
import { useMetricsNotifications } from './useMetricsNotifications';
import { useMetricsWebSocket } from './useMetricsWebSocket';
import { useMetricsIntegration } from './useMetricsIntegration';
import { useMetricsMonitoring } from './useMetricsMonitoring';
import { useMetricsValidation } from './useMetricsValidation';
import { useMetricsSubscription } from './useMetricsSubscription';
import { useMetricsAggregation } from './useMetricsAggregation';
import { useMetricsExporter } from './useMetricsExporter';
import type { MetricsConfig } from '../../types/metrics';



interface MetricsContextValue {
  config: MetricsConfig;
  store: ReturnType<typeof useMetricsStore>;
  processor: ReturnType<typeof useMetricsProcessor>;
  analytics: ReturnType<typeof useMetricsAnalytics>;
  notifications: ReturnType<typeof useMetricsNotifications>;
  websocket: ReturnType<typeof useMetricsWebSocket>;
  integration: ReturnType<typeof useMetricsIntegration>;
  monitoring: ReturnType<typeof useMetricsMonitoring>;
  validation: ReturnType<typeof useMetricsValidation>;
  subscription: ReturnType<typeof useMetricsSubscription>;
  aggregation: ReturnType<typeof useMetricsAggregation>;
  exporter: ReturnType<typeof useMetricsExporter>;
}

const MetricsContext = createContext<MetricsContextValue | null>(null);

export const MetricsProvider = ({ children, config }: { children: ReactNode; config: MetricsConfig }) => {
  const store = useMetricsStore();
  const processor = useMetricsProcessor({
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

  const analytics = useMetricsAnalytics({
    update_interval: config.update_interval,
    window_size: 100,
    thresholds: {
      volatility: config.thresholds.market.price_change,
      correlation: 0.7,
      trend_strength: 0.3,
      volume_impact: config.thresholds.market.volume_spike
    }
  });

  const notifications = useMetricsNotifications({
    update_interval: config.update_interval,
    thresholds: config.thresholds,
    channels: {
      browser: true,
      console: true,
      store: true
    }
  });

  const websocket = useMetricsWebSocket({
    url: config.ws_url,
    channels: {
      system: true,
      market: true,
      trading: true
    },
    reconnect_interval: 5000,
    max_reconnect_attempts: 5
  });

  const integration = useMetricsIntegration({
    api_url: config.api_url,
    ws_url: config.ws_url,
    update_interval: config.update_interval,
    thresholds: config.thresholds
  });

  const monitoring = useMetricsMonitoring({
    api_url: config.api_url,
    ws_url: config.ws_url,
    update_interval: config.update_interval,
    thresholds: config.thresholds,
    visualization: config.visualization
  });

  const validation = useMetricsValidation({
    update_interval: config.update_interval,
    thresholds: {
      data_quality: {
        missing_data_ratio: 0.1,
        stale_data_age: 300000,
        anomaly_zscore: 3
      },
      performance: {
        latency: config.thresholds.system.latency,
        error_rate: config.thresholds.system.error_rate,
        timeout: 30000
      },
      consistency: {
        price_deviation: config.thresholds.market.price_change,
        volume_deviation: config.thresholds.market.volume_spike,
        timestamp_gap: 60000
      }
    }
  });

  const subscription = useMetricsSubscription({
    ws_url: config.ws_url,
    channels: {
      system: true,
      market: true,
      trading: true
    },
    update_interval: config.update_interval,
    batch_size: 100
  });

  const aggregation = useMetricsAggregation({
    update_interval: config.update_interval,
    window_size: 100,
    batch_size: 100,
    thresholds: config.thresholds
  });

  const exporter = useMetricsExporter();

  const value = React.useMemo<MetricsContextValue>(() => ({
    config,
    store,
    processor,
    analytics,
    notifications,
    websocket,
    integration,
    monitoring,
    validation,
    subscription,
    aggregation,
    exporter
  }), [
    config,
    store,
    processor,
    analytics,
    notifications,
    websocket,
    integration,
    monitoring,
    validation,
    subscription,
    aggregation,
    exporter
  ]);

  return React.createElement(MetricsContext.Provider, { value }, children);
};

export function useMetrics(): MetricsContextValue {
  const context = useContext(MetricsContext);
  if (context === null) {
    throw new Error('useMetrics must be used within a MetricsProvider');
  }
  return context;
}
