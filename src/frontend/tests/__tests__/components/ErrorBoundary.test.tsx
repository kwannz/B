import React from 'react'
import { render, screen, waitFor, fireEvent } from '../../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import ErrorBoundary from '@/app/components/ErrorBoundary'

describe('ErrorBoundary', () => {
  const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  afterAll(() => {
    mockConsoleError.mockRestore()
  })

describe('ErrorBoundary', () => {
  const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  const mockCleanup = jest.fn()
  const mockWebSocket = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    close: jest.fn(),
    send: jest.fn()
  }

  beforeAll(() => {
    global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket)
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockCleanup.mockClear()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  afterAll(() => {
    mockConsoleError.mockRestore()
  })

  describe('Basic Error Handling', () => {
    it('renders children when no error occurs', () => {
      const { container } = render(
        <ErrorBoundary>
          <div data-testid="child">Test Content</div>
        </ErrorBoundary>
      )
      expect(screen.getByTestId('child')).toBeInTheDocument()
      expect(container).toMatchSnapshot('Error Boundary - Normal State')
    })

    it('renders error UI when error occurs', () => {
      const ErrorComponent = () => {
        throw new Error('Test error')
      }

      const { container } = render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
      expect(screen.getByText(/Test error/i)).toBeInTheDocument()
      expect(screen.getByTestId('error-boundary-retry')).toBeInTheDocument()
      expect(container).toMatchSnapshot('Error Boundary - Error State')
    })

    it('handles retry functionality', async () => {
      let shouldThrow = true
      const RetryComponent = () => {
        if (shouldThrow) {
          throw new Error('Test error')
        }
        return <div data-testid="success">Success</div>
      }

      const { container } = render(
        <ErrorBoundary>
          <RetryComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Test error/i)).toBeInTheDocument()
      const retryButton = screen.getByTestId('error-boundary-retry')
      shouldThrow = false
      await userEvent.click(retryButton)
      expect(screen.getByTestId('success')).toBeInTheDocument()
      expect(container).toMatchSnapshot('Error Boundary - After Recovery')
    })
  })

  describe('Advanced Error Handling', () => {
    it('handles async errors', async () => {
      const AsyncComponent = () => {
        const [error, setError] = React.useState<Error | null>(null)
        
        React.useEffect(() => {
          const fetchData = async () => {
            try {
              throw new Error('Async error')
            } catch (err) {
              setError(err as Error)
            }
          }
          fetchData()
        }, [])

        if (error) throw error
        return <div>Loading...</div>
      }

      const { container } = render(
        <ErrorBoundary>
          <AsyncComponent />
        </ErrorBoundary>
      )

      await waitFor(() => {
        expect(screen.getByText(/Async error/i)).toBeInTheDocument()
      })
      expect(container).toMatchSnapshot('Error Boundary - Async Error')
    })

    it('handles cleanup and memory leaks', () => {
      const mockCleanup = jest.fn()
      const LeakyComponent = () => {
        React.useEffect(() => {
          const interval = setInterval(() => {
            throw new Error('Memory leak error')
          }, 100)
          return () => {
            clearInterval(interval)
            mockCleanup()
          }
        }, [])
        return <div>Leaky Component</div>
      }

      const { container, unmount } = render(
        <ErrorBoundary>
          <LeakyComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Memory leak error/i)).toBeInTheDocument()
      unmount()
      expect(mockCleanup).toHaveBeenCalled()
      expect(container).toMatchSnapshot('Error Boundary - After Cleanup')
    })

    it('handles trading workflow errors', async () => {
      const TradingComponent = () => {
        const [error, setError] = React.useState<Error | null>(null)
        const [data, setData] = React.useState<string[]>([])

        React.useEffect(() => {
          const fetchData = async () => {
            try {
              throw new Error('Trading API error')
            } catch (err) {
              setError(err as Error)
            }
          }
          fetchData()
        }, [])

        if (error) throw error
        return <div>Trading Data: {data.join(', ')}</div>
      }

      const { container } = render(
        <ErrorBoundary>
          <TradingComponent />
        </ErrorBoundary>
      )

      await waitFor(() => {
        expect(screen.getByText(/Trading API error/i)).toBeInTheDocument()
      })
      expect(container).toMatchSnapshot('Error Boundary - Trading Error')

      const retryButton = screen.getByTestId('error-boundary-retry')
      await userEvent.click(retryButton)

      expect(screen.getByText(/Trading Data:/i)).toBeInTheDocument()
      expect(container).toMatchSnapshot('Error Boundary - After Trading Recovery')
    })
  })

  describe('Error Recovery and State Management', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
      jest.clearAllMocks()
    })

    it('recovers from errors and maintains state', async () => {
      const StateComponent = () => {
        const [count, setCount] = React.useState(0)
        const [shouldError, setShouldError] = React.useState(false)

        React.useEffect(() => {
          if (shouldError) {
            throw new Error('State error')
          }
        }, [shouldError])

        return (
          <div>
            <div data-testid="count">Count: {count}</div>
            <button onClick={() => setCount(prev => prev + 1)}>Increment</button>
            <button onClick={() => setShouldError(true)}>Trigger Error</button>
          </div>
        )
      }

      const { container } = render(
        <ErrorBoundary>
          <StateComponent />
        </ErrorBoundary>
      )

      const incrementButton = screen.getByText(/Increment/i)
      await userEvent.click(incrementButton)
      await userEvent.click(incrementButton)
      expect(screen.getByTestId('count')).toHaveTextContent('Count: 2')

      const errorButton = screen.getByText(/Trigger Error/i)
      await userEvent.click(errorButton)
      expect(screen.getByText(/State error/i)).toBeInTheDocument()
      expect(container).toMatchSnapshot('Error Boundary - State Error')

      const retryButton = screen.getByTestId('error-boundary-retry')
      await userEvent.click(retryButton)
      expect(screen.getByTestId('count')).toHaveTextContent('Count: 0')
      expect(container).toMatchSnapshot('Error Boundary - After Recovery')
    })

    it('handles multiple error recoveries', async () => {
      const MultiErrorComponent = () => {
        const [errorCount, setErrorCount] = React.useState(0)

        React.useEffect(() => {
          if (errorCount > 0) {
            throw new Error(`Error ${errorCount}`)
          }
        }, [errorCount])

        return (
          <button onClick={() => setErrorCount(prev => prev + 1)}>
            Trigger Error {errorCount}
          </button>
        )
      }

      const { container } = render(
        <ErrorBoundary>
          <MultiErrorComponent />
        </ErrorBoundary>
      )

      const triggerButton = screen.getByText(/Trigger Error/i)
      await userEvent.click(triggerButton)
      expect(screen.getByText(/Error 1/i)).toBeInTheDocument()

      const retryButton = screen.getByTestId('error-boundary-retry')
      await userEvent.click(retryButton)
      expect(screen.getByText(/Trigger Error 0/i)).toBeInTheDocument()

      await userEvent.click(triggerButton)
      expect(screen.getByText(/Error 1/i)).toBeInTheDocument()
      expect(container).toMatchSnapshot('Error Boundary - Multiple Errors')
    })
  })

  describe('Memory Leaks and Cleanup', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
      jest.clearAllMocks()
    })

    it('cleans up resources on unmount', () => {
      const mockCleanup = jest.fn()
      const CleanupComponent = () => {
        React.useEffect(() => {
          const timer = setInterval(() => {}, 1000)
          return () => {
            clearInterval(timer)
            mockCleanup()
          }
        }, [])
        throw new Error('Test error')
      }

      const { unmount } = render(
        <ErrorBoundary>
          <CleanupComponent />
        </ErrorBoundary>
      )

      unmount()
      expect(mockCleanup).toHaveBeenCalled()
    })

    it('handles memory leaks in error states', () => {
      const mockCleanup = jest.fn()
      const LeakyComponent = () => {
        React.useEffect(() => {
          const timer = setInterval(() => {}, 1000)
          return () => {
            clearInterval(timer)
            mockCleanup()
          }
        }, [])
        throw new Error('Memory leak test')
      }

      const { unmount } = render(
        <ErrorBoundary>
          <LeakyComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Memory leak test/i)).toBeInTheDocument()
      unmount()
      expect(mockCleanup).toHaveBeenCalled()
    })

    it('cleans up subscriptions on error recovery', async () => {
      const mockCleanup = jest.fn()
      const SubscriptionComponent = () => {
        const [shouldError, setShouldError] = React.useState(false)

        React.useEffect(() => {
          const subscription = { unsubscribe: mockCleanup }
          if (shouldError) {
            throw new Error('Subscription error')
          }
          return () => subscription.unsubscribe()
        }, [shouldError])

        return (
          <button onClick={() => setShouldError(true)}>
            Trigger Error
          </button>
        )
      }

      render(
        <ErrorBoundary>
          <SubscriptionComponent />
        </ErrorBoundary>
      )

      await userEvent.click(screen.getByText(/Trigger Error/i))
      expect(screen.getByText(/Subscription error/i)).toBeInTheDocument()
      expect(mockCleanup).toHaveBeenCalled()
    })
  })

  describe('Error Handling and Recovery', () => {
    it('renders error message and retry button', () => {
      const ErrorComponent = () => {
        throw new Error('Test error')
      }

      render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Test error/i)).toBeInTheDocument()
      expect(screen.getByTestId('error-boundary-retry')).toBeInTheDocument()
    })

    it('handles retry action', async () => {
      let errorThrown = true
      const RetryComponent = () => {
        if (errorThrown) {
          errorThrown = false
          throw new Error('Test error')
        }
        return <div>Success</div>
      }

      render(
        <ErrorBoundary>
          <RetryComponent />
        </ErrorBoundary>
      )

      const retryButton = screen.getByTestId('error-boundary-retry')
      await userEvent.click(retryButton)
      expect(screen.getByText('Success')).toBeInTheDocument()
    })

    it('maintains error state during updates', async () => {
      const ErrorComponent = () => {
        throw new Error('Test error')
      }

      const { rerender } = render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Test error/i)).toBeInTheDocument()

      rerender(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Test error/i)).toBeInTheDocument()
    })
  })

  describe('Lifecycle and Cleanup', () => {
    it('cleans up on unmount', () => {
      const mockCleanup = jest.fn()
      const CleanupComponent = () => {
        React.useEffect(() => {
          return mockCleanup
        }, [])
        throw new Error('Test error')
      }

      const { unmount } = render(
        <ErrorBoundary>
          <CleanupComponent />
        </ErrorBoundary>
      )

      unmount()
      expect(mockCleanup).toHaveBeenCalled()
    })

    it('handles nested error boundaries', () => {
      const NestedError = () => {
        throw new Error('Nested error')
      }

      render(
        <ErrorBoundary>
          <div>
            <ErrorBoundary>
              <NestedError />
            </ErrorBoundary>
            <div>Sibling content</div>
          </div>
        </ErrorBoundary>
      )

      expect(screen.getByText(/Nested error/i)).toBeInTheDocument()
      expect(screen.getByText(/Sibling content/i)).toBeInTheDocument()
    })
  })

    it('handles state updates during error recovery', async () => {
      const StateUpdateComponent = () => {
        const [count, setCount] = React.useState(0)
        const [shouldError, setShouldError] = React.useState(false)

        React.useEffect(() => {
          if (shouldError) {
            throw new Error('State update error')
          }
        }, [shouldError])

        return (
          <div>
            <div data-testid="count">Count: {count}</div>
            <button onClick={() => setCount(c => c + 1)}>Increment</button>
            <button onClick={() => setShouldError(true)}>Trigger Error</button>
          </div>
        )
      }

      const { container } = render(
        <ErrorBoundary>
          <StateUpdateComponent />
        </ErrorBoundary>
      )

      // Initial state
      expect(screen.getByTestId('count')).toHaveTextContent('Count: 0')

      // Update state before error
      await userEvent.click(screen.getByText(/Increment/i))
      await userEvent.click(screen.getByText(/Increment/i))
      expect(screen.getByTestId('count')).toHaveTextContent('Count: 2')

      // Trigger error
      await userEvent.click(screen.getByText(/Trigger Error/i))
      expect(screen.getByText(/State update error/i)).toBeInTheDocument()
      expect(container).toMatchSnapshot('Error Boundary - State Update Error')

      // Recover and verify state reset
      const retryButton = screen.getByTestId('error-boundary-retry')
      await userEvent.click(retryButton)
      expect(screen.getByTestId('count')).toHaveTextContent('Count: 0')
      expect(container).toMatchSnapshot('Error Boundary - After State Recovery')
    })

    it('maintains error boundary state during updates', async () => {
      const mockError = jest.fn()
      const originalError = console.error
      console.error = mockError

      const ErrorComponent = () => {
        throw new Error('Test error')
      }

      const { container, rerender } = render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Test error/i)).toBeInTheDocument()
      expect(container).toMatchSnapshot('Error Boundary - Initial Error')

      // Rerender should maintain error state
      rerender(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Test error/i)).toBeInTheDocument()
      expect(container).toMatchSnapshot('Error Boundary - After Rerender')

      console.error = originalError
    })

    it('handles nested error boundaries correctly', () => {
      const NestedErrorComponent = () => {
        throw new Error('Nested error')
      }

      const { container } = render(
        <ErrorBoundary>
          <div>
            <ErrorBoundary>
              <NestedErrorComponent />
            </ErrorBoundary>
            <div>Sibling content</div>
          </div>
        </ErrorBoundary>
      )

      expect(screen.getByText(/Nested error/i)).toBeInTheDocument()
      expect(screen.getByText(/Sibling content/i)).toBeInTheDocument()
      expect(container).toMatchSnapshot('Error Boundary - Nested Error')
    })
  })

  describe('Component Lifecycle', () => {
    it('handles component mount errors', () => {
      const MountErrorComponent = () => {
        React.useEffect(() => {
          throw new Error('Mount error')
        }, [])
        return null
      }

      const { container } = render(
        <ErrorBoundary>
          <MountErrorComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Mount error/i)).toBeInTheDocument()
      expect(container).toMatchSnapshot('Error Boundary - Mount Error')
    })

    it('handles component update errors', () => {
      const UpdateErrorComponent = () => {
        const [count, setCount] = React.useState(0)

        React.useEffect(() => {
          if (count > 0) {
            throw new Error('Update error')
          }
        }, [count])

        return (
          <button onClick={() => setCount(prev => prev + 1)}>
            Update
          </button>
        )
      }

      const { container } = render(
        <ErrorBoundary>
          <UpdateErrorComponent />
        </ErrorBoundary>
      )

      fireEvent.click(screen.getByText(/Update/i))
      expect(screen.getByText(/Update error/i)).toBeInTheDocument()
      expect(container).toMatchSnapshot('Error Boundary - Update Error')
    })

    it('handles cleanup during errors', () => {
      const mockCleanup = jest.fn()
      const CleanupComponent = () => {
        React.useEffect(() => {
          return () => mockCleanup()
        }, [])
        throw new Error('Cleanup test error')
      }

      const { container, unmount } = render(
        <ErrorBoundary>
          <CleanupComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Cleanup test error/i)).toBeInTheDocument()
      unmount()
      expect(mockCleanup).toHaveBeenCalled()
      expect(container).toMatchSnapshot('Error Boundary - After Cleanup')
    })

    it('handles nested component errors', () => {
      const NestedComponent = () => {
        throw new Error('Nested error')
      }

      const ParentComponent = () => (
        <div>
          <div>Parent</div>
          <NestedComponent />
        </div>
      )

      const { container } = render(
        <ErrorBoundary>
          <ParentComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Nested error/i)).toBeInTheDocument()
      expect(container).toMatchSnapshot('Error Boundary - Nested Error')
    })
  })

    describe('Network and WebSocket Handling', () => {
      const mockWebSocket = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        close: jest.fn(),
        send: jest.fn()
      }

      beforeAll(() => {
        global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket)
      })

      afterEach(() => {
        jest.clearAllMocks()
      })

      it('handles WebSocket connection errors', () => {
        const StreamComponent = () => {
          React.useEffect(() => {
            const ws = new WebSocket('ws://localhost:8080')
            ws.addEventListener('error', () => {
              throw new Error('WebSocket connection failed')
            })
            return () => ws.close()
          }, [])
          return <div>Streaming Data</div>
        }

        const { container } = render(
          <ErrorBoundary>
            <StreamComponent />
          </ErrorBoundary>
        )

        const errorEvent = new Event('error')
        mockWebSocket.addEventListener.mock.calls[0][1](errorEvent)

        expect(screen.getByText(/WebSocket connection failed/i)).toBeInTheDocument()
        expect(container).toMatchSnapshot('Error Boundary - WebSocket Error')
      })

      it('handles network request errors', async () => {
        const NetworkComponent = () => {
          const [error, setError] = React.useState<Error | null>(null)

          React.useEffect(() => {
            const fetchData = async () => {
              try {
                const response = await fetch('https://api.example.com/data')
                if (!response.ok) throw new Error('Network request failed')
              } catch (err) {
                setError(err as Error)
              }
            }
            fetchData()
          }, [])

          if (error) throw error
          return <div>Network Data</div>
        }

        global.fetch = jest.fn(() => Promise.reject(new Error('Network error')))

        const { container } = render(
          <ErrorBoundary>
            <NetworkComponent />
          </ErrorBoundary>
        )

        await waitFor(() => {
          expect(screen.getByText(/Network error/i)).toBeInTheDocument()
        })
        expect(container).toMatchSnapshot('Error Boundary - Network Error')
      })
    })

    describe('Form and Context Handling', () => {
      it('handles form submission errors', async () => {
        const FormComponent = () => {
          const [error, setError] = React.useState<Error | null>(null)
          const [submitted, setSubmitted] = React.useState(false)

          const handleSubmit = async (e: React.FormEvent) => {
            e.preventDefault()
            try {
              throw new Error('Form submission failed')
            } catch (err) {
              setError(err as Error)
            }
          }

          if (error) throw error
          return (
            <form onSubmit={handleSubmit} data-testid="error-form">
              <button type="submit">Submit</button>
              {submitted && <div>Success</div>}
            </form>
          )
        }

        const { container } = render(
          <ErrorBoundary>
            <FormComponent />
          </ErrorBoundary>
        )

        const form = screen.getByTestId('error-form')
        await userEvent.submit(form)

        expect(screen.getByText(/Form submission failed/i)).toBeInTheDocument()
        expect(container).toMatchSnapshot('Error Boundary - Form Error')
      })

      it('handles context state changes', async () => {
        const TradingContext = React.createContext<{
          state: { balance: number };
          dispatch: React.Dispatch<any>;
        } | null>(null)

      const TradingProvider = ({ children }: { children: React.ReactNode }) => {
        const [state, dispatch] = React.useReducer(
          (state: any, action: any) => {
            switch (action.type) {
              case 'UPDATE_BALANCE':
                if (action.payload === 0) {
                  throw new Error('Invalid balance update')
                }
                return { ...state, balance: action.payload }
              default:
                return state
            }
          },
          { balance: 100 }
        )

        return (
          <TradingContext.Provider value={{ state, dispatch }}>
            {children}
          </TradingContext.Provider>
        )
      }

      const TradingComponent = () => {
        const context = React.useContext(TradingContext)
        if (!context) throw new Error('Must be used within TradingProvider')

        const handleUpdate = () => {
          context.dispatch({ type: 'UPDATE_BALANCE', payload: 0 })
        }

        return (
          <div>
            <div data-testid="balance">Balance: {context.state.balance}</div>
            <button onClick={handleUpdate} data-testid="update-balance">
              Update
            </button>
          </div>
        )
      }

      const { container } = render(
        <ErrorBoundary>
          <TradingProvider>
            <TradingComponent />
          </TradingProvider>
        </ErrorBoundary>
      )

      expect(screen.getByTestId('balance')).toHaveTextContent('Balance: 100')
      const updateButton = screen.getByTestId('update-balance')
      await userEvent.click(updateButton)

      expect(screen.getByText(/Invalid balance update/i)).toBeInTheDocument()
      expect(container).toMatchSnapshot('Error Boundary - Context Error')

      const retryButton = screen.getByTestId('error-boundary-retry')
      await userEvent.click(retryButton)

      expect(screen.getByTestId('balance')).toHaveTextContent('Balance: 100')
      expect(container).toMatchSnapshot('Error Boundary - After Context Recovery')
    })

    it('handles memory leaks and cleanup', () => {
      const mockCleanup = jest.fn()
      const LeakyComponent = () => {
        React.useEffect(() => {
          const interval = setInterval(() => {
            throw new Error('Memory leak error')
          }, 100)
          return () => {
            clearInterval(interval)
            mockCleanup()
          }
        }, [])
        return <div>Leaky Component</div>
      }

      const { container, unmount } = render(
        <ErrorBoundary>
          <LeakyComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Memory leak error/i)).toBeInTheDocument()
      unmount()
      expect(mockCleanup).toHaveBeenCalled()
      expect(container).toMatchSnapshot('Error Boundary - After Cleanup')
    })
  })

  describe('Basic Error Handling', () => {
    it('renders error message and retry button', () => {
      const ErrorComponent = () => {
        throw new Error('Test error')
      }

      const { container } = render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Test error/i)).toBeInTheDocument()
      expect(screen.getByTestId('error-boundary-retry')).toBeInTheDocument()
      expect(container).toMatchSnapshot('Error State')
    })

    it('handles retry functionality', async () => {
      let shouldThrow = true
      const RetryComponent = () => {
        if (shouldThrow) {
          throw new Error('Retry test error')
        }
        return <div>Success</div>
      }

      render(
        <ErrorBoundary>
          <RetryComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Retry test error/i)).toBeInTheDocument()
      const retryButton = screen.getByTestId('error-boundary-retry')
      shouldThrow = false
      await userEvent.click(retryButton)
      expect(screen.getByText('Success')).toBeInTheDocument()
    })
  })

  describe('Trading Integration', () => {
    it('handles trading workflow errors', async () => {
      const TradingComponent = () => {
        const [error, setError] = React.useState<Error | null>(null)
        const [data, setData] = React.useState<any>(null)

        React.useEffect(() => {
          const fetchData = async () => {
            try {
              throw new Error('Trading workflow error')
            } catch (err) {
              setError(err as Error)
            }
          }
          fetchData()
        }, [])

        if (error) throw error
        return <div>Trading Data: {JSON.stringify(data)}</div>
      }

      render(
        <ErrorBoundary>
          <TradingComponent />
        </ErrorBoundary>
      )

      await waitFor(() => {
        expect(screen.getByText(/Trading workflow error/i)).toBeInTheDocument()
      })
    })

    it('handles WebSocket connection errors', () => {
      const mockWebSocket = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        close: jest.fn()
      }

      const StreamComponent = () => {
        React.useEffect(() => {
          const interval = setInterval(() => {
            throw new Error('WebSocket connection error')
          }, 100)
          return () => {
            clearInterval(interval)
            mockCleanup()
          }
        }, [])
        return <div>Stream Data</div>
      }

      const { unmount } = render(
        <ErrorBoundary>
          <StreamComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/WebSocket connection error/i)).toBeInTheDocument()
      unmount()
      expect(mockCleanup).toHaveBeenCalled()
    })
  })

  describe('Memory Management', () => {
    it('handles cleanup and memory leaks', () => {
      const LeakyComponent = () => {
        React.useEffect(() => {
          const interval = setInterval(() => {
            throw new Error('Memory leak error')
          }, 100)
          return () => {
            clearInterval(interval)
            mockCleanup()
          }
        }, [])
        return <div>Leaky Component</div>
      }

      const { unmount } = render(
        <ErrorBoundary>
          <LeakyComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Memory leak error/i)).toBeInTheDocument()
      unmount()
      expect(mockCleanup).toHaveBeenCalled()
    })
  })

  describe('Form Integration', () => {
    it('handles form submission errors', async () => {
      const FormComponent = () => {
        const handleSubmit = (e: React.FormEvent) => {
          e.preventDefault()
          throw new Error('Form submission error')
        }

        return (
          <form onSubmit={handleSubmit}>
            <button type="submit">Submit</button>
          </form>
        )
      }

      render(
        <ErrorBoundary>
          <FormComponent />
        </ErrorBoundary>
      )

      const submitButton = screen.getByRole('button')
      await userEvent.click(submitButton)
      expect(screen.getByText(/Form submission error/i)).toBeInTheDocument()
    })
  })
})

  describe('Basic Error Handling', () => {
    it('renders error message and retry button', () => {
      const ErrorComponent = () => {
        throw new Error('Test error')
      }

      const { container } = render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Test error/i)).toBeInTheDocument()
      expect(screen.getByTestId('error-boundary-retry')).toBeInTheDocument()
      expect(container).toMatchSnapshot('Error State')
    })

    it('handles retry functionality', async () => {
      let shouldThrow = true
      const RetryComponent = () => {
        if (shouldThrow) {
          throw new Error('Retry test error')
        }
        return <div>Success</div>
      }

      render(
        <ErrorBoundary>
          <RetryComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Retry test error/i)).toBeInTheDocument()
      const retryButton = screen.getByTestId('error-boundary-retry')
      shouldThrow = false
      await userEvent.click(retryButton)
      expect(screen.getByText('Success')).toBeInTheDocument()
    })
  })

  describe('Advanced Error Handling', () => {
    it('handles async errors', async () => {
      const AsyncComponent = () => {
        const [error, setError] = React.useState<Error | null>(null)

        React.useEffect(() => {
          const fetchData = async () => {
            try {
              throw new Error('Async error')
            } catch (e) {
              setError(e as Error)
            }
          }
          fetchData()
        }, [])

        if (error) throw error
        return <div>Loading...</div>
      }

      render(
        <ErrorBoundary>
          <AsyncComponent />
        </ErrorBoundary>
      )

      await waitFor(() => {
        expect(screen.getByText(/Async error/i)).toBeInTheDocument()
      })
    })

    it('handles cleanup and memory leaks', () => {
      const mockCleanup = jest.fn()
      const LeakyComponent = () => {
        React.useEffect(() => {
          const interval = setInterval(() => {
            throw new Error('Memory leak error')
          }, 100)
          return () => {
            clearInterval(interval)
            mockCleanup()
          }
        }, [])
        return <div>Leaky Component</div>
      }

      const { unmount } = render(
        <ErrorBoundary>
          <LeakyComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Memory leak error/i)).toBeInTheDocument()
      unmount()
      expect(mockCleanup).toHaveBeenCalled()
    })
  })

  describe('Trading Integration', () => {
    it('handles trading workflow errors', async () => {
      const TradingComponent = () => {
        const [balance, setBalance] = React.useState('100')
        const handleTrade = () => {
          if (Number(balance) < 0) throw new Error('Insufficient balance')
          setBalance('-50')
        }
        return (
          <div>
            <span>Balance: {balance}</span>
            <button onClick={handleTrade}>Execute Trade</button>
          </div>
        )
      }

      render(
        <ErrorBoundary>
          <TradingComponent />
        </ErrorBoundary>
      )

      const tradeButton = screen.getByText(/Execute Trade/i)
      await userEvent.click(tradeButton)
      expect(screen.getByText(/Insufficient balance/i)).toBeInTheDocument()
    })

    it('handles network errors', async () => {
      const NetworkComponent = () => {
        const [error, setError] = React.useState<Error | null>(null)
        React.useEffect(() => {
          const fetchData = async () => {
            try {
              throw new Error('Network error')
            } catch (e) {
              setError(e as Error)
            }
          }
          fetchData()
        }, [])
        if (error) throw error
        return <div>Loading...</div>
      }

      render(
        <ErrorBoundary>
          <NetworkComponent />
        </ErrorBoundary>
      )

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument()
      })
    })
  })
})

describe('ErrorBoundary', () => {
  const originalError = console.error
  const mockCleanup = jest.fn()
  
  beforeAll(() => {
    console.error = (...args: any[]) => {
      if (/React will try to recreate this component tree/.test(args[0])) return
      originalError.call(console, ...args)
    }
  })

  afterAll(() => {
    console.error = originalError
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockCleanup.mockClear()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('Error Boundary Component', () => {
    describe('Basic Error Handling', () => {
      it('renders error message and retry button', () => {
        const ErrorComponent = () => {
          throw new Error('Test error')
        }

        const { container } = render(
          <ErrorBoundary>
            <ErrorComponent />
          </ErrorBoundary>
        )

        expect(screen.getByText(/Test error/i)).toBeInTheDocument()
        expect(screen.getByTestId('error-boundary-retry')).toBeInTheDocument()
        expect(container).toMatchSnapshot('Error State')
      })

      it('handles retry functionality', async () => {
        let shouldThrow = true
        const RetryComponent = () => {
          if (shouldThrow) {
            throw new Error('Retry test error')
          }
          return <div>Success</div>
        }

        const { container } = render(
          <ErrorBoundary>
            <RetryComponent />
          </ErrorBoundary>
        )

        expect(screen.getByText(/Retry test error/i)).toBeInTheDocument()
        expect(container).toMatchSnapshot('Before Retry')

        shouldThrow = false
        const retryButton = screen.getByTestId('error-boundary-retry')
        await userEvent.click(retryButton)

        expect(screen.getByText('Success')).toBeInTheDocument()
        expect(container).toMatchSnapshot('After Retry')
      })
    })

    describe('Advanced Error Handling', () => {
      it('handles memory leaks and cleanup', async () => {
        const mockInterval = jest.fn()
        const mockClearInterval = jest.fn()
        global.setInterval = mockInterval
        global.clearInterval = mockClearInterval

        const LeakyComponent = () => {
          React.useEffect(() => {
            const interval = setInterval(() => {
              throw new Error('Memory leak error')
            }, 1000)
            return () => clearInterval(interval)
          }, [])
          return <div>Leaky component</div>
        }

        const { container, unmount } = render(
          <ErrorBoundary>
            <LeakyComponent />
          </ErrorBoundary>
        )

        expect(screen.getByText(/Leaky component/i)).toBeInTheDocument()
        expect(container).toMatchSnapshot('Before Memory Leak')

        unmount()
        expect(mockClearInterval).toHaveBeenCalled()
        expect(container).toMatchSnapshot('After Memory Leak Cleanup')
      })

      it('handles complex state management', async () => {
        const mockFetch = jest.fn()
        const TradingDataComponent = () => {
          const [data, setData] = React.useState<any>(null)
          const [error, setError] = React.useState<Error | null>(null)
          
          React.useEffect(() => {
            const handleMessage = async () => {
              try {
                await mockFetch()
                throw new Error('Trading data error')
              } catch (err) {
                setError(err as Error)
              }
            }

            const handleError = (errorEvent: ErrorEvent) => {
              setError(new Error(errorEvent.message))
            }

            window.addEventListener('error', handleError)
            handleMessage()

            return () => {
              window.removeEventListener('error', handleError)
            }
          }, [])

          if (error) throw error
          return <div>Trading data: {JSON.stringify(data)}</div>
        }

        const { container } = render(
          <ErrorBoundary>
            <TradingDataComponent />
          </ErrorBoundary>
        )

        expect(screen.getByText(/Trading data/i)).toBeInTheDocument()
        expect(container).toMatchSnapshot('Before Trading Data Error')

        await waitFor(() => {
          expect(screen.getByText(/Trading data error/i)).toBeInTheDocument()
        })
        expect(container).toMatchSnapshot('After Trading Data Error')
      })

      it('handles trading stream errors', async () => {
        const mockInterval = jest.fn()
        const mockClearInterval = jest.fn()
        global.setInterval = mockInterval
        global.clearInterval = mockClearInterval

        const TradingStreamComponent = () => {
          const [error, setError] = React.useState<Error | null>(null)
          
          React.useEffect(() => {
            const interval = setInterval(() => {
              throw new Error('Trading stream error')
            }, 1000)
            return () => clearInterval(interval)
          }, [])

          if (error) throw error
          return <div>Trading stream active</div>
        }

        const { container, unmount } = render(
          <ErrorBoundary>
            <TradingStreamComponent />
          </ErrorBoundary>
        )

        expect(screen.getByText(/Trading stream active/i)).toBeInTheDocument()
        expect(container).toMatchSnapshot('Before Stream Error')

        unmount()
        expect(mockClearInterval).toHaveBeenCalled()
        expect(container).toMatchSnapshot('After Stream Cleanup')
      })

      it('handles multiple trading errors', async () => {
        const mockFetch = jest.fn()
        const TradingContext = React.createContext<any>(null)
        
        const TradingProvider = ({ children }: { children: React.ReactNode }) => {
          const [state, dispatch] = React.useReducer((state: any, action: any) => {
            switch (action.type) {
              case 'SET_ERROR':
                return { ...state, error: action.payload }
              default:
                return state
            }
          }, { error: null })

          return (
            <TradingContext.Provider value={{ state, dispatch }}>
              {children}
            </TradingContext.Provider>
          )
        }

        const TradingBalance = () => {
          const { dispatch } = React.useContext(TradingContext)
          const handleUpdateBalance = () => {
            throw new Error('Balance update error')
          }

          React.useEffect(() => {
            handleUpdateBalance()
          }, [])

          return <div>Trading balance</div>
        }

        const { container } = render(
          <TradingProvider>
            <ErrorBoundary>
              <TradingBalance />
            </ErrorBoundary>
          </TradingProvider>
        )

        await waitFor(() => {
          expect(screen.getByText(/Balance update error/i)).toBeInTheDocument()
        })
        expect(container).toMatchSnapshot('After Balance Error')
      })

      it('handles trading data stream errors', async () => {
        const mockWebSocket = {
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          close: jest.fn()
        }

        const TradingDataStream = () => {
          const [error, setError] = React.useState<Error | null>(null)
          
          React.useEffect(() => {
            const handleMessage = () => {
              throw new Error('Trading data stream error')
            }

            const handleError = (e: Event) => {
              setError(new Error('WebSocket error'))
            }

            mockWebSocket.addEventListener('message', handleMessage)
            mockWebSocket.addEventListener('error', handleError)

            return () => {
              mockWebSocket.removeEventListener('message', handleMessage)
              mockWebSocket.removeEventListener('error', handleError)
              mockWebSocket.close()
            }
          }, [])

          if (error) throw error
          return <div>Trading data stream connected</div>
        }

        const { container, unmount } = render(
          <ErrorBoundary>
            <TradingDataStream />
          </ErrorBoundary>
        )

        expect(screen.getByText(/Trading data stream connected/i)).toBeInTheDocument()
        expect(container).toMatchSnapshot('Before Stream Error')

        unmount()
        expect(mockWebSocket.close).toHaveBeenCalled()
        expect(container).toMatchSnapshot('After Stream Cleanup')
      })
    })
  })
})
      })
    })

    describe('Memory Management', () => {
      beforeEach(() => {
        jest.useFakeTimers()
      })

      afterEach(() => {
        jest.useRealTimers()
        jest.clearAllMocks()
      })

      it('cleans up resources on unmount', async () => {
        const mockCleanup = jest.fn()
        const CleanupComponent = () => {
          React.useEffect(() => {
            return mockCleanup
          }, [])
          return <div>Cleanup test</div>
        }

        const { unmount } = render(
          <ErrorBoundary>
            <CleanupComponent />
          </ErrorBoundary>
        )

        unmount()
        expect(mockCleanup).toHaveBeenCalled()
      })

      it('handles component lifecycle errors', () => {
        const LifecycleComponent = () => {
          React.useEffect(() => {
            throw new Error('Lifecycle error')
          }, [])
          return <div>Lifecycle test</div>
        }

        const { container } = render(
          <ErrorBoundary>
            <LifecycleComponent />
          </ErrorBoundary>
        )

        expect(screen.getByText(/Lifecycle error/i)).toBeInTheDocument()
        expect(container).toMatchSnapshot('Lifecycle Error')
      })
    })

    describe('Form Handling', () => {
      it('handles form submission errors', async () => {
        const FormComponent = () => {
          const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault()
            throw new Error('Form submission error')
          }

          return (
            <form onSubmit={handleSubmit}>
              <button type="submit">Submit</button>
            </form>
          )
        }

        const { container } = render(
          <ErrorBoundary>
            <FormComponent />
          </ErrorBoundary>
        )

        const submitButton = screen.getByRole('button', { name: /submit/i })
        await userEvent.click(submitButton)

        expect(screen.getByText(/Form submission error/i)).toBeInTheDocument()
        expect(container).toMatchSnapshot('Form Error')
      })
    })
  })

    it('renders error message and retry button', () => {
      const ErrorComponent = () => {
        throw new Error('Test error')
      }

      render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Test error/i)).toBeInTheDocument()
      expect(screen.getByTestId('error-boundary-retry')).toBeInTheDocument()
    })

    it('handles retry functionality', async () => {
      let shouldThrow = true
      const RetryComponent = () => {
        if (shouldThrow) {
          throw new Error('Retry test error')
        }
        return <div>Success</div>
      }

      render(
        <ErrorBoundary>
          <RetryComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Retry test error/i)).toBeInTheDocument()
      const retryButton = screen.getByTestId('error-boundary-retry')
      shouldThrow = false
      await userEvent.click(retryButton)
      expect(screen.getByText('Success')).toBeInTheDocument()
    })
  })

  describe('Basic Error Handling', () => {
    it('renders error message and retry button', () => {
      const ErrorComponent = () => {
        throw new Error('Test error')
      }

      render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Test error/i)).toBeInTheDocument()
      expect(screen.getByTestId('error-boundary-retry')).toBeInTheDocument()
    })

    it('handles retry functionality', async () => {
      let shouldThrow = true
      const RetryComponent = () => {
        if (shouldThrow) {
          throw new Error('Retry test error')
        }
        return <div>Success</div>
      }

      render(
        <ErrorBoundary>
          <RetryComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Retry test error/i)).toBeInTheDocument()
      const retryButton = screen.getByTestId('error-boundary-retry')
      shouldThrow = false
      await userEvent.click(retryButton)
      expect(screen.getByText('Success')).toBeInTheDocument()
    })

    it('matches error state snapshot', () => {
      const ErrorComponent = () => {
        throw new Error('Test error')
      }

      const { container } = render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      )

      expect(container).toMatchSnapshot('Error Boundary - Error State')
    })
  })

  describe('State Management', () => {
    it('handles state errors', async () => {
      const StateComponent = () => {
        const [count, setCount] = React.useState(0)
        React.useEffect(() => {
          if (count === 1) throw new Error('State error')
          setCount(1)
        }, [count])
        return <div>Count: {count}</div>
      }

      render(
        <ErrorBoundary>
          <StateComponent />
        </ErrorBoundary>
      )

      await waitFor(() => {
        expect(screen.getByText(/State error/i)).toBeInTheDocument()
      })
    })

  it('handles async errors', async () => {
    const AsyncComponent = () => {
      const [data, setData] = React.useState<string | null>(null)
      
      React.useEffect(() => {
        const fetchData = async () => {
          throw new Error('Async error')
        }
        fetchData()
      }, [])

      return <div>{data || 'Loading...'}</div>
    }

    render(
      <ErrorBoundary>
        <AsyncComponent />
      </ErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByText(/Async error/i)).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('handles component state errors', async () => {
      const StateComponent = () => {
        const [count, setCount] = React.useState(0)
        
        if (count > 0) {
          throw new Error('State error')
        }

        return (
          <button onClick={() => setCount(prev => prev + 1)}>
            Increment
          </button>
        )
      }

      render(
        <ErrorBoundary>
          <StateComponent />
        </ErrorBoundary>
      )

      const button = screen.getByText('Increment')
      await userEvent.click(button)

      expect(screen.getByText(/State error/i)).toBeInTheDocument()
      expect(screen.getByTestId('error-boundary-retry')).toBeInTheDocument()
    })

    it('handles retry functionality', async () => {
      let shouldThrow = true
      const RetryComponent = () => {
        if (shouldThrow) {
          throw new Error('Retry test')
        }
        return <div>Success</div>
      }

      render(
        <ErrorBoundary>
          <RetryComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Retry test/i)).toBeInTheDocument()
      const retryButton = screen.getByTestId('error-boundary-retry')
      shouldThrow = false
      await userEvent.click(retryButton)
      expect(screen.getByText('Success')).toBeInTheDocument()
    })

    it('handles async errors', async () => {
      const AsyncComponent = () => {
        const [error, setError] = React.useState<Error | null>(null)

        React.useEffect(() => {
          const fetchData = async () => {
            try {
              throw new Error('Async error')
            } catch (e) {
              setError(e as Error)
            }
          }
          fetchData()
        }, [])

        if (error) throw error
        return <div>Loading...</div>
      }

      render(
        <ErrorBoundary>
          <AsyncComponent />
        </ErrorBoundary>
      )

      await waitFor(() => {
        expect(screen.getByText(/Async error/i)).toBeInTheDocument()
        expect(screen.getByTestId('error-boundary-retry')).toBeInTheDocument()
      })
    })

    it('handles cleanup and memory leaks', () => {
      const mockCleanup = jest.fn()
      const LeakyComponent = () => {
        React.useEffect(() => {
          const interval = setInterval(() => {
            throw new Error('Memory leak error')
          }, 100)
          return () => {
            clearInterval(interval)
            mockCleanup()
          }
        }, [])
        return <div>Leaky Component</div>
      }

      const { unmount } = render(
        <ErrorBoundary>
          <LeakyComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Memory leak error/i)).toBeInTheDocument()
      unmount()
      expect(mockCleanup).toHaveBeenCalled()
    })

    it('handles multiple sequential errors', async () => {
      const MultiErrorComponent = () => {
        const [error, setError] = React.useState<string | null>(null)
        
        if (error) throw new Error(error)
        
        return (
          <div>
            <button onClick={() => setError('First error')}>Trigger First Error</button>
            <button onClick={() => setError('Second error')}>Trigger Second Error</button>
          </div>
        )
      }

      render(
        <ErrorBoundary>
          <MultiErrorComponent />
        </ErrorBoundary>
      )

      const firstButton = screen.getByText(/Trigger First Error/i)
      await userEvent.click(firstButton)
      expect(screen.getByText(/First error/i)).toBeInTheDocument()

      const retryButton = screen.getByTestId('error-boundary-retry')
      await userEvent.click(retryButton)

      const secondButton = screen.getByText(/Trigger Second Error/i)
      await userEvent.click(secondButton)
      expect(screen.getByText(/Second error/i)).toBeInTheDocument()
    })

  it('handles error recovery', async () => {
    const RecoverableComponent = () => {
      const [hasError, setHasError] = React.useState(true)
      
      if (hasError) {
        throw new Error('Recoverable error')
      }

      return <div>Recovered</div>
    }

    const { container } = render(
      <ErrorBoundary>
        <RecoverableComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Recoverable error/i)).toBeInTheDocument()
    const retryButton = screen.getByTestId('error-boundary-retry')
    await userEvent.click(retryButton)
    expect(container).toMatchSnapshot('Error Boundary - After Recovery')
  })

  it('handles component unmounting during error', () => {
    const UnmountTestComponent = () => {
      React.useEffect(() => {
        throw new Error('Unmount test error')
      }, [])
      return <div>Unmount Test</div>
    }

    const { unmount } = render(
      <ErrorBoundary>
        <UnmountTestComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Unmount test error/i)).toBeInTheDocument()
    unmount()
  })

  it('handles async component errors', async () => {
    const AsyncComponent = () => {
      const [error, setError] = React.useState<Error | null>(null)

      React.useEffect(() => {
        const fetchData = async () => {
          try {
            throw new Error('Async component error')
          } catch (e) {
            setError(e as Error)
          }
        }
        fetchData()
      }, [])

      if (error) throw error
      return <div>Loading...</div>
    }

    render(
      <ErrorBoundary>
        <AsyncComponent />
      </ErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByText(/Async component error/i)).toBeInTheDocument()
      expect(screen.getByTestId('error-boundary-retry')).toBeInTheDocument()
    })
  })

  it('handles state updates during error recovery', async () => {
    const StateUpdateComponent = () => {
      const [count, setCount] = React.useState(0)
      const [shouldError, setShouldError] = React.useState(true)

      React.useEffect(() => {
        if (count > 0 && shouldError) {
          throw new Error('State update error')
        }
      }, [count, shouldError])

      return (
        <div>
          <button onClick={() => setCount(c => c + 1)}>Increment</button>
          <button onClick={() => setShouldError(false)}>Fix Error</button>
          <span>Count: {count}</span>
        </div>
      )
    }

    render(
      <ErrorBoundary>
        <StateUpdateComponent />
      </ErrorBoundary>
    )

    const incrementButton = screen.getByText('Increment')
    await userEvent.click(incrementButton)
    expect(screen.getByText(/State update error/i)).toBeInTheDocument()

    const retryButton = screen.getByTestId('error-boundary-retry')
    await userEvent.click(retryButton)
    const fixButton = screen.getByText('Fix Error')
    await userEvent.click(fixButton)
    await userEvent.click(incrementButton)
    expect(screen.getByText('Count: 1')).toBeInTheDocument()
  })

  it('handles cleanup and reinitialization', () => {
    const CleanupComponent = () => {
      React.useEffect(() => {
        const timer = setInterval(() => {
          console.log('Timer tick')
        }, 1000)
        return () => clearInterval(timer)
      }, [])

      throw new Error('Cleanup test error')
    }

    const { unmount } = render(
      <ErrorBoundary>
        <CleanupComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Cleanup test error/i)).toBeInTheDocument()
    unmount()
    expect(console.log).toHaveBeenCalledWith('Timer tick')
  })

  it('handles dynamic imports', async () => {
    const DynamicComponent = () => {
      const [Component, setComponent] = React.useState<React.ComponentType | null>(null)
      const [error, setError] = React.useState<Error | null>(null)

      React.useEffect(() => {
        const loadComponent = async () => {
          try {
            throw new Error('Dynamic import error')
          } catch (e) {
            setError(e as Error)
          }
        }
        loadComponent()
      }, [])

      if (error) throw error
      return Component ? <Component /> : <div>Loading...</div>
    }

    render(
      <ErrorBoundary>
        <DynamicComponent />
      </ErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByText(/Dynamic import error/i)).toBeInTheDocument()
      expect(screen.getByTestId('error-boundary-retry')).toBeInTheDocument()
    })
  })

  it('handles context state changes', async () => {
    const TradingContext = React.createContext({ balance: '0', updateBalance: () => {} })
    
    const TradingComponent = () => {
      const { balance } = React.useContext(TradingContext)
      if (Number(balance) < 0) throw new Error('Invalid balance')
      return <div>Balance: {balance}</div>
    }

    const { container } = render(
      <ErrorBoundary>
        <TradingContext.Provider value={{ balance: '-1', updateBalance: () => {} }}>
          <TradingComponent />
        </TradingContext.Provider>
      </ErrorBoundary>
    )

    expect(screen.getByText(/Invalid balance/i)).toBeInTheDocument()
    expect(screen.getByTestId('error-boundary-retry')).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - Context Error')
  })

  it('handles nested component errors', () => {
    const NestedComponent = () => {
      throw new Error('Nested error')
    }

    const ParentComponent = () => (
      <div>
        <h1>Parent</h1>
        <NestedComponent />
      </div>
    )

    const { container } = render(
      <ErrorBoundary>
        <ParentComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Nested error/i)).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - Nested Error')
  })

  it('handles component lifecycle errors', () => {
    const LifecycleComponent = () => {
      React.useEffect(() => {
        throw new Error('Lifecycle error')
      }, [])
      return <div>Lifecycle Component</div>
    }

    const { container } = render(
      <ErrorBoundary>
        <LifecycleComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Lifecycle error/i)).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - Lifecycle Error')
  })

  it('handles form submission errors', async () => {
    const FormComponent = () => {
      const [formData, setFormData] = React.useState({ amount: '' })
      const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (Number(formData.amount) < 0) {
          throw new Error('Invalid amount')
        }
      }

      return (
        <form onSubmit={handleSubmit}>
          <input
            type="number"
            value={formData.amount}
            onChange={(e) => setFormData({ amount: e.target.value })}
          />
          <button type="submit">Submit</button>
        </form>
      )
    }

    const { container } = render(
      <ErrorBoundary>
        <FormComponent />
      </ErrorBoundary>
    )

    const input = screen.getByRole('spinbutton')
    const submitButton = screen.getByRole('button')

    await userEvent.type(input, '-100')
    await userEvent.click(submitButton)

    expect(screen.getByText(/Invalid amount/i)).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - Form Error')
  })

  it('handles state transitions with errors', async () => {
    const StateComponent = () => {
      const [count, setCount] = React.useState(0)

      React.useEffect(() => {
        if (count > 5) {
          throw new Error('Count too high')
        }
      }, [count])

      return (
        <div>
          <span>Count: {count}</span>
          <button onClick={() => setCount(c => c + 1)}>Increment</button>
        </div>
      )
    }

    const { container } = render(
      <ErrorBoundary>
        <StateComponent />
      </ErrorBoundary>
    )

    const button = screen.getByRole('button')
    for (let i = 0; i < 6; i++) {
      await userEvent.click(button)
    }

    expect(screen.getByText(/Count too high/i)).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - State Transition Error')
  })

  it('handles memory leaks', () => {
    const LeakyComponent = () => {
      React.useEffect(() => {
        const interval = setInterval(() => {
          throw new Error('Memory leak error')
        }, 100)
        return () => clearInterval(interval)
      }, [])
      return <div>Leaky Component</div>
    }

    const { unmount } = render(
      <ErrorBoundary>
        <LeakyComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Memory leak error/i)).toBeInTheDocument()
    unmount()
  })

  it('handles multiple errors in sequence', async () => {
    const MultiErrorComponent = () => {
      const [error, setError] = React.useState<string | null>(null)
      
      if (error) throw new Error(error)
      
      return (
        <div>
          <button onClick={() => setError('First error')}>Trigger First Error</button>
          <button onClick={() => setError('Second error')}>Trigger Second Error</button>
        </div>
      )
    }

    render(
      <ErrorBoundary>
        <MultiErrorComponent />
      </ErrorBoundary>
    )

    const firstButton = screen.getByText(/Trigger First Error/i)
    await userEvent.click(firstButton)
    expect(screen.getByText(/First error/i)).toBeInTheDocument()

    const retryButton = screen.getByTestId('error-boundary-retry')
    await userEvent.click(retryButton)

    const secondButton = screen.getByText(/Trigger Second Error/i)
    await userEvent.click(secondButton)
    expect(screen.getByText(/Second error/i)).toBeInTheDocument()
  })
})

describe('ErrorBoundary Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('integrates with trading workflow', async () => {
    const TradingComponent = () => {
      const [balance, setBalance] = React.useState('100')
      const handleTrade = () => {
        if (Number(balance) < 0) throw new Error('Insufficient balance')
        setBalance('-50')
      }
      return (
        <div>
          <span>Balance: {balance}</span>
          <button onClick={handleTrade}>Execute Trade</button>
        </div>
      )
    }

    render(
      <ErrorBoundary>
        <TradingComponent />
      </ErrorBoundary>
    )

    const tradeButton = screen.getByText(/Execute Trade/i)
    await userEvent.click(tradeButton)
    expect(screen.getByText(/Insufficient balance/i)).toBeInTheDocument()
  })

  it('handles network errors', async () => {
    const NetworkComponent = () => {
      const [error, setError] = React.useState<Error | null>(null)
      React.useEffect(() => {
        const fetchData = async () => {
          try {
            throw new Error('Network error')
          } catch (e) {
            setError(e as Error)
          }
        }
        fetchData()
      }, [])
      if (error) throw error
      return <div>Loading...</div>
    }

    render(
      <ErrorBoundary>
        <NetworkComponent />
      </ErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument()
    })
  })
})
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('matches error state snapshot', () => {
    const ErrorComponent = () => {
      throw new Error('Test error')
    }

    const { container } = render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    )

    expect(container).toMatchSnapshot('Error Boundary - Error State')
  })

  it('matches retry state snapshot', async () => {
    const RetryComponent = () => {
      const [shouldError, setShouldError] = React.useState(true)
      if (shouldError) throw new Error('Retry error')
      return <div>Success</div>
    }

    const { container } = render(
      <ErrorBoundary>
        <RetryComponent />
      </ErrorBoundary>
    )

    expect(container).toMatchSnapshot('Error Boundary - Before Retry')
    const retryButton = screen.getByTestId('error-boundary-retry')
    await userEvent.click(retryButton)
    expect(container).toMatchSnapshot('Error Boundary - After Retry')
  })

  it('handles cleanup on unmount', () => {
    const CleanupComponent = () => {
      React.useEffect(() => {
        return () => {
          throw new Error('Cleanup error')
        }
      }, [])
      return <div>Cleanup Test</div>
    }

    const { unmount } = render(
      <ErrorBoundary>
        <CleanupComponent />
      </ErrorBoundary>
    )

    unmount()
    expect(screen.getByText(/Cleanup error/i)).toBeInTheDocument()
  })

  it('handles async state updates', async () => {
    const AsyncStateComponent = () => {
      const [data, setData] = React.useState(null)

      React.useEffect(() => {
        const fetchData = async () => {
          try {
            throw new Error('Async error')
          } catch (e) {
            setData(e)
          }
        }
        fetchData()
      }, [])

      if (data) throw data
      return <div>Loading...</div>
    }

    render(
      <ErrorBoundary>
        <AsyncStateComponent />
      </ErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByText(/Async error/i)).toBeInTheDocument()
    })
  })
})

  it('handles basic errors', () => {
    const ErrorComponent = () => {
      throw new Error('Test error')
      return null
    }

    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Test error/i)).toBeInTheDocument()
    expect(screen.getByTestId('error-boundary-retry')).toBeInTheDocument()
  })

  describe('Basic Functionality', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('renders children when there is no error', async () => {
    const { container } = render(
      <ErrorBoundary>
        <div data-testid="child">Test Content</div>
      </ErrorBoundary>
    )
    
    await waitFor(() => {
      expect(screen.getByTestId('child')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('error-boundary-retry')).not.toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - Normal State')
  })

  it('handles component updates during error state', async () => {
    let shouldThrow = true
    const UpdateComponent = () => {
      if (shouldThrow) {
        throw new Error('Update error')
      }
      return <div data-testid="updated">Updated Content</div>
    }

    const { container } = render(
      <ErrorBoundary>
        <UpdateComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Update error/i)).toBeInTheDocument()
    const retryButton = screen.getByTestId('error-boundary-retry')
    shouldThrow = false
    await userEvent.click(retryButton)

    await waitFor(() => {
      expect(screen.getByTestId('updated')).toBeInTheDocument()
    })
    expect(container).toMatchSnapshot('Error Boundary - After Update')
  })

  it('renders error UI when error occurs', () => {
    const ErrorComponent = () => {
      throw new Error('Test error')
    }

    const { container } = render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
    expect(screen.getByText(/Test error/i)).toBeInTheDocument()
    expect(screen.getByTestId('error-boundary-retry')).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - Error State')
  })

  it('handles retry functionality', async () => {
    let shouldThrow = true
    const RetryComponent = () => {
      if (shouldThrow) {
        throw new Error('Test error')
      }
      return <div data-testid="success">Success</div>
    }

    const { container } = render(
      <ErrorBoundary>
        <RetryComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Test error/i)).toBeInTheDocument()
    const retryButton = screen.getByTestId('error-boundary-retry')
    shouldThrow = false
    await userEvent.click(retryButton)

    await waitFor(() => {
      expect(screen.getByTestId('success')).toBeInTheDocument()
    })
    expect(container).toMatchSnapshot('Error Boundary - After Recovery')
  })

  it('handles multiple retries', async () => {
    let errorCount = 0
    const MultipleErrorComponent = () => {
      if (errorCount < 2) {
        errorCount++
        throw new Error(`Error attempt ${errorCount}`)
      }
      return <div data-testid="success">Success after retries</div>
    }

    const { container } = render(
      <ErrorBoundary>
        <MultipleErrorComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Error attempt 1/i)).toBeInTheDocument()
    const retryButton = screen.getByTestId('error-boundary-retry')
    
    await userEvent.click(retryButton)
    expect(screen.getByText(/Error attempt 2/i)).toBeInTheDocument()
    
    await userEvent.click(retryButton)
    await waitFor(() => {
      expect(screen.getByTestId('success')).toBeInTheDocument()
    })
    expect(container).toMatchSnapshot('Error Boundary - Multiple Retries')
  })

  it('preserves error state across re-renders', () => {
    const ErrorComponent = () => {
      throw new Error('Test error')
    }

    const { container, rerender } = render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Test error/i)).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - Initial Error')
    
    rerender(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    )
    
    expect(screen.getByText(/Test error/i)).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - After Rerender')
  })

  it('handles state updates after error', async () => {
    const { container } = render(
      <ErrorBoundary>
        <div data-testid="content">Content</div>
      </ErrorBoundary>
    )

    const error = new Error('Test error')
    const instance = screen.getByTestId('content').parentElement
    const errorBoundary = instance?.__reactFiber$?.return?.stateNode
    
    if (errorBoundary) {
      errorBoundary.setState({ hasError: true, error })
    }

    await waitFor(() => {
      expect(screen.getByTestId('error-boundary-retry')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('error-boundary-retry'))
    expect(screen.queryByText(/Test error/i)).not.toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - After State Update')
  })

  it('handles nested error boundaries', () => {
    const NestedErrorComponent = () => {
      throw new Error('Nested error')
    }

    const { container } = render(
      <ErrorBoundary>
        <div>
          <ErrorBoundary>
            <NestedErrorComponent />
          </ErrorBoundary>
        </div>
      </ErrorBoundary>
    )

    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
    expect(screen.getByText(/Nested error/i)).toBeInTheDocument()
    expect(screen.getByTestId('error-boundary-retry')).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - Nested Error')
  })

  it('handles component unmounting and cleanup', async () => {
    const mockCleanup = jest.fn()
    const UnmountTestComponent = () => {
      React.useEffect(() => {
        return () => mockCleanup()
      }, [])
      throw new Error('Unmount test error')
    }

    const { container, unmount } = render(
      <ErrorBoundary>
        <UnmountTestComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Unmount test error/i)).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - Before Unmount')
    
    unmount()
    expect(mockCleanup).toHaveBeenCalled()
    expect(console.error).toHaveBeenCalled()
    expect(container).toMatchSnapshot('Error Boundary - After Unmount')
  })

  it('handles multiple component instances', () => {
    const { container } = render(
      <>
        <ErrorBoundary>
          <div data-testid="first">First Instance</div>
        </ErrorBoundary>
        <ErrorBoundary>
          <div data-testid="second">Second Instance</div>
        </ErrorBoundary>
      </>
    )

    expect(screen.getByTestId('first')).toBeInTheDocument()
    expect(screen.getByTestId('second')).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - Multiple Instances')
  })

  it('handles async errors', async () => {
    const AsyncErrorComponent = () => {
      React.useEffect(() => {
        throw new Error('Async error')
      }, [])
      return <div>Loading...</div>
    }

    const { container } = render(
      <ErrorBoundary>
        <AsyncErrorComponent />
      </ErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByText(/Async error/i)).toBeInTheDocument()
    })
    expect(screen.getByTestId('error-boundary-retry')).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - Async Error')
  })

  it('handles dynamic error messages', async () => {
    const errors = ['Error 1', 'Error 2', 'Error 3']
    let errorIndex = 0
    
    const DynamicErrorComponent = () => {
      if (errorIndex < errors.length) {
        throw new Error(errors[errorIndex])
      }
      return <div data-testid="success">Success</div>
    }

    const { container } = render(
      <ErrorBoundary>
        <DynamicErrorComponent />
      </ErrorBoundary>
    )

    for (const error of errors) {
      expect(screen.getByText(error)).toBeInTheDocument()
      const retryButton = screen.getByTestId('error-boundary-retry')
      errorIndex++
      await userEvent.click(retryButton)
    }

    await waitFor(() => {
      expect(screen.getByTestId('success')).toBeInTheDocument()
    })
    expect(container).toMatchSnapshot('Error Boundary - Dynamic Errors')
  })

  it('handles error boundary state transitions', async () => {
    const StateTransitionComponent = () => {
      const [shouldError, setShouldError] = React.useState(true)
      
      React.useEffect(() => {
        if (shouldError) {
          throw new Error('Initial error state')
        }
      }, [shouldError])

      return <div data-testid="transition-success">Transition Complete</div>
    }

    const { container } = render(
      <ErrorBoundary>
        <StateTransitionComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Initial error state/i)).toBeInTheDocument()
    const retryButton = screen.getByTestId('error-boundary-retry')
    
    await userEvent.click(retryButton)
    await waitFor(() => {
      expect(screen.getByTestId('transition-success')).toBeInTheDocument()
    })
    
    expect(container).toMatchSnapshot('Error Boundary - State Transition')
  })

  it('handles prop updates during error state', async () => {
    const PropUpdateComponent = ({ shouldError = true }) => {
      if (shouldError) {
        throw new Error('Prop error state')
      }
      return <div data-testid="prop-success">Props Updated</div>
    }

    const { container, rerender } = render(
      <ErrorBoundary>
        <PropUpdateComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Prop error state/i)).toBeInTheDocument()
    
    rerender(
      <ErrorBoundary>
        <PropUpdateComponent shouldError={false} />
      </ErrorBoundary>
    )

    const retryButton = screen.getByTestId('error-boundary-retry')
    await userEvent.click(retryButton)

    await waitFor(() => {
      expect(screen.getByTestId('prop-success')).toBeInTheDocument()
    })
    expect(container).toMatchSnapshot('Error Boundary - After Prop Update')
  })

  it('handles errors within Suspense boundaries', async () => {
    const SuspenseContent = () => {
      throw new Error('Suspense error')
    }

    const { container } = render(
      <ErrorBoundary>
        <React.Suspense fallback={<div>Loading...</div>}>
          <SuspenseContent />
        </React.Suspense>
      </ErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByText(/Suspense error/i)).toBeInTheDocument()
    })
    expect(screen.getByTestId('error-boundary-retry')).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - Suspense Error')

    const retryButton = screen.getByTestId('error-boundary-retry')
    await userEvent.click(retryButton)
    expect(screen.getByText(/Loading.../i)).toBeInTheDocument()
  })

  it('handles concurrent errors in multiple components', async () => {
    const ErrorComponent1 = () => {
      throw new Error('Error in component 1')
    }

    const ErrorComponent2 = () => {
      throw new Error('Error in component 2')
    }

    const { container } = render(
      <div>
        <ErrorBoundary>
          <ErrorComponent1 />
        </ErrorBoundary>
        <ErrorBoundary>
          <ErrorComponent2 />
        </ErrorBoundary>
      </div>
    )

    expect(screen.getAllByText(/Error in component/i)).toHaveLength(2)
    expect(screen.getAllByTestId('error-boundary-retry')).toHaveLength(2)
    expect(container).toMatchSnapshot('Error Boundary - Concurrent Errors')

    const retryButtons = screen.getAllByTestId('error-boundary-retry')
    await userEvent.click(retryButtons[0])
    await userEvent.click(retryButtons[1])

    expect(screen.getAllByText(/Error in component/i)).toHaveLength(2)
    expect(container).toMatchSnapshot('Error Boundary - After Concurrent Retries')
  })

  it('handles errors with React Context', async () => {
    const TestContext = React.createContext({ value: 'test' })
    const ContextConsumer = () => {
      const context = React.useContext(TestContext)
      if (!context) {
        throw new Error('Context error')
      }
      return <div data-testid="context-content">{context.value}</div>
    }

    const { container } = render(
      <ErrorBoundary>
        <TestContext.Provider value={null as any}>
          <ContextConsumer />
        </TestContext.Provider>
      </ErrorBoundary>
    )

    expect(screen.getByText(/Context error/i)).toBeInTheDocument()
    expect(screen.getByTestId('error-boundary-retry')).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - Context Error')

    const retryButton = screen.getByTestId('error-boundary-retry')
    await userEvent.click(retryButton)
    expect(screen.getByText(/Context error/i)).toBeInTheDocument()
  })

  it('handles cleanup and memory leaks', async () => {
    const mockCleanup = jest.fn()
    const LeakyComponent = () => {
      React.useEffect(() => {
        const interval = setInterval(() => {
          console.log('Memory leak')
        }, 100)
        return () => {
          clearInterval(interval)
          mockCleanup()
        }
      }, [])
      throw new Error('Leak error')
    }

    const { container, unmount } = render(
      <ErrorBoundary>
        <LeakyComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Leak error/i)).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - Before Cleanup')

    unmount()
    expect(mockCleanup).toHaveBeenCalled()
    expect(container).toMatchSnapshot('Error Boundary - After Cleanup')
  })

  it('handles error propagation with Suspense boundaries', async () => {
    const mockError = new Error('Async error')
    const AsyncComponent = () => {
      const [data, setData] = React.useState(null)
      
      React.useEffect(() => {
        const fetchData = async () => {
          try {
            throw mockError
          } catch (error) {
            setData({ error })
          }
        }
        fetchData()
      }, [])

      if (data?.error) {
        throw data.error
      }

      return <div>Loading...</div>
    }

    const { container } = render(
      <ErrorBoundary>
        <React.Suspense fallback={<div>Suspense loading...</div>}>
          <AsyncComponent />
        </React.Suspense>
      </ErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByText(/Async error/i)).toBeInTheDocument()
    })
    expect(screen.getByTestId('error-boundary-retry')).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - Error Propagation')

    const retryButton = screen.getByTestId('error-boundary-retry')
    await userEvent.click(retryButton)
    expect(screen.getByText(/Suspense loading.../i)).toBeInTheDocument()
  })

  it('handles useEffect cleanup during errors', async () => {
    const mockCleanup = jest.fn()
    const mockErrorCleanup = jest.fn()
    
    const EffectComponent = () => {
      const [shouldError, setShouldError] = React.useState(true)
      
      React.useEffect(() => {
        const timer = setTimeout(() => {
          setShouldError(false)
        }, 100)
        
        return () => {
          clearTimeout(timer)
          mockCleanup()
        }
      }, [])

      React.useEffect(() => {
        if (shouldError) {
          return () => mockErrorCleanup()
        }
      }, [shouldError])

      if (shouldError) {
        throw new Error('Effect error')
      }

      return <div data-testid="effect-success">Effect Complete</div>
    }

    const { container, unmount } = render(
      <ErrorBoundary>
        <EffectComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Effect error/i)).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - Effect Error')

    unmount()
    expect(mockCleanup).toHaveBeenCalled()
    expect(mockErrorCleanup).toHaveBeenCalled()
    expect(container).toMatchSnapshot('Error Boundary - After Effect Cleanup')
  })

  it('handles StrictMode double-mounting', async () => {
    const mockMount = jest.fn()
    const mockUnmount = jest.fn()
    
    const StrictComponent = () => {
      React.useEffect(() => {
        mockMount()
        return () => mockUnmount()
      }, [])

      throw new Error('Strict mode error')
    }

    const { container, unmount } = render(
      <React.StrictMode>
        <ErrorBoundary>
          <StrictComponent />
        </ErrorBoundary>
      </React.StrictMode>
    )

    expect(screen.getByText(/Strict mode error/i)).toBeInTheDocument()
    expect(mockMount).toHaveBeenCalledTimes(1)
    expect(container).toMatchSnapshot('Error Boundary - StrictMode Error')

    unmount()
    expect(mockUnmount).toHaveBeenCalledTimes(1)
    expect(container).toMatchSnapshot('Error Boundary - After StrictMode Cleanup')
  })

  it('handles complex error propagation and recovery', async () => {
    const mockErrorLog = jest.fn()
    const mockRecoveryLog = jest.fn()
    
    const ChildComponent = ({ onError, onRecover }: { onError: () => void; onRecover: () => void }) => {
      const [shouldError, setShouldError] = React.useState(true)
      
      React.useEffect(() => {
        if (shouldError) {
          onError()
        } else {
          onRecover()
        }
      }, [shouldError, onError, onRecover])

      if (shouldError) {
        throw new Error('Child component error')
      }

      return <div data-testid="recovered-child">Recovered</div>
    }

    const ParentComponent = () => {
      const handleError = React.useCallback(() => {
        mockErrorLog('Error occurred in child')
      }, [])

      const handleRecovery = React.useCallback(() => {
        mockRecoveryLog('Child recovered')
      }, [])

      return (
        <ErrorBoundary>
          <ChildComponent onError={handleError} onRecover={handleRecovery} />
        </ErrorBoundary>
      )
    }

    const { container } = render(<ParentComponent />)

    expect(screen.getByText(/Child component error/i)).toBeInTheDocument()
    expect(mockErrorLog).toHaveBeenCalledWith('Error occurred in child')
    expect(container).toMatchSnapshot('Error Boundary - Complex Error')

    const retryButton = screen.getByTestId('error-boundary-retry')
    await userEvent.click(retryButton)

    await waitFor(() => {
      expect(screen.getByTestId('recovered-child')).toBeInTheDocument()
    })
    expect(mockRecoveryLog).toHaveBeenCalledWith('Child recovered')
    expect(container).toMatchSnapshot('Error Boundary - After Complex Recovery')
  })

  it('handles errors during component updates', async () => {
    const UpdateErrorComponent = ({ shouldError }: { shouldError: boolean }) => {
      React.useEffect(() => {
        if (shouldError) {
          throw new Error('Update cycle error')
        }
      }, [shouldError])

      return <div data-testid="update-content">Content</div>
    }

    const { container, rerender } = render(
      <ErrorBoundary>
        <UpdateErrorComponent shouldError={false} />
      </ErrorBoundary>
    )

    expect(screen.getByTestId('update-content')).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - Before Update Error')

    rerender(
      <ErrorBoundary>
        <UpdateErrorComponent shouldError={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Update cycle error/i)).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - After Update Error')

    const retryButton = screen.getByTestId('error-boundary-retry')
    await userEvent.click(retryButton)

    expect(screen.getByTestId('update-content')).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - After Update Recovery')
  })

  it('handles concurrent mode and suspense boundaries', async () => {
    const mockFetch = jest.fn()
    const ConcurrentComponent = () => {
      const [resource, setResource] = React.useState<any>(null)
      
      React.useEffect(() => {
        const fetchData = async () => {
          try {
            await mockFetch()
            throw new Error('Concurrent mode error')
          } catch (error) {
            setResource({ error })
          }
        }
        fetchData()
      }, [])

      if (!resource) {
        return <div>Loading...</div>
      }

      if (resource.error) {
        throw resource.error
      }

      return <div>Success</div>
    }

    const { container } = render(
      <React.Suspense fallback={<div>Suspense loading...</div>}>
        <ErrorBoundary>
          <ConcurrentComponent />
        </ErrorBoundary>
      </React.Suspense>
    )

    expect(screen.getByText(/Loading.../i)).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - Concurrent Loading')

    await waitFor(() => {
      expect(screen.getByText(/Concurrent mode error/i)).toBeInTheDocument()
    })
    expect(container).toMatchSnapshot('Error Boundary - Concurrent Error')

    const retryButton = screen.getByTestId('error-boundary-retry')
    await userEvent.click(retryButton)

    expect(screen.getByText(/Loading.../i)).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - After Concurrent Retry')
  })

  it('handles error recovery with state persistence', async () => {
    const mockStateUpdate = jest.fn()
    const StatefulComponent = () => {
      const [count, setCount] = React.useState(0)
      const [shouldError, setShouldError] = React.useState(true)

      React.useEffect(() => {
        if (count > 0) {
          mockStateUpdate(count)
        }
      }, [count])

      const handleIncrement = () => {
        setCount(prev => prev + 1)
        if (shouldError) {
          setShouldError(false)
          throw new Error('State update error')
        }
      }

      return (
        <div>
          <span data-testid="count-value">{count}</span>
          <button onClick={handleIncrement} data-testid="increment-button">
            Increment
          </button>
        </div>
      )
    }

    const { container } = render(
      <ErrorBoundary>
        <StatefulComponent />
      </ErrorBoundary>
    )

    const incrementButton = screen.getByTestId('increment-button')
    await userEvent.click(incrementButton)

    expect(screen.getByText(/State update error/i)).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - State Error')

    const retryButton = screen.getByTestId('error-boundary-retry')
    await userEvent.click(retryButton)

    const countValue = screen.getByTestId('count-value')
    expect(countValue).toHaveTextContent('1')
    expect(mockStateUpdate).toHaveBeenCalledWith(1)
    expect(container).toMatchSnapshot('Error Boundary - After State Recovery')

    await userEvent.click(incrementButton)
    expect(countValue).toHaveTextContent('2')
    expect(mockStateUpdate).toHaveBeenCalledWith(2)
    expect(container).toMatchSnapshot('Error Boundary - After State Update')
  })

  it('handles errors during dynamic imports', async () => {
    const mockImportError = new Error('Failed to load dynamic component')
    const DynamicErrorComponent = React.lazy(() => Promise.reject(mockImportError))

    const { container } = render(
      <ErrorBoundary>
        <React.Suspense fallback={<div>Loading dynamic component...</div>}>
          <DynamicErrorComponent />
        </React.Suspense>
      </ErrorBoundary>
    )

    expect(screen.getByText(/Loading dynamic component/i)).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - Before Dynamic Import')

    await waitFor(() => {
      expect(screen.getByText(/Failed to load dynamic component/i)).toBeInTheDocument()
    })
    expect(container).toMatchSnapshot('Error Boundary - After Dynamic Import Error')

    const retryButton = screen.getByTestId('error-boundary-retry')
    await userEvent.click(retryButton)

    expect(screen.getByText(/Loading dynamic component/i)).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - After Dynamic Import Retry')
  })

  it('handles errors during route transitions', async () => {
    const mockRouter = {
      push: jest.fn(),
      replace: jest.fn(),
      refresh: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn()
      }
    }

    jest.spyOn(require('next/navigation'), 'useRouter').mockReturnValue(mockRouter)

    const RouteComponent = () => {
      const [shouldError, setShouldError] = React.useState(false)
      const router = useRouter()

      React.useEffect(() => {
        if (shouldError) {
          throw new Error('Route transition error')
        }
      }, [shouldError])

      const handleNavigate = () => {
        setShouldError(true)
        router.push('/error-route')
      }

      return (
        <div>
          <button onClick={handleNavigate} data-testid="navigate-button">
            Navigate
          </button>
        </div>
      )
    }

    const { container } = render(
      <ErrorBoundary>
        <RouteComponent />
      </ErrorBoundary>
    )

    const navigateButton = screen.getByTestId('navigate-button')
    await userEvent.click(navigateButton)

    expect(screen.getByText(/Route transition error/i)).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - Route Error')

    const retryButton = screen.getByTestId('error-boundary-retry')
    await userEvent.click(retryButton)

    expect(navigateButton).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - After Route Recovery')
  })

  it('handles WebSocket trading data stream errors', async () => {
    const mockWebSocket = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      close: jest.fn(),
      send: jest.fn()
    }
    global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket)

    const TradingDataComponent = () => {
      const [error, setError] = React.useState<Error | null>(null)
      const [retryAttempt, setRetryAttempt] = React.useState(0)
      const [lastPrice, setLastPrice] = React.useState<string | null>(null)

      React.useEffect(() => {
        const ws = new WebSocket('wss://trading.example.com/stream')

        const handleMessage = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data)
            setLastPrice(data.price)
          } catch (err) {
            setError(new Error('Invalid trading data format'))
            throw err
          }
        }

        const handleError = () => {
          const wsError = new Error('Trading data stream disconnected')
          setError(wsError)
          throw wsError
        }

        ws.addEventListener('message', handleMessage)
        ws.addEventListener('error', handleError)

        if (retryAttempt === 0) {
          setTimeout(() => {
            const errorEvent = new ErrorEvent('error', {
              error: new Error('Connection lost'),
              message: 'Trading data stream disconnected'
            })
            ws.dispatchEvent(errorEvent)
          }, 100)
        }

        return () => {
          ws.removeEventListener('message', handleMessage)
          ws.removeEventListener('error', handleError)
          ws.close()
        }
      }, [retryAttempt])

      if (error) {
        throw error
      }

      return (
        <div data-testid="trading-data">
          {lastPrice ? `Latest Price: ${lastPrice}` : 'Connecting to trading stream...'}
        </div>
      )
    }

    const { container } = render(
      <ErrorBoundary>
        <TradingDataComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Connecting to trading stream/i)).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - Before WebSocket Error')

    await waitFor(() => {
      expect(screen.getByText(/Trading data stream disconnected/i)).toBeInTheDocument()
    })
    expect(container).toMatchSnapshot('Error Boundary - After WebSocket Error')

    const retryButton = screen.getByTestId('error-boundary-retry')
    await userEvent.click(retryButton)

    expect(screen.getByTestId('trading-data')).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - After WebSocket Recovery')
  })

  it('handles API request failures', async () => {
    const mockFetch = jest.fn()
    global.fetch = mockFetch

    const TradingAPIComponent = () => {
      const [error, setError] = React.useState<Error | null>(null)
      const [data, setData] = React.useState<any>(null)
      const [retryCount, setRetryCount] = React.useState(0)

      React.useEffect(() => {
        const fetchData = async () => {
          try {
            if (retryCount === 0) {
              mockFetch.mockRejectedValueOnce(new Error('API request failed'))
            } else {
              mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ price: '50000' })
              })
            }

            const response = await fetch('/api/trading/price')
            if (!response.ok) {
              throw new Error('API request failed')
            }
            const result = await response.json()
            setData(result)
          } catch (err) {
            setError(err as Error)
            throw err
          }
        }

        fetchData()
      }, [retryCount])

      if (error) {
        throw error
      }

      return (
        <div data-testid="api-component">
          {data ? `Price: ${data.price}` : 'Loading price data...'}
        </div>
      )
    }

    const { container } = render(
      <ErrorBoundary>
        <TradingAPIComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Loading price data/i)).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - Before API Error')

    await waitFor(() => {
      expect(screen.getByText(/API request failed/i)).toBeInTheDocument()
    })
    expect(container).toMatchSnapshot('Error Boundary - After API Error')

    const retryButton = screen.getByTestId('error-boundary-retry')
    await userEvent.click(retryButton)

    await waitFor(() => {
      expect(screen.getByText(/Price: 50000/i)).toBeInTheDocument()
    })
    expect(container).toMatchSnapshot('Error Boundary - After API Recovery')
  })

  it('handles concurrent mode updates', async () => {
    const TradingStreamComponent = () => {
      const [error, setError] = React.useState<Error | null>(null)
      const [prices, setPrices] = React.useState<string[]>([])
      const [updateCount, setUpdateCount] = React.useState(0)

      React.useEffect(() => {
        const interval = setInterval(() => {
          setUpdateCount(count => count + 1)
        }, 100)

        return () => clearInterval(interval)
      }, [])

      React.useEffect(() => {
        try {
          if (updateCount === 2) {
            throw new Error('Concurrent update error')
          }
          setPrices(prev => [...prev, `Price ${updateCount}`])
        } catch (err) {
          setError(err as Error)
          throw err
        }
      }, [updateCount])

      if (error) {
        throw error
      }

      return (
        <div data-testid="trading-stream">
          {prices.map((price, index) => (
            <div key={index} data-testid={`price-${index}`}>
              {price}
            </div>
          ))}
        </div>
      )
    }

    const { container } = render(
      <ErrorBoundary>
        <TradingStreamComponent />
      </ErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByTestId('price-0')).toHaveTextContent('Price 0')
      expect(screen.getByTestId('price-1')).toHaveTextContent('Price 1')
    })
    expect(container).toMatchSnapshot('Error Boundary - Before Concurrent Error')

    await waitFor(() => {
      expect(screen.getByText(/Concurrent update error/i)).toBeInTheDocument()
    })
    expect(container).toMatchSnapshot('Error Boundary - After Concurrent Error')

    const retryButton = screen.getByTestId('error-boundary-retry')
    await userEvent.click(retryButton)

    await waitFor(() => {
      expect(screen.getByTestId('trading-stream')).toBeInTheDocument()
    })
    expect(container).toMatchSnapshot('Error Boundary - After Concurrent Recovery')
  })

  describe('Basic Error Handling', () => {
    it('handles basic errors and retry functionality', async () => {
      let shouldThrow = true
      const RetryComponent = () => {
        if (shouldThrow) {
          throw new Error('Test error')
        }
        return <div>Success</div>
      }

      const { container } = render(
        <ErrorBoundary>
          <RetryComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Test error/i)).toBeInTheDocument()
      expect(screen.getByTestId('error-boundary-retry')).toBeInTheDocument()
      expect(container).toMatchSnapshot('Error Boundary - Initial Error')

      shouldThrow = false
      const retryButton = screen.getByTestId('error-boundary-retry')
      await userEvent.click(retryButton)

      expect(screen.getByText('Success')).toBeInTheDocument()
      expect(container).toMatchSnapshot('Error Boundary - After Recovery')
    })

    it('handles state management and cleanup', async () => {
      const mockCleanup = jest.fn()
      const StateComponent = () => {
        const [count, setCount] = React.useState(0)
        
        React.useEffect(() => {
          if (count === 1) {
            throw new Error('State error')
          }
          setCount(1)
          return mockCleanup
        }, [count])

        return <div>Count: {count}</div>
      }

      const { container, unmount } = render(
        <ErrorBoundary>
          <StateComponent />
        </ErrorBoundary>
      )

      await waitFor(() => {
        expect(screen.getByText(/State error/i)).toBeInTheDocument()
      })
      expect(container).toMatchSnapshot('Error Boundary - State Error')

      unmount()
      expect(mockCleanup).toHaveBeenCalled()
      expect(container).toMatchSnapshot('Error Boundary - After Cleanup')
    })

    it('handles async errors and nested components', async () => {
      const AsyncComponent = () => {
        const [error, setError] = React.useState<Error | null>(null)
        
        React.useEffect(() => {
          const fetchData = async () => {
            try {
              throw new Error('Async error')
            } catch (err) {
              setError(err as Error)
            }
          }
          fetchData()
        }, [])

        if (error) throw error
        return <div>Loading...</div>
      }

      const NestedComponent = () => (
        <div>
          <AsyncComponent />
        </div>
      )

      const { container } = render(
        <ErrorBoundary>
          <NestedComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Loading/i)).toBeInTheDocument()
      expect(container).toMatchSnapshot('Error Boundary - Before Async Error')

      await waitFor(() => {
        expect(screen.getByText(/Async error/i)).toBeInTheDocument()
      })
      expect(container).toMatchSnapshot('Error Boundary - After Async Error')

    expect(screen.getByText(/Nested error/i)).toBeInTheDocument()
  })

  describe('Dynamic Component Loading', () => {
    it('handles dynamic imports', async () => {
      const mockDynamicImport = jest.fn()
      const DynamicComponent = () => {
        const [Component, setComponent] = React.useState<React.ComponentType | null>(null)
        const [error, setError] = React.useState<Error | null>(null)

        React.useEffect(() => {
          const loadComponent = async () => {
            try {
              if (!Component) {
                const module = await mockDynamicImport()
                setComponent(() => module.default)
              }
            } catch (err) {
              setError(err as Error)
              throw err
            }
          }
          loadComponent()
        }, [Component])

        if (error) {
          throw error
        }

        return Component ? (
          <div data-testid="analytics-wrapper">
            <Component />
          </div>
        ) : (
          <div>Loading analytics...</div>
        )
      }

      mockDynamicImport.mockRejectedValueOnce(new Error('Failed to load analytics module'))

      const { container } = render(
        <ErrorBoundary>
          <DynamicComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Loading analytics/i)).toBeInTheDocument()
      expect(container).toMatchSnapshot('Error Boundary - Before Dynamic Import Error')

      await waitFor(() => {
        expect(screen.getByText(/Failed to load analytics module/i)).toBeInTheDocument()
      })
      expect(container).toMatchSnapshot('Error Boundary - After Dynamic Import Error')

      mockDynamicImport.mockResolvedValueOnce({
        default: () => <div data-testid="analytics-content">Analytics loaded</div>
      })

      const retryButton = screen.getByTestId('error-boundary-retry')
      await userEvent.click(retryButton)

      await waitFor(() => {
        expect(screen.getByTestId('analytics-content')).toBeInTheDocument()
      })
      expect(container).toMatchSnapshot('Error Boundary - After Dynamic Import Recovery')
    })
  })

  it('handles context state changes', async () => {
    const TradingContext = React.createContext<{
      state: { balance: string; positions: number };
      dispatch: React.Dispatch<any>;
    } | null>(null)

    const TradingProvider = ({ children }: { children: React.ReactNode }) => {
      const [state, dispatch] = React.useReducer(
        (state: any, action: any) => {
          switch (action.type) {
            case 'UPDATE_BALANCE':
              if (action.payload === '0') {
                throw new Error('Invalid balance update')
              }
              return { ...state, balance: action.payload }
            default:
              return state
          }
        },
        { balance: '100', positions: 0 }
      )

      return (
        <TradingContext.Provider value={{ state, dispatch }}>
          {children}
        </TradingContext.Provider>
      )
    }

    const TradingBalance = () => {
      const context = React.useContext(TradingContext)
      if (!context) throw new Error('TradingBalance must be used within TradingProvider')

      const handleUpdateBalance = () => {
        context.dispatch({ type: 'UPDATE_BALANCE', payload: '0' })
      }

      return (
        <div>
          <div data-testid="balance">Balance: {context.state.balance}</div>
          <button onClick={handleUpdateBalance} data-testid="update-balance">
            Update Balance
          </button>
        </div>
      )
    }

    const { container } = render(
      <ErrorBoundary>
        <TradingProvider>
          <TradingBalance />
        </TradingProvider>
      </ErrorBoundary>
    )

    expect(screen.getByTestId('balance')).toHaveTextContent('Balance: 100')
    expect(container).toMatchSnapshot('Error Boundary - Before Context Error')

    const updateButton = screen.getByTestId('update-balance')
    await userEvent.click(updateButton)

    expect(screen.getByText(/Invalid balance update/i)).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - After Context Error')

    const retryButton = screen.getByTestId('error-boundary-retry')
    await userEvent.click(retryButton)

    expect(screen.getByTestId('balance')).toHaveTextContent('Balance: 100')
    expect(container).toMatchSnapshot('Error Boundary - After Context Recovery')
  })

  it('handles memory leaks and cleanup', async () => {
    const mockCleanup = jest.fn()
    const mockError = jest.fn()

    const TradingDataStream = () => {
      const [error, setError] = React.useState<Error | null>(null)
      const [data, setData] = React.useState<string[]>([])
      const subscriptionRef = React.useRef<NodeJS.Timeout | null>(null)
      const cleanupRef = React.useRef<(() => void) | null>(null)

      React.useEffect(() => {
        try {
          subscriptionRef.current = setInterval(() => {
            setData(prev => [...prev, `Price update ${Date.now()}`])
          }, 100)

          cleanupRef.current = () => {
            if (subscriptionRef.current) {
              clearInterval(subscriptionRef.current)
              mockCleanup()
            }
          }

          if (data.length === 2) {
            throw new Error('Stream connection error')
          }
        } catch (err) {
          mockError(err)
          setError(err as Error)
          throw err
        }

        return () => {
          if (cleanupRef.current) {
            cleanupRef.current()
          }
        }
      }, [data.length])

      if (error) {
        throw error
      }

      return (
        <div data-testid="trading-stream">
          {data.map((price, index) => (
            <div key={index} data-testid={`price-${index}`}>
              {price}
            </div>
          ))}
        </div>
      )
    }

    const { container, unmount } = render(
      <ErrorBoundary>
        <TradingDataStream />
      </ErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByTestId('price-0')).toBeInTheDocument()
      expect(screen.getByTestId('price-1')).toBeInTheDocument()
    })
    expect(container).toMatchSnapshot('Error Boundary - Before Stream Error')

    await waitFor(() => {
      expect(screen.getByText(/Stream connection error/i)).toBeInTheDocument()
    })
    expect(container).toMatchSnapshot('Error Boundary - After Stream Error')
    expect(mockCleanup).toHaveBeenCalled()

    const retryButton = screen.getByTestId('error-boundary-retry')
    await userEvent.click(retryButton)

    await waitFor(() => {
      expect(screen.getByTestId('trading-stream')).toBeInTheDocument()
    })
    expect(container).toMatchSnapshot('Error Boundary - After Stream Recovery')

    unmount()
    expect(mockCleanup).toHaveBeenCalledTimes(2)
  })

  it('handles errors during form submissions', async () => {
    const mockSubmit = jest.fn()
    const FormComponent = () => {
      const [formData, setFormData] = React.useState({ value: '' })
      const [shouldError, setShouldError] = React.useState(true)

      const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
          if (shouldError) {
            setShouldError(false)
            throw new Error('Form submission error')
          }
          await mockSubmit(formData)
        } catch (error) {
          throw error
        }
      }

      const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ value: e.target.value })
      }

      return (
        <form onSubmit={handleSubmit} data-testid="error-form">
          <input
            type="text"
            value={formData.value}
            onChange={handleChange}
            data-testid="form-input"
          />
          <button type="submit" data-testid="submit-button">
            Submit
          </button>
        </form>
      )
    }

    const { container } = render(
      <ErrorBoundary>
        <FormComponent />
      </ErrorBoundary>
    )

    const input = screen.getByTestId('form-input')
    await userEvent.type(input, 'test value')
    
    const form = screen.getByTestId('error-form')
    await userEvent.submit(form)

    expect(screen.getByText(/Form submission error/i)).toBeInTheDocument()
    expect(container).toMatchSnapshot('Error Boundary - Form Error')

    const retryButton = screen.getByTestId('error-boundary-retry')
    await userEvent.click(retryButton)

    expect(screen.getByTestId('form-input')).toHaveValue('test value')
    await userEvent.submit(form)
    
    expect(mockSubmit).toHaveBeenCalledWith({ value: 'test value' })
    expect(container).toMatchSnapshot('Error Boundary - After Form Recovery')
  })
})

describe('Error Boundary Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })
})
