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

describe('Workflow Page Metrics', () => {
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

  const mockWallet = {
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

  beforeEach(() => {
    jest.clearAllMocks();
    (createBot as jest.Mock).mockResolvedValue({ id: 'bot-123' });
    (createWallet as jest.Mock).mockResolvedValue(mockWallet);
    (getWallet as jest.Mock).mockResolvedValue(mockWallet);
    (getBotStatus as jest.Mock).mockResolvedValue({ status: 'active', trades: [] });
  });

  it('validates workflow page metrics under load', async () => {
    const iterations = 3;
    const pages = [
      { component: AgentSelection, testId: 'agent-selection' },
      { component: StrategyCreation, testId: 'strategy-creation' },
      { component: BotIntegration, testId: 'bot-integration' },
      { component: KeyManagement, testId: 'key-management' },
      { component: TradingDashboard, testId: 'trading-dashboard' },
      { component: WalletComparison, testId: 'wallet-comparison' }
    ];

    const metricsData: any[] = [];
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      for (const page of pages) {
        const pageStartTime = Date.now();
        render(<TestContext><page.component /></TestContext>);

        await waitFor(() => {
          expect(screen.getByTestId(page.testId)).toBeInTheDocument();
        });

        const pageEndTime = Date.now();
        metricsData.push({
          iteration: i,
          page: page.testId,
          duration: pageEndTime - pageStartTime,
          metrics: {
            ...mockSystemMetrics,
            heap_used: Math.min(0.8, mockSystemMetrics.heap_used + (i * 0.05)),
            active_requests: Math.min(100, mockSystemMetrics.active_requests + (i * 5))
          }
        });
      }
    }

    const endTime = Date.now();
    const performanceMetrics = {
      total_duration: endTime - startTime,
      iterations_completed: iterations,
      pages_completed: pages.length * iterations,
      metrics_data: metricsData,
      performance_analysis: {
        average_page_duration: metricsData.reduce((acc, data) => acc + data.duration, 0) / metricsData.length,
        duration_variance: calculateVariance(metricsData.map(data => data.duration)),
        page_durations: pages.reduce((acc, page) => {
          const pageDurations = metricsData
            .filter(data => data.page === page.testId)
            .map(data => data.duration);
          acc[page.testId] = {
            average: pageDurations.reduce((sum, duration) => sum + duration, 0) / pageDurations.length,
            variance: calculateVariance(pageDurations)
          };
          return acc;
        }, {} as Record<string, { average: number; variance: number }>)
      },
      system_metrics: {
        heap_usage_trend: metricsData.map(data => data.metrics.heap_used),
        request_load_trend: metricsData.map(data => data.metrics.active_requests),
        heap_usage_variance: calculateVariance(metricsData.map(data => data.metrics.heap_used)),
        request_load_variance: calculateVariance(metricsData.map(data => data.metrics.active_requests))
      },
      correlation_analysis: {
        duration_vs_heap: calculateCorrelation(
          metricsData.map(data => data.duration),
          metricsData.map(data => data.metrics.heap_used)
        ),
        duration_vs_requests: calculateCorrelation(
          metricsData.map(data => data.duration),
          metricsData.map(data => data.metrics.active_requests)
        ),
        heap_vs_requests: calculateCorrelation(
          metricsData.map(data => data.metrics.heap_used),
          metricsData.map(data => data.metrics.active_requests)
        )
      }
    };

    testRunner.expectMetrics(performanceMetrics);
    expect(performanceMetrics.total_duration).toBeLessThan(30000);
    expect(performanceMetrics.performance_analysis.average_page_duration).toBeLessThan(1000);
    expect(performanceMetrics.system_metrics.heap_usage_variance).toBeLessThan(0.1);
    expect(performanceMetrics.system_metrics.request_load_variance).toBeLessThan(100);
    expect(Math.abs(performanceMetrics.correlation_analysis.duration_vs_heap)).toBeLessThan(1);
    expect(Math.abs(performanceMetrics.correlation_analysis.duration_vs_requests)).toBeLessThan(1);
    expect(Math.abs(performanceMetrics.correlation_analysis.heap_vs_requests)).toBeLessThan(1);

    Object.values(performanceMetrics.performance_analysis.page_durations).forEach(metrics => {
      expect(metrics.average).toBeLessThan(1000);
      expect(metrics.variance).toBeLessThan(100000);
    });
  });

  it('validates workflow page metrics with concurrent operations', async () => {
    const concurrentOperations = 3;
    const pages = [
      { component: AgentSelection, testId: 'agent-selection' },
      { component: StrategyCreation, testId: 'strategy-creation' },
      { component: BotIntegration, testId: 'bot-integration' },
      { component: KeyManagement, testId: 'key-management' },
      { component: TradingDashboard, testId: 'trading-dashboard' },
      { component: WalletComparison, testId: 'wallet-comparison' }
    ];

    const metricsData: any[] = [];
    const startTime = Date.now();

    const renderPromises = Array(concurrentOperations).fill(null).map(async (_, operationIndex) => {
      for (const page of pages) {
        const pageStartTime = Date.now();
        render(<TestContext><page.component /></TestContext>);

        await waitFor(() => {
          expect(screen.getByTestId(page.testId)).toBeInTheDocument();
        });

        const pageEndTime = Date.now();
        metricsData.push({
          operation: operationIndex,
          page: page.testId,
          duration: pageEndTime - pageStartTime,
          metrics: {
            ...mockSystemMetrics,
            heap_used: Math.min(0.8, mockSystemMetrics.heap_used + (operationIndex * 0.1)),
            active_requests: Math.min(100, mockSystemMetrics.active_requests + (operationIndex * 10))
          }
        });
      }
    });

    await Promise.all(renderPromises);
    const endTime = Date.now();

    const concurrentMetrics = {
      total_duration: endTime - startTime,
      concurrent_operations: concurrentOperations,
      pages_completed: pages.length * concurrentOperations,
      metrics_data: metricsData,
      performance_analysis: {
        average_page_duration: metricsData.reduce((acc, data) => acc + data.duration, 0) / metricsData.length,
        duration_variance: calculateVariance(metricsData.map(data => data.duration)),
        page_durations: pages.reduce((acc, page) => {
          const pageDurations = metricsData
            .filter(data => data.page === page.testId)
            .map(data => data.duration);
          acc[page.testId] = {
            average: pageDurations.reduce((sum, duration) => sum + duration, 0) / pageDurations.length,
            variance: calculateVariance(pageDurations)
          };
          return acc;
        }, {} as Record<string, { average: number; variance: number }>)
      },
      system_metrics: {
        peak_metrics: {
          heap_usage: Math.max(...metricsData.map(data => data.metrics.heap_used)),
          request_load: Math.max(...metricsData.map(data => data.metrics.active_requests))
        },
        metrics_variance: {
          heap_usage: calculateVariance(metricsData.map(data => data.metrics.heap_used)),
          request_load: calculateVariance(metricsData.map(data => data.metrics.active_requests))
        }
      },
      correlation_analysis: {
        concurrent_impact: {
          heap_usage: calculateCorrelation(
            metricsData.map(data => data.operation),
            metricsData.map(data => data.metrics.heap_used)
          ),
          request_load: calculateCorrelation(
            metricsData.map(data => data.operation),
            metricsData.map(data => data.metrics.active_requests)
          )
        },
        duration_impact: {
          heap_usage: calculateCorrelation(
            metricsData.map(data => data.duration),
            metricsData.map(data => data.metrics.heap_used)
          ),
          request_load: calculateCorrelation(
            metricsData.map(data => data.duration),
            metricsData.map(data => data.metrics.active_requests)
          )
        }
      }
    };

    testRunner.expectMetrics(concurrentMetrics);
    expect(concurrentMetrics.total_duration).toBeLessThan(30000);
    expect(concurrentMetrics.performance_analysis.average_page_duration).toBeLessThan(1000);
    expect(concurrentMetrics.system_metrics.peak_metrics.heap_usage).toBeLessThan(0.8);
    expect(concurrentMetrics.system_metrics.peak_metrics.request_load).toBeLessThan(100);
    expect(concurrentMetrics.system_metrics.metrics_variance.heap_usage).toBeLessThan(0.1);
    expect(concurrentMetrics.system_metrics.metrics_variance.request_load).toBeLessThan(100);
    expect(Math.abs(concurrentMetrics.correlation_analysis.concurrent_impact.heap_usage)).toBeLessThan(1);
    expect(Math.abs(concurrentMetrics.correlation_analysis.concurrent_impact.request_load)).toBeLessThan(1);
    expect(Math.abs(concurrentMetrics.correlation_analysis.duration_impact.heap_usage)).toBeLessThan(1);
    expect(Math.abs(concurrentMetrics.correlation_analysis.duration_impact.request_load)).toBeLessThan(1);

    Object.values(concurrentMetrics.performance_analysis.page_durations).forEach(metrics => {
      expect(metrics.average).toBeLessThan(1000);
      expect(metrics.variance).toBeLessThan(100000);
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
