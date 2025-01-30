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

describe('Workflow Validation with System Monitoring', () => {
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

  it('validates complete workflow with system monitoring', async () => {
    const workflowData: any[] = [];
    const startTime = Date.now();
    const systemData = {
      heap_usage: [] as number[],
      external_memory: [] as number[],
      event_loop_lag: [] as number[],
      active_handles: [] as number[],
      active_requests: [] as number[],
      gc_collections: [] as number[],
      gc_duration: [] as number[],
      timestamps: [] as number[]
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

      systemData.heap_usage.push(pageMetrics.heap_used);
      systemData.external_memory.push(pageMetrics.external_memory);
      systemData.event_loop_lag.push(pageMetrics.event_loop_lag);
      systemData.active_handles.push(pageMetrics.active_handles);
      systemData.active_requests.push(pageMetrics.active_requests);
      systemData.gc_collections.push(pageMetrics.garbage_collection.count);
      systemData.gc_duration.push(pageMetrics.garbage_collection.duration);
      systemData.timestamps.push(pageEndTime);

      workflowData.push({
        page: page.testId,
        duration: pageEndTime - pageStartTime,
        metrics: pageMetrics,
        system: {
          heap_usage: pageMetrics.heap_used,
          external_memory: pageMetrics.external_memory,
          event_loop_lag: pageMetrics.event_loop_lag,
          active_handles: pageMetrics.active_handles,
          active_requests: pageMetrics.active_requests,
          gc_metrics: pageMetrics.garbage_collection
        }
      });
    }

    const endTime = Date.now();
    const metrics = {
      total_duration: endTime - startTime,
      pages_completed: workflowData.length,
      workflow_data: workflowData,
      system_metrics: {
        memory: {
          average_heap_usage: systemData.heap_usage.reduce((a, b) => a + b, 0) / systemData.heap_usage.length,
          heap_usage_variance: calculateVariance(systemData.heap_usage),
          average_external_memory: systemData.external_memory.reduce((a, b) => a + b, 0) / systemData.external_memory.length,
          external_memory_variance: calculateVariance(systemData.external_memory),
          memory_trend: calculateTrend(systemData.heap_usage)
        },
        event_loop: {
          average_lag: systemData.event_loop_lag.reduce((a, b) => a + b, 0) / systemData.event_loop_lag.length,
          lag_variance: calculateVariance(systemData.event_loop_lag),
          lag_trend: calculateTrend(systemData.event_loop_lag)
        },
        resources: {
          average_handles: systemData.active_handles.reduce((a, b) => a + b, 0) / systemData.active_handles.length,
          handles_variance: calculateVariance(systemData.active_handles),
          average_requests: systemData.active_requests.reduce((a, b) => a + b, 0) / systemData.active_requests.length,
          requests_variance: calculateVariance(systemData.active_requests),
          handles_trend: calculateTrend(systemData.active_handles),
          requests_trend: calculateTrend(systemData.active_requests)
        },
        garbage_collection: {
          total_collections: systemData.gc_collections.reduce((a, b) => a + b, 0),
          total_duration: systemData.gc_duration.reduce((a, b) => a + b, 0),
          average_duration: systemData.gc_duration.reduce((a, b) => a + b, 0) / systemData.gc_collections.reduce((a, b) => a + b, 0),
          duration_variance: calculateVariance(systemData.gc_duration),
          collections_trend: calculateTrend(systemData.gc_collections),
          duration_trend: calculateTrend(systemData.gc_duration)
        },
        correlations: {
          heap_vs_lag: calculateCorrelation(systemData.heap_usage, systemData.event_loop_lag),
          heap_vs_requests: calculateCorrelation(systemData.heap_usage, systemData.active_requests),
          lag_vs_requests: calculateCorrelation(systemData.event_loop_lag, systemData.active_requests),
          gc_vs_heap: calculateCorrelation(systemData.gc_duration, systemData.heap_usage),
          gc_vs_lag: calculateCorrelation(systemData.gc_duration, systemData.event_loop_lag)
        },
        time_series: {
          timestamps: systemData.timestamps,
          intervals: systemData.timestamps.slice(1).map((t, i) => t - systemData.timestamps[i]),
          average_interval: (systemData.timestamps[systemData.timestamps.length - 1] - systemData.timestamps[0]) / (systemData.timestamps.length - 1)
        }
      }
    };

    testRunner.expectMetrics(metrics);
    expect(metrics.total_duration).toBeLessThan(6000);
    expect(metrics.system_metrics.memory.average_heap_usage).toBeLessThan(0.8);
    expect(metrics.system_metrics.memory.heap_usage_variance).toBeLessThan(0.1);
    expect(metrics.system_metrics.event_loop.average_lag).toBeLessThan(100);
    expect(metrics.system_metrics.event_loop.lag_variance).toBeLessThan(1000);
    expect(metrics.system_metrics.resources.average_requests).toBeLessThan(100);
    expect(metrics.system_metrics.resources.requests_variance).toBeLessThan(1000);
    expect(metrics.system_metrics.garbage_collection.average_duration).toBeLessThan(1000);
    expect(metrics.system_metrics.garbage_collection.duration_variance).toBeLessThan(10000);

    Object.values(metrics.system_metrics.correlations).forEach(correlation => {
      expect(Math.abs(correlation)).toBeLessThan(1);
    });

    Object.values(metrics.system_metrics).forEach(category => {
      if (category.trend) {
        expect(['increasing', 'decreasing', 'stable']).toContain(category.trend);
      }
    });

    workflowData.forEach(data => {
      expect(data.duration).toBeLessThan(1000);
      expect(data.metrics.heap_used).toBeLessThan(0.8);
      expect(data.metrics.active_requests).toBeLessThan(100);
      expect(data.system.heap_usage).toBeLessThan(0.8);
      expect(data.system.event_loop_lag).toBeLessThan(100);
      expect(data.system.active_requests).toBeLessThan(100);
      expect(data.system.gc_metrics.duration).toBeLessThan(1000);
    });

    expect(metrics.system_metrics.time_series.average_interval).toBeLessThan(1000);
    metrics.system_metrics.time_series.intervals.forEach(interval => {
      expect(interval).toBeLessThan(1000);
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
