import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import { useDebugStore } from '@/app/stores/debugStore';
import { TestMetrics } from '../types/test.types';
import TradingDashboard from '@/app/trading-dashboard/page';
import WalletComparison from '@/app/wallet-comparison/page';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/api/client');
jest.mock('@/app/stores/debugStore');

describe('Metrics and Error Handling Integration', () => {
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

  it('should track metrics during API errors', async () => {
    const errorMessage = 'API Error';
    (getBotStatus as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));
    
    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics.performance.errorRate).toBeGreaterThan(0);
      expect(metrics.performance.systemHealth).toBeLessThan(1);
    });
  });

  it('should track recovery metrics after errors', async () => {
    const mockResponses = [
      Promise.reject(new Error('Network Error')),
      Promise.resolve({
        id: 'bot-123',
        status: 'active',
        metrics: {
          total_volume: 1000,
          profit_loss: 0.5,
          active_positions: 2
        }
      })
    ];

    let callCount = 0;
    (getBotStatus as jest.Mock).mockImplementation(() => mockResponses[callCount++]);

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });

    // Trigger retry
    const retryButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics.performance.errorRate).toBe(0.5);
      expect(metrics.performance.successRate).toBe(0.5);
      expect(metrics.performance.systemHealth).toBe(1);
    });
  });

  it('should validate error boundary metrics', async () => {
    const error = new Error('Component Error');
    (getBotStatus as jest.Mock).mockImplementation(() => {
      throw error;
    });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics.performance.errorRate).toBe(1);
      expect(metrics.performance.systemHealth).toBe(0);
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  it('should track metrics during wallet errors', async () => {
    (getWallet as jest.Mock).mockRejectedValueOnce(new Error('Wallet Error'));

    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    await waitFor(() => {
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics.performance.errorRate).toBeGreaterThan(0);
      expect(metrics.performance.walletBalance).toBe(0);
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it('should aggregate error metrics across components', async () => {
    const errors = [];
    const metrics = {
      apiCalls: 0,
      errors: 0,
      recoveries: 0
    };

    // Mock multiple API failures
    (getBotStatus as jest.Mock).mockImplementation(() => {
      metrics.apiCalls++;
      if (metrics.apiCalls % 2 === 1) {
        metrics.errors++;
        return Promise.reject(new Error('API Error'));
      }
      metrics.recoveries++;
      return Promise.resolve({
        id: 'bot-123',
        status: 'active',
        metrics: {
          total_volume: 1000,
          profit_loss: 0.5
        }
      });
    });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    // Wait for multiple API calls
    await waitFor(() => {
      expect(getBotStatus).toHaveBeenCalledTimes(2);
    });

    const finalMetrics = useDebugStore.getState().metrics as TestMetrics;
    expect(finalMetrics.performance.errorRate).toBe(metrics.errors / metrics.apiCalls);
    expect(finalMetrics.performance.successRate).toBe(metrics.recoveries / metrics.apiCalls);
  });

  it('should track performance impact of errors', async () => {
    const startTime = Date.now();
    const errorDelay = 1000;

    (getBotStatus as jest.Mock).mockImplementation(() => 
      new Promise((resolve, reject) => {
        setTimeout(() => {
          reject(new Error('Timeout Error'));
        }, errorDelay);
      })
    );

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics.performance.apiLatency).toBeGreaterThanOrEqual(errorDelay);
      expect(metrics.performance.errorRate).toBe(1);
      expect(Date.now() - startTime).toBeGreaterThanOrEqual(errorDelay);
    });
  });
});
