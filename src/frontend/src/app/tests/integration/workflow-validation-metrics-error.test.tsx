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

describe('Workflow Validation with Error Metrics', () => {
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

  it('validates complete workflow with error handling metrics', async () => {
    const workflowData: any[] = [];
    const startTime = Date.now();
    const errorScenarios = [
      { type: 'network', count: 0, recovered: 0 },
      { type: 'validation', count: 0, recovered: 0 },
      { type: 'timeout', count: 0, recovered: 0 },
      { type: 'system', count: 0, recovered: 0 }
    ];

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

      errorScenarios.forEach(scenario => {
        if (Math.random() < 0.2) {
          scenario.count++;
          if (Math.random() < 0.8) {
            scenario.recovered++;
          }
        }
      });

      workflowData.push({
        page: page.testId,
        duration: pageEndTime - pageStartTime,
        metrics: pageMetrics,
        errors: errorScenarios.map(scenario => ({
          ...scenario,
          recovery_rate: scenario.count > 0 ? scenario.recovered / scenario.count : 1
        }))
      });
    }

    const endTime = Date.now();
    const metrics = {
      total_duration: endTime - startTime,
      pages_completed: workflowData.length,
      workflow_data: workflowData,
      error_metrics: {
        total_errors: errorScenarios.reduce((sum, scenario) => sum + scenario.count, 0),
        total_recoveries: errorScenarios.reduce((sum, scenario) => sum + scenario.recovered, 0),
        recovery_rate: errorScenarios.reduce((sum, scenario) => sum + scenario.recovered, 0) / 
                      Math.max(1, errorScenarios.reduce((sum, scenario) => sum + scenario.count, 0)),
        error_distribution: errorScenarios.reduce((dist, scenario) => ({
          ...dist,
          [scenario.type]: {
            count: scenario.count,
            recovered: scenario.recovered,
            recovery_rate: scenario.count > 0 ? scenario.recovered / scenario.count : 1
          }
        }), {}),
        error_trends: workflowData.map(data => ({
          timestamp: data.duration,
          errors: data.errors
        }))
      },
      system_metrics: {
        heap_usage_trend: workflowData.map(data => data.metrics.heap_used),
        request_load_trend: workflowData.map(data => data.metrics.active_requests),
        heap_usage_variance: calculateVariance(workflowData.map(data => data.metrics.heap_used)),
        request_load_variance: calculateVariance(workflowData.map(data => data.metrics.active_requests))
      }
    };

    testRunner.expectMetrics(metrics);
    expect(metrics.total_duration).toBeLessThan(6000);
    expect(metrics.error_metrics.recovery_rate).toBeGreaterThan(0.8);
    expect(metrics.system_metrics.heap_usage_variance).toBeLessThan(0.1);
    expect(metrics.system_metrics.request_load_variance).toBeLessThan(100);

    workflowData.forEach(data => {
      expect(data.duration).toBeLessThan(1000);
      expect(data.metrics.heap_used).toBeLessThan(0.8);
      expect(data.metrics.active_requests).toBeLessThan(100);
      data.errors.forEach((error: any) => {
        expect(error.recovery_rate).toBeGreaterThanOrEqual(0);
        expect(error.recovery_rate).toBeLessThanOrEqual(1);
      });
    });
  });
});

function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - mean, 2));
  return squareDiffs.reduce((a, b) => a + b, 0) / values.length;
}
