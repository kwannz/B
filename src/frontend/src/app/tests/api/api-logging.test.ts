import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Logging Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should track API request logs', async () => {
    const requests = [
      { method: 'GET', path: '/wallets', success: true },
      { method: 'POST', path: '/bots', success: false },
      { method: 'PATCH', path: '/trades', success: true }
    ];

    for (const req of requests) {
      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: req.method, url: req.path },
            async () => {
              if (!req.success) throw new Error('Request failed');
              return { status: 'success' };
            }
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const store = useDebugStore.getState();
    expect(store.logs).toContain(expect.stringContaining('API Request'));
    expect(store.logs.length).toBeGreaterThanOrEqual(requests.length);
  });

  it('should handle log retention limits', async () => {
    const maxLogs = DEBUG_CONFIG.retention.max_logs;
    const logEntries = Array(maxLogs + 5).fill(null).map((_, i) => ({
      level: i % 2 === 0 ? 'info' : 'error',
      message: `Log entry ${i}`
    }));

    for (const entry of logEntries) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/logs' },
          async () => {
            useDebugStore.setState(state => ({
              ...state,
              logs: [...state.logs, `[${entry.level}] ${entry.message}`]
            }));
            return { status: 'logged' };
          }
        );
      });
    }

    const store = useDebugStore.getState();
    expect(store.logs.length).toBeLessThanOrEqual(maxLogs);
    expect(store.logs[store.logs.length - 1]).toContain('Log entry');
  });

  it('should track error logs with context', async () => {
    const errorScenarios = [
      { type: 'validation', context: { field: 'amount', value: -1 } },
      { type: 'network', context: { status: 503, retry: true } },
      { type: 'auth', context: { token: 'expired' } }
    ];

    for (const scenario of errorScenarios) {
      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/api/errors' },
            async () => {
              throw {
                type: scenario.type,
                context: scenario.context,
                message: `${scenario.type} error occurred`
              };
            }
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const store = useDebugStore.getState();
    expect(store.logs).toContain(expect.stringContaining('context'));
    expect(store.metrics.performance.errorRate).toBeGreaterThan(0);
  });

  it('should track system event logs', async () => {
    const events = [
      { type: 'wallet_created', data: { address: 'test-address' } },
      { type: 'trade_executed', data: { amount: 1.0, price: 100 } },
      { type: 'bot_status_changed', data: { status: 'active' } }
    ];

    for (const event of events) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/events' },
          async () => {
            useDebugStore.setState(state => ({
              ...state,
              logs: [
                ...state.logs,
                `[EVENT] ${event.type}: ${JSON.stringify(event.data)}`
              ]
            }));
            return { status: 'logged' };
          }
        );
      });
    }

    const store = useDebugStore.getState();
    expect(store.logs).toContain(expect.stringContaining('[EVENT]'));
    expect(store.logs.length).toBe(events.length);
  });

  it('should handle log aggregation', async () => {
    const timeWindow = 1000;
    const similarLogs = Array(10).fill(null).map((_, i) => ({
      type: 'validation_error',
      count: i + 1,
      timestamp: Date.now() + (i * timeWindow / 2)
    }));

    for (const log of similarLogs) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/logs' },
          async () => {
            useDebugStore.setState(state => ({
              ...state,
              logs: [
                ...state.logs,
                `[ERROR] Validation error occurred (count: ${log.count})`
              ]
            }));
            return { status: 'logged' };
          }
        );
      });
    }

    const store = useDebugStore.getState();
    const aggregatedCount = store.logs.filter(log => 
      log.includes('Validation error')
    ).length;
    expect(aggregatedCount).toBeLessThan(similarLogs.length);
  });
});
