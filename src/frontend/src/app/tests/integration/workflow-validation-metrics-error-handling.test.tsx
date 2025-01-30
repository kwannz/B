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

describe('Workflow Validation with Error Handling', () => {
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

  it('validates complete workflow with error handling', async () => {
    const workflowData: any[] = [];
    const startTime = Date.now();
    const errorData = {
      api_errors: [] as any[],
      validation_errors: [] as any[],
      system_errors: [] as any[],
      recovery_attempts: [] as any[],
      error_timestamps: [] as number[]
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

      const mockError = {
        timestamp: Date.now(),
        type: Math.random() > 0.8 ? 'api' : Math.random() > 0.5 ? 'validation' : 'system',
        message: 'Mock error message',
        code: Math.floor(Math.random() * 1000),
        recovered: Math.random() > 0.1
      };

      const mockRecovery = {
        timestamp: Date.now(),
        error_type: mockError.type,
        attempt_count: Math.floor(Math.random() * 3) + 1,
        success: Math.random() > 0.1
      };

      if (mockError.type === 'api') errorData.api_errors.push(mockError);
      else if (mockError.type === 'validation') errorData.validation_errors.push(mockError);
      else errorData.system_errors.push(mockError);

      errorData.recovery_attempts.push(mockRecovery);
      errorData.error_timestamps.push(mockError.timestamp);

      workflowData.push({
        page: page.testId,
        duration: pageEndTime - pageStartTime,
        metrics: pageMetrics,
        errors: {
          api_error: mockError.type === 'api' ? mockError : null,
          validation_error: mockError.type === 'validation' ? mockError : null,
          system_error: mockError.type === 'system' ? mockError : null,
          recovery: mockRecovery
        }
      });
    }

    const endTime = Date.now();
    const metrics = {
      total_duration: endTime - startTime,
      pages_completed: workflowData.length,
      workflow_data: workflowData,
      error_metrics: {
        api: {
          total_errors: errorData.api_errors.length,
          recovery_rate: errorData.api_errors.filter(e => e.recovered).length / errorData.api_errors.length,
          average_recovery_attempts: errorData.recovery_attempts
            .filter(r => r.error_type === 'api')
            .reduce((sum, r) => sum + r.attempt_count, 0) / errorData.api_errors.length,
          error_trend: calculateTrend(errorData.api_errors.map(e => e.timestamp))
        },
        validation: {
          total_errors: errorData.validation_errors.length,
          recovery_rate: errorData.validation_errors.filter(e => e.recovered).length / errorData.validation_errors.length,
          average_recovery_attempts: errorData.recovery_attempts
            .filter(r => r.error_type === 'validation')
            .reduce((sum, r) => sum + r.attempt_count, 0) / errorData.validation_errors.length,
          error_trend: calculateTrend(errorData.validation_errors.map(e => e.timestamp))
        },
        system: {
          total_errors: errorData.system_errors.length,
          recovery_rate: errorData.system_errors.filter(e => e.recovered).length / errorData.system_errors.length,
          average_recovery_attempts: errorData.recovery_attempts
            .filter(r => r.error_type === 'system')
            .reduce((sum, r) => sum + r.attempt_count, 0) / errorData.system_errors.length,
          error_trend: calculateTrend(errorData.system_errors.map(e => e.timestamp))
        },
        overall: {
          total_errors: errorData.api_errors.length + errorData.validation_errors.length + errorData.system_errors.length,
          total_recoveries: errorData.recovery_attempts.filter(r => r.success).length,
          recovery_rate: errorData.recovery_attempts.filter(r => r.success).length / errorData.recovery_attempts.length,
          average_recovery_attempts: errorData.recovery_attempts.reduce((sum, r) => sum + r.attempt_count, 0) / errorData.recovery_attempts.length,
          error_distribution: {
            api: errorData.api_errors.length / (errorData.api_errors.length + errorData.validation_errors.length + errorData.system_errors.length),
            validation: errorData.validation_errors.length / (errorData.api_errors.length + errorData.validation_errors.length + errorData.system_errors.length),
            system: errorData.system_errors.length / (errorData.api_errors.length + errorData.validation_errors.length + errorData.system_errors.length)
          }
        },
        time_series: {
          timestamps: errorData.error_timestamps,
          intervals: errorData.error_timestamps.slice(1).map((t, i) => t - errorData.error_timestamps[i]),
          average_interval: (errorData.error_timestamps[errorData.error_timestamps.length - 1] - errorData.error_timestamps[0]) / (errorData.error_timestamps.length - 1)
        }
      }
    };

    testRunner.expectMetrics(metrics);
    expect(metrics.total_duration).toBeLessThan(6000);
    expect(metrics.error_metrics.overall.recovery_rate).toBeGreaterThan(0.8);
    expect(metrics.error_metrics.overall.average_recovery_attempts).toBeLessThan(3);
    expect(metrics.error_metrics.api.recovery_rate).toBeGreaterThan(0.8);
    expect(metrics.error_metrics.validation.recovery_rate).toBeGreaterThan(0.8);
    expect(metrics.error_metrics.system.recovery_rate).toBeGreaterThan(0.8);

    Object.values(metrics.error_metrics).forEach(category => {
      if (category.error_trend) {
        expect(['increasing', 'decreasing', 'stable']).toContain(category.error_trend);
      }
    });

    workflowData.forEach(data => {
      expect(data.duration).toBeLessThan(1000);
      expect(data.metrics.heap_used).toBeLessThan(0.8);
      expect(data.metrics.active_requests).toBeLessThan(100);
      if (data.errors.api_error) {
        expect(data.errors.recovery.error_type).toBe('api');
        expect(data.errors.recovery.attempt_count).toBeGreaterThan(0);
        expect(data.errors.recovery.attempt_count).toBeLessThan(4);
      }
      if (data.errors.validation_error) {
        expect(data.errors.recovery.error_type).toBe('validation');
        expect(data.errors.recovery.attempt_count).toBeGreaterThan(0);
        expect(data.errors.recovery.attempt_count).toBeLessThan(4);
      }
      if (data.errors.system_error) {
        expect(data.errors.recovery.error_type).toBe('system');
        expect(data.errors.recovery.attempt_count).toBeGreaterThan(0);
        expect(data.errors.recovery.attempt_count).toBeLessThan(4);
      }
    });

    expect(metrics.error_metrics.time_series.average_interval).toBeLessThan(1000);
    metrics.error_metrics.time_series.intervals.forEach(interval => {
      expect(interval).toBeLessThan(1000);
    });
  });
});

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
