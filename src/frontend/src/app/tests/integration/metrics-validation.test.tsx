'use client';

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import WalletComparison from '@/app/wallet-comparison/page';
import { getWallet, listWallets } from '@/app/api/client';
import { useDebugStore } from '@/app/stores/debugStore';
import { TestMetrics } from '../types/test.types';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/api/client');
jest.mock('@/app/stores/debugStore');

describe('Metrics Validation Integration', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn()
  };

  const mockWallet = {
    connected: true,
    publicKey: { toString: () => '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK' }
  };

  const mockWallets = [
    {
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      balance: 1.5,
      performance: {
        total_trades: 50,
        success_rate: 0.8,
        profit_loss: 0.5,
        avg_trade_duration: 120,
        max_drawdown: 0.1
      }
    },
    {
      address: '7MmPwD5TcJwHh5YeK8mCtNyJRmCxfCXgzMJFzEgQHHVE',
      balance: 2.0,
      performance: {
        total_trades: 75,
        success_rate: 0.85,
        profit_loss: 0.75,
        avg_trade_duration: 90,
        max_drawdown: 0.08
      }
    }
  ];

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useWallet as jest.Mock).mockReturnValue(mockWallet);
    (listWallets as jest.Mock).mockResolvedValue(mockWallets);
    (getWallet as jest.Mock).mockImplementation((address) => 
      Promise.resolve(mockWallets.find(w => w.address === address))
    );
  });

  it('should track and validate performance metrics', async () => {
    const mockMetrics: TestMetrics = {
      performance: {
        errorRate: 0,
        apiLatency: 100,
        successRate: 0.95,
        totalTrades: 125,
        walletBalance: 3.5,
        systemHealth: 1
      },
      wallet: {
        balances: { 'total': 3.5 },
        transactions: 125,
        performance: {
          total_trades: 125,
          success_rate: 0.95,
          profit_loss: 1.25,
          avg_trade_duration: 105,
          max_drawdown: 0.09
        }
      },
      trading: {
        activePositions: 3,
        totalVolume: 1500,
        profitLoss: 1.25
      },
      debug: {
        logs: [],
        errors: [],
        warnings: [],
        metrics: {}
      }
    };

    (useDebugStore.getState as jest.Mock).mockReturnValue({
      metrics: mockMetrics,
      updateMetrics: jest.fn(),
      addLog: jest.fn()
    });

    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/wallet comparison/i)).toBeInTheDocument();
    });

    const metrics = useDebugStore.getState().metrics as TestMetrics;
    expect(metrics).toHaveErrorRate(0);
    expect(metrics).toHaveLatency(100);
    expect(metrics).toHaveSuccessRate(0.95);
    expect(metrics).toHaveTradeCount(125);
    expect(metrics).toHaveWalletBalance(3.5);
  });

  it('should handle and track error metrics properly', async () => {
    const error = new Error('API Error');
    (listWallets as jest.Mock).mockRejectedValueOnce(error);

    const mockMetrics: TestMetrics = {
      performance: {
        errorRate: 0.2,
        apiLatency: 500,
        successRate: 0.8,
        totalTrades: 125,
        walletBalance: 3.5,
        systemHealth: 0.8
      },
      wallet: {
        balances: { 'total': 3.5 },
        transactions: 125,
        performance: {
          total_trades: 125,
          success_rate: 0.8,
          profit_loss: 1.25,
          avg_trade_duration: 105,
          max_drawdown: 0.09
        }
      },
      trading: {
        activePositions: 3,
        totalVolume: 1500,
        profitLoss: 1.25
      },
      debug: {
        logs: ['API Error occurred'],
        errors: ['Failed to fetch wallet list'],
        warnings: [],
        metrics: {}
      }
    };

    (useDebugStore.getState as jest.Mock).mockReturnValue({
      metrics: mockMetrics,
      updateMetrics: jest.fn(),
      addLog: jest.fn()
    });

    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/error loading wallet data/i)).toBeInTheDocument();
    });

    const metrics = useDebugStore.getState().metrics as TestMetrics;
    expect(metrics).toHaveErrorRate(0.2);
    expect(metrics).toHaveLatency(500);
    expect(metrics).toHaveSuccessRate(0.8);
  });

  it('should validate wallet performance thresholds', async () => {
    const lowPerformanceWallet = {
      ...mockWallets[0],
      performance: {
        ...mockWallets[0].performance,
        success_rate: 0.5,
        profit_loss: -0.2
      }
    };

    (listWallets as jest.Mock).mockResolvedValueOnce([lowPerformanceWallet]);

    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/performance warning/i)).toBeInTheDocument();
      expect(screen.getByText(/below target success rate/i)).toBeInTheDocument();
    });

    const metrics = useDebugStore.getState().metrics as TestMetrics;
    expect(metrics.performance.systemHealth).toBeLessThan(0.9);
  });

  it('should track real-time metric updates', async () => {
    const initialMetrics: TestMetrics = {
      performance: {
        errorRate: 0,
        apiLatency: 100,
        successRate: 0.9,
        totalTrades: 100,
        walletBalance: 3.0,
        systemHealth: 1
      },
      wallet: {
        balances: { 'total': 3.0 },
        transactions: 100,
        performance: {
          total_trades: 100,
          success_rate: 0.9,
          profit_loss: 1.0,
          avg_trade_duration: 100,
          max_drawdown: 0.1
        }
      },
      trading: {
        activePositions: 2,
        totalVolume: 1000,
        profitLoss: 1.0
      },
      debug: {
        logs: [],
        errors: [],
        warnings: [],
        metrics: {}
      }
    };

    const updatedMetrics: TestMetrics = {
      ...initialMetrics,
      performance: {
        ...initialMetrics.performance,
        totalTrades: 101,
        walletBalance: 3.1
      }
    };

    (useDebugStore.getState as jest.Mock)
      .mockReturnValueOnce({ metrics: initialMetrics, updateMetrics: jest.fn(), addLog: jest.fn() })
      .mockReturnValueOnce({ metrics: updatedMetrics, updateMetrics: jest.fn(), addLog: jest.fn() });

    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    await waitFor(() => {
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics).toHaveTradeCount(101);
      expect(metrics).toHaveWalletBalance(3.1);
    });
  });
});
