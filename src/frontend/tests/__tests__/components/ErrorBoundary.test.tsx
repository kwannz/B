import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from '@/app/components/ErrorBoundary';
import '@testing-library/jest-dom';
import type { ReactElement } from 'react';
import { useRouter } from 'next/navigation';

// Mock Next.js navigation and window.location
const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockReplace = jest.fn();

const originalLocation = window.location;
beforeAll(() => {
  delete (window as any).location;
  window.location = { ...originalLocation, href: '' };
});

afterAll(() => {
  window.location = originalLocation;
});

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
    replace: mockReplace
  })
}));

function TestComponent(): ReactElement {
  return <div data-testid="test-content">Test Content</div>;
}

describe('ErrorBoundary', () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    consoleError.mockRestore();
  });

  it('renders children when no error occurs', () => {
    const { container } = render(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>
    );
    expect(screen.getByTestId('test-content')).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it('displays error UI when error occurs', async () => {
    function ThrowError(): ReactElement {
      throw new Error('Test error');
    }

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
      expect(screen.getByTestId('error-boundary-retry')).toBeInTheDocument();
      expect(screen.getByTestId('error-boundary-home')).toBeInTheDocument();
      expect(screen.getByText(/Test error/)).toBeInTheDocument();
    });
  });

  it('handles retry action', async () => {
    const user = userEvent.setup();
    function ThrowError(): ReactElement {
      throw new Error('Test error');
    }

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    const retryButton = screen.getByTestId('error-boundary-retry');
    await user.click(retryButton);

    expect(mockRefresh).toHaveBeenCalled();
  });

  it('handles home navigation', async () => {
    const user = userEvent.setup();
    function ThrowError(): ReactElement {
      throw new Error('Test error');
    }

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    const homeButton = screen.getByTestId('error-boundary-home');
    await user.click(homeButton);

    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('displays loading state during retry and recovers', async () => {
    const user = userEvent.setup();
    function ThrowError(): ReactElement {
      throw new Error('Test error');
    }

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    const retryButton = screen.getByTestId('error-boundary-retry');
    await user.click(retryButton);

    await waitFor(() => {
      expect(retryButton).toBeDisabled();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('handles navigation errors and recovery', async () => {
    const user = userEvent.setup();
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const locationSpy = jest.spyOn(window.location, 'href', 'set');
    mockPush.mockRejectedValueOnce(new Error('Navigation failed'));
    
    let shouldThrow = true;
    function RecoverableNavigation(): ReactElement {
      if (shouldThrow) {
        throw new Error('Navigation error');
      }
      return <div data-testid="recovered-nav">Navigation successful</div>;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <RecoverableNavigation />
      </ErrorBoundary>
    );

    const homeButton = screen.getByTestId('error-boundary-home');
    shouldThrow = false;
    await user.click(homeButton);

    // Should attempt Next.js navigation first
    expect(mockPush).toHaveBeenCalledWith('/');

    // Should log navigation error and fallback to window.location
    expect(consoleSpy).toHaveBeenCalledWith('Navigation error:', expect.any(Error));
    expect(locationSpy).toHaveBeenCalledWith('/');

    // Rerender to simulate recovery
    rerender(
      <ErrorBoundary>
        <RecoverableNavigation />
      </ErrorBoundary>
    );

    // Should show recovered content
    await waitFor(() => {
      expect(screen.queryByTestId('error-boundary')).not.toBeInTheDocument();
      expect(screen.getByTestId('recovered-nav')).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
    locationSpy.mockRestore();
  });

  it('handles configuration and environment validation errors in trading system', async () => {
    const user = userEvent.setup();
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    type ConfigState = 'environment' | 'dependencies' | 'resources' | 'recovered';
    let currentState: ConfigState = 'environment';
    let configData: Record<string, any> = {};
    let configAttempts = 0;
    
    function ConfigErrorComponent(): ReactElement {
      switch (currentState) {
        case 'environment':
          configAttempts++;
          configData.environment = {
            component: 'EnvironmentValidator',
            variables: {
              api_keys: {
                required: ['DEEPSEEK_API_KEY', 'BINANCE_API_KEY'],
                missing: ['DEEPSEEK_API_KEY'],
                status: 'incomplete'
              },
              endpoints: {
                required: ['OLLAMA_ENDPOINT', 'TRADING_API'],
                invalid: ['TRADING_API'],
                status: 'misconfigured'
              }
            },
            runtime: {
              node_version: {
                required: '18.x',
                current: '16.x',
                status: 'outdated'
              },
              python_version: {
                required: '3.12',
                current: '3.8',
                status: 'incompatible'
              }
            },
            network: {
              ports: {
                required: [3000, 8000, 11434],
                blocked: [11434],
                status: 'unavailable'
              },
              firewall: {
                required_rules: ['allow_trading_api'],
                missing_rules: ['allow_trading_api'],
                status: 'blocked'
              }
            },
            attempt: configAttempts
          };
          throw new Error('Config Error: Trading environment validation failed');
        case 'dependencies':
          configData.dependencies = {
            component: 'DependencyValidator',
            packages: {
              npm: {
                missing: ['@mui/material', '@thirdweb-dev/react'],
                conflicts: ['react-router-dom'],
                status: 'incomplete'
              },
              python: {
                missing: ['deepseek-ai', 'fastapi'],
                version_mismatch: ['pandas'],
                status: 'incompatible'
              }
            },
            services: {
              docker: {
                required: ['ollama', 'trading-api'],
                unhealthy: ['ollama'],
                status: 'degraded'
              },
              external: {
                required: ['binance-api', 'deepseek-api'],
                unreachable: ['deepseek-api'],
                status: 'disconnected'
              }
            },
            system: {
              memory: {
                required: '4GB',
                available: '2GB',
                status: 'insufficient'
              },
              disk: {
                required: '10GB',
                available: '5GB',
                status: 'low'
              }
            }
          };
          throw new Error('Config Error: Trading dependencies validation failed');
        case 'resources':
          configData.resources = {
            component: 'ResourceManager',
            allocation: {
              cpu: {
                required: '4 cores',
                available: '2 cores',
                status: 'insufficient'
              },
              gpu: {
                required: 'cuda',
                available: 'none',
                status: 'missing'
              }
            },
            limits: {
              memory: {
                heap: {
                  maximum: '2GB',
                  used: '1.8GB',
                  status: 'critical'
                },
                cache: {
                  maximum: '1GB',
                  used: '900MB',
                  status: 'warning'
                }
              },
              storage: {
                temp: {
                  maximum: '5GB',
                  used: '4.5GB',
                  status: 'warning'
                },
                logs: {
                  maximum: '2GB',
                  used: '1.9GB',
                  status: 'critical'
                }
              }
            }
          };
          throw new Error('Config Error: Trading resources validation failed');
        case 'recovered':
          return <div data-testid="recovered-content">Trading configuration restored</div>;
      }
    }

    const { unmount, rerender } = render(
      <ErrorBoundary>
        <ConfigErrorComponent />
      </ErrorBoundary>
    );

    // Initial environment error state
    expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
    expect(screen.getByText('Config Error: Trading environment validation failed')).toBeInTheDocument();
    expect(configAttempts).toBe(1);
    expect(configData.environment.variables.api_keys.status).toBe('incomplete');

    // Environment → Dependencies transition
    const retryButton = screen.getByTestId('error-boundary-retry');
    currentState = 'dependencies';
    await user.click(retryButton);

    await waitFor(() => {
      expect(retryButton).toBeDisabled();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    rerender(
      <ErrorBoundary>
        <ConfigErrorComponent />
      </ErrorBoundary>
    );

    // Verify dependencies error state
    await waitFor(() => {
      expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
      expect(screen.getByText('Config Error: Trading dependencies validation failed')).toBeInTheDocument();
      expect(configData.dependencies.packages.npm.status).toBe('incomplete');
    });

    // Dependencies → Resources transition
    currentState = 'resources';
    await user.click(retryButton);

    rerender(
      <ErrorBoundary>
        <ConfigErrorComponent />
      </ErrorBoundary>
    );

    // Verify resources error state
    await waitFor(() => {
      expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
      expect(screen.getByText('Config Error: Trading resources validation failed')).toBeInTheDocument();
      expect(configData.resources.allocation.cpu.status).toBe('insufficient');
    });

    // Resources → Recovered transition
    configData = {};
    currentState = 'recovered';
    await user.click(retryButton);

    rerender(
      <ErrorBoundary>
        <ConfigErrorComponent />
      </ErrorBoundary>
    );

    // Verify recovered state
    await waitFor(() => {
      expect(screen.queryByTestId('error-boundary')).not.toBeInTheDocument();
      expect(screen.getByTestId('recovered-content')).toBeInTheDocument();
      expect(screen.getByText('Trading configuration restored')).toBeInTheDocument();
      expect(Object.keys(configData)).toHaveLength(0);
    });

    // Test cleanup
    unmount();
    expect(screen.queryByTestId('error-boundary')).not.toBeInTheDocument();
    expect(screen.queryByTestId('recovered-content')).not.toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
