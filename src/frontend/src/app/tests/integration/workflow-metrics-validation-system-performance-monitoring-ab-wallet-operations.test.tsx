import { render, screen, waitFor } from '@testing-library/react';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet, transferSOL } from '@/app/api/client';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('@/app/api/client');

describe('Workflow Metrics Validation - AB Wallet Operations', () => {
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
    (transferSOL as jest.Mock).mockResolvedValue({ success: true });
  });

  it('validates wallet transfer operations with performance metrics', async () => {
    await testRunner.runTest(async () => {
      const operationsData: any[] = [];
      const startTime = Date.now();

      render(<TestContext><WalletComparison /></TestContext>);

      await waitFor(() => {
        expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
      });

      const transferAmount = 0.1;
      const transferStartTime = Date.now();
      await transferSOL(mockWalletA.address, mockWalletB.address, transferAmount);
      const transferEndTime = Date.now();

      operationsData.push({
        operation: 'transfer',
        amount: transferAmount,
        duration: transferEndTime - transferStartTime,
        source: mockWalletA.address,
        destination: mockWalletB.address,
        metrics: {
          source_wallet: mockWalletA.metrics,
          destination_wallet: mockWalletB.metrics
        }
      });

      const endTime = Date.now();
      const operationsMetrics = {
        total_duration: endTime - startTime,
        operations: operationsData,
        performance: {
          average_operation_duration: operationsData.reduce((acc, op) => acc + op.duration, 0) / operationsData.length,
          total_transfer_amount: operationsData.reduce((acc, op) => acc + op.amount, 0),
          source_metrics: mockWalletA.metrics,
          destination_metrics: mockWalletB.metrics
        }
      };

      testRunner.expectMetrics(operationsMetrics);
      expect(operationsMetrics.total_duration).toBeLessThan(5000);
      expect(operationsMetrics.performance.average_operation_duration).toBeLessThan(1000);
      expect(transferSOL).toHaveBeenCalledWith(mockWalletA.address, mockWalletB.address, transferAmount);
    });
  });

  it('validates error handling during wallet operations', async () => {
    const errorMetrics: any[] = [];
    let errorCount = 0;
    const maxRetries = 3;

    (transferSOL as jest.Mock).mockImplementation(() => {
      if (errorCount < maxRetries) {
        errorCount++;
        const error = new Error('Simulated Transfer Error');
        errorMetrics.push({
          timestamp: Date.now(),
          error,
          attempt: errorCount,
          source_metrics: mockWalletA.metrics,
          destination_metrics: mockWalletB.metrics
        });
        throw error;
      }
      return Promise.resolve({ success: true });
    });

    await testRunner.runTest(async () => {
      render(<TestContext><WalletComparison /></TestContext>);

      await waitFor(() => {
        expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
      });

      const startTime = Date.now();
      let transferSuccess = false;
      let attempts = 0;

      while (!transferSuccess && attempts < maxRetries + 1) {
        try {
          await transferSOL(mockWalletA.address, mockWalletB.address, 0.1);
          transferSuccess = true;
        } catch (error) {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 100));
        }
      }

      const endTime = Date.now();
      const errorHandlingMetrics = {
        duration: endTime - startTime,
        attempts,
        errors: errorMetrics,
        recovery: {
          success: transferSuccess,
          retry_count: attempts,
          backoff_pattern: errorMetrics.map((_, i) => Math.pow(2, i + 1) * 100)
        }
      };

      testRunner.expectMetrics(errorHandlingMetrics);
      expect(errorHandlingMetrics.duration).toBeLessThan(10000);
      expect(errorHandlingMetrics.attempts).toBeLessThanOrEqual(maxRetries + 1);
      expect(errorHandlingMetrics.recovery.success).toBe(true);
    });
  });
});
