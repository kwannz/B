import { create } from 'zustand';

interface MetricsConfig {
  api_url: string;
  ws_url: string;
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
  visualization: {
    data_points: number;
    chart_colors: {
      primary: string;
      secondary: string;
      success: string;
      warning: string;
      error: string;
    };
  };
}

interface ConfigStore {
  config: MetricsConfig;
  updateConfig: (newConfig: Partial<MetricsConfig>) => void;
  resetConfig: () => void;
}

const DEFAULT_CONFIG: MetricsConfig = {
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

export const useMetricsConfiguration = create<ConfigStore>((set) => ({
  config: DEFAULT_CONFIG,
  updateConfig: (newConfig) =>
    set((state) => ({
      config: {
        ...state.config,
        ...newConfig,
        thresholds: {
          ...state.config.thresholds,
          ...newConfig.thresholds
        },
        visualization: {
          ...state.config.visualization,
          ...newConfig.visualization
        }
      }
    })),
  resetConfig: () => set({ config: DEFAULT_CONFIG })
}));

export const getDefaultConfig = () => DEFAULT_CONFIG;

export type { MetricsConfig };
