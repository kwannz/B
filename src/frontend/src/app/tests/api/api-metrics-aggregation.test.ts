import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Metrics Aggregation Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should aggregate system-wide metrics', async () => {
    const systemMetrics = [
      { cpu: 0.4, memory: 0.6, latency: 100, errors: 2, requests: 100 },
      { cpu: 0.5, memory: 0.7, latency: 150, errors: 3, requests: 150 },
      { cpu: 0.6, memory: 0.8, latency: 200, errors: 5, requests: 200 }
    ];

    for (const metrics of systemMetrics) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/metrics/system' },
          async () => {
            useDebugStore.setState(state => ({
              ...state,
              metrics: {
                ...state.metrics,
                performance: {
                  ...state.metrics.performance,
                  resourceUsage: Math.max(metrics.cpu, metrics.memory),
                  apiLatency: metrics.latency,
                  errorRate: metrics.errors / metrics.requests
                }
              }
            }));
            return metrics;
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.resourceUsage).toBeGreaterThan(0.7);
    expect(metrics.performance.apiLatency).toBeGreaterThan(150);
  });

  it('should track metrics across different components', async () => {
    const componentMetrics = [
      { component: 'api', errors: 5, requests: 100, latency: 50 },
      { component: 'trading', errors: 2, requests: 50, latency: 100 },
      { component: 'wallet', errors: 1, requests: 40, latency: 75 }
    ];

    for (const metrics of componentMetrics) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: `/api/metrics/${metrics.component}` },
          async () => {
            return {
              error_rate: metrics.errors / metrics.requests,
              avg_latency: metrics.latency,
              total_requests: metrics.requests
            };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.componentErrors).toBeDefined();
    expect(Object.keys(metrics.performance.componentErrors)).toHaveLength(
      componentMetrics.length
    );
  });

  it('should aggregate trading performance metrics', async () => {
    const tradingMetrics = [
      { trades: 10, profitable: 6, volume: 1000, slippage: 0.001 },
      { trades: 15, profitable: 8, volume: 1500, slippage: 0.002 },
      { trades: 20, profitable: 11, volume: 2000, slippage: 0.0015 }
    ];

    for (const metrics of tradingMetrics) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/metrics/trading' },
          async () => {
            useDebugStore.setState(state => ({
              ...state,
              metrics: {
                ...state.metrics,
                trading: {
                  ...state.metrics.trading,
                  totalTrades: metrics.trades,
                  profitableTrades: metrics.profitable,
                  totalVolume: metrics.volume,
                  averageSlippage: metrics.slippage
                }
              }
            }));
            return metrics;
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.trading.totalTrades).toBe(20);
    expect(metrics.trading.profitableTrades).toBe(11);
  });

  it('should track metrics retention and history', async () => {
    const retentionPeriod = DEBUG_CONFIG.retention.max_age_ms;
    const metricsHistory = Array(5).fill(null).map((_, i) => ({
      timestamp: Date.now() - (i * retentionPeriod / 10),
      cpu: 0.3 + (i * 0.1),
      memory: 0.4 + (i * 0.1),
      errors: i
    }));

    for (const metrics of metricsHistory) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/metrics/history' },
          async () => {
            useDebugStore.setState(state => ({
              ...state,
              metricsHistory: [
                ...state.metricsHistory,
                {
                  timestamp: metrics.timestamp,
                  metrics: {
                    cpu: metrics.cpu,
                    memory: metrics.memory,
                    errors: metrics.errors
                  }
                }
              ]
            }));
            return metrics;
          }
        );
      });
    }

    const store = useDebugStore.getState();
    expect(store.metricsHistory.length).toBeLessThanOrEqual(
      DEBUG_CONFIG.retention.max_logs
    );
    expect(store.metricsHistory[0].timestamp).toBeGreaterThan(
      Date.now() - retentionPeriod
    );
  });

  it('should handle metrics aggregation under load', async () => {
    const concurrentMetrics = Array(10).fill(null).map((_, i) => ({
      component: `component-${i}`,
      metrics: {
        requests: 100 + (i * 10),
        errors: i,
        latency: 50 + (i * 5)
      }
    }));

    await Promise.all(
      concurrentMetrics.map(async metrics =>
        runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: `/api/metrics/${metrics.component}` },
            async () => metrics.metrics
          );
        })
      )
    );

    const store = useDebugStore.getState();
    expect(store.metrics.performance.concurrentRequests).toBeLessThanOrEqual(
      DEBUG_CONFIG.thresholds.api.concurrent_requests
    );
  });
});
