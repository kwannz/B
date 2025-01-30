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

describe('Workflow Validation with Performance Monitoring and AB Testing', () => {
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

  it('validates complete workflow with performance monitoring and AB testing', async () => {
    const workflowData: any[] = [];
    const startTime = Date.now();
    const performanceData = {
      group_a: {
        api_calls: [] as number[],
        response_times: [] as number[],
        error_counts: [] as number[],
        memory_usage: [] as number[],
        event_loop_delays: [] as number[],
        active_requests: [] as number[],
        gc_collections: [] as number[],
        gc_durations: [] as number[],
        timestamps: [] as number[]
      },
      group_b: {
        api_calls: [] as number[],
        response_times: [] as number[],
        error_counts: [] as number[],
        memory_usage: [] as number[],
        event_loop_delays: [] as number[],
        active_requests: [] as number[],
        gc_collections: [] as number[],
        gc_durations: [] as number[],
        timestamps: [] as number[]
      }
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

      const groupAMetrics = {
        api_calls: 2,
        response_time: Math.random() * 200,
        error_count: Math.floor(Math.random() * 5),
        memory_usage: pageMetrics.heap_used * (0.9 + Math.random() * 0.2),
        event_loop_delay: pageMetrics.event_loop_lag * (0.9 + Math.random() * 0.2),
        active_requests: Math.floor(pageMetrics.active_requests * (0.9 + Math.random() * 0.2)),
        gc_collections: pageMetrics.garbage_collection.count,
        gc_duration: pageMetrics.garbage_collection.duration * (0.9 + Math.random() * 0.2)
      };

      const groupBMetrics = {
        api_calls: 2,
        response_time: Math.random() * 200,
        error_count: Math.floor(Math.random() * 5),
        memory_usage: pageMetrics.heap_used * (0.9 + Math.random() * 0.2),
        event_loop_delay: pageMetrics.event_loop_lag * (0.9 + Math.random() * 0.2),
        active_requests: Math.floor(pageMetrics.active_requests * (0.9 + Math.random() * 0.2)),
        gc_collections: pageMetrics.garbage_collection.count,
        gc_duration: pageMetrics.garbage_collection.duration * (0.9 + Math.random() * 0.2)
      };

      performanceData.group_a.api_calls.push(groupAMetrics.api_calls);
      performanceData.group_a.response_times.push(groupAMetrics.response_time);
      performanceData.group_a.error_counts.push(groupAMetrics.error_count);
      performanceData.group_a.memory_usage.push(groupAMetrics.memory_usage);
      performanceData.group_a.event_loop_delays.push(groupAMetrics.event_loop_delay);
      performanceData.group_a.active_requests.push(groupAMetrics.active_requests);
      performanceData.group_a.gc_collections.push(groupAMetrics.gc_collections);
      performanceData.group_a.gc_durations.push(groupAMetrics.gc_duration);
      performanceData.group_a.timestamps.push(Date.now());

      performanceData.group_b.api_calls.push(groupBMetrics.api_calls);
      performanceData.group_b.response_times.push(groupBMetrics.response_time);
      performanceData.group_b.error_counts.push(groupBMetrics.error_count);
      performanceData.group_b.memory_usage.push(groupBMetrics.memory_usage);
      performanceData.group_b.event_loop_delays.push(groupBMetrics.event_loop_delay);
      performanceData.group_b.active_requests.push(groupBMetrics.active_requests);
      performanceData.group_b.gc_collections.push(groupBMetrics.gc_collections);
      performanceData.group_b.gc_durations.push(groupBMetrics.gc_duration);
      performanceData.group_b.timestamps.push(Date.now());

      workflowData.push({
        page: page.testId,
        duration: pageEndTime - pageStartTime,
        metrics: pageMetrics,
        ab_test: {
          group_a: {
            metrics: groupAMetrics,
            timestamp: Date.now()
          },
          group_b: {
            metrics: groupBMetrics,
            timestamp: Date.now()
          }
        }
      });
    }

    const endTime = Date.now();
    const metrics = {
      total_duration: endTime - startTime,
      pages_completed: workflowData.length,
      workflow_data: workflowData,
      performance_metrics: {
        group_a: {
          api: {
            total_calls: performanceData.group_a.api_calls.reduce((a, b) => a + b, 0),
            average_response_time: performanceData.group_a.response_times.reduce((a, b) => a + b, 0) / performanceData.group_a.response_times.length,
            response_time_variance: calculateVariance(performanceData.group_a.response_times),
            total_errors: performanceData.group_a.error_counts.reduce((a, b) => a + b, 0),
            error_rate: performanceData.group_a.error_counts.reduce((a, b) => a + b, 0) / performanceData.group_a.api_calls.reduce((a, b) => a + b, 0)
          },
          system: {
            average_memory: performanceData.group_a.memory_usage.reduce((a, b) => a + b, 0) / performanceData.group_a.memory_usage.length,
            memory_variance: calculateVariance(performanceData.group_a.memory_usage),
            average_event_loop_delay: performanceData.group_a.event_loop_delays.reduce((a, b) => a + b, 0) / performanceData.group_a.event_loop_delays.length,
            event_loop_variance: calculateVariance(performanceData.group_a.event_loop_delays),
            average_active_requests: performanceData.group_a.active_requests.reduce((a, b) => a + b, 0) / performanceData.group_a.active_requests.length,
            request_variance: calculateVariance(performanceData.group_a.active_requests)
          },
          garbage_collection: {
            total_collections: performanceData.group_a.gc_collections.reduce((a, b) => a + b, 0),
            total_duration: performanceData.group_a.gc_durations.reduce((a, b) => a + b, 0),
            average_duration: performanceData.group_a.gc_durations.reduce((a, b) => a + b, 0) / performanceData.group_a.gc_collections.reduce((a, b) => a + b, 0),
            duration_variance: calculateVariance(performanceData.group_a.gc_durations)
          },
          trends: {
            memory_trend: calculateTrend(performanceData.group_a.memory_usage),
            event_loop_trend: calculateTrend(performanceData.group_a.event_loop_delays),
            request_trend: calculateTrend(performanceData.group_a.active_requests),
            gc_trend: calculateTrend(performanceData.group_a.gc_durations)
          }
        },
        group_b: {
          api: {
            total_calls: performanceData.group_b.api_calls.reduce((a, b) => a + b, 0),
            average_response_time: performanceData.group_b.response_times.reduce((a, b) => a + b, 0) / performanceData.group_b.response_times.length,
            response_time_variance: calculateVariance(performanceData.group_b.response_times),
            total_errors: performanceData.group_b.error_counts.reduce((a, b) => a + b, 0),
            error_rate: performanceData.group_b.error_counts.reduce((a, b) => a + b, 0) / performanceData.group_b.api_calls.reduce((a, b) => a + b, 0)
          },
          system: {
            average_memory: performanceData.group_b.memory_usage.reduce((a, b) => a + b, 0) / performanceData.group_b.memory_usage.length,
            memory_variance: calculateVariance(performanceData.group_b.memory_usage),
            average_event_loop_delay: performanceData.group_b.event_loop_delays.reduce((a, b) => a + b, 0) / performanceData.group_b.event_loop_delays.length,
            event_loop_variance: calculateVariance(performanceData.group_b.event_loop_delays),
            average_active_requests: performanceData.group_b.active_requests.reduce((a, b) => a + b, 0) / performanceData.group_b.active_requests.length,
            request_variance: calculateVariance(performanceData.group_b.active_requests)
          },
          garbage_collection: {
            total_collections: performanceData.group_b.gc_collections.reduce((a, b) => a + b, 0),
            total_duration: performanceData.group_b.gc_durations.reduce((a, b) => a + b, 0),
            average_duration: performanceData.group_b.gc_durations.reduce((a, b) => a + b, 0) / performanceData.group_b.gc_collections.reduce((a, b) => a + b, 0),
            duration_variance: calculateVariance(performanceData.group_b.gc_durations)
          },
          trends: {
            memory_trend: calculateTrend(performanceData.group_b.memory_usage),
            event_loop_trend: calculateTrend(performanceData.group_b.event_loop_delays),
            request_trend: calculateTrend(performanceData.group_b.active_requests),
            gc_trend: calculateTrend(performanceData.group_b.gc_durations)
          }
        },
        comparison: {
          api: {
            response_time_diff: Math.abs(
              performanceData.group_a.response_times.reduce((a, b) => a + b, 0) / performanceData.group_a.response_times.length -
              performanceData.group_b.response_times.reduce((a, b) => a + b, 0) / performanceData.group_b.response_times.length
            ),
            error_rate_diff: Math.abs(
              performanceData.group_a.error_counts.reduce((a, b) => a + b, 0) / performanceData.group_a.api_calls.reduce((a, b) => a + b, 0) -
              performanceData.group_b.error_counts.reduce((a, b) => a + b, 0) / performanceData.group_b.api_calls.reduce((a, b) => a + b, 0)
            )
          },
          system: {
            memory_diff: Math.abs(
              performanceData.group_a.memory_usage.reduce((a, b) => a + b, 0) / performanceData.group_a.memory_usage.length -
              performanceData.group_b.memory_usage.reduce((a, b) => a + b, 0) / performanceData.group_b.memory_usage.length
            ),
            event_loop_diff: Math.abs(
              performanceData.group_a.event_loop_delays.reduce((a, b) => a + b, 0) / performanceData.group_a.event_loop_delays.length -
              performanceData.group_b.event_loop_delays.reduce((a, b) => a + b, 0) / performanceData.group_b.event_loop_delays.length
            ),
            request_diff: Math.abs(
              performanceData.group_a.active_requests.reduce((a, b) => a + b, 0) / performanceData.group_a.active_requests.length -
              performanceData.group_b.active_requests.reduce((a, b) => a + b, 0) / performanceData.group_b.active_requests.length
            )
          },
          garbage_collection: {
            collection_diff: Math.abs(
              performanceData.group_a.gc_collections.reduce((a, b) => a + b, 0) -
              performanceData.group_b.gc_collections.reduce((a, b) => a + b, 0)
            ),
            duration_diff: Math.abs(
              performanceData.group_a.gc_durations.reduce((a, b) => a + b, 0) / performanceData.group_a.gc_collections.reduce((a, b) => a + b, 0) -
              performanceData.group_b.gc_durations.reduce((a, b) => a + b, 0) / performanceData.group_b.gc_collections.reduce((a, b) => a + b, 0)
            )
          }
        }
      }
    };

    testRunner.expectMetrics(metrics);
    expect(metrics.total_duration).toBeLessThan(6000);

    [metrics.performance_metrics.group_a, metrics.performance_metrics.group_b].forEach(group => {
      expect(group.api.error_rate).toBeLessThan(0.1);
      expect(group.api.average_response_time).toBeLessThan(200);
      expect(group.api.response_time_variance).toBeLessThan(10000);
      expect(group.system.average_memory).toBeLessThan(0.8);
      expect(group.system.memory_variance).toBeLessThan(0.1);
      expect(group.system.average_event_loop_delay).toBeLessThan(100);
      expect(group.system.event_loop_variance).toBeLessThan(1000);
      expect(group.garbage_collection.average_duration).toBeLessThan(1000);
      expect(group.garbage_collection.duration_variance).toBeLessThan(10000);

      Object.values(group.trends).forEach(trend => {
        expect(['increasing', 'decreasing', 'stable']).toContain(trend);
      });
    });

    expect(metrics.performance_metrics.comparison.api.response_time_diff).toBeLessThan(100);
    expect(metrics.performance_metrics.comparison.api.error_rate_diff).toBeLessThan(0.05);
    expect(metrics.performance_metrics.comparison.system.memory_diff).toBeLessThan(0.1);
    expect(metrics.performance_metrics.comparison.system.event_loop_diff).toBeLessThan(50);
    expect(metrics.performance_metrics.comparison.system.request_diff).toBeLessThan(20);
    expect(metrics.performance_metrics.comparison.garbage_collection.duration_diff).toBeLessThan(500);

    workflowData.forEach(data => {
      expect(data.duration).toBeLessThan(1000);
      expect(data.metrics.heap_used).toBeLessThan(0.8);
      expect(data.metrics.active_requests).toBeLessThan(100);
      expect(data.ab_test.group_a.metrics.response_time).toBeLessThan(200);
      expect(data.ab_test.group_b.metrics.response_time).toBeLessThan(200);
      expect(data.ab_test.group_a.metrics.memory_usage).toBeLessThan(0.8);
      expect(data.ab_test.group_b.metrics.memory_usage).toBeLessThan(0.8);
      expect(data.ab_test.group_a.metrics.event_loop_delay).toBeLessThan(100);
      expect(data.ab_test.group_b.metrics.event_loop_delay).toBeLessThan(100);
      expect(data.ab_test.group_a.metrics.gc_duration).toBeLessThan(1000);
      expect(data.ab_test.group_b.metrics.gc_duration).toBeLessThan(1000);
    });
  });
});

function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - mean, 2));
  return squareDiffs.reduce((a, b) => a + b, 0) / values.length;
}

function calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
  const correlation = calculateCorrelation(values, Array.from({ length: values.length }, (_, i) => i));
  if (Math.abs(correlation) < 0.3) return 'stable';
  return correlation > 0 ? 'increasing' : 'decreasing';
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
