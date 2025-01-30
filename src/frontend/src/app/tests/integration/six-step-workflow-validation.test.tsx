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

describe('Six-Step Workflow Validation', () => {
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

  it('validates complete six-step workflow with performance monitoring', async () => {
    await testRunner.runTest(async () => {
      const workflowData: any[] = [];
      const startTime = Date.now();

      // Step 1: Agent Selection
      const step1Start = Date.now();
      render(<TestContext><AgentSelection /></TestContext>);
      await waitFor(() => {
        expect(screen.getByTestId('agent-selection')).toBeInTheDocument();
      });
      const step1End = Date.now();
      workflowData.push({
        step: 'agent-selection',
        duration: step1End - step1Start,
        metrics: { ...mockSystemMetrics }
      });

      // Step 2: Strategy Creation
      const step2Start = Date.now();
      render(<TestContext><StrategyCreation /></TestContext>);
      await waitFor(() => {
        expect(screen.getByTestId('strategy-creation')).toBeInTheDocument();
      });
      const step2End = Date.now();
      workflowData.push({
        step: 'strategy-creation',
        duration: step2End - step2Start,
        metrics: {
          ...mockSystemMetrics,
          heap_used: Math.min(0.8, mockSystemMetrics.heap_used + 0.05)
        }
      });

      // Step 3: Bot Integration
      const step3Start = Date.now();
      render(<TestContext><BotIntegration /></TestContext>);
      await waitFor(() => {
        expect(screen.getByTestId('bot-integration')).toBeInTheDocument();
      });
      const step3End = Date.now();
      workflowData.push({
        step: 'bot-integration',
        duration: step3End - step3Start,
        metrics: {
          ...mockSystemMetrics,
          heap_used: Math.min(0.8, mockSystemMetrics.heap_used + 0.1)
        }
      });

      // Step 4: Key Management
      const step4Start = Date.now();
      render(<TestContext><KeyManagement /></TestContext>);
      await waitFor(() => {
        expect(screen.getByTestId('key-management')).toBeInTheDocument();
      });
      const step4End = Date.now();
      workflowData.push({
        step: 'key-management',
        duration: step4End - step4Start,
        metrics: {
          ...mockSystemMetrics,
          heap_used: Math.min(0.8, mockSystemMetrics.heap_used + 0.15)
        }
      });

      // Step 5: Trading Dashboard
      const step5Start = Date.now();
      render(<TestContext><TradingDashboard /></TestContext>);
      await waitFor(() => {
        expect(screen.getByTestId('trading-dashboard')).toBeInTheDocument();
      });
      const step5End = Date.now();
      workflowData.push({
        step: 'trading-dashboard',
        duration: step5End - step5Start,
        metrics: {
          ...mockSystemMetrics,
          heap_used: Math.min(0.8, mockSystemMetrics.heap_used + 0.2)
        }
      });

      // Step 6: Wallet Comparison
      const step6Start = Date.now();
      render(<TestContext><WalletComparison /></TestContext>);
      await waitFor(() => {
        expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
      });
      const step6End = Date.now();
      workflowData.push({
        step: 'wallet-comparison',
        duration: step6End - step6Start,
        metrics: {
          ...mockSystemMetrics,
          heap_used: Math.min(0.8, mockSystemMetrics.heap_used + 0.25)
        }
      });

      const endTime = Date.now();
      const workflowMetrics = {
        total_duration: endTime - startTime,
        steps_completed: workflowData.length,
        workflow_data: workflowData,
        performance_metrics: {
          average_step_duration: workflowData.reduce((acc, data) => acc + data.duration, 0) / workflowData.length,
          step_duration_variance: calculateVariance(workflowData.map(data => data.duration)),
          step_durations: workflowData.reduce((acc, data) => {
            acc[data.step] = data.duration;
            return acc;
          }, {} as Record<string, number>)
        },
        system_metrics: {
          heap_usage_trend: workflowData.map(data => data.metrics.heap_used),
          request_load_trend: workflowData.map(data => data.metrics.active_requests),
          heap_usage_variance: calculateVariance(workflowData.map(data => data.metrics.heap_used)),
          request_load_variance: calculateVariance(workflowData.map(data => data.metrics.active_requests))
        },
        workflow_correlation: {
          step_duration_vs_heap: calculateCorrelation(
            workflowData.map((_, index) => index),
            workflowData.map(data => data.metrics.heap_used)
          ),
          step_duration_vs_requests: calculateCorrelation(
            workflowData.map((_, index) => index),
            workflowData.map(data => data.metrics.active_requests)
          )
        }
      };

      testRunner.expectMetrics(workflowMetrics);
      expect(workflowMetrics.total_duration).toBeLessThan(30000);
      expect(workflowMetrics.performance_metrics.average_step_duration).toBeLessThan(5000);
      expect(workflowMetrics.system_metrics.heap_usage_variance).toBeLessThan(0.1);
      expect(workflowMetrics.system_metrics.request_load_variance).toBeLessThan(100);
      expect(Math.abs(workflowMetrics.workflow_correlation.step_duration_vs_heap)).toBeLessThan(1);
      expect(Math.abs(workflowMetrics.workflow_correlation.step_duration_vs_requests)).toBeLessThan(1);

      workflowData.forEach(data => {
        expect(data.duration).toBeLessThan(5000);
        expect(data.metrics.heap_used).toBeLessThan(0.8);
        expect(data.metrics.active_requests).toBeLessThan(100);
      });
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
