import { MetricsConfig } from '../hooks/useMetricsConfiguration';

export const DEBUG_CONFIG: MetricsConfig = {
  api_url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  ws_url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000',
  update_interval: 5000,
  thresholds: {
    system: {
      latency: 1000,
      error_rate: 0.05,
      resource_usage: 0.8
    },
    market: {
      price_change: 0.05,
      volume_spike: 2,
      liquidity_drop: 0.3
    },
    trading: {
      drawdown: 0.1,
      exposure: 0.8,
      loss_threshold: 0.05
    }
  },
  visualization: {
    data_points: 100,
    chart_colors: {
      primary: '#2196f3',
      secondary: '#9c27b0',
      success: '#4caf50',
      warning: '#ff9800',
      error: '#f44336'
    }
  }
};

export const DEBUG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
} as const;

export const DEBUG_CATEGORIES = {
  SYSTEM: 'system',
  MARKET: 'market',
  TRADING: 'trading',
  WALLET: 'wallet'
} as const;

export const DEBUG_RETENTION = {
  MAX_LOGS: 1000,
  MAX_AGE_MS: 24 * 60 * 60 * 1000
};

export const DEBUG_WEBSOCKET = {
  RECONNECT_ATTEMPTS: 5,
  RECONNECT_DELAY: 1000,
  PING_INTERVAL: 30000
};

export const DEBUG_EXPORT_FORMATS = {
  JSON: 'json',
  CSV: 'csv'
} as const;

export type DebugLevel = typeof DEBUG_LEVELS[keyof typeof DEBUG_LEVELS];
export type DebugCategory = typeof DEBUG_CATEGORIES[keyof typeof DEBUG_CATEGORIES];
export type DebugExportFormat = typeof DEBUG_EXPORT_FORMATS[keyof typeof DEBUG_EXPORT_FORMATS];
