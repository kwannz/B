import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Performance Monitoring Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should track API performance metrics', async () => {
    const endpoints = [
      { path: '/wallets', latency: 50, success: true },
      { path: '/bots', latency: 150, success: true },
      { path: '/trades', latency: 250, success: false }
    ];

    for (const endpoint of endpoints) {
      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'GET', url: endpoint.path },
            async () => {
              await new Promise(resolve => setTimeout(resolve, endpoint.latency));
              if (!endpoint.success) throw new Error('API Error');
              return { status: 'success' };
            }
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.apiLatency).toBeGreaterThan(0);
    expect(metrics.performance.successRate).toBeLessThan(1);
  });

  it('should monitor memory usage patterns', async () => {
    const operations = Array(5).fill(null).map((_, i) => ({
      size: 1024 * 1024 * (i + 1),
      duration: 100 * (i + 1)
    }));

    for (const op of operations) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/performance' },
          async () => {
            const array = new Array(op.size);
            await new Promise(resolve => setTimeout(resolve, op.duration));
            return { memoryUsed: process.memoryUsage().heapUsed };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.memoryUsage).toBeGreaterThan(0);
    expect(metrics.performance.resourceUsage).toBeLessThan(
      DEBUG_CONFIG.thresholds.system.resource_usage
    );
  });

  it('should track concurrent request performance', async () => {
    const requests = Array(10).fill(null).map((_, i) => ({
      endpoint: `/api/endpoint-${i}`,
      latency: 50 + (i * 10)
    }));

    await Promise.all(
      requests.map(req =>
        runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'GET', url: req.endpoint },
            async () => {
              await new Promise(resolve => setTimeout(resolve, req.latency));
              return { status: 'success' };
            }
          );
        })
      )
    );

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.concurrentRequests).toBeLessThanOrEqual(
      DEBUG_CONFIG.thresholds.api.concurrent_requests
    );
    expect(metrics.performance.apiLatency).toBeGreaterThan(0);
  });

  it('should monitor performance degradation patterns', async () => {
    const timeframes = [
      { duration: '1h', samples: 12 },
      { duration: '6h', samples: 6 },
      { duration: '24h', samples: 4 }
    ];

    for (const timeframe of timeframes) {
      const samples = Array(timeframe.samples).fill(null).map((_, i) => ({
        latency: 100 * (i + 1),
        errors: Math.floor(i / 2),
        requests: 10 * (i + 1)
      }));

      for (const sample of samples) {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/api/metrics/performance' },
            async () => {
              await new Promise(resolve => setTimeout(resolve, sample.latency));
              return {
                error_rate: sample.errors / sample.requests,
                latency: sample.latency
              };
            }
          );
        });
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.degradationRate).toBeDefined();
    expect(metrics.performance.trendAnalysis).toBeDefined();
  });

  it('should track performance impact of system load', async () => {
    const loadScenarios = [
      { cpu: 0.3, memory: 0.4, requests: 10 },
      { cpu: 0.5, memory: 0.6, requests: 20 },
      { cpu: 0.7, memory: 0.8, requests: 30 },
      { cpu: 0.9, memory: 0.9, requests: 40 }
    ];

    for (const scenario of loadScenarios) {
      const requests = Array(scenario.requests).fill(null).map(() => ({
        latency: Math.random() * 100 + 50
      }));

      await Promise.all(
        requests.map(req =>
          runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'GET', url: '/api/load-test' },
              async () => {
                await new Promise(resolve => setTimeout(resolve, req.latency));
                return {
                  cpu_usage: scenario.cpu,
                  memory_usage: scenario.memory
                };
              }
            );
          })
        )
      );
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.loadImpact).toBeDefined();
    expect(metrics.performance.scalabilityMetrics).toBeDefined();
  });
});
