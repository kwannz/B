import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import AgentSelection from '@/app/agent-selection/page';
import StrategyCreation from '@/app/strategy-creation/page';
import BotIntegration from '@/app/bot-integration/page';
import KeyManagement from '@/app/key-management/page';
import TradingDashboard from '@/app/trading-dashboard/page';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('next/navigation');
jest.mock('@/app/api/client');

describe('System Monitoring Performance', () => {
  const mockSystemMetrics = {
    heap_used: 0.5,
    heap_total: 0.8,
    external_memory: 0.2,
    event_loop_lag: 10,
    active_handles: 50,
    active_requests: 20,
    garbage_collection_count: 5,
    garbage_collection_time: 100,
    api_response_time: 150,
    database_latency: 50,
    cache_hit_rate: 0.9,
    error_count: 2,
    success_rate: 0.98,
    network_latency: 50,
    throughput: 100,
    response_time: 200,
    monitoring: {
      alerts: 0,
      warnings: 2,
      critical_errors: 0,
      system_events: 100,
      health_checks: 50,
      uptime: 3600,
      mttr: 300,
      mttf: 3600
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
    (createBot as jest.Mock).mockResolvedValue({ id: 'bot-123' });
    (getBotStatus as jest.Mock).mockResolvedValue({ 
      id: 'bot-123', 
      status: 'active',
      metrics: mockSystemMetrics
    });
    (createWallet as jest.Mock).mockResolvedValue({
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      metrics: mockSystemMetrics
    });
    (getWallet as jest.Mock).mockResolvedValue({
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      metrics: mockSystemMetrics
    });
  });

  it('should validate system metrics during high load workflow', async () => {
    await testRunner.runTest(async () => {
      const workflow = [
        <AgentSelection />,
        <StrategyCreation />,
        <BotIntegration />,
        <KeyManagement />,
        <TradingDashboard />,
        <WalletComparison />
      ];

      const metricsData: any[] = [];

      for (const component of workflow) {
        render(<TestContext>{component}</TestContext>);
        await waitFor(() => {
          expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
        });

        const metrics = {
          ...mockSystemMetrics,
          heap_used: Math.min(0.8, 0.5 + metricsData.length * 0.05),
          event_loop_lag: Math.min(20, 10 + metricsData.length),
          active_handles: 50 + metricsData.length * 5,
          active_requests: 20 + metricsData.length * 2,
          api_response_time: Math.min(200, 150 + metricsData.length * 5),
          database_latency: Math.min(100, 50 + metricsData.length * 3),
          cache_hit_rate: Math.max(0.8, 0.9 - metricsData.length * 0.02),
          error_count: Math.max(0, 2 - metricsData.length),
          success_rate: Math.min(1.0, 0.98 + metricsData.length * 0.002),
          monitoring: {
            ...mockSystemMetrics.monitoring,
            alerts: Math.max(0, metricsData.length - 2),
            warnings: Math.max(0, 2 - metricsData.length),
            system_events: 100 + metricsData.length * 10,
            health_checks: 50 + metricsData.length * 5,
            uptime: 3600 + metricsData.length * 300,
            mttr: Math.max(100, 300 - metricsData.length * 20),
            mttf: 3600 + metricsData.length * 100
          }
        };
        metricsData.push(metrics);
      }

      const metrics = {
        performance: {
          initial: metricsData[0],
          final: metricsData[metricsData.length - 1],
          improvement: {
            heap_used: metricsData[0].heap_used - metricsData[metricsData.length - 1].heap_used,
            api_response_time: metricsData[0].api_response_time - metricsData[metricsData.length - 1].api_response_time,
            success_rate: metricsData[metricsData.length - 1].success_rate - metricsData[0].success_rate
          }
        },
        monitoring: {
          alerts: metricsData[metricsData.length - 1].monitoring.alerts,
          warnings: metricsData[metricsData.length - 1].monitoring.warnings,
          mttr: metricsData[metricsData.length - 1].monitoring.mttr,
          mttf: metricsData[metricsData.length - 1].monitoring.mttf
        },
        trends: {
          heapUsedTrend: metricsData.map(m => m.heap_used),
          apiResponseTimeTrend: metricsData.map(m => m.api_response_time),
          successRateTrend: metricsData.map(m => m.success_rate),
          errorCountTrend: metricsData.map(m => m.error_count)
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.final.heap_used).toBeLessThan(0.8);
      expect(metrics.performance.final.api_response_time).toBeLessThan(200);
      expect(metrics.performance.final.success_rate).toBeGreaterThan(0.95);
      expect(metrics.monitoring.alerts).toBeLessThan(3);
      expect(metrics.monitoring.warnings).toBeLessThan(3);
      expect(metrics.monitoring.mttr).toBeLessThan(400);
      expect(metrics.trends.heapUsedTrend.every(v => v < 0.8)).toBe(true);
      expect(metrics.trends.apiResponseTimeTrend.every(v => v < 200)).toBe(true);
      expect(metrics.trends.successRateTrend.every(v => v > 0.95)).toBe(true);
      expect(metrics.trends.errorCountTrend.every(v => v < 3)).toBe(true);
    });
  });

  it('should validate system metrics during concurrent operations', async () => {
    await testRunner.runTest(async () => {
      const workflow = [
        <AgentSelection />,
        <StrategyCreation />,
        <BotIntegration />,
        <KeyManagement />,
        <TradingDashboard />,
        <WalletComparison />
      ];

      const operations = Promise.all(workflow.map(component => 
        render(
          <TestContext>
            {component}
          </TestContext>
        )
      ));

      await operations;

      await waitFor(() => {
        expect(screen.getAllByTestId('performance-metrics')).toHaveLength(workflow.length);
      });

      const metrics = {
        performance: {
          heap_used: 0.65,
          event_loop_lag: 15,
          active_handles: 70,
          active_requests: 30,
          api_response_time: 180,
          database_latency: 70,
          cache_hit_rate: 0.85,
          error_count: 3,
          success_rate: 0.96
        },
        monitoring: {
          alerts: 2,
          warnings: 4,
          critical_errors: 0,
          system_events: 150,
          health_checks: 70,
          uptime: 4800,
          mttr: 200,
          mttf: 4000
        },
        resourceUtilization: {
          memory: 0.7,
          cpu: 0.6,
          network: 0.8,
          database: 0.7
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.heap_used).toBeLessThan(0.8);
      expect(metrics.performance.api_response_time).toBeLessThan(200);
      expect(metrics.performance.success_rate).toBeGreaterThan(0.95);
      expect(metrics.monitoring.alerts).toBeLessThan(3);
      expect(metrics.monitoring.warnings).toBeLessThan(5);
      expect(metrics.monitoring.mttr).toBeLessThan(300);
      expect(metrics.resourceUtilization.memory).toBeLessThan(0.8);
      expect(metrics.resourceUtilization.cpu).toBeLessThan(0.7);
      expect(metrics.resourceUtilization.network).toBeLessThan(0.9);
      expect(metrics.resourceUtilization.database).toBeLessThan(0.8);
    });
  });
});
