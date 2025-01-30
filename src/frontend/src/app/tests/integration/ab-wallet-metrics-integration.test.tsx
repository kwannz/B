import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet, transferSOL } from '@/app/api/client';
import { useDebugStore } from '@/app/stores/debugStore';
import { TestMetrics } from '../types/test.types';
import WalletComparison from '@/app/wallet-comparison/page';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/api/client');
jest.mock('@/app/stores/debugStore');

describe('AB Wallet Metrics Integration', () => {
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

  it('should track metrics during wallet comparison workflow', async () => {
    const metrics = {
      operations: [] as { type: string; latency: number; success: boolean }[],
      errors: 0,
      successes: 0
    };

    const walletA = {
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      balance: 1.5,
      bot_id: 'bot-123',
      performance: {
        total_trades: 100,
        win_rate: 0.65,
        profit_loss: 0.8
      }
    };

    const walletB = {
      address: '7MmPxd4AiDUnLEqQxqBT8HfFmqHpiKmNKvEKEADNbXDK',
      balance: 2.0,
      bot_id: 'bot-456',
      performance: {
        total_trades: 80,
        win_rate: 0.70,
        profit_loss: 1.2
      }
    };

    (getWallet as jest.Mock)
      .mockImplementation((botId) => {
        const startTime = Date.now();
        return Promise.resolve(botId === 'bot-123' ? walletA : walletB)
          .then(result => {
            metrics.operations.push({
              type: 'get_wallet',
              latency: Date.now() - startTime,
              success: true
            });
            metrics.successes++;
            return result;
          })
          .catch(error => {
            metrics.operations.push({
              type: 'get_wallet',
              latency: Date.now() - startTime,
              success: false
            });
            metrics.errors++;
            throw error;
          });
      });

    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    // Wait for both wallets to load
    await waitFor(() => {
      expect(screen.getByText(/1.5 SOL/)).toBeInTheDocument();
      expect(screen.getByText(/2.0 SOL/)).toBeInTheDocument();
    });

    // Simulate transfer between wallets
    const transferStart = Date.now();
    const transferButton = screen.getByRole('button', { name: /transfer/i });
    fireEvent.click(transferButton);

    const amountInput = screen.getByRole('textbox', { name: /amount/i });
    fireEvent.change(amountInput, { target: { value: '0.5' } });

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(transferSOL).toHaveBeenCalledWith(walletA.address, walletB.address, 0.5);
      metrics.operations.push({
        type: 'transfer',
        latency: Date.now() - transferStart,
        success: true
      });
      metrics.successes++;
    });

    const avgLatency = metrics.operations.reduce((sum, op) => sum + op.latency, 0) / metrics.operations.length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / metrics.operations.length,
        apiLatency: avgLatency,
        systemHealth: metrics.successes / metrics.operations.length,
        successRate: metrics.successes / metrics.operations.length,
        totalTrades: walletA.performance.total_trades + walletB.performance.total_trades,
        walletBalance: walletA.balance + walletB.balance
      },
      wallets: {
        comparison: {
          walletA: {
            balance: walletA.balance,
            performance: walletA.performance
          },
          walletB: {
            balance: walletB.balance,
            performance: walletB.performance
          }
        },
        operations: metrics.operations.length,
        avgLatency,
        successRate: metrics.successes / metrics.operations.length
      }
    };

    expect(testMetrics.wallets.operations).toBeGreaterThan(0);
    expect(testMetrics.performance.successRate).toBe(1);
    expect(testMetrics.wallets.comparison.walletA.performance.win_rate).toBe(0.65);
    expect(testMetrics.wallets.comparison.walletB.performance.win_rate).toBe(0.70);
  });

  it('should track metrics during wallet performance comparison', async () => {
    const metrics = {
      comparisons: [] as { type: string; timestamp: number; values: any }[],
      updates: 0
    };

    const walletPerformanceData = [
      {
        walletA: { win_rate: 0.65, profit_loss: 0.8, active_positions: 2 },
        walletB: { win_rate: 0.70, profit_loss: 1.2, active_positions: 3 }
      },
      {
        walletA: { win_rate: 0.67, profit_loss: 0.9, active_positions: 3 },
        walletB: { win_rate: 0.68, profit_loss: 1.1, active_positions: 2 }
      },
      {
        walletA: { win_rate: 0.70, profit_loss: 1.0, active_positions: 4 },
        walletB: { win_rate: 0.69, profit_loss: 1.2, active_positions: 3 }
      }
    ];

    let updateCount = 0;
    (getBotStatus as jest.Mock).mockImplementation(() => {
      const data = walletPerformanceData[updateCount];
      metrics.comparisons.push({
        type: 'performance_update',
        timestamp: Date.now(),
        values: data
      });
      metrics.updates++;
      updateCount = (updateCount + 1) % walletPerformanceData.length;
      return Promise.resolve({
        id: 'bot-123',
        status: 'active',
        metrics: data
      });
    });

    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    // Wait for initial performance data
    await waitFor(() => {
      expect(screen.getByText(/65%/)).toBeInTheDocument();
      expect(screen.getByText(/70%/)).toBeInTheDocument();
    });

    // Simulate performance updates
    for (let i = 0; i < 2; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await waitFor(() => {
        const currentData = walletPerformanceData[(i + 1) % walletPerformanceData.length];
        expect(screen.getByText(new RegExp(`${currentData.walletA.win_rate * 100}%`))).toBeInTheDocument();
      });
    }

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: 0,
        apiLatency: 0,
        systemHealth: 1,
        successRate: 1,
        totalTrades: 0,
        walletBalance: 0
      },
      comparison: {
        updates: metrics.updates,
        dataPoints: metrics.comparisons.length,
        performance: {
          walletA: {
            avgWinRate: metrics.comparisons.reduce((sum, comp) => sum + comp.values.walletA.win_rate, 0) / metrics.comparisons.length,
            avgProfitLoss: metrics.comparisons.reduce((sum, comp) => sum + comp.values.walletA.profit_loss, 0) / metrics.comparisons.length
          },
          walletB: {
            avgWinRate: metrics.comparisons.reduce((sum, comp) => sum + comp.values.walletB.win_rate, 0) / metrics.comparisons.length,
            avgProfitLoss: metrics.comparisons.reduce((sum, comp) => sum + comp.values.walletB.profit_loss, 0) / metrics.comparisons.length
          }
        }
      }
    };

    expect(testMetrics.comparison.updates).toBeGreaterThan(0);
    expect(testMetrics.comparison.performance.walletA.avgWinRate).toBeGreaterThan(0);
    expect(testMetrics.comparison.performance.walletB.avgWinRate).toBeGreaterThan(0);
  });

  it('should track error metrics during wallet comparison failures', async () => {
    const metrics = {
      errors: [] as { type: string; timestamp: number; error: any }[],
      recoveries: 0,
      attempts: 0
    };

    (getWallet as jest.Mock)
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce({
        address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
        balance: 1.5,
        bot_id: 'bot-123'
      });

    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    // Track initial error
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
      metrics.errors.push({
        type: 'wallet_fetch',
        timestamp: Date.now(),
        error: 'Network Error'
      });
      metrics.attempts++;
    });

    // Track recovery
    const retryButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText(/1.5 SOL/)).toBeInTheDocument();
      metrics.recoveries++;
      metrics.attempts++;
    });

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors.length / metrics.attempts,
        apiLatency: 0,
        systemHealth: metrics.recoveries / metrics.attempts,
        successRate: metrics.recoveries / metrics.attempts,
        totalTrades: 0,
        walletBalance: 1.5
      },
      errors: {
        count: metrics.errors.length,
        types: metrics.errors.map(e => e.type),
        recoveryRate: metrics.recoveries / metrics.errors.length,
        meanTimeBetweenErrors: metrics.errors.length > 1 
          ? (metrics.errors[metrics.errors.length - 1].timestamp - metrics.errors[0].timestamp) / (metrics.errors.length - 1)
          : 0
      }
    };

    expect(testMetrics.errors.count).toBeGreaterThan(0);
    expect(testMetrics.errors.recoveryRate).toBe(1);
    expect(testMetrics.performance.systemHealth).toBeGreaterThan(0);
  });
});
