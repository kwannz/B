import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Monitoring Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should track system health metrics', async () => {
    const operations = Array(10).fill(null).map((_, i) => ({
      type: i % 2 === 0 ? 'success' : 'error',
      latency: 100 * (i + 1)
    }));

    for (const op of operations) {
      if (op.type === 'error') {
        mockAPI.createWallet.mockRejectedValueOnce(new Error('Test Error'));
      } else {
        mockAPI.createWallet.mockImplementationOnce(() =>
          new Promise(resolve => setTimeout(resolve, op.latency))
        );
      }

      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/api/wallets' },
            () => apiClient.createWallet('test-bot')
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.errorRate).toBe(0.5);
    expect(metrics.performance.systemHealth).toBeLessThan(1);
  });

  it('should track resource utilization', async () => {
    const resourceTests = Array(5).fill(null).map((_, i) => ({
      memoryUsage: 0.2 * (i + 1),
      cpuUsage: 0.15 * (i + 1),
      delay: 100 * (i + 1)
    }));

    for (const test of resourceTests) {
      mockAPI.getBotStatus.mockImplementation(() =>
        new Promise(resolve => {
          setTimeout(() => {
            process.memoryUsage = () => ({
              heapUsed: test.memoryUsage * 1024 * 1024 * 1024,
              heapTotal: 1024 * 1024 * 1024,
              external: 0,
              rss: 0
            });
            resolve({ status: 'active' });
          }, test.delay);
        })
      );

      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'GET', url: '/api/bots/status' },
          () => apiClient.getBotStatus('test-bot')
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.resourceUsage).toBeGreaterThan(0.5);
    expect(metrics.performance.systemHealth).toBeLessThan(1);
  });

  it('should track API endpoint health', async () => {
    const endpoints = [
      { path: '/wallets', method: 'POST', success: true },
      { path: '/bots', method: 'POST', success: false },
      { path: '/transfers', method: 'POST', success: true },
      { path: '/wallets/status', method: 'GET', success: true },
      { path: '/bots/status', method: 'GET', success: false }
    ];

    for (const endpoint of endpoints) {
      if (endpoint.success) {
        mockAPI[endpoint.method.toLowerCase()].mockResolvedValueOnce({});
      } else {
        mockAPI[endpoint.method.toLowerCase()].mockRejectedValueOnce(
          new Error('Endpoint Error')
        );
      }

      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: endpoint.method, url: endpoint.path },
            () => apiClient[endpoint.method.toLowerCase()](endpoint.path)
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.endpointHealth).toBeCloseTo(0.6, 1);
  });

  it('should track system alerts', async () => {
    const alertScenarios = [
      { type: 'error', threshold: 0.8, value: 0.9 },
      { type: 'warning', threshold: 0.6, value: 0.7 },
      { type: 'info', threshold: 0.4, value: 0.5 }
    ];

    for (const scenario of alertScenarios) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/alerts' },
          async () => {
            useDebugStore.setState(state => ({
              ...state,
              metrics: {
                ...state.metrics,
                alerts: {
                  ...state.metrics.alerts,
                  [scenario.type]: scenario.value
                }
              }
            }));
            return { status: 'success' };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.alerts.error).toBeGreaterThan(
      DEBUG_CONFIG.thresholds.alerts.error
    );
    expect(metrics.alerts.warning).toBeGreaterThan(
      DEBUG_CONFIG.thresholds.alerts.warning
    );
  });

  it('should track long-term system stability', async () => {
    const timeframes = [
      { duration: '1h', samples: 5 },
      { duration: '6h', samples: 3 },
      { duration: '24h', samples: 2 }
    ];

    for (const timeframe of timeframes) {
      const samples = Array(timeframe.samples).fill(null).map((_, i) => ({
        errorRate: 0.1 * (i + 1),
        latency: 100 * (i + 1),
        resourceUsage: 0.2 * (i + 1)
      }));

      for (const sample of samples) {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/api/metrics' },
            async () => {
              useDebugStore.setState(state => ({
                ...state,
                metrics: {
                  ...state.metrics,
                  performance: {
                    ...state.metrics.performance,
                    ...sample
                  }
                }
              }));
              return { status: 'success' };
            }
          );
        });
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.stabilityScore).toBeDefined();
    expect(metrics.performance.trendAnalysis).toBeDefined();
  });
});
