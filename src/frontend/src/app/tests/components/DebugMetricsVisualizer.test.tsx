import { render, screen, fireEvent, act } from '@testing-library/react';
import { DebugMetricsVisualizer } from '../../components/DebugMetricsVisualizer';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { TestProvider } from '../contexts/TestContext';
import { runDebugTest } from '../utils/debug-test-runner';

describe('DebugMetricsVisualizer', () => {
  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
  });

  it('should display current system metrics', async () => {
    const { metrics } = await runDebugTest(async () => {
      render(
        <TestProvider>
          <DebugMetricsVisualizer />
        </TestProvider>
      );

      expect(screen.getByText('System Health')).toBeInTheDocument();
      expect(screen.getByText('API Latency')).toBeInTheDocument();
      expect(screen.getByText('Error Rate')).toBeInTheDocument();

      return useDebugStore.getState().metrics;
    });

    expect(metrics.performance.systemHealth).toBe(1);
    expect(metrics.performance.errorRate).toBe(0);
  });

  it('should update metrics in real-time', async () => {
    const { metrics } = await runDebugTest(async () => {
      render(
        <TestProvider>
          <DebugMetricsVisualizer />
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
              systemHealth: 0.5
            }
          }
        }));
      });

      return useDebugStore.getState().metrics;
    });

    expect(metrics.performance.systemHealth).toBe(0.5);
    expect(metrics.performance.errorRate).toBe(0.5);
  });

  it('should handle metric threshold violations', async () => {
    const { metrics } = await runDebugTest(async () => {
      render(
        <TestProvider>
          <DebugMetricsVisualizer />
        </TestProvider>
      );

      act(() => {
        useDebugStore.setState(state => ({
          ...state,
          metrics: {
            ...state.metrics,
            performance: {
              ...state.metrics.performance,
              errorRate: 1,
              systemHealth: 0,
              apiLatency: 2000
            }
          }
        }));
      });

      expect(screen.getByText(/Error Rate: 100%/i)).toBeInTheDocument();
      expect(screen.getByText(/System Health: 0%/i)).toBeInTheDocument();
      expect(screen.getByText(/API Latency: 2000ms/i)).toBeInTheDocument();

      return useDebugStore.getState().metrics;
    });

    expect(metrics.performance.systemHealth).toBe(0);
    expect(metrics.performance.errorRate).toBe(1);
    expect(metrics.performance.apiLatency).toBe(2000);
  });

  it('should toggle metrics visibility', async () => {
    render(
      <TestProvider>
        <DebugMetricsVisualizer />
      </TestProvider>
    );

    const toggleButton = screen.getByRole('button', { name: /toggle metrics/i });
    fireEvent.click(toggleButton);

    expect(screen.queryByText('System Health')).not.toBeInTheDocument();
    expect(screen.queryByText('API Latency')).not.toBeInTheDocument();
    expect(screen.queryByText('Error Rate')).not.toBeInTheDocument();

    fireEvent.click(toggleButton);

    expect(screen.getByText('System Health')).toBeInTheDocument();
    expect(screen.getByText('API Latency')).toBeInTheDocument();
    expect(screen.getByText('Error Rate')).toBeInTheDocument();
  });

  it('should display trading metrics', async () => {
    const { metrics } = await runDebugTest(async () => {
      render(
        <TestProvider>
          <DebugMetricsVisualizer />
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

      expect(screen.getByText(/Active Positions: 5/i)).toBeInTheDocument();
      expect(screen.getByText(/Total Volume: 10000/i)).toBeInTheDocument();
      expect(screen.getByText(/Profit\/Loss: \+500/i)).toBeInTheDocument();

      return useDebugStore.getState().metrics;
    });

    expect(metrics.trading.activePositions).toBe(5);
    expect(metrics.trading.totalVolume).toBe(10000);
    expect(metrics.trading.profitLoss).toBe(500);
  });
});
