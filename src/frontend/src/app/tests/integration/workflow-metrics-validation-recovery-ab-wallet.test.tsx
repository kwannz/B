import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import { useDebugStore } from '@/app/stores/debugStore';
import { TestMetrics } from '../types/test.types';
import AgentSelection from '@/app/agent-selection/page';
import StrategyCreation from '@/app/strategy-creation/page';
import BotIntegration from '@/app/bot-integration/page';
import KeyManagement from '@/app/key-management/page';
import TradingDashboard from '@/app/trading-dashboard/page';
import WalletComparison from '@/app/wallet-comparison/page';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/api/client');
jest.mock('@/app/stores/debugStore');

describe('Workflow Metrics Validation and Recovery with AB Wallet Testing', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn()
  };

  const mockWalletA = {
    connected: true,
    connecting: false,
    publicKey: { toString: () => '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK' },
    connect: jest.fn(),
    disconnect: jest.fn(),
    signTransaction: jest.fn(),
    signAllTransactions: jest.fn()
  };

  const mockWalletB = {
    connected: true,
    connecting: false,
    publicKey: { toString: () => '7MmPwD5TQzXBtKnLGNEHzLHuPsE8kw9aNgvhYxM3yxVJ' },
    connect: jest.fn(),
    disconnect: jest.fn(),
    signTransaction: jest.fn(),
    signAllTransactions: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  it('should validate AB wallet comparison workflow metrics', async () => {
    const metrics = {
      wallets: [] as { id: string; performance: any; timestamp: number }[],
      comparisons: [] as { walletA: string; walletB: string; metrics: any }[],
      operations: [] as { wallet: string; type: string; result: any }[]
    };

    const mockWalletMetrics = {
      walletA: {
        trades: 15,
        success_rate: 0.85,
        avg_return: 0.06,
        total_value: 2.5
      },
      walletB: {
        trades: 12,
        success_rate: 0.75,
        avg_return: 0.04,
        total_value: 2.0
      }
    };

    const trackWalletMetrics = (walletId: string, performance: any) => {
      metrics.wallets.push({
        id: walletId,
        performance,
        timestamp: Date.now()
      });
    };

    const compareWallets = (walletA: string, walletB: string) => {
      const comparison = {
        trades_diff: mockWalletMetrics.walletA.trades - mockWalletMetrics.walletB.trades,
        success_rate_diff: mockWalletMetrics.walletA.success_rate - mockWalletMetrics.walletB.success_rate,
        avg_return_diff: mockWalletMetrics.walletA.avg_return - mockWalletMetrics.walletB.avg_return,
        total_value_diff: mockWalletMetrics.walletA.total_value - mockWalletMetrics.walletB.total_value
      };

      metrics.comparisons.push({
        walletA,
        walletB,
        metrics: comparison
      });

      return comparison;
    };

    (useWallet as jest.Mock)
      .mockReturnValueOnce(mockWalletA)
      .mockReturnValueOnce(mockWalletB);

    (getWallet as jest.Mock).mockImplementation((walletId) => {
      const performance = walletId === mockWalletA.publicKey.toString() 
        ? mockWalletMetrics.walletA 
        : mockWalletMetrics.walletB;

      metrics.operations.push({
        wallet: walletId,
        type: 'get_metrics',
        result: performance
      });

      trackWalletMetrics(walletId, performance);
      return Promise.resolve({ address: walletId, performance });
    });

    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    await waitFor(() => {
      expect(metrics.wallets.length).toBe(2);
      expect(metrics.comparisons.length).toBe(1);
    });

    const comparison = compareWallets(
      mockWalletA.publicKey.toString(),
      mockWalletB.publicKey.toString()
    );

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: 0,
        apiLatency: metrics.operations.reduce((sum, op) => sum + op.result.trades, 0) / metrics.operations.length,
        systemHealth: 1,
        successRate: 1,
        totalTrades: metrics.wallets.reduce((sum, w) => sum + w.performance.trades, 0),
        walletBalance: metrics.wallets.reduce((sum, w) => sum + w.performance.total_value, 0)
      },
      comparison: {
        wallets: metrics.wallets.length,
        operations: metrics.operations.length,
        differences: {
          trades: comparison.trades_diff,
          success_rate: comparison.success_rate_diff,
          avg_return: comparison.avg_return_diff,
          total_value: comparison.total_value_diff
        }
      }
    };

    expect(testMetrics.comparison.wallets).toBe(2);
    expect(testMetrics.comparison.differences.trades).toBeGreaterThan(0);
    expect(testMetrics.comparison.differences.success_rate).toBeGreaterThan(0);
  });

  it('should validate AB wallet metrics during error recovery', async () => {
    const metrics = {
      errors: [] as { wallet: string; error: any; timestamp: number }[],
      recoveries: [] as { wallet: string; duration: number }[],
      operations: [] as { wallet: string; type: string; attempt: number }[]
    };

    const mockErrors = {
      walletA: new Error('Wallet A metrics fetch failed'),
      walletB: new Error('Wallet B metrics fetch failed')
    };

    let errorCount = 0;
    const executeWithRecovery = async (wallet: string, operation: () => Promise<any>) => {
      try {
        if (errorCount++ < Object.keys(mockErrors).length) {
          const error = mockErrors[wallet];
          if (error) {
            metrics.errors.push({
              wallet,
              error,
              timestamp: Date.now()
            });
            throw error;
          }
        }

        const startTime = Date.now();
        const result = await operation();

        if (metrics.errors.find(e => e.wallet === wallet)) {
          metrics.recoveries.push({
            wallet,
            duration: Date.now() - startTime
          });
        }

        metrics.operations.push({
          wallet,
          type: 'get_metrics',
          attempt: metrics.operations.filter(op => op.wallet === wallet).length + 1
        });

        return result;
      } catch (error) {
        metrics.operations.push({
          wallet,
          type: 'error',
          attempt: metrics.operations.filter(op => op.wallet === wallet).length + 1
        });
        throw error;
      }
    };

    (useWallet as jest.Mock)
      .mockReturnValueOnce(mockWalletA)
      .mockReturnValueOnce(mockWalletB);

    (getWallet as jest.Mock).mockImplementation((walletId) =>
      executeWithRecovery(walletId === mockWalletA.publicKey.toString() ? 'walletA' : 'walletB', () =>
        Promise.resolve({
          address: walletId,
          performance: {
            trades: 10,
            success_rate: 0.8,
            avg_return: 0.05,
            total_value: 2.0
          }
        })
      )
    );

    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    await waitFor(() => {
      expect(metrics.operations.length).toBeGreaterThan(2);
    });

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors.length / metrics.operations.length,
        apiLatency: metrics.recoveries.reduce((sum, r) => sum + r.duration, 0) / metrics.recoveries.length,
        systemHealth: metrics.recoveries.length / metrics.errors.length,
        successRate: metrics.recoveries.length / metrics.errors.length,
        totalTrades: 20,
        walletBalance: 4.0
      },
      recovery: {
        totalErrors: metrics.errors.length,
        recoveredErrors: metrics.recoveries.length,
        avgRecoveryTime: metrics.recoveries.reduce((sum, r) => sum + r.duration, 0) / metrics.recoveries.length,
        operationsByWallet: metrics.operations.reduce((acc, op) => {
          if (!acc[op.wallet]) acc[op.wallet] = [];
          acc[op.wallet].push(op);
          return acc;
        }, {} as Record<string, typeof metrics.operations>)
      }
    };

    expect(testMetrics.recovery.totalErrors).toBe(2);
    expect(testMetrics.recovery.recoveredErrors).toBe(2);
    expect(testMetrics.performance.systemHealth).toBe(1);
  });
});
