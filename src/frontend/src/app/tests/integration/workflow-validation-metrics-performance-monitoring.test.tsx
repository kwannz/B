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

describe('Workflow Validation with Performance Monitoring', () => {
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

  it('validates complete workflow with performance monitoring', async () => {
    const workflowData: any[] = [];
    const startTime = Date.now();
    const performanceData = {
      api_calls: [] as number[],
      response_times: [] as number[],
      error_counts: [] as number[],
      memory_usage: [] as number[],
      event_loop_delays: [] as number[],
      active_requests: [] as number[],
      gc_collections: [] as number[],
      gc_durations: [] as number[]
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

      performanceData.api_calls.push(2);
      performanceData.response_times.push(mockWalletMetrics.api_latency);
      performanceData.error_counts.push(Math.floor(mockWalletMetrics.error_rate * 100));
      performanceData.memory_usage.push(pageMetrics.heap_used);
      performanceData.event_loop_delays.push(pageMetrics.event_loop_lag);
      performanceData.active_requests.push(pageMetrics.active_requests);
      performanceData.gc_collections.push(pageMetrics.garbage_collection.count);
      performanceData.gc_durations.push(pageMetrics.garbage_collection.duration);

      workflowData.push({
        page: page.testId,
        duration: pageEndTime - pageStartTime,
        metrics: pageMetrics,
        performance: {
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
      performance_metrics: {
        api: {
          total_calls: performanceData.api_calls.reduce((a, b) => a + b, 0),
          average_response_time: performanceData.response_times.reduce((a, b) => a + b, 0) / performanceData.response_times.length,
          response_time_variance: calculateVariance(performanceData.response_times),
          total_errors: performanceData.error_counts.reduce((a, b) => a + b, 0),
          error_rate: performanceData.error_counts.reduce((a, b) => a + b, 0) / performanceData.api_calls.reduce((a, b) => a + b, 0)
        },
        system: {
          average_memory: performanceData.memory_usage.reduce((a, b) => a + b, 0) / performanceData.memory_usage.length,
          memory_variance: calculateVariance(performanceData.memory_usage),
          average_event_loop_delay: performanceData.event_loop_delays.reduce((a, b) => a + b, 0) / performanceData.event_loop_delays.length,
          event_loop_variance: calculateVariance(performanceData.event_loop_delays),
          average_active_requests: performanceData.active_requests.reduce((a, b) => a + b, 0) / performanceData.active_requests.length,
          request_variance: calculateVariance(performanceData.active_requests)
        },
        garbage_collection: {
          total_collections: performanceData.gc_collections.reduce((a, b) => a + b, 0),
          total_duration: performanceData.gc_durations.reduce((a, b) => a + b, 0),
          average_duration: performanceData.gc_durations.reduce((a, b) => a + b, 0) / performanceData.gc_collections.reduce((a, b) => a + b, 0),
          duration_variance: calculateVariance(performanceData.gc_durations)
        },
        trends: {
          memory_trend: calculateTrend(performanceData.memory_usage),
          event_loop_trend: calculateTrend(performanceData.event_loop_delays),
          request_trend: calculateTrend(performanceData.active_requests),
          gc_trend: calculateTrend(performanceData.gc_durations)
        },
        correlations: {
          memory_vs_latency: calculateCorrelation(performanceData.memory_usage, performanceData.response_times),
          memory_vs_errors: calculateCorrelation(performanceData.memory_usage, performanceData.error_counts),
          latency_vs_requests: calculateCorrelation(performanceData.response_times, performanceData.active_requests),
          gc_vs_latency: calculateCorrelation(performanceData.gc_durations, performanceData.response_times)
        }
      }
    };

    testRunner.expectMetrics(metrics);
    expect(metrics.total_duration).toBeLessThan(6000);
    expect(metrics.performance_metrics.api.error_rate).toBeLessThan(0.1);
    expect(metrics.performance_metrics.system.memory_variance).toBeLessThan(0.1);
    expect(metrics.performance_metrics.system.event_loop_variance).toBeLessThan(100);
    expect(metrics.performance_metrics.garbage_collection.duration_variance).toBeLessThan(1000);

    Object.values(metrics.performance_metrics.correlations).forEach(correlation => {
      expect(Math.abs(correlation)).toBeLessThan(1);
    });

    Object.values(metrics.performance_metrics.trends).forEach(trend => {
      expect(['increasing', 'decreasing', 'stable']).toContain(trend);
    });

    workflowData.forEach(data => {
      expect(data.duration).toBeLessThan(1000);
      expect(data.metrics.heap_used).toBeLessThan(0.8);
      expect(data.metrics.active_requests).toBeLessThan(100);
      expect(data.performance.api_latency).toBeLessThan(1000);
      expect(data.performance.error_rate).toBeLessThan(0.1);
      expect(data.performance.success_rate).toBeGreaterThan(0.9);
      expect(data.performance.throughput).toBeGreaterThan(0);
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

function calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
  const correlation = calculateCorrelation(values, Array.from({ length: values.length }, (_, i) => i));
  if (Math.abs(correlation) < 0.3) return 'stable';
  return correlation > 0 ? 'increasing' : 'decreasing';
}
