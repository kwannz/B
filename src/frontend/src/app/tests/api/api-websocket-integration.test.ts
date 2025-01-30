import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API WebSocket Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should track websocket connection metrics', async () => {
    const connections = [
      { endpoint: 'market-data', latency: 50 },
      { endpoint: 'trading-updates', latency: 75 },
      { endpoint: 'system-alerts', latency: 100 }
    ];

    for (const conn of connections) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'WS', url: `/ws/${conn.endpoint}` },
          async () => {
            await new Promise(resolve => setTimeout(resolve, conn.latency));
            return { status: 'connected' };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.websocket.connections).toBe(connections.length);
    expect(metrics.websocket.connectionLatency).toBeGreaterThan(0);
  });

  it('should monitor websocket message throughput', async () => {
    const messageStreams = [
      { type: 'market_data', count: 100, interval: 10 },
      { type: 'trade_updates', count: 50, interval: 20 },
      { type: 'system_metrics', count: 25, interval: 40 }
    ];

    for (const stream of messageStreams) {
      const messages = Array(stream.count).fill(null);
      await Promise.all(
        messages.map(async (_, i) => {
          await runDebugApiTest(async () => {
            await new Promise(resolve => 
              setTimeout(resolve, i * stream.interval)
            );
            await debugMetricsMiddleware(
              { method: 'WS', url: `/ws/${stream.type}` },
              async () => ({ type: stream.type, sequence: i })
            );
          });
        })
      );
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.websocket.messageRate).toBeGreaterThan(0);
    expect(metrics.websocket.messageLatency).toBeDefined();
  });

  it('should track websocket error handling', async () => {
    const errorScenarios = [
      { type: 'connection_lost', retry: true },
      { type: 'invalid_message', retry: false },
      { type: 'timeout', retry: true }
    ];

    for (const scenario of errorScenarios) {
      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'WS', url: '/ws/error-test' },
            async () => {
              throw {
                type: scenario.type,
                retryable: scenario.retry,
                timestamp: Date.now()
              };
            }
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.websocket.errorRate).toBeGreaterThan(0);
    expect(metrics.websocket.reconnectionAttempts).toBeGreaterThan(0);
  });

  it('should handle websocket backpressure', async () => {
    const loadTests = [
      { messages: 1000, interval: 1 },
      { messages: 500, interval: 2 },
      { messages: 250, interval: 4 }
    ];

    for (const test of loadTests) {
      const messages = Array(test.messages).fill(null);
      let processed = 0;

      await Promise.all(
        messages.map(async (_, i) => {
          await runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'WS', url: '/ws/load-test' },
              async () => {
                processed++;
                await new Promise(resolve => 
                  setTimeout(resolve, i * test.interval)
                );
                return { processed, pending: test.messages - processed };
              }
            );
          });
        })
      );
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.websocket.backpressure).toBeDefined();
    expect(metrics.websocket.processingRate).toBeGreaterThan(0);
  });

  it('should track websocket connection lifecycle', async () => {
    const lifecycleTests = [
      { duration: 1000, messages: 10 },
      { duration: 2000, messages: 20 },
      { duration: 3000, messages: 30 }
    ];

    for (const test of lifecycleTests) {
      const startTime = Date.now();
      const messages = Array(test.messages).fill(null);

      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'WS', url: '/ws/lifecycle-test' },
          async () => {
            for (const _ of messages) {
              await new Promise(resolve => 
                setTimeout(resolve, test.duration / test.messages)
              );
            }
            return {
              duration: Date.now() - startTime,
              messages: test.messages
            };
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.websocket.connectionDuration).toBeGreaterThan(0);
    expect(metrics.websocket.messageDistribution).toBeDefined();
  });
});
