import { render, screen, act } from '@testing-library/react';
import { DebugMetricsProvider } from '../../providers/DebugMetricsProvider';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { TestProvider } from '../contexts/TestContext';
import { runDebugTest } from '../utils/debug-test-runner';
import { DEBUG_CONFIG } from '../../config/debug.config';

const TestComponent = () => {
  const metrics = useDebugStore(state => state.metrics);
  return (
    <div>
      <div data-testid="error-rate">
        Error Rate: {metrics.performance.errorRate}
      </div>
      <div data-testid="system-health">
        System Health: {metrics.performance.systemHealth}
      </div>
    </div>
  );
};

describe('DebugMetricsProvider', () => {
  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
  });

  it('should provide metrics context to children', async () => {
    render(
      <TestProvider>
        <DebugMetricsProvider>
          <TestComponent />
        </DebugMetricsProvider>
      </TestProvider>
    );

    expect(screen.getByTestId('error-rate')).toHaveTextContent('Error Rate: 0');
    expect(screen.getByTestId('system-health')).toHaveTextContent('System Health: 1');
  });

  it('should update metrics in real-time', async () => {
    jest.useFakeTimers();

    render(
      <TestProvider>
        <DebugMetricsProvider updateInterval={1000}>
          <TestComponent />
        </DebugMetricsProvider>
      </TestProvider>
    );

    act(() => {
      useDebugStore.setState(state => ({
        ...state,
        metrics: {
          ...state.metrics,
          performance: {
            errorRate: 0.5,
            apiLatency: 1000,
            systemHealth: 0.5
          }
        }
      }));
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId('error-rate')).toHaveTextContent('Error Rate: 0.5');
    expect(screen.getByTestId('system-health')).toHaveTextContent('System Health: 0.5');

    jest.useRealTimers();
  });

  it('should handle metric threshold violations', async () => {
    render(
      <TestProvider>
        <DebugMetricsProvider>
          <TestComponent />
        </DebugMetricsProvider>
      </TestProvider>
    );

    act(() => {
      useDebugStore.setState(state => ({
        ...state,
        metrics: {
          ...state.metrics,
          performance: {
            errorRate: DEBUG_CONFIG.thresholds.system.error_rate + 0.1,
            apiLatency: DEBUG_CONFIG.thresholds.system.latency + 100,
            systemHealth: 0.3
          }
        }
      }));
    });

    const errorRate = screen.getByTestId('error-rate');
    const systemHealth = screen.getByTestId('system-health');

    expect(errorRate).toHaveTextContent(
      `Error Rate: ${DEBUG_CONFIG.thresholds.system.error_rate + 0.1}`
    );
    expect(systemHealth).toHaveTextContent('System Health: 0.3');
    expect(errorRate.closest('div[class*="text-red-500"]')).toBeInTheDocument();
  });

  it('should persist metrics state', async () => {
    const { metrics } = await runDebugTest(async () => {
      render(
        <TestProvider>
          <DebugMetricsProvider>
            <TestComponent />
          </DebugMetricsProvider>
        </TestProvider>
      );

      act(() => {
        useDebugStore.setState(state => ({
          ...state,
          metrics: {
            ...state.metrics,
            performance: {
              errorRate: 0.2,
              apiLatency: 500,
              systemHealth: 0.8
            }
          }
        }));
      });

      return useDebugStore.getState().metrics;
    });

    expect(metrics.performance.errorRate).toBe(0.2);
    expect(metrics.performance.systemHealth).toBe(0.8);
  });

  it('should handle disabled debug mode', async () => {
    act(() => {
      useDebugStore.setState({ isEnabled: false });
    });

    render(
      <TestProvider>
        <DebugMetricsProvider>
          <TestComponent />
        </DebugMetricsProvider>
      </TestProvider>
    );

    expect(screen.getByTestId('error-rate')).toHaveTextContent('Error Rate: 0');
    expect(screen.getByTestId('system-health')).toHaveTextContent('System Health: 1');
  });
});
