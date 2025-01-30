import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DebugErrorBoundary } from '../../components/DebugErrorBoundary';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { TestProvider } from '../contexts/TestContext';

const ErrorComponent = ({ shouldThrow = false }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('DebugErrorBoundary', () => {
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

  it('should render children when no error occurs', () => {
    render(
      <TestProvider>
        <DebugErrorBoundary>
          <ErrorComponent />
        </DebugErrorBoundary>
      </TestProvider>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should render error UI when error occurs', () => {
    render(
      <TestProvider>
        <DebugErrorBoundary>
          <ErrorComponent shouldThrow />
        </DebugErrorBoundary>
      </TestProvider>
    );

    expect(screen.getByText(/An error occurred/i)).toBeInTheDocument();
    expect(screen.getByText(/Test error/i)).toBeInTheDocument();
  });

  it('should update debug metrics when error occurs', () => {
    render(
      <TestProvider>
        <DebugErrorBoundary>
          <ErrorComponent shouldThrow />
        </DebugErrorBoundary>
      </TestProvider>
    );

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.errorRate).toBeGreaterThan(0);
    expect(metrics.performance.systemHealth).toBeLessThan(1);
  });

  it('should log error details', () => {
    render(
      <TestProvider>
        <DebugErrorBoundary>
          <ErrorComponent shouldThrow />
        </DebugErrorBoundary>
      </TestProvider>
    );

    const logs = useDebugStore.getState().logs;
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[logs.length - 1]).toContain('Test error');
  });

  it('should allow retry after error', () => {
    const TestComponent = () => {
      const [shouldThrow, setShouldThrow] = React.useState(true);
      React.useEffect(() => {
        setTimeout(() => setShouldThrow(false), 100);
      }, []);
      return <ErrorComponent shouldThrow={shouldThrow} />;
    };

    render(
      <TestProvider>
        <DebugErrorBoundary>
          <TestComponent />
        </DebugErrorBoundary>
      </TestProvider>
    );

    const retryButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton);

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should handle nested errors', () => {
    const NestedErrorComponent = () => {
      throw new Error('Nested error');
    };

    render(
      <TestProvider>
        <DebugErrorBoundary>
          <div>
            <DebugErrorBoundary>
              <NestedErrorComponent />
            </DebugErrorBoundary>
          </div>
        </DebugErrorBoundary>
      </TestProvider>
    );

    expect(screen.getByText(/Nested error/i)).toBeInTheDocument();
    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.errorRate).toBeGreaterThan(0);
  });
});
