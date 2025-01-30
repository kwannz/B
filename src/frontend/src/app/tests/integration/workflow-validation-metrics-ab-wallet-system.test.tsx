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

describe('Workflow Validation with AB Wallet System Metrics', () => {
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

  it('validates complete workflow with AB wallet system metrics', async () => {
    const workflowData: any[] = [];
    const startTime = Date.now();
    const walletData = {
      wallet_a: {
        operations: [] as any[],
        metrics: [] as any[],
        system_metrics: [] as any[],
        timestamps: [] as number[]
      },
      wallet_b: {
        operations: [] as any[],
        metrics: [] as any[],
        system_metrics: [] as any[],
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

      const mockOperation = {
        timestamp: Date.now(),
        type: Math.random() > 0.5 ? 'transfer' : 'trade',
        amount: Math.random() * 1000,
        success: Math.random() > 0.1,
        latency: Math.random() * 200
      };

      const mockMetrics = {
        timestamp: Date.now(),
        balance: Math.random() * 1000,
        transactions: Math.floor(Math.random() * 100),
        success_rate: 0.9 + Math.random() * 0.1,
        performance_score: 0.8 + Math.random() * 0.2
      };

      const mockSystemMetricsA = {
        ...pageMetrics,
        heap_used: pageMetrics.heap_used * (0.9 + Math.random() * 0.2),
        active_requests: Math.floor(pageMetrics.active_requests * (0.9 + Math.random() * 0.2))
      };

      const mockSystemMetricsB = {
        ...pageMetrics,
        heap_used: pageMetrics.heap_used * (0.9 + Math.random() * 0.2),
        active_requests: Math.floor(pageMetrics.active_requests * (0.9 + Math.random() * 0.2))
      };

      walletData.wallet_a.operations.push(mockOperation);
      walletData.wallet_a.metrics.push(mockMetrics);
      walletData.wallet_a.system_metrics.push(mockSystemMetricsA);
      walletData.wallet_a.timestamps.push(Date.now());

      walletData.wallet_b.operations.push({ ...mockOperation, success: Math.random() > 0.1 });
      walletData.wallet_b.metrics.push({ ...mockMetrics, performance_score: 0.8 + Math.random() * 0.2 });
      walletData.wallet_b.system_metrics.push(mockSystemMetricsB);
      walletData.wallet_b.timestamps.push(Date.now());

      workflowData.push({
        page: page.testId,
        duration: pageEndTime - pageStartTime,
        metrics: pageMetrics,
        wallet_comparison: {
          wallet_a: {
            operation: mockOperation,
            metrics: mockMetrics,
            system: mockSystemMetricsA
          },
          wallet_b: {
            operation: { ...mockOperation, success: Math.random() > 0.1 },
            metrics: { ...mockMetrics, performance_score: 0.8 + Math.random() * 0.2 },
            system: mockSystemMetricsB
          }
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
          operations: {
            total: walletData.wallet_a.operations.length,
            success_rate: walletData.wallet_a.operations.filter(op => op.success).length / walletData.wallet_a.operations.length,
            average_latency: walletData.wallet_a.operations.reduce((sum, op) => sum + op.latency, 0) / walletData.wallet_a.operations.length,
            operation_trend: calculateTrend(walletData.wallet_a.operations.map(op => op.latency))
          },
          performance: {
            average_score: walletData.wallet_a.metrics.reduce((sum, m) => sum + m.performance_score, 0) / walletData.wallet_a.metrics.length,
            score_variance: calculateVariance(walletData.wallet_a.metrics.map(m => m.performance_score)),
            success_rate: walletData.wallet_a.metrics.reduce((sum, m) => sum + m.success_rate, 0) / walletData.wallet_a.metrics.length,
            performance_trend: calculateTrend(walletData.wallet_a.metrics.map(m => m.performance_score))
          },
          system: {
            average_heap: walletData.wallet_a.system_metrics.reduce((sum, m) => sum + m.heap_used, 0) / walletData.wallet_a.system_metrics.length,
            heap_variance: calculateVariance(walletData.wallet_a.system_metrics.map(m => m.heap_used)),
            average_requests: walletData.wallet_a.system_metrics.reduce((sum, m) => sum + m.active_requests, 0) / walletData.wallet_a.system_metrics.length,
            requests_variance: calculateVariance(walletData.wallet_a.system_metrics.map(m => m.active_requests)),
            system_trend: calculateTrend(walletData.wallet_a.system_metrics.map(m => m.heap_used))
          }
        },
        wallet_b: {
          operations: {
            total: walletData.wallet_b.operations.length,
            success_rate: walletData.wallet_b.operations.filter(op => op.success).length / walletData.wallet_b.operations.length,
            average_latency: walletData.wallet_b.operations.reduce((sum, op) => sum + op.latency, 0) / walletData.wallet_b.operations.length,
            operation_trend: calculateTrend(walletData.wallet_b.operations.map(op => op.latency))
          },
          performance: {
            average_score: walletData.wallet_b.metrics.reduce((sum, m) => sum + m.performance_score, 0) / walletData.wallet_b.metrics.length,
            score_variance: calculateVariance(walletData.wallet_b.metrics.map(m => m.performance_score)),
            success_rate: walletData.wallet_b.metrics.reduce((sum, m) => sum + m.success_rate, 0) / walletData.wallet_b.metrics.length,
            performance_trend: calculateTrend(walletData.wallet_b.metrics.map(m => m.performance_score))
          },
          system: {
            average_heap: walletData.wallet_b.system_metrics.reduce((sum, m) => sum + m.heap_used, 0) / walletData.wallet_b.system_metrics.length,
            heap_variance: calculateVariance(walletData.wallet_b.system_metrics.map(m => m.heap_used)),
            average_requests: walletData.wallet_b.system_metrics.reduce((sum, m) => sum + m.active_requests, 0) / walletData.wallet_b.system_metrics.length,
            requests_variance: calculateVariance(walletData.wallet_b.system_metrics.map(m => m.active_requests)),
            system_trend: calculateTrend(walletData.wallet_b.system_metrics.map(m => m.heap_used))
          }
        },
        comparison: {
          operation_success_diff: Math.abs(
            walletData.wallet_a.operations.filter(op => op.success).length / walletData.wallet_a.operations.length -
            walletData.wallet_b.operations.filter(op => op.success).length / walletData.wallet_b.operations.length
          ),
          latency_diff: Math.abs(
            walletData.wallet_a.operations.reduce((sum, op) => sum + op.latency, 0) / walletData.wallet_a.operations.length -
            walletData.wallet_b.operations.reduce((sum, op) => sum + op.latency, 0) / walletData.wallet_b.operations.length
          ),
          performance_score_diff: Math.abs(
            walletData.wallet_a.metrics.reduce((sum, m) => sum + m.performance_score, 0) / walletData.wallet_a.metrics.length -
            walletData.wallet_b.metrics.reduce((sum, m) => sum + m.performance_score, 0) / walletData.wallet_b.metrics.length
          ),
          system_efficiency: {
            heap_usage_diff: Math.abs(
              walletData.wallet_a.system_metrics.reduce((sum, m) => sum + m.heap_used, 0) / walletData.wallet_a.system_metrics.length -
              walletData.wallet_b.system_metrics.reduce((sum, m) => sum + m.heap_used, 0) / walletData.wallet_b.system_metrics.length
            ),
            request_load_diff: Math.abs(
              walletData.wallet_a.system_metrics.reduce((sum, m) => sum + m.active_requests, 0) / walletData.wallet_a.system_metrics.length -
              walletData.wallet_b.system_metrics.reduce((sum, m) => sum + m.active_requests, 0) / walletData.wallet_b.system_metrics.length
            )
          }
        }
      }
    };

    testRunner.expectMetrics(metrics);
    expect(metrics.total_duration).toBeLessThan(6000);
    expect(metrics.wallet_metrics.wallet_a.operations.success_rate).toBeGreaterThan(0.8);
    expect(metrics.wallet_metrics.wallet_b.operations.success_rate).toBeGreaterThan(0.8);
    expect(metrics.wallet_metrics.wallet_a.performance.average_score).toBeGreaterThan(0.8);
    expect(metrics.wallet_metrics.wallet_b.performance.average_score).toBeGreaterThan(0.8);
    expect(metrics.wallet_metrics.comparison.operation_success_diff).toBeLessThan(0.2);
    expect(metrics.wallet_metrics.comparison.latency_diff).toBeLessThan(100);
    expect(metrics.wallet_metrics.comparison.performance_score_diff).toBeLessThan(0.2);
    expect(metrics.wallet_metrics.comparison.system_efficiency.heap_usage_diff).toBeLessThan(0.2);
    expect(metrics.wallet_metrics.comparison.system_efficiency.request_load_diff).toBeLessThan(50);

    [metrics.wallet_metrics.wallet_a, metrics.wallet_metrics.wallet_b].forEach(wallet => {
      expect(wallet.operations.average_latency).toBeLessThan(200);
      expect(wallet.performance.score_variance).toBeLessThan(0.1);
      expect(wallet.system.heap_variance).toBeLessThan(0.1);
      expect(wallet.system.requests_variance).toBeLessThan(1000);
      expect(['increasing', 'decreasing', 'stable']).toContain(wallet.operations.operation_trend);
      expect(['increasing', 'decreasing', 'stable']).toContain(wallet.performance.performance_trend);
      expect(['increasing', 'decreasing', 'stable']).toContain(wallet.system.system_trend);
    });

    workflowData.forEach(data => {
      expect(data.duration).toBeLessThan(1000);
      expect(data.metrics.heap_used).toBeLessThan(0.8);
      expect(data.metrics.active_requests).toBeLessThan(100);
      expect(data.wallet_comparison.wallet_a.operation.latency).toBeLessThan(200);
      expect(data.wallet_comparison.wallet_b.operation.latency).toBeLessThan(200);
      expect(data.wallet_comparison.wallet_a.metrics.performance_score).toBeGreaterThan(0.8);
      expect(data.wallet_comparison.wallet_b.metrics.performance_score).toBeGreaterThan(0.8);
      expect(data.wallet_comparison.wallet_a.system.heap_used).toBeLessThan(0.8);
      expect(data.wallet_comparison.wallet_b.system.heap_used).toBeLessThan(0.8);
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
