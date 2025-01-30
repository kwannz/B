import { render, screen, waitFor } from '@testing-library/react';
import { TestContext } from '../contexts/TestContext';
import { createBot, getWallet, createWallet } from '@/app/api/client';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('@/app/api/client');

describe('AB Wallet Workflow Validation', () => {
  const mockWalletA = {
    address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
    balance: 1.5,
    metrics: {
      api_latency: 100,
      error_rate: 0.05,
      success_rate: 0.95,
      throughput: 100,
      active_trades: 5,
      total_volume: 10000,
      profit_loss: 500
    }
  };

  const mockWalletB = {
    address: '7MmPb3RLvEgtg4HQY8gguARGwGKyYaCeT8DLvBwfLL',
    balance: 2.0,
    metrics: {
      api_latency: 90,
      error_rate: 0.04,
      success_rate: 0.96,
      throughput: 120,
      active_trades: 6,
      total_volume: 12000,
      profit_loss: 600
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createBot as jest.Mock).mockResolvedValue({ id: 'bot-123' });
    (createWallet as jest.Mock).mockImplementation((botId) => 
      Promise.resolve(botId === 'bot-123' ? mockWalletA : mockWalletB));
    (getWallet as jest.Mock).mockImplementation((botId) => 
      Promise.resolve(botId === 'bot-123' ? mockWalletA : mockWalletB));
  });

  it('validates AB wallet comparison workflow with performance metrics', async () => {
    await testRunner.runTest(async () => {
      render(<TestContext><WalletComparison /></TestContext>);

      await waitFor(() => {
        expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
      });

      const metrics = {
        wallets: {
          wallet_a: mockWalletA.metrics,
          wallet_b: mockWalletB.metrics
        },
        performance: {
          latency_diff: Math.abs(mockWalletA.metrics.api_latency - mockWalletB.metrics.api_latency),
          error_rate_diff: Math.abs(mockWalletA.metrics.error_rate - mockWalletB.metrics.error_rate),
          throughput_diff: Math.abs(mockWalletA.metrics.throughput - mockWalletB.metrics.throughput),
          volume_diff: Math.abs(mockWalletA.metrics.total_volume - mockWalletB.metrics.total_volume)
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.latency_diff).toBeLessThan(20);
      expect(metrics.performance.error_rate_diff).toBeLessThan(0.02);
      expect(metrics.performance.throughput_diff).toBeGreaterThan(0);
      expect(metrics.performance.volume_diff).toBeGreaterThan(0);

      const walletAMetrics = screen.getByTestId('wallet-a-metrics');
      const walletBMetrics = screen.getByTestId('wallet-b-metrics');

      expect(walletAMetrics).toHaveTextContent(mockWalletA.metrics.success_rate.toString());
      expect(walletBMetrics).toHaveTextContent(mockWalletB.metrics.success_rate.toString());

      expect(walletAMetrics).toHaveTextContent(mockWalletA.metrics.profit_loss.toString());
      expect(walletBMetrics).toHaveTextContent(mockWalletB.metrics.profit_loss.toString());
    });
  });

  it('validates error handling and recovery in AB wallet comparison', async () => {
    const errorMetrics: any[] = [];
    let errorCount = 0;
    const maxRetries = 3;

    (createWallet as jest.Mock).mockImplementation((botId) => {
      if (errorCount < maxRetries) {
        errorCount++;
        const error = new Error('Simulated Wallet Creation Error');
        errorMetrics.push({
          timestamp: Date.now(),
          error,
          metrics: mockWalletA.metrics
        });
        throw error;
      }
      return Promise.resolve(botId === 'bot-123' ? mockWalletA : mockWalletB);
    });

    await testRunner.runTest(async () => {
      render(<TestContext><WalletComparison /></TestContext>);

      await waitFor(() => {
        expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
      });

      const metrics = {
        errors: {
          count: errorCount,
          metrics: errorMetrics
        },
        recovery: {
          success: errorCount === maxRetries,
          retry_count: errorCount
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.errors.count).toBe(maxRetries);
      expect(metrics.recovery.success).toBe(true);
    });
  });

  it('validates performance monitoring during wallet operations', async () => {
    const operationMetrics: any[] = [];
    const startTime = Date.now();

    await testRunner.runTest(async () => {
      render(<TestContext><WalletComparison /></TestContext>);

      await waitFor(() => {
        expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
      });

      const endTime = Date.now();
      operationMetrics.push({
        operation: 'render',
        duration: endTime - startTime,
        metrics: {
          wallet_a: mockWalletA.metrics,
          wallet_b: mockWalletB.metrics
        }
      });

      const metrics = {
        operations: operationMetrics,
        performance: {
          total_duration: endTime - startTime,
          average_latency: (mockWalletA.metrics.api_latency + mockWalletB.metrics.api_latency) / 2
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.total_duration).toBeLessThan(5000);
      expect(metrics.performance.average_latency).toBeLessThan(100);
    });
  });
});
