import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import { useDebugStore } from '@/app/stores/debugStore';
import { TestMetrics } from '../types/test.types';
import TradingDashboard from '@/app/trading-dashboard/page';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/api/client');
jest.mock('@/app/stores/debugStore');

describe('Error Handling Metrics Integration', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn()
  };

  const mockWallet = {
    connected: true,
    connecting: false,
    publicKey: { toString: () => '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK' },
    connect: jest.fn(),
    disconnect: jest.fn(),
    signTransaction: jest.fn(),
    signAllTransactions: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useWallet as jest.Mock).mockReturnValue(mockWallet);
  });

  it('should track error recovery metrics during system failures', async () => {
    const metrics = {
      errors: [] as { type: string; timestamp: number; recovered: boolean }[],
      recoveryAttempts: 0,
      successfulRecoveries: 0
    };

    const mockErrors = [
      new Error('Network Error'),
      new Error('API Timeout'),
      new Error('Service Unavailable')
    ];

    let errorIndex = 0;
    (getBotStatus as jest.Mock).mockImplementation(() => {
      if (errorIndex < mockErrors.length) {
        const error = mockErrors[errorIndex++];
        metrics.errors.push({
          type: error.message,
          timestamp: Date.now(),
          recovered: false
        });
        return Promise.reject(error);
      }

      metrics.successfulRecoveries++;
      return Promise.resolve({
        id: 'bot-123',
        status: 'active',
        metrics: {
          system_health: {
            error_rate: 0.01,
            recovery_time: 150
          }
        }
      });
    });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    // Initial error
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });

    // Recovery attempts
    const retryButton = screen.getByRole('button', { name: /retry/i });
    for (let i = 0; i < mockErrors.length; i++) {
      metrics.recoveryAttempts++;
      fireEvent.click(retryButton);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Final success
    await waitFor(() => {
      expect(screen.getByText(/active/i)).toBeInTheDocument();
    });

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: (metrics.errors.length - metrics.successfulRecoveries) / metrics.errors.length,
        apiLatency: 0,
        systemHealth: metrics.successfulRecoveries / metrics.recoveryAttempts,
        successRate: metrics.successfulRecoveries / metrics.recoveryAttempts,
        totalTrades: 0,
        walletBalance: 0
      },
      errors: {
        total: metrics.errors.length,
        unique: new Set(metrics.errors.map(e => e.type)).size,
        recoveryRate: metrics.successfulRecoveries / metrics.errors.length,
        avgRecoveryAttempts: metrics.recoveryAttempts / metrics.errors.length
      }
    };

    expect(testMetrics.errors.total).toBeGreaterThan(0);
    expect(testMetrics.errors.recoveryRate).toBeGreaterThan(0);
    expect(testMetrics.performance.systemHealth).toBeGreaterThan(0);
  });

  it('should track error metrics during concurrent operations', async () => {
    const metrics = {
      operations: [] as { type: string; success: boolean; timestamp: number }[],
      errors: [] as { type: string; timestamp: number }[],
      recoveries: 0
    };

    const mockOperations = [
      { type: 'bot_status', shouldFail: true },
      { type: 'wallet_info', shouldFail: false },
      { type: 'trading_metrics', shouldFail: true },
      { type: 'system_health', shouldFail: false }
    ];

    const executeOperation = async (op: typeof mockOperations[0]) => {
      try {
        if (op.shouldFail) {
          throw new Error(`${op.type} failed`);
        }
        metrics.operations.push({
          type: op.type,
          success: true,
          timestamp: Date.now()
        });
        return Promise.resolve({ status: 'success' });
      } catch (error) {
        metrics.operations.push({
          type: op.type,
          success: false,
          timestamp: Date.now()
        });
        metrics.errors.push({
          type: op.type,
          timestamp: Date.now()
        });
        throw error;
      }
    };

    (getBotStatus as jest.Mock).mockImplementation(() =>
      executeOperation(mockOperations[0])
    );

    (getWallet as jest.Mock).mockImplementation(() =>
      executeOperation(mockOperations[1])
    );

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    // Execute concurrent operations
    await Promise.allSettled(mockOperations.map(executeOperation));

    const successfulOps = metrics.operations.filter(op => op.success).length;
    const failedOps = metrics.operations.filter(op => !op.success).length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: failedOps / metrics.operations.length,
        apiLatency: 0,
        systemHealth: successfulOps / metrics.operations.length,
        successRate: successfulOps / metrics.operations.length,
        totalTrades: 0,
        walletBalance: 0
      },
      concurrent: {
        totalOperations: metrics.operations.length,
        successfulOperations: successfulOps,
        failedOperations: failedOps,
        errorTypes: new Set(metrics.errors.map(e => e.type)).size,
        operationTypes: new Set(metrics.operations.map(op => op.type)).size
      }
    };

    expect(testMetrics.concurrent.totalOperations).toBe(mockOperations.length);
    expect(testMetrics.concurrent.failedOperations).toBe(2);
    expect(testMetrics.performance.errorRate).toBe(0.5);
  });

  it('should validate error handling metrics accuracy', async () => {
    const metrics = {
      errors: [] as { type: string; timestamp: number; handled: boolean }[],
      handlers: [] as { type: string; success: boolean }[],
      recoveries: [] as { type: string; timestamp: number }[]
    };

    const errorTypes = ['network', 'timeout', 'validation'];
    let currentErrorIndex = 0;

    const mockErrorResponse = () => {
      const errorType = errorTypes[currentErrorIndex++ % errorTypes.length];
      metrics.errors.push({
        type: errorType,
        timestamp: Date.now(),
        handled: false
      });
      throw new Error(`${errorType} error`);
    };

    const mockErrorHandler = (error: Error) => {
      const errorType = error.message.split(' ')[0];
      metrics.handlers.push({
        type: errorType,
        success: true
      });
      metrics.errors[metrics.errors.length - 1].handled = true;
      metrics.recoveries.push({
        type: errorType,
        timestamp: Date.now()
      });
    };

    (getBotStatus as jest.Mock)
      .mockImplementationOnce(mockErrorResponse)
      .mockImplementationOnce(mockErrorResponse)
      .mockImplementationOnce(() => Promise.resolve({
        id: 'bot-123',
        status: 'active',
        metrics: {
          error_handling: {
            total_errors: metrics.errors.length,
            handled_errors: metrics.handlers.length,
            recovery_rate: metrics.recoveries.length / metrics.errors.length
          }
        }
      }));

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    // Initial errors
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });

    // Handle errors
    const retryButton = screen.getByRole('button', { name: /retry/i });
    for (let i = 0; i < 2; i++) {
      try {
        fireEvent.click(retryButton);
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        mockErrorHandler(error as Error);
      }
    }

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: (metrics.errors.length - metrics.recoveries.length) / metrics.errors.length,
        apiLatency: 0,
        systemHealth: metrics.handlers.filter(h => h.success).length / metrics.handlers.length,
        successRate: metrics.recoveries.length / metrics.errors.length,
        totalTrades: 0,
        walletBalance: 0
      },
      errorHandling: {
        totalErrors: metrics.errors.length,
        handledErrors: metrics.handlers.length,
        unhandledErrors: metrics.errors.filter(e => !e.handled).length,
        recoveryRate: metrics.recoveries.length / metrics.errors.length,
        uniqueErrorTypes: new Set(metrics.errors.map(e => e.type)).size
      }
    };

    expect(testMetrics.errorHandling.totalErrors).toBeGreaterThan(0);
    expect(testMetrics.errorHandling.handledErrors).toBe(testMetrics.errorHandling.totalErrors);
    expect(testMetrics.errorHandling.recoveryRate).toBeGreaterThan(0);
  });
});
