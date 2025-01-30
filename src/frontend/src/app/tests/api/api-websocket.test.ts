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
  let mockWebSocket: WebSocket;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
    mockWebSocket = new WebSocket('ws://localhost:8000/ws');
  });

  afterEach(() => {
    mockWebSocket.close();
  });

  it('should handle real-time metrics updates', async () => {
    const metricsUpdates = [
      { errorRate: 0.1, apiLatency: 100, systemHealth: 0.9 },
      { errorRate: 0.2, apiLatency: 200, systemHealth: 0.8 },
      { errorRate: 0.3, apiLatency: 300, systemHealth: 0.7 }
    ];

    await runDebugApiTest(async () => {
      for (const update of metricsUpdates) {
        act(() => {
          mockWebSocket.dispatchEvent(new MessageEvent('message', {
            data: JSON.stringify({
              type: 'metrics',
              data: update
            })
          }));
        });

        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.errorRate).toBe(metricsUpdates[2].errorRate);
    expect(metrics.performance.systemHealth).toBe(metricsUpdates[2].systemHealth);
  });

  it('should handle websocket reconnection', async () => {
    let reconnectCount = 0;
    const mockReconnect = jest.fn(() => {
      reconnectCount++;
      mockWebSocket.dispatchEvent(new Event('open'));
    });

    await runDebugApiTest(async () => {
      mockWebSocket.addEventListener('close', mockReconnect);
      mockWebSocket.dispatchEvent(new CloseEvent('close'));
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(reconnectCount).toBe(1);
    expect(useDebugStore.getState().logs).toContain(
      expect.stringContaining('WebSocket reconnected')
    );
  });

  it('should batch metrics updates', async () => {
    const batchSize = DEBUG_CONFIG.metrics.batch_size;
    const updates = Array(batchSize + 2).fill(null).map((_, i) => ({
      errorRate: i * 0.1,
      apiLatency: i * 100,
      systemHealth: 1 - i * 0.1
    }));

    await runDebugApiTest(async () => {
      for (const update of updates) {
        act(() => {
          mockWebSocket.dispatchEvent(new MessageEvent('message', {
            data: JSON.stringify({
              type: 'metrics',
              data: update
            })
          }));
        });
      }
    });

    const store = useDebugStore.getState();
    expect(store.metrics.performance.errorRate).toBe(updates[updates.length - 1].errorRate);
    expect(store.metricsHistory.length).toBeLessThanOrEqual(batchSize);
  });

  it('should handle malformed websocket messages', async () => {
    const invalidMessages = [
      'invalid json',
      '{"type": "unknown"}',
      '{"type": "metrics", "data": null}',
      '{}'
    ];

    for (const msg of invalidMessages) {
      act(() => {
        mockWebSocket.dispatchEvent(new MessageEvent('message', {
          data: msg
        }));
      });
    }

    const logs = useDebugStore.getState().logs;
    expect(logs).toContain(expect.stringContaining('Invalid WebSocket message'));
    expect(logs.length).toBe(invalidMessages.length);
  });

  it('should maintain websocket connection during high load', async () => {
    const highLoadUpdates = Array(100).fill(null).map((_, i) => ({
      errorRate: Math.random(),
      apiLatency: Math.random() * 1000,
      systemHealth: Math.random()
    }));

    let dropCount = 0;
    mockWebSocket.addEventListener('close', () => {
      dropCount++;
    });

    await runDebugApiTest(async () => {
      await Promise.all(
        highLoadUpdates.map(update =>
          act(() => {
            mockWebSocket.dispatchEvent(new MessageEvent('message', {
              data: JSON.stringify({
                type: 'metrics',
                data: update
              })
            }));
          })
        )
      );
    });

    expect(dropCount).toBe(0);
    expect(useDebugStore.getState().metrics.performance.systemHealth).toBeGreaterThan(0);
  });
});
