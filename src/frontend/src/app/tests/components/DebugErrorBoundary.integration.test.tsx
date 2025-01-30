import { render, screen, fireEvent, act } from '@testing-library/react';
import { DebugErrorBoundary } from '../../components/DebugErrorBoundary';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { TestProvider } from '../contexts/TestContext';
import { runDebugTest } from '../utils/debug-test-runner';
import { DEBUG_CONFIG } from '../../config/debug.config';

const ErrorComponent = ({ shouldThrow = false }) => {
  if (shouldThrow) {
    throw new Error('Test Error');
  }
  return <div>Normal Component</div>;
};

describe('DebugErrorBoundary Integration', () => {
  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should handle and recover from component errors', async () => {
    const { metrics } = await runDebugTest(async () => {
      render(
        <TestProvider>
          <DebugErrorBoundary>
            <ErrorComponent shouldThrow={true} />
          </DebugErrorBoundary>
        </TestProvider>
      );

      expect(screen.getByText('Error: Test Error')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();

      act(() => {
        fireEvent.click(screen.getByText('Retry'));
      });

      return useDebugStore.getState().metrics;
    });

    expect(metrics.performance.errorRate).toBeGreaterThan(0);
    expect(useDebugStore.getState().logs).toContain(
      expect.stringContaining('Component Error: Test Error')
    );
  });

  it('should track error recovery attempts', async () => {
    render(
      <TestProvider>
        <DebugErrorBoundary maxRetries={3}>
          <ErrorComponent shouldThrow={true} />
        </DebugErrorBoundary>
      </TestProvider>
    );

    for (let i = 0; i < 3; i++) {
      act(() => {
        fireEvent.click(screen.getByText('Retry'));
      });
    }

    expect(screen.getByText('Max retries exceeded')).toBeInTheDocument();
    expect(useDebugStore.getState().logs.length).toBe(3);
  });

  it('should integrate with global error tracking', async () => {
    const { metrics } = await runDebugTest(async () => {
      render(
        <TestProvider>
          <DebugErrorBoundary>
            <ErrorComponent shouldThrow={true} />
          </DebugErrorBoundary>
        </TestProvider>
      );

      const errorBoundary = screen.getByTestId('error-boundary');
      expect(errorBoundary).toHaveAttribute('data-error-count', '1');

      return useDebugStore.getState().metrics;
    });

    expect(metrics.performance.systemHealth).toBeLessThan(1);
    expect(metrics.performance.errorRate).toBeGreaterThan(0);
  });

  it('should handle nested error boundaries', async () => {
    render(
      <TestProvider>
        <DebugErrorBoundary id="outer">
          <div>
            <DebugErrorBoundary id="inner">
              <ErrorComponent shouldThrow={true} />
            </DebugErrorBoundary>
          </div>
        </DebugErrorBoundary>
      </TestProvider>
    );

    expect(screen.getByTestId('error-boundary')).toHaveAttribute('data-boundary-id', 'inner');
    expect(useDebugStore.getState().logs).toContain(
      expect.stringContaining('Inner boundary caught error')
    );
  });

  it('should maintain error context in metrics history', async () => {
    const errors = [
      new Error('Error 1'),
      new Error('Error 2'),
      new Error('Error 3')
    ];

    for (const error of errors) {
      render(
        <TestProvider>
          <DebugErrorBoundary>
            <ErrorComponent
              shouldThrow={true}
              error={error}
            />
          </DebugErrorBoundary>
        </TestProvider>
      );

      act(() => {
        fireEvent.click(screen.getByText('Retry'));
      });
    }

    const store = useDebugStore.getState();
    expect(store.logs.length).toBe(errors.length);
    expect(store.metrics.performance.errorRate).toBeGreaterThan(0.5);
  });
});
