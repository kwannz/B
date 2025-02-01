export interface ProcessedMetrics {
  system: {
    health_score: number;
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
    efficiency_score: number;
    liquidity_score: number;
    volatility_score: number;
    sentiment_score: number;
    trends: {
      price: string;
      volume: string;
      momentum: string;
    };
  };
  trading: {
    execution_score: number;
    profit_score: number;
    strategy_score: number;
    risk_score: number;
  };
}

export interface MetricsStore {
  system: {
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
  alerts: Array<{
    id: string;
    type: 'info' | 'warning' | 'error';
    message: string;
    timestamp: number;
  }>;
}

export interface MetricsConfig {
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
