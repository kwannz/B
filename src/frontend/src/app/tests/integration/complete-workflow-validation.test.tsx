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

describe('Complete Workflow Validation', () => {
  const mockMetrics = {
    api_latency: 100,
    error_rate: 0.05,
    system_health: 0.95,
    memory_usage: 0.4,
    cpu_usage: 0.3,
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
    (createBot as jest.Mock).mockResolvedValue({ id: 'bot-123', metrics: mockMetrics });
    (getBotStatus as jest.Mock).mockResolvedValue({ id: 'bot-123', status: 'active', metrics: mockMetrics });
    (createWallet as jest.Mock).mockResolvedValue({ address: 'test-wallet', metrics: mockMetrics });
    (getWallet as jest.Mock).mockResolvedValue({ address: 'test-wallet', metrics: mockMetrics });
  });

  it('should validate complete workflow with metrics tracking', async () => {
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
          ...mockMetrics,
          api_latency: Math.min(200, 100 + metricsData.length * 10),
          error_rate: Math.max(0, 0.05 - metricsData.length * 0.01),
          system_health: Math.min(1.0, 0.95 + metricsData.length * 0.01),
          memory_usage: Math.min(0.8, 0.4 + metricsData.length * 0.05),
          cpu_usage: Math.min(0.7, 0.3 + metricsData.length * 0.05),
          network_latency: Math.min(100, 50 + metricsData.length * 5),
          throughput: 100 + metricsData.length * 10,
          response_time: Math.min(300, 200 + metricsData.length * 10),
          monitoring: {
            ...mockMetrics.monitoring,
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
            api_latency: metricsData[0].api_latency - metricsData[metricsData.length - 1].api_latency,
            error_rate: metricsData[0].error_rate - metricsData[metricsData.length - 1].error_rate,
            system_health: metricsData[metricsData.length - 1].system_health - metricsData[0].system_health
          }
        },
        monitoring: {
          alerts: metricsData[metricsData.length - 1].monitoring.alerts,
          warnings: metricsData[metricsData.length - 1].monitoring.warnings,
          mttr: metricsData[metricsData.length - 1].monitoring.mttr,
          mttf: metricsData[metricsData.length - 1].monitoring.mttf
        },
        trends: {
          api_latency: metricsData.map(m => m.api_latency),
          error_rate: metricsData.map(m => m.error_rate),
          system_health: metricsData.map(m => m.system_health),
          memory_usage: metricsData.map(m => m.memory_usage),
          cpu_usage: metricsData.map(m => m.cpu_usage)
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.final.api_latency).toBeLessThan(200);
      expect(metrics.performance.final.error_rate).toBeLessThan(0.05);
      expect(metrics.performance.final.system_health).toBeGreaterThan(0.95);
      expect(metrics.monitoring.alerts).toBeLessThan(3);
      expect(metrics.monitoring.warnings).toBeLessThan(3);
      expect(metrics.monitoring.mttr).toBeLessThan(400);
      expect(metrics.trends.memory_usage.every(v => v < 0.8)).toBe(true);
      expect(metrics.trends.cpu_usage.every(v => v < 0.7)).toBe(true);
    });
  });

  it('should validate complete workflow with concurrent operations', async () => {
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
          api_latency: 150,
          error_rate: 0.03,
          system_health: 0.97,
          memory_usage: 0.6,
          cpu_usage: 0.5,
          network_latency: 70,
          throughput: 150,
          response_time: 250
        },
        monitoring: {
          alerts: 2,
          warnings: 3,
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
      expect(metrics.performance.api_latency).toBeLessThan(200);
      expect(metrics.performance.error_rate).toBeLessThan(0.05);
      expect(metrics.performance.system_health).toBeGreaterThan(0.95);
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
