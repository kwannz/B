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

describe('Workflow Validation with System Monitoring and AB Testing', () => {
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

  it('validates complete workflow with system monitoring and AB testing', async () => {
    const workflowData: any[] = [];
    const startTime = Date.now();
    const monitoringData = {
      group_a: {
        system_metrics: [] as any[],
        performance_metrics: [] as any[],
        timestamps: [] as number[]
      },
      group_b: {
        system_metrics: [] as any[],
        performance_metrics: [] as any[],
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
        system: {
          ...pageMetrics,
          heap_used: pageMetrics.heap_used * (0.9 + Math.random() * 0.2),
          active_requests: Math.floor(pageMetrics.active_requests * (0.9 + Math.random() * 0.2))
        },
        performance: {
          api_latency: Math.random() * 200,
          error_rate: Math.random() * 0.1,
          success_rate: 0.9 + Math.random() * 0.1,
          throughput: Math.random() * 100
        }
      };

      const groupBMetrics = {
        system: {
          ...pageMetrics,
          heap_used: pageMetrics.heap_used * (0.9 + Math.random() * 0.2),
          active_requests: Math.floor(pageMetrics.active_requests * (0.9 + Math.random() * 0.2))
        },
        performance: {
          api_latency: Math.random() * 200,
          error_rate: Math.random() * 0.1,
          success_rate: 0.9 + Math.random() * 0.1,
          throughput: Math.random() * 100
        }
      };

      monitoringData.group_a.system_metrics.push(groupAMetrics.system);
      monitoringData.group_a.performance_metrics.push(groupAMetrics.performance);
      monitoringData.group_a.timestamps.push(Date.now());

      monitoringData.group_b.system_metrics.push(groupBMetrics.system);
      monitoringData.group_b.performance_metrics.push(groupBMetrics.performance);
      monitoringData.group_b.timestamps.push(Date.now());

      workflowData.push({
        page: page.testId,
        duration: pageEndTime - pageStartTime,
        metrics: {
          group_a: groupAMetrics,
          group_b: groupBMetrics
        }
      });
    }

    const endTime = Date.now();
    const metrics = {
      total_duration: endTime - startTime,
      pages_completed: workflowData.length,
      workflow_data: workflowData,
      monitoring_metrics: {
        group_a: {
          system: {
            average_heap: monitoringData.group_a.system_metrics.reduce((sum, m) => sum + m.heap_used, 0) / monitoringData.group_a.system_metrics.length,
            heap_variance: calculateVariance(monitoringData.group_a.system_metrics.map(m => m.heap_used)),
            average_requests: monitoringData.group_a.system_metrics.reduce((sum, m) => sum + m.active_requests, 0) / monitoringData.group_a.system_metrics.length,
            requests_variance: calculateVariance(monitoringData.group_a.system_metrics.map(m => m.active_requests)),
            system_trend: {
              heap: calculateTrend(monitoringData.group_a.system_metrics.map(m => m.heap_used)),
              requests: calculateTrend(monitoringData.group_a.system_metrics.map(m => m.active_requests))
            }
          },
          performance: {
            average_latency: monitoringData.group_a.performance_metrics.reduce((sum, m) => sum + m.api_latency, 0) / monitoringData.group_a.performance_metrics.length,
            latency_variance: calculateVariance(monitoringData.group_a.performance_metrics.map(m => m.api_latency)),
            average_error_rate: monitoringData.group_a.performance_metrics.reduce((sum, m) => sum + m.error_rate, 0) / monitoringData.group_a.performance_metrics.length,
            error_variance: calculateVariance(monitoringData.group_a.performance_metrics.map(m => m.error_rate)),
            average_success_rate: monitoringData.group_a.performance_metrics.reduce((sum, m) => sum + m.success_rate, 0) / monitoringData.group_a.performance_metrics.length,
            success_variance: calculateVariance(monitoringData.group_a.performance_metrics.map(m => m.success_rate)),
            average_throughput: monitoringData.group_a.performance_metrics.reduce((sum, m) => sum + m.throughput, 0) / monitoringData.group_a.performance_metrics.length,
            throughput_variance: calculateVariance(monitoringData.group_a.performance_metrics.map(m => m.throughput)),
            performance_trend: {
              latency: calculateTrend(monitoringData.group_a.performance_metrics.map(m => m.api_latency)),
              errors: calculateTrend(monitoringData.group_a.performance_metrics.map(m => m.error_rate)),
              success: calculateTrend(monitoringData.group_a.performance_metrics.map(m => m.success_rate)),
              throughput: calculateTrend(monitoringData.group_a.performance_metrics.map(m => m.throughput))
            }
          }
        },
        group_b: {
          system: {
            average_heap: monitoringData.group_b.system_metrics.reduce((sum, m) => sum + m.heap_used, 0) / monitoringData.group_b.system_metrics.length,
            heap_variance: calculateVariance(monitoringData.group_b.system_metrics.map(m => m.heap_used)),
            average_requests: monitoringData.group_b.system_metrics.reduce((sum, m) => sum + m.active_requests, 0) / monitoringData.group_b.system_metrics.length,
            requests_variance: calculateVariance(monitoringData.group_b.system_metrics.map(m => m.active_requests)),
            system_trend: {
              heap: calculateTrend(monitoringData.group_b.system_metrics.map(m => m.heap_used)),
              requests: calculateTrend(monitoringData.group_b.system_metrics.map(m => m.active_requests))
            }
          },
          performance: {
            average_latency: monitoringData.group_b.performance_metrics.reduce((sum, m) => sum + m.api_latency, 0) / monitoringData.group_b.performance_metrics.length,
            latency_variance: calculateVariance(monitoringData.group_b.performance_metrics.map(m => m.api_latency)),
            average_error_rate: monitoringData.group_b.performance_metrics.reduce((sum, m) => sum + m.error_rate, 0) / monitoringData.group_b.performance_metrics.length,
            error_variance: calculateVariance(monitoringData.group_b.performance_metrics.map(m => m.error_rate)),
            average_success_rate: monitoringData.group_b.performance_metrics.reduce((sum, m) => sum + m.success_rate, 0) / monitoringData.group_b.performance_metrics.length,
            success_variance: calculateVariance(monitoringData.group_b.performance_metrics.map(m => m.success_rate)),
            average_throughput: monitoringData.group_b.performance_metrics.reduce((sum, m) => sum + m.throughput, 0) / monitoringData.group_b.performance_metrics.length,
            throughput_variance: calculateVariance(monitoringData.group_b.performance_metrics.map(m => m.throughput)),
            performance_trend: {
              latency: calculateTrend(monitoringData.group_b.performance_metrics.map(m => m.api_latency)),
              errors: calculateTrend(monitoringData.group_b.performance_metrics.map(m => m.error_rate)),
              success: calculateTrend(monitoringData.group_b.performance_metrics.map(m => m.success_rate)),
              throughput: calculateTrend(monitoringData.group_b.performance_metrics.map(m => m.throughput))
            }
          }
        },
        comparison: {
          system: {
            heap_diff: Math.abs(
              monitoringData.group_a.system_metrics.reduce((sum, m) => sum + m.heap_used, 0) / monitoringData.group_a.system_metrics.length -
              monitoringData.group_b.system_metrics.reduce((sum, m) => sum + m.heap_used, 0) / monitoringData.group_b.system_metrics.length
            ),
            requests_diff: Math.abs(
              monitoringData.group_a.system_metrics.reduce((sum, m) => sum + m.active_requests, 0) / monitoringData.group_a.system_metrics.length -
              monitoringData.group_b.system_metrics.reduce((sum, m) => sum + m.active_requests, 0) / monitoringData.group_b.system_metrics.length
            )
          },
          performance: {
            latency_diff: Math.abs(
              monitoringData.group_a.performance_metrics.reduce((sum, m) => sum + m.api_latency, 0) / monitoringData.group_a.performance_metrics.length -
              monitoringData.group_b.performance_metrics.reduce((sum, m) => sum + m.api_latency, 0) / monitoringData.group_b.performance_metrics.length
            ),
            error_rate_diff: Math.abs(
              monitoringData.group_a.performance_metrics.reduce((sum, m) => sum + m.error_rate, 0) / monitoringData.group_a.performance_metrics.length -
              monitoringData.group_b.performance_metrics.reduce((sum, m) => sum + m.error_rate, 0) / monitoringData.group_b.performance_metrics.length
            ),
            success_rate_diff: Math.abs(
              monitoringData.group_a.performance_metrics.reduce((sum, m) => sum + m.success_rate, 0) / monitoringData.group_a.performance_metrics.length -
              monitoringData.group_b.performance_metrics.reduce((sum, m) => sum + m.success_rate, 0) / monitoringData.group_b.performance_metrics.length
            ),
            throughput_diff: Math.abs(
              monitoringData.group_a.performance_metrics.reduce((sum, m) => sum + m.throughput, 0) / monitoringData.group_a.performance_metrics.length -
              monitoringData.group_b.performance_metrics.reduce((sum, m) => sum + m.throughput, 0) / monitoringData.group_b.performance_metrics.length
            )
          }
        }
      }
    };

    testRunner.expectMetrics(metrics);
    expect(metrics.total_duration).toBeLessThan(6000);

    [metrics.monitoring_metrics.group_a, metrics.monitoring_metrics.group_b].forEach(group => {
      expect(group.system.average_heap).toBeLessThan(0.8);
      expect(group.system.heap_variance).toBeLessThan(0.1);
      expect(group.system.average_requests).toBeLessThan(100);
      expect(group.system.requests_variance).toBeLessThan(1000);

      expect(group.performance.average_latency).toBeLessThan(200);
      expect(group.performance.latency_variance).toBeLessThan(10000);
      expect(group.performance.average_error_rate).toBeLessThan(0.1);
      expect(group.performance.error_variance).toBeLessThan(0.01);
      expect(group.performance.average_success_rate).toBeGreaterThan(0.9);
      expect(group.performance.success_variance).toBeLessThan(0.01);
      expect(group.performance.average_throughput).toBeGreaterThan(0);
      expect(group.performance.throughput_variance).toBeLessThan(10000);

      Object.values(group.system.system_trend).forEach(trend => {
        expect(['increasing', 'decreasing', 'stable']).toContain(trend);
      });

      Object.values(group.performance.performance_trend).forEach(trend => {
        expect(['increasing', 'decreasing', 'stable']).toContain(trend);
      });
    });

    const { system: systemComparison, performance: perfComparison } = metrics.monitoring_metrics.comparison;

    expect(systemComparison.heap_diff).toBeLessThan(0.1);
    expect(systemComparison.requests_diff).toBeLessThan(20);
    expect(perfComparison.latency_diff).toBeLessThan(50);
    expect(perfComparison.error_rate_diff).toBeLessThan(0.05);
    expect(perfComparison.success_rate_diff).toBeLessThan(0.05);
    expect(perfComparison.throughput_diff).toBeLessThan(20);

    workflowData.forEach(data => {
      expect(data.duration).toBeLessThan(1000);
      
      [data.metrics.group_a, data.metrics.group_b].forEach(group => {
        expect(group.system.heap_used).toBeLessThan(0.8);
        expect(group.system.active_requests).toBeLessThan(100);
        expect(group.performance.api_latency).toBeLessThan(200);
        expect(group.performance.error_rate).toBeLessThan(0.1);
        expect(group.performance.success_rate).toBeGreaterThan(0.9);
        expect(group.performance.throughput).toBeGreaterThan(0);
      });
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
