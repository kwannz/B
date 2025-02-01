import { create } from 'zustand';
import { DEBUG_CONFIG } from '../config/debug.config';
import type { DebugMetrics } from '../../types/debug';

interface DebugMetricsState {
  metrics: DebugMetrics;
  addPerformanceMetric: (metric: { apiLatency: number; errorRate: number; systemHealth: number; memoryUsage?: number }) => void;
}

export const debugMetricsStore = create<DebugMetricsState>((set) => ({
  metrics: {
    performance: {
      apiLatency: [],
      errorRate: [],
      systemHealth: [],
      memoryUsage: []
    },
    timestamps: []
  },
  addPerformanceMetric: (metric) => set((state) => {
    const now = Date.now();
    const { apiLatency, errorRate, systemHealth, memoryUsage = 0 } = metric;
    
    return {
      metrics: {
        performance: {
          apiLatency: [...state.metrics.performance.apiLatency.slice(-DEBUG_CONFIG.retention.dataPoints), apiLatency],
          errorRate: [...state.metrics.performance.errorRate.slice(-DEBUG_CONFIG.retention.dataPoints), errorRate],
          systemHealth: [...state.metrics.performance.systemHealth.slice(-DEBUG_CONFIG.retention.dataPoints), systemHealth],
          memoryUsage: [...state.metrics.performance.memoryUsage.slice(-DEBUG_CONFIG.retention.dataPoints), memoryUsage]
        },
        timestamps: [...state.metrics.timestamps.slice(-DEBUG_CONFIG.retention.dataPoints), now]
      }
    };
  })
}));
