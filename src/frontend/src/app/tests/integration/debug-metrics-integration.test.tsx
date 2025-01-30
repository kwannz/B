import { render, screen, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { useMetricsStore } from '../../stores/metricsStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { TestProvider } from '../contexts/TestContext';
import { runDebugTest } from '../utils/debug-test-runner';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { DebugMetricsProvider } from '../../providers/DebugMetricsProvider';
import { DebugMetricsDashboard } from '../../components/DebugMetricsDashboard';
import { errorHandlingMiddleware } from '../../middleware/errorHandlingMiddleware';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';
import { mockAPI } from '../setup/test-config';

describe('Debug Metrics Integration', () => {
  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    useMetricsStore.setState({
      metrics: createDebugMetrics(),
      metricsHistory: []
    });
  });

  it('should track system-wide metrics during API operations', async () => {
    render(
      <TestProvider>
        <DebugMetricsProvider>
          <DebugMetricsDashboard />
        </DebugMetricsProvider>
      </TestProvider>
    );

    const operations = [
      () => mockAPI.createWallet('test-bot'),
      () => mockAPI.createBot('trading', 'test-strategy'),
      () => mockAPI.getBotStatus('test-bot'),
      () => mockAPI.updateBotStatus('test-bot', 'active')
    ];

    for (const operation of operations) {
      await act(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/test' },
          operation
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.errorRate).toBe(0);
    expect(metrics.performance.systemHealth).toBe(1);
    expect(metrics.performance.apiLatency).toBeLessThan(
      DEBUG_CONFIG.thresholds.system.latency
    );
  });

  it('should handle and track cascading errors', async () => {
    render(
      <TestProvider>
        <DebugMetricsProvider>
          <DebugMetricsDashboard />
        </DebugMetricsProvider>
      </TestProvider>
    );

    const errors = [
      { message: 'Network Error', code: 'NETWORK_ERROR', status: 503 },
      { message: 'Rate Limit', code: 'RATE_LIMIT', status: 429 },
      { message: 'Invalid Input', code: 'VALIDATION_ERROR', status: 400 }
    ];

    for (const error of errors) {
      try {
        await act(async () => {
          await errorHandlingMiddleware(async () => {
            throw error;
          });
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.errorRate).toBeGreaterThan(0.5);
    expect(metrics.performance.systemHealth).toBeLessThan(0.5);
    expect(useDebugStore.getState().logs.length).toBe(errors.length);
  });

  it('should maintain metrics history across operations', async () => {
    const { metrics, history } = await runDebugTest(async () => {
      render(
        <TestProvider>
          <DebugMetricsProvider>
            <DebugMetricsDashboard />
          </DebugMetricsProvider>
        </TestProvider>
      );

      const operations = Array(5).fill(null).map((_, i) => ({
        success: i % 2 === 0,
        latency: (i + 1) * 100
      }));

      for (const op of operations) {
        await act(async () => {
          if (op.success) {
            await debugMetricsMiddleware(
              { method: 'GET', url: '/api/test' },
              async () => {
                await new Promise(resolve => setTimeout(resolve, op.latency));
                return { status: 200, data: {} };
              }
            );
          } else {
            try {
              await errorHandlingMiddleware(async () => {
                await new Promise(resolve => setTimeout(resolve, op.latency));
                throw new Error('Test Error');
              });
            } catch (e) {
              expect(e).toBeDefined();
            }
          }
        });
      }

      return {
        metrics: useDebugStore.getState().metrics,
        history: useMetricsStore.getState().metricsHistory
      };
    });

    expect(history.length).toBe(5);
    expect(metrics.performance.errorRate).toBeGreaterThan(0);
    expect(metrics.performance.apiLatency).toBeGreaterThan(0);
  });

  it('should update UI components with metrics changes', async () => {
    render(
      <TestProvider>
        <DebugMetricsProvider>
          <DebugMetricsDashboard />
        </DebugMetricsProvider>
      </TestProvider>
    );

    await act(async () => {
      useDebugStore.setState(state => ({
        ...state,
        metrics: {
          ...state.metrics,
          performance: {
            errorRate: 0.7,
            apiLatency: 1500,
            systemHealth: 0.3
          }
        }
      }));
    });

    expect(screen.getByText('Error Rate: 70%')).toBeInTheDocument();
    expect(screen.getByText('System Health: 30%')).toBeInTheDocument();
    expect(screen.getByTestId('health-indicator')).toHaveStyle({
      backgroundColor: expect.stringContaining('red')
    });
  });
});
