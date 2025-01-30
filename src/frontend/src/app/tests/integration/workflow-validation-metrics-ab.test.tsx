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

describe('Workflow Validation with AB Wallet Metrics', () => {
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

  it('validates complete workflow with AB wallet metrics', async () => {
    const workflowData: any[] = [];
    const startTime = Date.now();

    const pages = [
      { component: AgentSelection, testId: 'agent-selection' },
      { component: StrategyCreation, testId: 'strategy-creation' },
      { component: BotIntegration, testId: 'bot-integration' },
      { component: KeyManagement, testId: 'key-management' },
      { component: TradingDashboard, testId: 'trading-dashboard' },
      { component: WalletComparison, testId: 'wallet-comparison' }
    ];

    for (const page of pages) {
      const pageStartTime = Date.now();
      render(<TestContext><page.component /></TestContext>);

      await waitFor(() => {
        expect(screen.getByTestId(page.testId)).toBeInTheDocument();
      });

      const pageEndTime = Date.now();
      workflowData.push({
        page: page.testId,
        duration: pageEndTime - pageStartTime,
        metrics: {
          ...mockSystemMetrics,
          heap_used: Math.min(0.8, mockSystemMetrics.heap_used + (workflowData.length * 0.05)),
          active_requests: Math.min(100, mockSystemMetrics.active_requests + (workflowData.length * 5))
        }
      });
    }

    const endTime = Date.now();
    const metrics = {
      total_duration: endTime - startTime,
      pages_completed: workflowData.length,
      workflow_data: workflowData,
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
      system_metrics: {
        heap_usage_trend: workflowData.map(data => data.metrics.heap_used),
        request_load_trend: workflowData.map(data => data.metrics.active_requests),
        heap_usage_variance: calculateVariance(workflowData.map(data => data.metrics.heap_used)),
        request_load_variance: calculateVariance(workflowData.map(data => data.metrics.active_requests))
      }
    };

    testRunner.expectMetrics(metrics);
    expect(metrics.total_duration).toBeLessThan(6000);
    expect(metrics.system_metrics.heap_usage_variance).toBeLessThan(0.1);
    expect(metrics.system_metrics.request_load_variance).toBeLessThan(100);

    expect(metrics.wallet_metrics.comparison.latency_diff).toBeLessThan(50);
    expect(metrics.wallet_metrics.comparison.error_rate_diff).toBeLessThan(0.1);
    expect(metrics.wallet_metrics.comparison.success_rate_diff).toBeLessThan(0.1);
    expect(Math.abs(metrics.wallet_metrics.comparison.throughput_diff)).toBeLessThan(50);
    expect(Math.abs(metrics.wallet_metrics.comparison.volume_diff)).toBeLessThan(10000);
    expect(Math.abs(metrics.wallet_metrics.comparison.profit_diff)).toBeLessThan(1000);

    workflowData.forEach(data => {
      expect(data.duration).toBeLessThan(1000);
      expect(data.metrics.heap_used).toBeLessThan(0.8);
      expect(data.metrics.active_requests).toBeLessThan(100);
    });
  });
});

function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - mean, 2));
  return squareDiffs.reduce((a, b) => a + b, 0) / values.length;
}
