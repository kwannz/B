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

describe('Metrics and Trading Integration', () => {
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
    (getBotStatus as jest.Mock).mockResolvedValue({
      id: 'bot-123',
      status: 'active',
      metrics: {
        total_volume: 1000,
        profit_loss: 0.5,
        active_positions: 2,
        performance_metrics: {
          win_rate: 0.65,
          avg_profit: 0.2,
          max_drawdown: 0.15
        }
      }
    });
    (getWallet as jest.Mock).mockResolvedValue({
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      balance: 1.5,
      bot_id: 'bot-123'
    });
  });

  it('should track and validate trading metrics in real-time', async () => {
    const startTime = Date.now();
    
    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(getBotStatus).toHaveBeenCalled();
      expect(screen.getByText(/total volume/i)).toBeInTheDocument();
      expect(screen.getByText(/1000/)).toBeInTheDocument();
      expect(screen.getByText(/win rate: 65%/i)).toBeInTheDocument();
    });

    const metrics = useDebugStore.getState().metrics as TestMetrics;
    expect(metrics.performance.apiLatency).toBeLessThan(1000);
    expect(metrics.performance.errorRate).toBe(0);
    expect(metrics.trading?.totalVolume).toBe(1000);
    expect(metrics.trading?.profitLoss).toBe(0.5);
  });

  it('should update metrics during wallet operations', async () => {
    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    await waitFor(() => {
      expect(getWallet).toHaveBeenCalled();
      expect(screen.getByText(/1.5 SOL/)).toBeInTheDocument();
    });

    const metrics = useDebugStore.getState().metrics as TestMetrics;
    expect(metrics.performance.walletBalance).toBe(1.5);
    expect(metrics.performance.apiLatency).toBeLessThan(500);
  });

  it('should track performance metrics during trading operations', async () => {
    const operations = [];
    const metrics = {
      latencies: [] as number[],
      errors: 0,
      successes: 0
    };

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    // Track multiple status updates
    for (let i = 0; i < 3; i++) {
      const startTime = Date.now();
      await getBotStatus('bot-123');
      metrics.latencies.push(Date.now() - startTime);
      metrics.successes++;
      operations.push('getBotStatus');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const avgLatency = metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / operations.length,
        apiLatency: avgLatency,
        systemHealth: metrics.successes / operations.length,
        successRate: metrics.successes / operations.length,
        totalTrades: 0,
        walletBalance: 1.5
      },
      trading: {
        totalVolume: 1000,
        profitLoss: 0.5,
        activePositions: 2
      }
    };

    expect(testMetrics.performance.apiLatency).toBeLessThan(1000);
    expect(testMetrics.performance.successRate).toBe(1);
    expect(testMetrics.trading.totalVolume).toBe(1000);
  });

  it('should validate metrics during error scenarios', async () => {
    (getBotStatus as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

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

  it('should track comprehensive trading performance metrics', async () => {
    const mockPerformanceData = {
      id: 'bot-123',
      status: 'active',
      metrics: {
        total_volume: 1000,
        profit_loss: 0.5,
        active_positions: 2,
        performance_metrics: {
          win_rate: 0.65,
          avg_profit: 0.2,
          max_drawdown: 0.15,
          sharpe_ratio: 1.8,
          sortino_ratio: 2.1,
          max_consecutive_wins: 5,
          max_consecutive_losses: 2,
          profit_factor: 1.5,
          recovery_factor: 1.2
        }
      }
    };

    (getBotStatus as jest.Mock).mockResolvedValueOnce(mockPerformanceData);

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/win rate: 65%/i)).toBeInTheDocument();
      expect(screen.getByText(/sharpe ratio: 1.8/i)).toBeInTheDocument();
      expect(screen.getByText(/sortino ratio: 2.1/i)).toBeInTheDocument();
      
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics.trading?.profitLoss).toBe(0.5);
      expect(metrics.trading?.totalVolume).toBe(1000);
      expect(metrics.performance.systemHealth).toBe(1);
    });
  });
});
