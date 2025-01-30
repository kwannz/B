import { render, screen, fireEvent, act } from '@testing-library/react';
import { DebugMetricsDashboard } from '../../components/DebugMetricsDashboard';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { TestProvider } from '../contexts/TestContext';
import { runDebugTest } from '../utils/debug-test-runner';
import { DEBUG_CONFIG } from '../../config/debug.config';

describe('DebugMetricsDashboard', () => {
  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
  });

  it('should render all debug components when enabled', async () => {
    render(
      <TestProvider>
        <DebugMetricsDashboard />
      </TestProvider>
    );

    expect(screen.getByText('Debug Metrics Dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('performance-chart')).toBeInTheDocument();
    expect(screen.getByTestId('trading-chart')).toBeInTheDocument();
    expect(screen.getByText('System Health Overview')).toBeInTheDocument();
  });

  it('should show enable button when debug mode is disabled', async () => {
    act(() => {
      useDebugStore.setState({ isEnabled: false });
    });

    render(
      <TestProvider>
        <DebugMetricsDashboard />
      </TestProvider>
    );

    const enableButton = screen.getByText('Enable Debug Mode');
    expect(enableButton).toBeInTheDocument();

    fireEvent.click(enableButton);
    expect(useDebugStore.getState().isEnabled).toBe(true);
  });

  it('should highlight performance issues', async () => {
    const { metrics } = await runDebugTest(async () => {
      render(
        <TestProvider>
          <DebugMetricsDashboard />
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
              systemHealth: 0.4
            }
          }
        }));
      });

      const performanceChart = screen.getByTestId('performance-chart')
        .closest('div[class*="border-red-500"]');
      expect(performanceChart).toBeInTheDocument();

      return useDebugStore.getState().metrics;
    });

    expect(metrics.performance.errorRate).toBeGreaterThan(
      DEBUG_CONFIG.thresholds.system.error_rate
    );
  });

  it('should highlight trading issues', async () => {
    const { metrics } = await runDebugTest(async () => {
      render(
        <TestProvider>
          <DebugMetricsDashboard />
        </TestProvider>
      );

      act(() => {
        useDebugStore.setState(state => ({
          ...state,
          metrics: {
            ...state.metrics,
            trading: {
              activePositions: 0,
              totalVolume: 0,
              profitLoss: -500
            }
          }
        }));
      });

      const tradingChart = screen.getByTestId('trading-chart')
        .closest('div[class*="border-yellow-500"]');
      expect(tradingChart).toBeInTheDocument();

      return useDebugStore.getState().metrics;
    });

    expect(metrics.trading.activePositions).toBe(0);
    expect(metrics.trading.profitLoss).toBeLessThan(0);
  });

  it('should update metrics in real-time', async () => {
    jest.useFakeTimers();

    render(
      <TestProvider>
        <DebugMetricsDashboard />
      </TestProvider>
    );

    for (let i = 0; i < 5; i++) {
      act(() => {
        useDebugStore.setState(state => ({
          ...state,
          metrics: {
            ...state.metrics,
            performance: {
              errorRate: i * 0.1,
              apiLatency: i * 200,
              systemHealth: 1 - i * 0.1
            },
            trading: {
              activePositions: i,
              totalVolume: i * 1000,
              profitLoss: i * 100
            }
          }
        }));
        jest.advanceTimersByTime(DEBUG_CONFIG.update_interval);
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.errorRate).toBe(0.4);
    expect(metrics.trading.activePositions).toBe(4);

    jest.useRealTimers();
  });

  it('should display last updated timestamp', async () => {
    jest.useFakeTimers();
    const now = new Date();
    jest.setSystemTime(now);

    render(
      <TestProvider>
        <DebugMetricsDashboard />
      </TestProvider>
    );

    const timestamp = screen.getByText(
      `Last Updated: ${now.toLocaleTimeString()}`
    );
    expect(timestamp).toBeInTheDocument();

    jest.useRealTimers();
  });
});
