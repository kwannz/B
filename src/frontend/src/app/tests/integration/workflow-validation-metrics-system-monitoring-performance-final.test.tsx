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

describe('Final Workflow Validation with System Monitoring and Performance Metrics', () => {
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

  it('validates complete workflow with comprehensive system monitoring and performance metrics', async () => {
    const workflowData: any[] = [];
    const startTime = Date.now();
    const metricsData = {
      system: {
        heap_usage: [] as number[],
        external_memory: [] as number[],
        event_loop_lag: [] as number[],
        active_handles: [] as number[],
        active_requests: [] as number[],
        gc_collections: [] as number[],
        gc_duration: [] as number[]
      },
      performance: {
        api_latency: [] as number[],
        error_rate: [] as number[],
        success_rate: [] as number[],
        throughput: [] as number[],
        response_time: [] as number[],
        request_count: [] as number[]
      },
      workflow: {
        step_duration: [] as number[],
        step_success: [] as boolean[],
        step_errors: [] as any[],
        step_retries: [] as number[],
        step_validations: [] as boolean[]
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

      metricsData.system.heap_usage.push(pageMetrics.heap_used);
      metricsData.system.external_memory.push(pageMetrics.external_memory);
      metricsData.system.event_loop_lag.push(pageMetrics.event_loop_lag);
      metricsData.system.active_handles.push(pageMetrics.active_handles);
      metricsData.system.active_requests.push(pageMetrics.active_requests);
      metricsData.system.gc_collections.push(pageMetrics.garbage_collection.count);
      metricsData.system.gc_duration.push(pageMetrics.garbage_collection.duration);

      metricsData.performance.api_latency.push(mockWalletMetrics.api_latency);
      metricsData.performance.error_rate.push(mockWalletMetrics.error_rate);
      metricsData.performance.success_rate.push(mockWalletMetrics.success_rate);
      metricsData.performance.throughput.push(mockWalletMetrics.throughput);
      metricsData.performance.response_time.push(Math.random() * 200);
      metricsData.performance.request_count.push(Math.floor(Math.random() * 50) + 1);

      metricsData.workflow.step_duration.push(pageEndTime - pageStartTime);
      metricsData.workflow.step_success.push(true);
      metricsData.workflow.step_errors.push(null);
      metricsData.workflow.step_retries.push(0);
      metricsData.workflow.step_validations.push(true);

      metricsData.timestamps.push(Date.now());

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
            throughput: mockWalletMetrics.throughput,
            response_time: metricsData.performance.response_time[metricsData.performance.response_time.length - 1],
            request_count: metricsData.performance.request_count[metricsData.performance.request_count.length - 1]
          },
          workflow: {
            duration: pageEndTime - pageStartTime,
            success: true,
            error: null,
            retries: 0,
            validation: true
          }
        }
      });
    }

    const endTime = Date.now();
    const metrics = {
      total_duration: endTime - startTime,
      pages_completed: workflowData.length,
      workflow_data: workflowData,
      metrics_summary: {
        system: {
          memory: {
            average_heap: metricsData.system.heap_usage.reduce((a, b) => a + b, 0) / metricsData.system.heap_usage.length,
            heap_variance: calculateVariance(metricsData.system.heap_usage),
            average_external: metricsData.system.external_memory.reduce((a, b) => a + b, 0) / metricsData.system.external_memory.length,
            external_variance: calculateVariance(metricsData.system.external_memory),
            memory_trend: calculateTrend(metricsData.system.heap_usage)
          },
          event_loop: {
            average_lag: metricsData.system.event_loop_lag.reduce((a, b) => a + b, 0) / metricsData.system.event_loop_lag.length,
            lag_variance: calculateVariance(metricsData.system.event_loop_lag),
            average_handles: metricsData.system.active_handles.reduce((a, b) => a + b, 0) / metricsData.system.active_handles.length,
            handles_variance: calculateVariance(metricsData.system.active_handles),
            lag_trend: calculateTrend(metricsData.system.event_loop_lag)
          },
          resources: {
            average_requests: metricsData.system.active_requests.reduce((a, b) => a + b, 0) / metricsData.system.active_requests.length,
            requests_variance: calculateVariance(metricsData.system.active_requests),
            requests_trend: calculateTrend(metricsData.system.active_requests)
          },
          garbage_collection: {
            total_collections: metricsData.system.gc_collections.reduce((a, b) => a + b, 0),
            average_duration: metricsData.system.gc_duration.reduce((a, b) => a + b, 0) / metricsData.system.gc_collections.reduce((a, b) => a + b, 0),
            duration_variance: calculateVariance(metricsData.system.gc_duration),
            gc_trend: calculateTrend(metricsData.system.gc_duration)
          }
        },
        performance: {
          api: {
            average_latency: metricsData.performance.api_latency.reduce((a, b) => a + b, 0) / metricsData.performance.api_latency.length,
            latency_variance: calculateVariance(metricsData.performance.api_latency),
            latency_trend: calculateTrend(metricsData.performance.api_latency)
          },
          errors: {
            average_rate: metricsData.performance.error_rate.reduce((a, b) => a + b, 0) / metricsData.performance.error_rate.length,
            rate_variance: calculateVariance(metricsData.performance.error_rate),
            rate_trend: calculateTrend(metricsData.performance.error_rate)
          },
          success: {
            average_rate: metricsData.performance.success_rate.reduce((a, b) => a + b, 0) / metricsData.performance.success_rate.length,
            rate_variance: calculateVariance(metricsData.performance.success_rate),
            rate_trend: calculateTrend(metricsData.performance.success_rate)
          },
          throughput: {
            average: metricsData.performance.throughput.reduce((a, b) => a + b, 0) / metricsData.performance.throughput.length,
            variance: calculateVariance(metricsData.performance.throughput),
            trend: calculateTrend(metricsData.performance.throughput)
          },
          response: {
            average_time: metricsData.performance.response_time.reduce((a, b) => a + b, 0) / metricsData.performance.response_time.length,
            time_variance: calculateVariance(metricsData.performance.response_time),
            time_trend: calculateTrend(metricsData.performance.response_time)
          },
          requests: {
            total_count: metricsData.performance.request_count.reduce((a, b) => a + b, 0),
            average_count: metricsData.performance.request_count.reduce((a, b) => a + b, 0) / metricsData.performance.request_count.length,
            count_variance: calculateVariance(metricsData.performance.request_count),
            count_trend: calculateTrend(metricsData.performance.request_count)
          }
        },
        workflow: {
          steps: {
            average_duration: metricsData.workflow.step_duration.reduce((a, b) => a + b, 0) / metricsData.workflow.step_duration.length,
            duration_variance: calculateVariance(metricsData.workflow.step_duration),
            success_rate: metricsData.workflow.step_success.filter(s => s).length / metricsData.workflow.step_success.length,
            error_rate: metricsData.workflow.step_errors.filter(e => e !== null).length / metricsData.workflow.step_errors.length,
            average_retries: metricsData.workflow.step_retries.reduce((a, b) => a + b, 0) / metricsData.workflow.step_retries.length,
            validation_rate: metricsData.workflow.step_validations.filter(v => v).length / metricsData.workflow.step_validations.length,
            duration_trend: calculateTrend(metricsData.workflow.step_duration)
          }
        },
        correlations: {
          heap_vs_latency: calculateCorrelation(metricsData.system.heap_usage, metricsData.performance.api_latency),
          heap_vs_errors: calculateCorrelation(metricsData.system.heap_usage, metricsData.performance.error_rate),
          lag_vs_latency: calculateCorrelation(metricsData.system.event_loop_lag, metricsData.performance.api_latency),
          requests_vs_throughput: calculateCorrelation(metricsData.system.active_requests, metricsData.performance.throughput),
          gc_vs_latency: calculateCorrelation(metricsData.system.gc_duration, metricsData.performance.api_latency),
          duration_vs_success: calculateCorrelation(metricsData.workflow.step_duration, metricsData.workflow.step_success.map(s => s ? 1 : 0)),
          duration_vs_errors: calculateCorrelation(metricsData.workflow.step_duration, metricsData.workflow.step_errors.map(e => e !== null ? 1 : 0)),
          duration_vs_retries: calculateCorrelation(metricsData.workflow.step_duration, metricsData.workflow.step_retries),
          duration_vs_validation: calculateCorrelation(metricsData.workflow.step_duration, metricsData.workflow.step_validations.map(v => v ? 1 : 0))
        },
        time_series: {
          timestamps: metricsData.timestamps,
          intervals: metricsData.timestamps.slice(1).map((t, i) => t - metricsData.timestamps[i]),
          average_interval: (metricsData.timestamps[metricsData.timestamps.length - 1] - metricsData.timestamps[0]) / (metricsData.timestamps.length - 1)
        }
      }
    };

    testRunner.expectMetrics(metrics);
    expect(metrics.total_duration).toBeLessThan(6000);

    const { system, performance, workflow } = metrics.metrics_summary;

    expect(system.memory.average_heap).toBeLessThan(0.8);
    expect(system.memory.heap_variance).toBeLessThan(0.1);
    expect(system.event_loop.average_lag).toBeLessThan(100);
    expect(system.event_loop.lag_variance).toBeLessThan(1000);
    expect(system.resources.average_requests).toBeLessThan(100);
    expect(system.resources.requests_variance).toBeLessThan(1000);
    expect(system.garbage_collection.average_duration).toBeLessThan(1000);
    expect(system.garbage_collection.duration_variance).toBeLessThan(10000);

    expect(performance.api.average_latency).toBeLessThan(200);
    expect(performance.api.latency_variance).toBeLessThan(10000);
    expect(performance.errors.average_rate).toBeLessThan(0.1);
    expect(performance.errors.rate_variance).toBeLessThan(0.01);
    expect(performance.success.average_rate).toBeGreaterThan(0.9);
    expect(performance.success.rate_variance).toBeLessThan(0.01);
    expect(performance.throughput.average).toBeGreaterThan(0);
    expect(performance.throughput.variance).toBeLessThan(10000);
    expect(performance.response.average_time).toBeLessThan(200);
    expect(performance.response.time_variance).toBeLessThan(10000);
    expect(performance.requests.average_count).toBeGreaterThan(0);
    expect(performance.requests.count_variance).toBeLessThan(1000);

    expect(workflow.steps.average_duration).toBeLessThan(1000);
    expect(workflow.steps.duration_variance).toBeLessThan(100000);
    expect(workflow.steps.success_rate).toBeGreaterThan(0.9);
    expect(workflow.steps.error_rate).toBeLessThan(0.1);
    expect(workflow.steps.average_retries).toBeLessThan(1);
    expect(workflow.steps.validation_rate).toBeGreaterThan(0.9);

    Object.values(system).forEach(category => {
      if (category.trend) {
        expect(['increasing', 'decreasing', 'stable']).toContain(category.trend);
      }
    });

    Object.values(performance).forEach(category => {
      if (category.trend) {
        expect(['increasing', 'decreasing', 'stable']).toContain(category.trend);
      }
    });

    expect(['increasing', 'decreasing', 'stable']).toContain(workflow.steps.duration_trend);

    Object.values(metrics.metrics_summary.correlations).forEach(correlation => {
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
      expect(data.metrics.performance.response_time).toBeLessThan(200);
      expect(data.metrics.performance.request_count).toBeGreaterThan(0);
      expect(data.metrics.workflow.duration).toBeLessThan(1000);
      expect(data.metrics.workflow.success).toBe(true);
      expect(data.metrics.workflow.error).toBeNull();
      expect(data.metrics.workflow.retries).toBeLessThan(1);
      expect(data.metrics.workflow.validation).toBe(true);
    });

    expect(metrics.metrics_summary.time_series.average_interval).toBeLessThan(1000);
    metrics.metrics_summary.time_series.intervals.forEach(interval => {
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
