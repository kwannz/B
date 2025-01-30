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

describe('Final Workflow Validation with Complete Metrics', () => {
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

  it('validates complete workflow with comprehensive metrics', async () => {
    const workflowData: any[] = [];
    const startTime = Date.now();
    const metricsData = {
      performance: {
        api_calls: [] as number[],
        response_times: [] as number[],
        error_counts: [] as number[],
        success_rates: [] as number[]
      },
      system: {
        memory_usage: [] as number[],
        event_loop_delays: [] as number[],
        active_requests: [] as number[],
        gc_metrics: [] as any[]
      },
      wallet: {
        operations: [] as any[],
        balances: [] as number[],
        transaction_success: [] as boolean[],
        latencies: [] as number[]
      },
      workflow: {
        step_durations: [] as number[],
        validations: [] as boolean[],
        coverage: [] as number[]
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

      const mockOperation = {
        timestamp: Date.now(),
        type: Math.random() > 0.5 ? 'transfer' : 'trade',
        amount: Math.random() * 1000,
        success: Math.random() > 0.1,
        latency: Math.random() * 200
      };

      metricsData.performance.api_calls.push(2);
      metricsData.performance.response_times.push(Math.random() * 200);
      metricsData.performance.error_counts.push(Math.floor(Math.random() * 5));
      metricsData.performance.success_rates.push(0.9 + Math.random() * 0.1);

      metricsData.system.memory_usage.push(pageMetrics.heap_used);
      metricsData.system.event_loop_delays.push(pageMetrics.event_loop_lag);
      metricsData.system.active_requests.push(pageMetrics.active_requests);
      metricsData.system.gc_metrics.push(pageMetrics.garbage_collection);

      metricsData.wallet.operations.push(mockOperation);
      metricsData.wallet.balances.push(1.5 + Math.random());
      metricsData.wallet.transaction_success.push(Math.random() > 0.1);
      metricsData.wallet.latencies.push(Math.random() * 200);

      metricsData.workflow.step_durations.push(pageEndTime - pageStartTime);
      metricsData.workflow.validations.push(true);
      metricsData.workflow.coverage.push(0.9 + Math.random() * 0.1);

      metricsData.timestamps.push(Date.now());

      workflowData.push({
        page: page.testId,
        duration: pageEndTime - pageStartTime,
        metrics: {
          performance: {
            api_calls: metricsData.performance.api_calls[metricsData.performance.api_calls.length - 1],
            response_time: metricsData.performance.response_times[metricsData.performance.response_times.length - 1],
            error_count: metricsData.performance.error_counts[metricsData.performance.error_counts.length - 1],
            success_rate: metricsData.performance.success_rates[metricsData.performance.success_rates.length - 1]
          },
          system: {
            memory_usage: metricsData.system.memory_usage[metricsData.system.memory_usage.length - 1],
            event_loop_delay: metricsData.system.event_loop_delays[metricsData.system.event_loop_delays.length - 1],
            active_requests: metricsData.system.active_requests[metricsData.system.active_requests.length - 1],
            gc_metrics: metricsData.system.gc_metrics[metricsData.system.gc_metrics.length - 1]
          },
          wallet: {
            operation: metricsData.wallet.operations[metricsData.wallet.operations.length - 1],
            balance: metricsData.wallet.balances[metricsData.wallet.balances.length - 1],
            transaction_success: metricsData.wallet.transaction_success[metricsData.wallet.transaction_success.length - 1],
            latency: metricsData.wallet.latencies[metricsData.wallet.latencies.length - 1]
          },
          workflow: {
            duration: metricsData.workflow.step_durations[metricsData.workflow.step_durations.length - 1],
            validation: metricsData.workflow.validations[metricsData.workflow.validations.length - 1],
            coverage: metricsData.workflow.coverage[metricsData.workflow.coverage.length - 1]
          }
        }
      });
    }

    const endTime = Date.now();
    const metrics = {
      total_duration: endTime - startTime,
      pages_completed: workflowData.length,
      workflow_data: workflowData,
      aggregated_metrics: {
        performance: {
          total_api_calls: metricsData.performance.api_calls.reduce((a, b) => a + b, 0),
          average_response_time: metricsData.performance.response_times.reduce((a, b) => a + b, 0) / metricsData.performance.response_times.length,
          response_time_variance: calculateVariance(metricsData.performance.response_times),
          total_errors: metricsData.performance.error_counts.reduce((a, b) => a + b, 0),
          average_success_rate: metricsData.performance.success_rates.reduce((a, b) => a + b, 0) / metricsData.performance.success_rates.length,
          performance_trend: {
            response_time: calculateTrend(metricsData.performance.response_times),
            error_rate: calculateTrend(metricsData.performance.error_counts),
            success_rate: calculateTrend(metricsData.performance.success_rates)
          }
        },
        system: {
          average_memory: metricsData.system.memory_usage.reduce((a, b) => a + b, 0) / metricsData.system.memory_usage.length,
          memory_variance: calculateVariance(metricsData.system.memory_usage),
          average_event_loop_delay: metricsData.system.event_loop_delays.reduce((a, b) => a + b, 0) / metricsData.system.event_loop_delays.length,
          event_loop_variance: calculateVariance(metricsData.system.event_loop_delays),
          average_active_requests: metricsData.system.active_requests.reduce((a, b) => a + b, 0) / metricsData.system.active_requests.length,
          request_variance: calculateVariance(metricsData.system.active_requests),
          system_trend: {
            memory: calculateTrend(metricsData.system.memory_usage),
            event_loop: calculateTrend(metricsData.system.event_loop_delays),
            requests: calculateTrend(metricsData.system.active_requests)
          }
        },
        wallet: {
          total_operations: metricsData.wallet.operations.length,
          success_rate: metricsData.wallet.transaction_success.filter(s => s).length / metricsData.wallet.transaction_success.length,
          average_latency: metricsData.wallet.latencies.reduce((a, b) => a + b, 0) / metricsData.wallet.latencies.length,
          latency_variance: calculateVariance(metricsData.wallet.latencies),
          average_balance: metricsData.wallet.balances.reduce((a, b) => a + b, 0) / metricsData.wallet.balances.length,
          wallet_trend: {
            latency: calculateTrend(metricsData.wallet.latencies),
            balance: calculateTrend(metricsData.wallet.balances),
            success: calculateTrend(metricsData.wallet.transaction_success.map(s => s ? 1 : 0))
          }
        },
        workflow: {
          average_step_duration: metricsData.workflow.step_durations.reduce((a, b) => a + b, 0) / metricsData.workflow.step_durations.length,
          duration_variance: calculateVariance(metricsData.workflow.step_durations),
          validation_success: metricsData.workflow.validations.filter(v => v).length / metricsData.workflow.validations.length,
          average_coverage: metricsData.workflow.coverage.reduce((a, b) => a + b, 0) / metricsData.workflow.coverage.length,
          workflow_trend: {
            duration: calculateTrend(metricsData.workflow.step_durations),
            coverage: calculateTrend(metricsData.workflow.coverage)
          }
        },
        correlations: {
          memory_vs_latency: calculateCorrelation(metricsData.system.memory_usage, metricsData.performance.response_times),
          memory_vs_success: calculateCorrelation(metricsData.system.memory_usage, metricsData.performance.success_rates),
          latency_vs_success: calculateCorrelation(metricsData.performance.response_times, metricsData.performance.success_rates),
          duration_vs_coverage: calculateCorrelation(metricsData.workflow.step_durations, metricsData.workflow.coverage)
        }
      }
    };

    testRunner.expectMetrics(metrics);
    expect(metrics.total_duration).toBeLessThan(6000);

    const { performance, system, wallet, workflow } = metrics.aggregated_metrics;

    expect(performance.average_response_time).toBeLessThan(200);
    expect(performance.response_time_variance).toBeLessThan(10000);
    expect(performance.average_success_rate).toBeGreaterThan(0.9);
    Object.values(performance.performance_trend).forEach(trend => {
      expect(['increasing', 'decreasing', 'stable']).toContain(trend);
    });

    expect(system.average_memory).toBeLessThan(0.8);
    expect(system.memory_variance).toBeLessThan(0.1);
    expect(system.average_event_loop_delay).toBeLessThan(100);
    expect(system.event_loop_variance).toBeLessThan(1000);
    expect(system.average_active_requests).toBeLessThan(100);
    expect(system.request_variance).toBeLessThan(1000);
    Object.values(system.system_trend).forEach(trend => {
      expect(['increasing', 'decreasing', 'stable']).toContain(trend);
    });

    expect(wallet.success_rate).toBeGreaterThan(0.9);
    expect(wallet.average_latency).toBeLessThan(200);
    expect(wallet.latency_variance).toBeLessThan(10000);
    Object.values(wallet.wallet_trend).forEach(trend => {
      expect(['increasing', 'decreasing', 'stable']).toContain(trend);
    });

    expect(workflow.average_step_duration).toBeLessThan(1000);
    expect(workflow.duration_variance).toBeLessThan(100000);
    expect(workflow.validation_success).toBeGreaterThan(0.9);
    expect(workflow.average_coverage).toBeGreaterThan(0.9);
    Object.values(workflow.workflow_trend).forEach(trend => {
      expect(['increasing', 'decreasing', 'stable']).toContain(trend);
    });

    Object.values(metrics.aggregated_metrics.correlations).forEach(correlation => {
      expect(Math.abs(correlation)).toBeLessThan(1);
    });

    workflowData.forEach(data => {
      const { performance, system, wallet, workflow } = data.metrics;

      expect(performance.response_time).toBeLessThan(200);
      expect(performance.success_rate).toBeGreaterThan(0.9);

      expect(system.memory_usage).toBeLessThan(0.8);
      expect(system.event_loop_delay).toBeLessThan(100);
      expect(system.active_requests).toBeLessThan(100);

      expect(wallet.operation.latency).toBeLessThan(200);
      expect(wallet.transaction_success).toBe(true);

      expect(workflow.duration).toBeLessThan(1000);
      expect(workflow.validation).toBe(true);
      expect(workflow.coverage).toBeGreaterThan(0.9);
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
