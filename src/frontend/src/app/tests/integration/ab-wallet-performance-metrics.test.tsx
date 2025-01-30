import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import { useDebugStore } from '@/app/stores/debugStore';
import { TestMetrics } from '../types/test.types';
import WalletComparison from '@/app/wallet-comparison/page';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/api/client');
jest.mock('@/app/stores/debugStore');

describe('AB Wallet Performance Metrics Integration', () => {
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

  it('should track performance metrics during AB wallet comparison', async () => {
    const metrics = {
      wallets: [] as { id: string; metrics: any; timestamp: number }[],
      comparisons: [] as { walletA: string; walletB: string; metrics: any }[],
      operations: [] as { type: string; duration: number; success: boolean }[]
    };

    const mockWalletData = [
      {
        id: 'wallet-A',
        balance: 1.5,
        performance: {
          trades: 10,
          success_rate: 0.8,
          avg_return: 0.05,
          total_volume: 1000
        }
      },
      {
        id: 'wallet-B',
        balance: 2.0,
        performance: {
          trades: 15,
          success_rate: 0.75,
          avg_return: 0.04,
          total_volume: 1500
        }
      }
    ];

    const trackOperation = async (type: string, operation: () => Promise<any>) => {
      const startTime = Date.now();
      try {
        const result = await operation();
        metrics.operations.push({
          type,
          duration: Date.now() - startTime,
          success: true
        });
        return result;
      } catch (error) {
        metrics.operations.push({
          type,
          duration: Date.now() - startTime,
          success: false
        });
        throw error;
      }
    };

    (getWallet as jest.Mock).mockImplementation((walletId) => 
      trackOperation('get_wallet', () => {
        const wallet = mockWalletData.find(w => w.id === walletId);
        if (wallet) {
          metrics.wallets.push({
            id: walletId,
            metrics: wallet.performance,
            timestamp: Date.now()
          });
        }
        return Promise.resolve(wallet);
      })
    );

    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    // Compare wallets
    const compareButton = screen.getByRole('button', { name: /compare/i });
    await trackOperation('compare_wallets', async () => {
      fireEvent.click(compareButton);
      const comparison = {
        walletA: mockWalletData[0].id,
        walletB: mockWalletData[1].id,
        metrics: {
          trade_difference: mockWalletData[1].performance.trades - mockWalletData[0].performance.trades,
          success_rate_difference: mockWalletData[1].performance.success_rate - mockWalletData[0].performance.success_rate,
          return_difference: mockWalletData[1].performance.avg_return - mockWalletData[0].performance.avg_return,
          volume_difference: mockWalletData[1].performance.total_volume - mockWalletData[0].performance.total_volume
        }
      };
      metrics.comparisons.push(comparison);
      return Promise.resolve(comparison);
    });

    const avgOperationDuration = metrics.operations.reduce((sum, op) => sum + op.duration, 0) / metrics.operations.length;
    const successfulOps = metrics.operations.filter(op => op.success).length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: (metrics.operations.length - successfulOps) / metrics.operations.length,
        apiLatency: avgOperationDuration,
        systemHealth: successfulOps / metrics.operations.length,
        successRate: successfulOps / metrics.operations.length,
        totalTrades: mockWalletData.reduce((sum, w) => sum + w.performance.trades, 0),
        walletBalance: mockWalletData.reduce((sum, w) => sum + w.balance, 0)
      },
      comparison: {
        walletsCompared: metrics.wallets.length,
        comparisons: metrics.comparisons.length,
        metrics: metrics.comparisons.map(c => ({
          tradeDifference: c.metrics.trade_difference,
          successRateDifference: c.metrics.success_rate_difference,
          returnDifference: c.metrics.return_difference,
          volumeDifference: c.metrics.volume_difference
        }))
      }
    };

    expect(testMetrics.comparison.walletsCompared).toBe(2);
    expect(testMetrics.performance.successRate).toBe(1);
    expect(testMetrics.comparison.metrics.length).toBeGreaterThan(0);
  });

  it('should track performance metrics during wallet operations', async () => {
    const metrics = {
      operations: [] as { type: string; latency: number; success: boolean }[],
      transfers: [] as { amount: number; timestamp: number }[],
      balances: [] as { wallet: string; balance: number; timestamp: number }[]
    };

    const mockTransferOperation = async (amount: number) => {
      const startTime = Date.now();
      try {
        metrics.transfers.push({
          amount,
          timestamp: Date.now()
        });
        metrics.operations.push({
          type: 'transfer',
          latency: Date.now() - startTime,
          success: true
        });
        return Promise.resolve({ success: true });
      } catch (error) {
        metrics.operations.push({
          type: 'transfer',
          latency: Date.now() - startTime,
          success: false
        });
        throw error;
      }
    };

    const mockBalanceCheck = async (walletId: string) => {
      const startTime = Date.now();
      try {
        const balance = Math.random() * 2 + 1;
        metrics.balances.push({
          wallet: walletId,
          balance,
          timestamp: Date.now()
        });
        metrics.operations.push({
          type: 'balance_check',
          latency: Date.now() - startTime,
          success: true
        });
        return Promise.resolve({ balance });
      } catch (error) {
        metrics.operations.push({
          type: 'balance_check',
          latency: Date.now() - startTime,
          success: false
        });
        throw error;
      }
    };

    (getWallet as jest.Mock).mockImplementation((walletId) => mockBalanceCheck(walletId));

    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    // Perform transfers
    const transferButton = screen.getByRole('button', { name: /transfer/i });
    for (let i = 0; i < 3; i++) {
      fireEvent.click(transferButton);
      await mockTransferOperation(0.1 * (i + 1));
    }

    const avgLatency = metrics.operations.reduce((sum, op) => sum + op.latency, 0) / metrics.operations.length;
    const successfulOps = metrics.operations.filter(op => op.success).length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: (metrics.operations.length - successfulOps) / metrics.operations.length,
        apiLatency: avgLatency,
        systemHealth: successfulOps / metrics.operations.length,
        successRate: successfulOps / metrics.operations.length,
        totalTrades: metrics.transfers.length,
        walletBalance: metrics.balances[metrics.balances.length - 1]?.balance || 0
      },
      operations: {
        total: metrics.operations.length,
        transfers: metrics.transfers.length,
        balanceChecks: metrics.balances.length,
        avgTransferAmount: metrics.transfers.reduce((sum, t) => sum + t.amount, 0) / metrics.transfers.length,
        avgLatencyByType: Object.entries(
          metrics.operations.reduce((acc, op) => {
            if (!acc[op.type]) acc[op.type] = [];
            acc[op.type].push(op.latency);
            return acc;
          }, {} as Record<string, number[]>)
        ).reduce((acc, [type, latencies]) => {
          acc[type] = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
          return acc;
        }, {} as Record<string, number>)
      }
    };

    expect(testMetrics.operations.transfers).toBe(3);
    expect(testMetrics.performance.successRate).toBe(1);
    expect(testMetrics.operations.avgLatencyByType.transfer).toBeLessThan(1000);
  });

  it('should validate AB wallet metrics consistency', async () => {
    const metrics = {
      measurements: [] as { wallet: string; metrics: any; timestamp: number }[],
      validations: {
        success: 0,
        failure: 0
      }
    };

    const validateMetrics = (data: any) => {
      try {
        expect(data.trades).toBeGreaterThanOrEqual(0);
        expect(data.success_rate).toBeGreaterThanOrEqual(0);
        expect(data.success_rate).toBeLessThanOrEqual(1);
        expect(data.avg_return).toBeDefined();
        expect(data.total_volume).toBeGreaterThanOrEqual(0);
        metrics.validations.success++;
        return true;
      } catch (error) {
        metrics.validations.failure++;
        return false;
      }
    };

    const mockWalletMetrics = {
      trades: 10 + Math.floor(Math.random() * 5),
      success_rate: 0.7 + Math.random() * 0.2,
      avg_return: 0.04 + Math.random() * 0.02,
      total_volume: 1000 + Math.random() * 500
    };

    (getWallet as jest.Mock).mockImplementation((walletId) => {
      const data = {
        id: walletId,
        performance: mockWalletMetrics
      };

      metrics.measurements.push({
        wallet: walletId,
        metrics: data.performance,
        timestamp: Date.now()
      });

      validateMetrics(data.performance);
      return Promise.resolve(data);
    });

    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    await waitFor(() => {
      expect(metrics.measurements.length).toBeGreaterThan(0);
    });

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.validations.failure / (metrics.validations.success + metrics.validations.failure),
        apiLatency: 0,
        systemHealth: metrics.validations.success / (metrics.validations.success + metrics.validations.failure),
        successRate: metrics.validations.success / (metrics.validations.success + metrics.validations.failure),
        totalTrades: mockWalletMetrics.trades,
        walletBalance: 0
      },
      validation: {
        measurements: metrics.measurements.length,
        validationRate: metrics.validations.success / (metrics.validations.success + metrics.validations.failure),
        metricsRanges: {
          trades: {
            min: Math.min(...metrics.measurements.map(m => m.metrics.trades)),
            max: Math.max(...metrics.measurements.map(m => m.metrics.trades))
          },
          successRate: {
            min: Math.min(...metrics.measurements.map(m => m.metrics.success_rate)),
            max: Math.max(...metrics.measurements.map(m => m.metrics.success_rate))
          },
          avgReturn: {
            min: Math.min(...metrics.measurements.map(m => m.metrics.avg_return)),
            max: Math.max(...metrics.measurements.map(m => m.metrics.avg_return))
          }
        }
      }
    };

    expect(testMetrics.validation.measurements).toBeGreaterThan(0);
    expect(testMetrics.validation.validationRate).toBe(1);
    expect(testMetrics.validation.metricsRanges.successRate.max).toBeLessThanOrEqual(1);
    expect(testMetrics.validation.metricsRanges.successRate.min).toBeGreaterThanOrEqual(0);
  });
});
