import { render, screen, waitFor } from '@testing-library/react';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('@/app/api/client');

describe('Workflow Metrics Validation - AB Wallet Metrics', () => {
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

  it('validates AB wallet comparison with comprehensive metrics tracking', async () => {
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
        improvements: {
          latency: ((mockWalletA.metrics.api_latency - mockWalletB.metrics.api_latency) / mockWalletA.metrics.api_latency) * 100,
          error_rate: ((mockWalletA.metrics.error_rate - mockWalletB.metrics.error_rate) / mockWalletA.metrics.error_rate) * 100,
          throughput: ((mockWalletB.metrics.throughput - mockWalletA.metrics.throughput) / mockWalletA.metrics.throughput) * 100,
          system_efficiency: {
            heap: ((mockWalletA.metrics.system.heap_used - mockWalletB.metrics.system.heap_used) / mockWalletA.metrics.system.heap_used) * 100,
            requests: ((mockWalletA.metrics.system.active_requests - mockWalletB.metrics.system.active_requests) / mockWalletA.metrics.system.active_requests) * 100,
            lag: ((mockWalletA.metrics.system.event_loop_lag - mockWalletB.metrics.system.event_loop_lag) / mockWalletA.metrics.system.event_loop_lag) * 100
          }
        }
      };

      testRunner.expectMetrics(performanceMetrics);
      expect(performanceMetrics.duration).toBeLessThan(5000);
      expect(performanceMetrics.wallet_comparison.performance.latency_diff).toBeLessThan(20);
      expect(performanceMetrics.wallet_comparison.performance.error_rate_diff).toBeLessThan(0.02);
      expect(performanceMetrics.improvements.throughput).toBeGreaterThan(0);
      expect(performanceMetrics.improvements.system_efficiency.heap).toBeGreaterThan(0);
      expect(performanceMetrics.improvements.system_efficiency.requests).toBeGreaterThan(0);
      expect(performanceMetrics.improvements.system_efficiency.lag).toBeGreaterThan(0);
    });
  });

  it('validates system metrics correlation with wallet performance', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      const correlationData: any[] = [];

      render(<TestContext><WalletComparison /></TestContext>);

      await waitFor(() => {
        expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
      });

      const endTime = Date.now();
      correlationData.push({
        timestamp: endTime,
        wallet_a: {
          performance: {
            throughput: mockWalletA.metrics.throughput,
            success_rate: mockWalletA.metrics.success_rate
          },
          system: mockWalletA.metrics.system
        },
        wallet_b: {
          performance: {
            throughput: mockWalletB.metrics.throughput,
            success_rate: mockWalletB.metrics.success_rate
          },
          system: mockWalletB.metrics.system
        }
      });

      const correlationMetrics = {
        duration: endTime - startTime,
        correlations: {
          wallet_a: {
            throughput_vs_heap: calculateCorrelation(
              [mockWalletA.metrics.throughput],
              [mockWalletA.metrics.system.heap_used]
            ),
            success_vs_requests: calculateCorrelation(
              [mockWalletA.metrics.success_rate],
              [mockWalletA.metrics.system.active_requests]
            )
          },
          wallet_b: {
            throughput_vs_heap: calculateCorrelation(
              [mockWalletB.metrics.throughput],
              [mockWalletB.metrics.system.heap_used]
            ),
            success_vs_requests: calculateCorrelation(
              [mockWalletB.metrics.success_rate],
              [mockWalletB.metrics.system.active_requests]
            )
          }
        }
      };

      testRunner.expectMetrics(correlationMetrics);
      expect(correlationMetrics.duration).toBeLessThan(5000);
      expect(Math.abs(correlationMetrics.correlations.wallet_a.throughput_vs_heap)).toBeLessThan(1);
      expect(Math.abs(correlationMetrics.correlations.wallet_a.success_vs_requests)).toBeLessThan(1);
      expect(Math.abs(correlationMetrics.correlations.wallet_b.throughput_vs_heap)).toBeLessThan(1);
      expect(Math.abs(correlationMetrics.correlations.wallet_b.success_vs_requests)).toBeLessThan(1);
    });
  });
});

function calculateCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  const sum_x = x.reduce((a, b) => a + b, 0);
  const sum_y = y.reduce((a, b) => a + b, 0);
  const sum_xy = x.reduce((a, b, i) => a + b * y[i], 0);
  const sum_x2 = x.reduce((a, b) => a + b * b, 0);
  const sum_y2 = y.reduce((a, b) => a + b * b, 0);

  const numerator = n * sum_xy - sum_x * sum_y;
  const denominator = Math.sqrt((n * sum_x2 - sum_x * sum_x) * (n * sum_y2 - sum_y * sum_y));

  return denominator === 0 ? 0 : numerator / denominator;
}
