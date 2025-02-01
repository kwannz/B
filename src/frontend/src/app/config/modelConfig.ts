j/**
 * 模型配置
 */

export interface ModelConfig {
  name: string;
  provider: 'ollama';
  modelId: string;
  version: string;
  parameters: {
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
  };
}

export const modelConfig: ModelConfig = {
  name: 'DeepSeek',
  provider: 'ollama',
  modelId: 'deepseek',
  version: 'r1-1.5b',
  parameters: {
    temperature: 0.7,
    top_p: 0.9,
    max_tokens: 2048,
    presence_penalty: 0,
    frequency_penalty: 0
  }
};

export const debugConfig = {
  // 调试模式下的模型参数
  debugParameters: {
    ...modelConfig.parameters,
    temperature: 0.5, // 降低随机性以获得更稳定的输出
    max_tokens: 4096  // 增加输出长度以获取更详细的调试信息
  },
  
  // 性能监控阈值
  performanceThresholds: {
    cpuUsage: 80,      // CPU使用率警告阈值 (%)
    memoryUsage: 90,   // 内存使用率警告阈值 (%)
    apiLatency: 1000,  // API延迟警告阈值 (ms)
    maxQueueSize: 100  // 最大队列大小
  },
  
  // 日志配置
  logging: {
    maxLogs: 1000,     // 最大日志条数
    retentionDays: 7,  // 日志保留天数
    batchSize: 50,     // 日志批处理大小
    exportFormats: ['json', 'csv'] as const
  },
  
  // 指标采集配置
  metrics: {
    collectionInterval: 5000,  // 指标采集间隔 (ms)
    retentionPeriod: 3600,    // 指标保留时间 (s)
    maxDataPoints: 720,       // 最大数据点数量
    aggregationWindow: 60     // 聚合窗口大小 (s)
  }
};

// 调试类别
export const debugCategories = {
  MODEL: 'Model',
  TRADING: 'Trading',
  WALLET: 'Wallet',
  API: 'API',
  PERFORMANCE: 'Performance',
  SYSTEM: 'System'
} as const;

// 调试级别
export const debugLevels = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
} as const;

// 调试工具配置
export const toolConfig = {
  // 工具栏位置
  toolbar: {
    position: 'bottom-right',
    offset: {
      x: 16,
      y: 16
    }
  },
  
  // 面板大小
  panel: {
    minWidth: 600,
    maxWidth: 1200,
    minHeight: 400,
    maxHeight: 800
  },
  
  // 图表配置
  charts: {
    defaultTimeRange: 3600,  // 默认时间范围 (s)
    refreshInterval: 1000,   // 刷新间隔 (ms)
    animations: true,        // 启用动画
    theme: {
      primary: '#1976d2',
      secondary: '#dc004e',
      success: '#4caf50',
      warning: '#ff9800',
      error: '#f44336'
    }
  }
};
