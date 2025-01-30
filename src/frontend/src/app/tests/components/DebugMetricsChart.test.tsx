import { render, screen, fireEvent, act } from '@testing-library/react';
import { DebugMetricsChart } from '../../components/DebugMetricsChart';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { TestProvider } from '../contexts/TestContext';
import { runDebugTest } from '../utils/debug-test-runner';
import { DEBUG_CONFIG } from '../../config/debug.config';

describe('DebugMetricsChart', () => {
  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
  });

  it('should render performance metrics chart', async () => {
    const { metrics } = await runDebugTest(async () => {
      render(
        <TestProvider>
          <DebugMetricsChart type="performance" />
        </TestProvider>
      );

      expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
      expect(screen.getByTestId('performance-chart')).toBeInTheDocument();

      return useDebugStore.getState().metrics;
    });

    expect(metrics.performance.systemHealth).toBe(1);
    expect(metrics.performance.errorRate).toBe(0);
  });

  it('should update chart on metrics changes', async () => {
    const { metrics } = await runDebugTest(async () => {
      render(
        <TestProvider>
          <DebugMetricsChart type="performance" />
        </TestProvider>
      );

      act(() => {
        useDebugStore.setState(state => ({
          ...state,
          metrics: {
            ...state.metrics,
            performance: {
              ...state.metrics.performance,
              errorRate: 0.5,
              apiLatency: 1000,
              systemHealth: 0.5
            }
          }
        }));
      });

      expect(screen.getByText('Error Rate: 50%')).toBeInTheDocument();
      expect(screen.getByText('API Latency: 1000ms')).toBeInTheDocument();
      expect(screen.getByText('System Health: 50%')).toBeInTheDocument();

      return useDebugStore.getState().metrics;
    });

    expect(metrics.performance.errorRate).toBe(0.5);
    expect(metrics.performance.systemHealth).toBe(0.5);
  });

  it('should handle threshold violations in chart', async () => {
    const { metrics } = await runDebugTest(async () => {
      render(
        <TestProvider>
          <DebugMetricsChart type="performance" />
        </TestProvider>
      );

      act(() => {
        useDebugStore.setState(state => ({
          ...state,
          metrics: {
            ...state.metrics,
            performance: {
              errorRate: 1,
              apiLatency: DEBUG_CONFIG.thresholds.system.latency * 2,
              systemHealth: 0
            }
          }
        }));
      });

      const chart = screen.getByTestId('performance-chart');
      expect(chart).toHaveClass('threshold-violation');

      return useDebugStore.getState().metrics;
    });

    expect(metrics.performance.errorRate).toBe(1);
    expect(metrics.performance.systemHealth).toBe(0);
  });

  it('should display trading metrics chart', async () => {
    const { metrics } = await runDebugTest(async () => {
      render(
        <TestProvider>
          <DebugMetricsChart type="trading" />
        </TestProvider>
      );

      act(() => {
        useDebugStore.setState(state => ({
          ...state,
          metrics: {
            ...state.metrics,
            trading: {
              activePositions: 5,
              totalVolume: 10000,
              profitLoss: 500
            }
          }
        }));
      });

      expect(screen.getByText('Trading Metrics')).toBeInTheDocument();
      expect(screen.getByText('Active Positions: 5')).toBeInTheDocument();
      expect(screen.getByText('Total Volume: 10000')).toBeInTheDocument();
      expect(screen.getByText('Profit/Loss: +500')).toBeInTheDocument();

      return useDebugStore.getState().metrics;
    });

    expect(metrics.trading.activePositions).toBe(5);
    expect(metrics.trading.totalVolume).toBe(10000);
    expect(metrics.trading.profitLoss).toBe(500);
  });

  it('should handle real-time updates', async () => {
    jest.useFakeTimers();

    render(
      <TestProvider>
        <DebugMetricsChart type="performance" updateInterval={1000} />
      </TestProvider>
    );

    for (let i = 0; i < 5; i++) {
      act(() => {
        useDebugStore.setState(state => ({
          ...state,
          metrics: {
            ...state.metrics,
            performance: {
              errorRate: i * 0.2,
              apiLatency: i * 200,
              systemHealth: 1 - i * 0.2
            }
          }
        }));
        jest.advanceTimersByTime(1000);
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.errorRate).toBe(0.8);
    expect(metrics.performance.systemHealth).toBe(0.2);

    jest.useRealTimers();
  });
});
