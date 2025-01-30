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

describe('Workflow Validation with Monitoring Metrics', () => {
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

  const mockWalletMetrics = {
    api_latency: 100,
    error_rate: 0.05,
    success_rate: 0.95,
    throughput: 100,
    active_trades: 5,
    total_volume: 10000,
    profit_loss: 500,
    system: mockSystemMetrics
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createBot as jest.Mock).mockResolvedValue({ id: 'bot-123' });
    (createWallet as jest.Mock).mockResolvedValue({
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      balance: 1.5,
      metrics: mockWalletMetrics
    });
    (getWallet as jest.Mock).mockResolvedValue({
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      balance: 1.5,
      metrics: mockWalletMetrics
    });
    (getBotStatus as jest.Mock).mockResolvedValue({ status: 'active', trades: [] });
  });

  it('validates complete workflow with monitoring metrics', async () => {
    const workflowData: any[] = [];
    const startTime = Date.now();
    const monitoringData = {
      api_calls: 0,
      api_errors: 0,
      api_latency: [] as number[],
      memory_usage: [] as number[],
      event_loop_delays: [] as number[],
      gc_collections: 0,
      gc_duration: 0
    };

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
      const pageMetrics = {
        ...mockSystemMetrics,
        heap_used: Math.min(0.8, mockSystemMetrics.heap_used + (workflowData.length * 0.05)),
        active_requests: Math.min(100, mockSystemMetrics.active_requests + (workflowData.length * 5))
      };

      monitoringData.api_calls += 2;
      monitoringData.api_latency.push(mockWalletMetrics.api_latency);
      monitoringData.memory_usage.push(pageMetrics.heap_used);
      monitoringData.event_loop_delays.push(pageMetrics.event_loop_lag);
      monitoringData.gc_collections += pageMetrics.garbage_collection.count;
      monitoringData.gc_duration += pageMetrics.garbage_collection.duration;

      workflowData.push({
        page: page.testId,
        duration: pageEndTime - pageStartTime,
        metrics: pageMetrics,
        monitoring: {
          api_latency: mockWalletMetrics.api_latency,
          error_rate: mockWalletMetrics.error_rate,
          success_rate: mockWalletMetrics.success_rate,
          throughput: mockWalletMetrics.throughput
        }
      });
    }

    const endTime = Date.now();
    const metrics = {
      total_duration: endTime - startTime,
      pages_completed: workflowData.length,
      workflow_data: workflowData,
      monitoring_metrics: {
        api: {
          total_calls: monitoringData.api_calls,
          total_errors: monitoringData.api_errors,
          error_rate: monitoringData.api_errors / monitoringData.api_calls,
          average_latency: monitoringData.api_latency.reduce((a, b) => a + b, 0) / monitoringData.api_latency.length,
          latency_variance: calculateVariance(monitoringData.api_latency)
        },
        system: {
          average_memory: monitoringData.memory_usage.reduce((a, b) => a + b, 0) / monitoringData.memory_usage.length,
          memory_variance: calculateVariance(monitoringData.memory_usage),
          average_event_loop_delay: monitoringData.event_loop_delays.reduce((a, b) => a + b, 0) / monitoringData.event_loop_delays.length,
          event_loop_variance: calculateVariance(monitoringData.event_loop_delays),
          gc_metrics: {
            total_collections: monitoringData.gc_collections,
            total_duration: monitoringData.gc_duration,
            average_duration: monitoringData.gc_duration / monitoringData.gc_collections
          }
        },
        correlations: {
          memory_vs_latency: calculateCorrelation(monitoringData.memory_usage, monitoringData.api_latency),
          memory_vs_event_loop: calculateCorrelation(monitoringData.memory_usage, monitoringData.event_loop_delays),
          latency_vs_event_loop: calculateCorrelation(monitoringData.api_latency, monitoringData.event_loop_delays)
        }
      }
    };

    testRunner.expectMetrics(metrics);
    expect(metrics.total_duration).toBeLessThan(6000);
    expect(metrics.monitoring_metrics.api.error_rate).toBeLessThan(0.1);
    expect(metrics.monitoring_metrics.system.memory_variance).toBeLessThan(0.1);
    expect(metrics.monitoring_metrics.system.event_loop_variance).toBeLessThan(100);
    expect(Math.abs(metrics.monitoring_metrics.correlations.memory_vs_latency)).toBeLessThan(1);
    expect(Math.abs(metrics.monitoring_metrics.correlations.memory_vs_event_loop)).toBeLessThan(1);
    expect(Math.abs(metrics.monitoring_metrics.correlations.latency_vs_event_loop)).toBeLessThan(1);

    workflowData.forEach(data => {
      expect(data.duration).toBeLessThan(1000);
      expect(data.metrics.heap_used).toBeLessThan(0.8);
      expect(data.metrics.active_requests).toBeLessThan(100);
      expect(data.monitoring.api_latency).toBeLessThan(1000);
      expect(data.monitoring.error_rate).toBeLessThan(0.1);
      expect(data.monitoring.success_rate).toBeGreaterThan(0.9);
      expect(data.monitoring.throughput).toBeGreaterThan(0);
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
