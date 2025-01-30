import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API WebSocket Metrics Integration', () => {
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
    const connectionTests = [
      { endpoint: '/ws/trades', latency: 50, success: true },
      { endpoint: '/ws/market', latency: 75, success: true },
      { endpoint: '/ws/orders', latency: 100, success: false }
    ];

    for (const test of connectionTests) {
      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'WS', url: test.endpoint },
            async () => {
              await new Promise(resolve => 
                setTimeout(resolve, test.latency)
              );
              if (!test.success) {
                throw new Error('Connection failed');
              }
              return {
                connected: test.success,
                latency: test.latency,
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
    expect(metrics.websocket.connectionRate).toBeGreaterThan(0);
    expect(metrics.websocket.latencyDistribution).toBeDefined();
  });

  it('should monitor message throughput', async () => {
    const throughputTests = [
      { messages: 100, interval: 1000, size: 1024 },
      { messages: 200, interval: 2000, size: 512 },
      { messages: 300, interval: 3000, size: 256 }
    ];

    for (const test of throughputTests) {
      const messages = Array(test.messages).fill(null);
      let processed = 0;

      await Promise.all(
        messages.map(async (_, i) => {
          await runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'WS', url: '/ws/throughput' },
              async () => {
                await new Promise(resolve => 
                  setTimeout(resolve, test.interval / test.messages)
                );
                processed++;
                return {
                  messageId: i,
                  size: test.size,
                  processed,
                  timestamp: Date.now()
                };
              }
            );
          });
        })
      );

      expect(processed).toBe(test.messages);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.websocket.messageThroughput).toBeGreaterThan(0);
    expect(metrics.websocket.messageSize).toBeDefined();
  });

  it('should track connection stability', async () => {
    const stabilityTests = [
      { duration: 1000, disconnects: 0 },
      { duration: 2000, disconnects: 1 },
      { duration: 3000, disconnects: 2 }
    ];

    for (const test of stabilityTests) {
      const startTime = Date.now();
      let disconnections = 0;

      while (Date.now() - startTime < test.duration) {
        try {
          await runDebugApiTest(async () => {
            await debugMetricsMiddleware(
              { method: 'WS', url: '/ws/stability' },
              async () => {
                if (disconnections < test.disconnects) {
                  disconnections++;
                  throw new Error('Connection lost');
                }
                return {
                  uptime: Date.now() - startTime,
                  disconnections,
                  timestamp: Date.now()
                };
              }
            );
          });
        } catch (e) {
          expect(e).toBeDefined();
        }
      }

      expect(disconnections).toBe(test.disconnects);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.websocket.stability).toBeDefined();
    expect(metrics.websocket.reconnectionRate).toBeGreaterThan(0);
  });

  it('should implement backpressure monitoring', async () => {
    const backpressureTests = [
      { rate: 100, capacity: 50 },
      { rate: 200, capacity: 100 },
      { rate: 300, capacity: 150 }
    ];

    for (const test of backpressureTests) {
      const messages = Array(test.rate).fill(null);
      let queued = 0;
      let dropped = 0;

      await Promise.all(
        messages.map(async (_, i) => {
          try {
            await runDebugApiTest(async () => {
              await debugMetricsMiddleware(
                { method: 'WS', url: '/ws/backpressure' },
                async () => {
                  if (queued >= test.capacity) {
                    dropped++;
                    throw new Error('Message dropped');
                  }
                  queued++;
                  await new Promise(resolve => 
                    setTimeout(resolve, 10)
                  );
                  queued--;
                  return {
                    queued,
                    dropped,
                    capacity: test.capacity,
                    timestamp: Date.now()
                  };
                }
              );
            });
          } catch (e) {
            expect(e).toBeDefined();
          }
        })
      );

      expect(dropped).toBeGreaterThan(0);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.websocket.backpressure).toBeDefined();
    expect(metrics.websocket.dropRate).toBeGreaterThan(0);
  });

  it('should track message processing errors', async () => {
    const errorTests = [
      { messages: 50, errorRate: 0.1 },
      { messages: 100, errorRate: 0.2 },
      { messages: 150, errorRate: 0.3 }
    ];

    for (const test of errorTests) {
      const messages = Array(test.messages).fill(null);
      let errors = 0;

      await Promise.all(
        messages.map(async (_, i) => {
          try {
            await runDebugApiTest(async () => {
              await debugMetricsMiddleware(
                { method: 'WS', url: '/ws/errors' },
                async () => {
                  if (Math.random() < test.errorRate) {
                    errors++;
                    throw new Error('Processing error');
                  }
                  return {
                    messageId: i,
                    errors,
                    timestamp: Date.now()
                  };
                }
              );
            });
          } catch (e) {
            expect(e).toBeDefined();
          }
        })
      );

      expect(errors / test.messages).toBeCloseTo(test.errorRate, 1);
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.websocket.errorRate).toBeGreaterThan(0);
    expect(metrics.websocket.errorPatterns).toBeDefined();
  });
});
