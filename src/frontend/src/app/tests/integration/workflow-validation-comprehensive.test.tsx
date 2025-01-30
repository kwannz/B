import { render, screen, waitFor } from '@testing-library/react';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import AgentSelection from '@/app/agent-selection/page';
import StrategyCreation from '@/app/strategy-creation/page';
import BotIntegration from '@/app/bot-integration/page';
import KeyManagement from '@/app/key-management/page';
import TradingDashboard from '@/app/trading-dashboard/page';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('@/app/api/client');

describe('Workflow Comprehensive Validation', () => {
  const mockSystemMetrics = {
    heap_used: 0.5,
    heap_total: 0.8,
    external_memory: 0.2,
    event_loop_lag: 10,
    active_handles: 50,
    active_requests: 20,
    garbage_collection: {
      count: 5,
      duration: 100
    }
  };

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
      system: mockSystemMetrics
    }
  };

  const mockWalletB = {
    address: '7MmPxQvM5RKzZKBqJqGpPxEUVhGqLGy8YFoqBJyFw9R2',
    balance: 2.0,
    metrics: {
      api_latency: 90,
      error_rate: 0.03,
      success_rate: 0.97,
      throughput: 120,
      active_trades: 7,
      total_volume: 15000,
      profit_loss: 750,
      system: mockSystemMetrics
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createBot as jest.Mock).mockResolvedValue({ id: 'bot-123' });
    (createWallet as jest.Mock).mockImplementation((botId) => {
      return Promise.resolve(botId === 'bot-123' ? mockWalletA : mockWalletB);
    });
    (getWallet as jest.Mock).mockImplementation((botId) => {
      return Promise.resolve(botId === 'bot-123' ? mockWalletA : mockWalletB);
    });
    (getBotStatus as jest.Mock).mockResolvedValue({ status: 'active', trades: [] });
  });

  it('validates complete workflow with comprehensive metrics', async () => {
    const workflowData: any[] = [];
    const startTime = Date.now();
    const errorThreshold = 3;
    let errorCount = 0;

    const pages = [
      { component: AgentSelection, testId: 'agent-selection', maxRetries: 3 },
      { component: StrategyCreation, testId: 'strategy-creation', maxRetries: 3 },
      { component: BotIntegration, testId: 'bot-integration', maxRetries: 3 },
      { component: KeyManagement, testId: 'key-management', maxRetries: 3 },
      { component: TradingDashboard, testId: 'trading-dashboard', maxRetries: 3 },
      { component: WalletComparison, testId: 'wallet-comparison', maxRetries: 3 }
    ];

    for (const page of pages) {
      let success = false;
      let retries = 0;
      const pageStartTime = Date.now();

      while (!success && retries < page.maxRetries) {
        try {
          if (errorCount < errorThreshold) {
            errorCount++;
            throw new Error('Simulated error for testing recovery');
          }

          render(<TestContext><page.component /></TestContext>);
          await waitFor(() => {
            expect(screen.getByTestId(page.testId)).toBeInTheDocument();
          });
          success = true;
        } catch (error) {
          retries++;
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 100));
        }
      }

      const pageEndTime = Date.now();
      workflowData.push({
        page: page.testId,
        duration: pageEndTime - pageStartTime,
        retries,
        success,
        error_rate: retries / page.maxRetries,
        metrics: {
          ...mockSystemMetrics,
          heap_used: Math.min(0.8, mockSystemMetrics.heap_used + (retries * 0.05)),
          active_requests: Math.min(100, mockSystemMetrics.active_requests + (retries * 5))
        }
      });
    }

    const endTime = Date.now();
    const comprehensiveMetrics = {
      total_duration: endTime - startTime,
      pages_completed: workflowData.length,
      workflow_data: workflowData,
      error_metrics: {
        total_errors: workflowData.reduce((acc, data) => acc + data.retries, 0),
        error_rate: workflowData.reduce((acc, data) => acc + data.error_rate, 0) / workflowData.length,
        retry_distribution: workflowData.reduce((acc, data) => {
          acc[data.retries] = (acc[data.retries] || 0) + 1;
          return acc;
        }, {} as Record<number, number>),
        success_rate: workflowData.filter(data => data.success).length / workflowData.length
      },
      system_metrics: {
        heap_usage_trend: workflowData.map(data => data.metrics.heap_used),
        request_load_trend: workflowData.map(data => data.metrics.active_requests),
        heap_usage_variance: calculateVariance(workflowData.map(data => data.metrics.heap_used)),
        request_load_variance: calculateVariance(workflowData.map(data => data.metrics.active_requests))
      },
      wallet_metrics: {
        wallet_a: {
          performance: {
            api_latency: mockWalletA.metrics.api_latency,
            error_rate: mockWalletA.metrics.error_rate,
            success_rate: mockWalletA.metrics.success_rate,
            throughput: mockWalletA.metrics.throughput
          },
          trading: {
            active_trades: mockWalletA.metrics.active_trades,
            total_volume: mockWalletA.metrics.total_volume,
            profit_loss: mockWalletA.metrics.profit_loss
          }
        },
        wallet_b: {
          performance: {
            api_latency: mockWalletB.metrics.api_latency,
            error_rate: mockWalletB.metrics.error_rate,
            success_rate: mockWalletB.metrics.success_rate,
            throughput: mockWalletB.metrics.throughput
          },
          trading: {
            active_trades: mockWalletB.metrics.active_trades,
            total_volume: mockWalletB.metrics.total_volume,
            profit_loss: mockWalletB.metrics.profit_loss
          }
        },
        comparison: {
          latency_diff: mockWalletA.metrics.api_latency - mockWalletB.metrics.api_latency,
          error_rate_diff: mockWalletA.metrics.error_rate - mockWalletB.metrics.error_rate,
          success_rate_diff: mockWalletA.metrics.success_rate - mockWalletB.metrics.success_rate,
          throughput_diff: mockWalletA.metrics.throughput - mockWalletB.metrics.throughput,
          volume_diff: mockWalletA.metrics.total_volume - mockWalletB.metrics.total_volume,
          profit_diff: mockWalletA.metrics.profit_loss - mockWalletB.metrics.profit_loss
        }
      },
      correlation_analysis: {
        retries_vs_heap: calculateCorrelation(
          workflowData.map(data => data.retries),
          workflowData.map(data => data.metrics.heap_used)
        ),
        retries_vs_requests: calculateCorrelation(
          workflowData.map(data => data.retries),
          workflowData.map(data => data.metrics.active_requests)
        ),
        duration_vs_retries: calculateCorrelation(
          workflowData.map(data => data.duration),
          workflowData.map(data => data.retries)
        ),
        latency_vs_success: calculateCorrelation(
          [mockWalletA.metrics.api_latency, mockWalletB.metrics.api_latency],
          [mockWalletA.metrics.success_rate, mockWalletB.metrics.success_rate]
        ),
        throughput_vs_profit: calculateCorrelation(
          [mockWalletA.metrics.throughput, mockWalletB.metrics.throughput],
          [mockWalletA.metrics.profit_loss, mockWalletB.metrics.profit_loss]
        ),
        volume_vs_error: calculateCorrelation(
          [mockWalletA.metrics.total_volume, mockWalletB.metrics.total_volume],
          [mockWalletA.metrics.error_rate, mockWalletB.metrics.error_rate]
        )
      }
    };

    testRunner.expectMetrics(comprehensiveMetrics);
    expect(comprehensiveMetrics.total_duration).toBeLessThan(30000);
    expect(comprehensiveMetrics.error_metrics.error_rate).toBeLessThan(0.7);
    expect(comprehensiveMetrics.error_metrics.success_rate).toBeGreaterThan(0.6);
    expect(comprehensiveMetrics.system_metrics.heap_usage_variance).toBeLessThan(0.1);
    expect(comprehensiveMetrics.system_metrics.request_load_variance).toBeLessThan(100);
    expect(Math.abs(comprehensiveMetrics.correlation_analysis.retries_vs_heap)).toBeLessThan(1);
    expect(Math.abs(comprehensiveMetrics.correlation_analysis.retries_vs_requests)).toBeLessThan(1);
    expect(Math.abs(comprehensiveMetrics.correlation_analysis.duration_vs_retries)).toBeLessThan(1);
    expect(Math.abs(comprehensiveMetrics.correlation_analysis.latency_vs_success)).toBeLessThan(1);
    expect(Math.abs(comprehensiveMetrics.correlation_analysis.throughput_vs_profit)).toBeLessThan(1);
    expect(Math.abs(comprehensiveMetrics.correlation_analysis.volume_vs_error)).toBeLessThan(1);

    expect(comprehensiveMetrics.wallet_metrics.comparison.latency_diff).toBeLessThan(50);
    expect(comprehensiveMetrics.wallet_metrics.comparison.error_rate_diff).toBeLessThan(0.1);
    expect(comprehensiveMetrics.wallet_metrics.comparison.success_rate_diff).toBeLessThan(0.1);
    expect(Math.abs(comprehensiveMetrics.wallet_metrics.comparison.throughput_diff)).toBeLessThan(50);
    expect(Math.abs(comprehensiveMetrics.wallet_metrics.comparison.volume_diff)).toBeLessThan(10000);
    expect(Math.abs(comprehensiveMetrics.wallet_metrics.comparison.profit_diff)).toBeLessThan(1000);

    workflowData.forEach(data => {
      expect(data.metrics.heap_used).toBeLessThan(0.8);
      expect(data.metrics.active_requests).toBeLessThan(100);
      if (data.success) {
        expect(data.retries).toBeLessThan(data.maxRetries);
      }
    });
  });
});

function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - mean, 2));
  return squareDiffs.reduce((a, b) => a + b, 0) / values.length;
}

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
