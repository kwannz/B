import { render, screen, waitFor } from '@testing-library/react';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('@/app/api/client');

describe('Workflow Metrics Validation - AB Wallet Metrics Validation', () => {
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
  });

  it('validates AB wallet metrics with performance thresholds', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      const metricsData: any[] = [];

      render(<TestContext><WalletComparison /></TestContext>);

      await waitFor(() => {
        expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
      });

      const endTime = Date.now();
      metricsData.push({
        timestamp: endTime,
        wallets: {
          wallet_a: mockWalletA.metrics,
          wallet_b: mockWalletB.metrics
        }
      });

      const performanceMetrics = {
        duration: endTime - startTime,
        wallet_comparison: {
          performance: {
            latency_diff: Math.abs(mockWalletA.metrics.api_latency - mockWalletB.metrics.api_latency),
            error_rate_diff: Math.abs(mockWalletA.metrics.error_rate - mockWalletB.metrics.error_rate),
            throughput_diff: mockWalletB.metrics.throughput - mockWalletA.metrics.throughput,
            volume_diff: mockWalletB.metrics.total_volume - mockWalletA.metrics.total_volume
          },
          system: {
            heap_diff: mockWalletA.metrics.system.heap_used - mockWalletB.metrics.system.heap_used,
            requests_diff: mockWalletA.metrics.system.active_requests - mockWalletB.metrics.system.active_requests,
            lag_diff: mockWalletA.metrics.system.event_loop_lag - mockWalletB.metrics.system.event_loop_lag
          }
        },
        thresholds: {
          max_latency_diff: 20,
          max_error_rate_diff: 0.02,
          min_throughput_improvement: 10,
          max_heap_diff: 0.1,
          max_requests_diff: 10,
          max_lag_diff: 5
        }
      };

      testRunner.expectMetrics(performanceMetrics);
      expect(performanceMetrics.duration).toBeLessThan(5000);
      expect(performanceMetrics.wallet_comparison.performance.latency_diff)
        .toBeLessThan(performanceMetrics.thresholds.max_latency_diff);
      expect(performanceMetrics.wallet_comparison.performance.error_rate_diff)
        .toBeLessThan(performanceMetrics.thresholds.max_error_rate_diff);
      expect(performanceMetrics.wallet_comparison.performance.throughput_diff)
        .toBeGreaterThan(performanceMetrics.thresholds.min_throughput_improvement);
      expect(Math.abs(performanceMetrics.wallet_comparison.system.heap_diff))
        .toBeLessThan(performanceMetrics.thresholds.max_heap_diff);
      expect(Math.abs(performanceMetrics.wallet_comparison.system.requests_diff))
        .toBeLessThan(performanceMetrics.thresholds.max_requests_diff);
      expect(Math.abs(performanceMetrics.wallet_comparison.system.lag_diff))
        .toBeLessThan(performanceMetrics.thresholds.max_lag_diff);
    });
  });

  it('validates metrics consistency over time', async () => {
    await testRunner.runTest(async () => {
      const iterations = 3;
      const metricsHistory: any[] = [];
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        render(<TestContext><WalletComparison /></TestContext>);

        await waitFor(() => {
          expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
        });

        metricsHistory.push({
          timestamp: Date.now(),
          wallet_a: { ...mockWalletA.metrics },
          wallet_b: { ...mockWalletB.metrics }
        });

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const endTime = Date.now();
      const consistencyMetrics = {
        duration: endTime - startTime,
        iterations,
        metrics_history: metricsHistory,
        consistency: {
          latency_variance: calculateVariance(metricsHistory.map(m => 
            Math.abs(m.wallet_a.api_latency - m.wallet_b.api_latency)
          )),
          error_rate_variance: calculateVariance(metricsHistory.map(m => 
            Math.abs(m.wallet_a.error_rate - m.wallet_b.error_rate)
          )),
          throughput_variance: calculateVariance(metricsHistory.map(m => 
            m.wallet_b.throughput - m.wallet_a.throughput
          ))
        }
      };

      testRunner.expectMetrics(consistencyMetrics);
      expect(consistencyMetrics.duration).toBeLessThan(10000);
      expect(consistencyMetrics.consistency.latency_variance).toBeLessThan(5);
      expect(consistencyMetrics.consistency.error_rate_variance).toBeLessThan(0.001);
      expect(consistencyMetrics.consistency.throughput_variance).toBeLessThan(10);
    });
  });
});

function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - mean, 2));
  return squareDiffs.reduce((a, b) => a + b, 0) / values.length;
}
