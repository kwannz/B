import { render, screen, waitFor } from '@testing-library/react';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet, transferSOL } from '@/app/api/client';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('@/app/api/client');

describe('Workflow Metrics Validation - AB Wallet Metrics Validation and Recovery', () => {
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
      profit_loss: 500,
      system: {
        heap_used: 0.5,
        active_requests: 50,
        event_loop_lag: 10
      }
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
      profit_loss: 600,
      system: {
        heap_used: 0.45,
        active_requests: 45,
        event_loop_lag: 8
      }
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

  it('validates metrics collection and recovery during high load', async () => {
    await testRunner.runTest(async () => {
      const iterations = 5;
      const metricsData: any[] = [];
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const iterationMetrics = {
          wallet_a: { ...mockWalletA.metrics },
          wallet_b: { ...mockWalletB.metrics }
        };

        if (i === 2) {
          iterationMetrics.wallet_a.system.heap_used = 0.85;
          iterationMetrics.wallet_a.system.active_requests = 150;
          iterationMetrics.wallet_a.error_rate = 0.15;
        }

        (getWallet as jest.Mock).mockImplementation((botId) => 
          Promise.resolve(botId === 'bot-123' ? 
            { ...mockWalletA, metrics: iterationMetrics.wallet_a } : 
            { ...mockWalletB, metrics: iterationMetrics.wallet_b }
          )
        );

        render(<TestContext><WalletComparison /></TestContext>);

        await waitFor(() => {
          expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
        });

        metricsData.push({
          timestamp: Date.now(),
          iteration: i,
          metrics: iterationMetrics
        });

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const endTime = Date.now();
      const performanceMetrics = {
        duration: endTime - startTime,
        iterations_completed: iterations,
        metrics_history: metricsData,
        recovery_analysis: {
          pre_incident: metricsData.slice(0, 2).map(m => ({
            heap_used: m.metrics.wallet_a.system.heap_used,
            active_requests: m.metrics.wallet_a.system.active_requests,
            error_rate: m.metrics.wallet_a.error_rate
          })),
          incident: metricsData[2].metrics.wallet_a,
          post_recovery: metricsData.slice(3).map(m => ({
            heap_used: m.metrics.wallet_a.system.heap_used,
            active_requests: m.metrics.wallet_a.system.active_requests,
            error_rate: m.metrics.wallet_a.error_rate
          }))
        },
        system_stability: {
          heap_trend: metricsData.map(m => m.metrics.wallet_a.system.heap_used),
          request_trend: metricsData.map(m => m.metrics.wallet_a.system.active_requests),
          error_trend: metricsData.map(m => m.metrics.wallet_a.error_rate)
        }
      };

      testRunner.expectMetrics(performanceMetrics);
      expect(performanceMetrics.duration).toBeLessThan(10000);
      expect(performanceMetrics.recovery_analysis.post_recovery.every(m => m.heap_used < 0.8)).toBe(true);
      expect(performanceMetrics.recovery_analysis.post_recovery.every(m => m.active_requests < 100)).toBe(true);
      expect(performanceMetrics.recovery_analysis.post_recovery.every(m => m.error_rate < 0.1)).toBe(true);
    });
  });

  it('validates system metrics during concurrent wallet operations', async () => {
    await testRunner.runTest(async () => {
      const operations = 3;
      const operationsData: any[] = [];
      const startTime = Date.now();

      for (let i = 0; i < operations; i++) {
        const transferAmount = 0.1;
        const operationStartTime = Date.now();

        render(<TestContext><WalletComparison /></TestContext>);

        await waitFor(() => {
          expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
        });

        await transferSOL(mockWalletA.address, mockWalletB.address, transferAmount);

        const operationEndTime = Date.now();
        operationsData.push({
          operation: i,
          duration: operationEndTime - operationStartTime,
          transfer_amount: transferAmount,
          metrics: {
            wallet_a: { ...mockWalletA.metrics },
            wallet_b: { ...mockWalletB.metrics }
          }
        });
      }

      const endTime = Date.now();
      const concurrencyMetrics = {
        total_duration: endTime - startTime,
        operations_completed: operations,
        operations_data: operationsData,
        performance_analysis: {
          average_operation_duration: operationsData.reduce((acc, op) => acc + op.duration, 0) / operations,
          total_transfer_amount: operationsData.reduce((acc, op) => acc + op.transfer_amount, 0),
          operation_success_rate: 1.0
        },
        system_metrics: {
          final_heap_used: mockWalletA.metrics.system.heap_used,
          final_active_requests: mockWalletA.metrics.system.active_requests,
          final_event_loop_lag: mockWalletA.metrics.system.event_loop_lag
        }
      };

      testRunner.expectMetrics(concurrencyMetrics);
      expect(concurrencyMetrics.total_duration).toBeLessThan(5000);
      expect(concurrencyMetrics.performance_analysis.average_operation_duration).toBeLessThan(1000);
      expect(concurrencyMetrics.system_metrics.final_heap_used).toBeLessThan(0.8);
      expect(concurrencyMetrics.system_metrics.final_active_requests).toBeLessThan(100);
      expect(concurrencyMetrics.system_metrics.final_event_loop_lag).toBeLessThan(20);
    });
  });
});
