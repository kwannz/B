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

describe('Workflow Validation with System Performance Metrics', () => {
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

  it('validates complete workflow with system performance metrics', async () => {
    const workflowData: any[] = [];
    const startTime = Date.now();
    const performanceData = {
      system: {
        heap_usage: [] as number[],
        external_memory: [] as number[],
        event_loop_lag: [] as number[],
        active_handles: [] as number[],
        active_requests: [] as number[],
        gc_collections: [] as number[],
        gc_duration: [] as number[]
      },
      metrics: {
        api_latency: [] as number[],
        error_rate: [] as number[],
        success_rate: [] as number[],
        throughput: [] as number[]
      },
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

      performanceData.system.heap_usage.push(pageMetrics.heap_used);
      performanceData.system.external_memory.push(pageMetrics.external_memory);
      performanceData.system.event_loop_lag.push(pageMetrics.event_loop_lag);
      performanceData.system.active_handles.push(pageMetrics.active_handles);
      performanceData.system.active_requests.push(pageMetrics.active_requests);
      performanceData.system.gc_collections.push(pageMetrics.garbage_collection.count);
      performanceData.system.gc_duration.push(pageMetrics.garbage_collection.duration);

      performanceData.metrics.api_latency.push(mockWalletMetrics.api_latency);
      performanceData.metrics.error_rate.push(mockWalletMetrics.error_rate);
      performanceData.metrics.success_rate.push(mockWalletMetrics.success_rate);
      performanceData.metrics.throughput.push(mockWalletMetrics.throughput);

      performanceData.timestamps.push(Date.now());

      workflowData.push({
        page: page.testId,
        duration: pageEndTime - pageStartTime,
        metrics: {
          system: {
            heap_usage: pageMetrics.heap_used,
            external_memory: pageMetrics.external_memory,
            event_loop_lag: pageMetrics.event_loop_lag,
            active_handles: pageMetrics.active_handles,
            active_requests: pageMetrics.active_requests,
            gc_metrics: pageMetrics.garbage_collection
          },
          performance: {
            api_latency: mockWalletMetrics.api_latency,
            error_rate: mockWalletMetrics.error_rate,
            success_rate: mockWalletMetrics.success_rate,
            throughput: mockWalletMetrics.throughput
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
        system: {
          memory: {
            average_heap: performanceData.system.heap_usage.reduce((a, b) => a + b, 0) / performanceData.system.heap_usage.length,
            heap_variance: calculateVariance(performanceData.system.heap_usage),
            average_external: performanceData.system.external_memory.reduce((a, b) => a + b, 0) / performanceData.system.external_memory.length,
            external_variance: calculateVariance(performanceData.system.external_memory),
            memory_trend: calculateTrend(performanceData.system.heap_usage)
          },
          event_loop: {
            average_lag: performanceData.system.event_loop_lag.reduce((a, b) => a + b, 0) / performanceData.system.event_loop_lag.length,
            lag_variance: calculateVariance(performanceData.system.event_loop_lag),
            average_handles: performanceData.system.active_handles.reduce((a, b) => a + b, 0) / performanceData.system.active_handles.length,
            handles_variance: calculateVariance(performanceData.system.active_handles),
            lag_trend: calculateTrend(performanceData.system.event_loop_lag)
          },
          resources: {
            average_requests: performanceData.system.active_requests.reduce((a, b) => a + b, 0) / performanceData.system.active_requests.length,
            requests_variance: calculateVariance(performanceData.system.active_requests),
            requests_trend: calculateTrend(performanceData.system.active_requests)
          },
          garbage_collection: {
            total_collections: performanceData.system.gc_collections.reduce((a, b) => a + b, 0),
            average_duration: performanceData.system.gc_duration.reduce((a, b) => a + b, 0) / performanceData.system.gc_collections.reduce((a, b) => a + b, 0),
            duration_variance: calculateVariance(performanceData.system.gc_duration),
            gc_trend: calculateTrend(performanceData.system.gc_duration)
          }
        },
        metrics: {
          api: {
            average_latency: performanceData.metrics.api_latency.reduce((a, b) => a + b, 0) / performanceData.metrics.api_latency.length,
            latency_variance: calculateVariance(performanceData.metrics.api_latency),
            latency_trend: calculateTrend(performanceData.metrics.api_latency)
          },
          errors: {
            average_rate: performanceData.metrics.error_rate.reduce((a, b) => a + b, 0) / performanceData.metrics.error_rate.length,
            rate_variance: calculateVariance(performanceData.metrics.error_rate),
            rate_trend: calculateTrend(performanceData.metrics.error_rate)
          },
          success: {
            average_rate: performanceData.metrics.success_rate.reduce((a, b) => a + b, 0) / performanceData.metrics.success_rate.length,
            rate_variance: calculateVariance(performanceData.metrics.success_rate),
            rate_trend: calculateTrend(performanceData.metrics.success_rate)
          },
          throughput: {
            average: performanceData.metrics.throughput.reduce((a, b) => a + b, 0) / performanceData.metrics.throughput.length,
            variance: calculateVariance(performanceData.metrics.throughput),
            trend: calculateTrend(performanceData.metrics.throughput)
          }
        },
        correlations: {
          heap_vs_latency: calculateCorrelation(performanceData.system.heap_usage, performanceData.metrics.api_latency),
          heap_vs_errors: calculateCorrelation(performanceData.system.heap_usage, performanceData.metrics.error_rate),
          lag_vs_latency: calculateCorrelation(performanceData.system.event_loop_lag, performanceData.metrics.api_latency),
          requests_vs_throughput: calculateCorrelation(performanceData.system.active_requests, performanceData.metrics.throughput),
          gc_vs_latency: calculateCorrelation(performanceData.system.gc_duration, performanceData.metrics.api_latency)
        }
      }
    };

    testRunner.expectMetrics(metrics);
    expect(metrics.total_duration).toBeLessThan(6000);

    const { system, metrics: perfMetrics } = metrics.performance_metrics;

    expect(system.memory.average_heap).toBeLessThan(0.8);
    expect(system.memory.heap_variance).toBeLessThan(0.1);
    expect(system.event_loop.average_lag).toBeLessThan(100);
    expect(system.event_loop.lag_variance).toBeLessThan(1000);
    expect(system.resources.average_requests).toBeLessThan(100);
    expect(system.resources.requests_variance).toBeLessThan(1000);
    expect(system.garbage_collection.average_duration).toBeLessThan(1000);
    expect(system.garbage_collection.duration_variance).toBeLessThan(10000);

    expect(perfMetrics.api.average_latency).toBeLessThan(200);
    expect(perfMetrics.api.latency_variance).toBeLessThan(10000);
    expect(perfMetrics.errors.average_rate).toBeLessThan(0.1);
    expect(perfMetrics.success.average_rate).toBeGreaterThan(0.9);
    expect(perfMetrics.throughput.average).toBeGreaterThan(0);

    Object.values(system).forEach(category => {
      if (category.trend) {
        expect(['increasing', 'decreasing', 'stable']).toContain(category.trend);
      }
    });

    Object.values(perfMetrics).forEach(category => {
      if (category.trend) {
        expect(['increasing', 'decreasing', 'stable']).toContain(category.trend);
      }
    });

    Object.values(metrics.performance_metrics.correlations).forEach(correlation => {
      expect(Math.abs(correlation)).toBeLessThan(1);
    });

    workflowData.forEach(data => {
      expect(data.duration).toBeLessThan(1000);
      expect(data.metrics.system.heap_usage).toBeLessThan(0.8);
      expect(data.metrics.system.event_loop_lag).toBeLessThan(100);
      expect(data.metrics.system.active_requests).toBeLessThan(100);
      expect(data.metrics.system.gc_metrics.duration).toBeLessThan(1000);
      expect(data.metrics.performance.api_latency).toBeLessThan(200);
      expect(data.metrics.performance.error_rate).toBeLessThan(0.1);
      expect(data.metrics.performance.success_rate).toBeGreaterThan(0.9);
      expect(data.metrics.performance.throughput).toBeGreaterThan(0);
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
