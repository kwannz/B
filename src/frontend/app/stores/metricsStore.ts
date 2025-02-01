import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEBUG_CONFIG, DEBUG_RETENTION } from '../config/debug.config';

interface MetricsState {
  metrics: {
    performance: {
      apiLatency: number[];
      memoryUsage: number[];
      errorRates: number[];
      systemHealth: number[];
    };
    trading: {
      botStatuses: Record<string, string>;
      activePositions: number;
      totalTrades: number;
      successRate: number;
      dexSwap: {
        volume: number;
        averageSlippage: number;
        totalSwaps: number;
        lastPrice: number;
      };
      memeCoin: {
        volume: number;
        averageSentiment: number;
        totalTrades: number;
        momentum: number;
      };
    };
    wallet: {
      balances: Record<string, number>;
      transactions: number;
      lastUpdate: string;
    };
    timestamps: number[];
  };
  addMetric: (category: string, data: any) => void;
  clearMetrics: () => void;
  getLatestMetrics: () => any;
  exportMetrics: () => string;
  importMetrics: (data: string) => void;
}

export const useMetricsStore = create<MetricsState>()(
  persist(
    (set, get) => ({
      metrics: {
        performance: {
          apiLatency: [],
          memoryUsage: [],
          errorRates: [],
          systemHealth: []
        },
        trading: {
          botStatuses: {},
          activePositions: 0,
          totalTrades: 0,
          successRate: 0,
          dexSwap: {
            volume: 0,
            averageSlippage: 0,
            totalSwaps: 0,
            lastPrice: 0
          },
          memeCoin: {
            volume: 0,
            averageSentiment: 0,
            totalTrades: 0,
            momentum: 0
          }
        },
        wallet: {
          balances: {},
          transactions: 0,
          lastUpdate: new Date().toISOString()
        },
        timestamps: []
      },

      addMetric: (category, data) => {
        const currentState = get().metrics;
        const timestamp = Date.now();

        set({
          metrics: {
            ...currentState,
            [category]: {
              ...currentState[category],
              ...data
            },
            timestamps: [...currentState.timestamps, timestamp].slice(-DEBUG_CONFIG.visualization.data_points)
          }
        });

        if (currentState.timestamps.length > DEBUG_RETENTION.MAX_LOGS) {
          const cutoffTime = Date.now() - DEBUG_RETENTION.MAX_AGE_MS;
          set(state => ({
            metrics: {
              ...state.metrics,
              timestamps: state.metrics.timestamps.filter(ts => ts > cutoffTime)
            }
          }));
        }
      },

      clearMetrics: () => {
        set({
          metrics: {
            performance: {
              apiLatency: [],
              memoryUsage: [],
              errorRates: [],
              systemHealth: []
            },
            trading: {
              botStatuses: {},
              activePositions: 0,
              totalTrades: 0,
              successRate: 0,
              dexSwap: {
                volume: 0,
                averageSlippage: 0,
                totalSwaps: 0,
                lastPrice: 0
              },
              memeCoin: {
                volume: 0,
                averageSentiment: 0,
                totalTrades: 0,
                momentum: 0
              }
            },
            wallet: {
              balances: {},
              transactions: 0,
              lastUpdate: new Date().toISOString()
            },
            timestamps: []
          }
        });
      },

      getLatestMetrics: () => {
        const state = get().metrics;
        const latestIndex = state.timestamps.length - 1;
        
        return {
          performance: {
            apiLatency: state.performance.apiLatency[latestIndex] || 0,
            memoryUsage: state.performance.memoryUsage[latestIndex] || 0,
            errorRate: state.performance.errorRates[latestIndex] || 0,
            systemHealth: state.performance.systemHealth[latestIndex] || 0
          },
          trading: state.trading,
          wallet: state.wallet,
          timestamp: state.timestamps[latestIndex] || Date.now()
        };
      },

      exportMetrics: () => {
        return JSON.stringify(get().metrics);
      },

      importMetrics: (data: string) => {
        try {
          const parsed = JSON.parse(data);
          set({ metrics: parsed });
        } catch (error) {
          console.error('Failed to import metrics:', error);
        }
      }
    }),
    {
      name: 'trading-bot-metrics',
      partialize: (state) => ({ metrics: state.metrics })
    }
  )
);
