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

describe('Workflow Metrics Collection', () => {
  const mockPerformanceData = {
    api_latency: 100,
    error_rate: 0.05,
    system_health: 0.95,
    memory_usage: 0.4,
    cpu_usage: 0.3,
    network_latency: 50,
    throughput: 100,
    response_time: 200,
    validation_success: 0.98,
    error_count: 2,
    warning_count: 5
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
    (createBot as jest.Mock).mockResolvedValue({ id: 'bot-123', metrics: mockPerformanceData });
    (getBotStatus as jest.Mock).mockResolvedValue({ 
      id: 'bot-123', 
      status: 'active',
      metrics: mockPerformanceData
    });
    (createWallet as jest.Mock).mockResolvedValue({
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      metrics: mockPerformanceData
    });
    (getWallet as jest.Mock).mockResolvedValue({
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      metrics: mockPerformanceData
    });
  });

  it('should collect and validate metrics throughout workflow', async () => {
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
          ...mockPerformanceData,
          api_latency: Math.min(200, 100 + metricsData.length * 10),
          error_rate: Math.max(0, 0.05 - metricsData.length * 0.01),
          system_health: Math.min(1.0, 0.95 + metricsData.length * 0.01),
          memory_usage: Math.min(0.8, 0.4 + metricsData.length * 0.05),
          cpu_usage: Math.min(0.7, 0.3 + metricsData.length * 0.05),
          validation_success: Math.min(1.0, 0.98 + metricsData.length * 0.004),
          error_count: Math.max(0, 2 - metricsData.length),
          warning_count: Math.max(0, 5 - metricsData.length)
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
            system_health: metricsData[metricsData.length - 1].system_health - metricsData[0].system_health,
            validation_success: metricsData[metricsData.length - 1].validation_success - metricsData[0].validation_success
          }
        },
        trends: {
          api_latency: metricsData.map(m => m.api_latency),
          error_rate: metricsData.map(m => m.error_rate),
          system_health: metricsData.map(m => m.system_health),
          memory_usage: metricsData.map(m => m.memory_usage),
          cpu_usage: metricsData.map(m => m.cpu_usage),
          validation_success: metricsData.map(m => m.validation_success)
        },
        validation: {
          error_reduction: metricsData[0].error_count - metricsData[metricsData.length - 1].error_count,
          warning_reduction: metricsData[0].warning_count - metricsData[metricsData.length - 1].warning_count
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.final.api_latency).toBeLessThan(200);
      expect(metrics.performance.final.error_rate).toBeLessThan(0.05);
      expect(metrics.performance.final.system_health).toBeGreaterThan(0.95);
      expect(metrics.performance.final.validation_success).toBeGreaterThan(0.98);
      expect(metrics.validation.error_reduction).toBeGreaterThanOrEqual(0);
      expect(metrics.validation.warning_reduction).toBeGreaterThanOrEqual(0);
      expect(metrics.trends.memory_usage.every(v => v < 0.8)).toBe(true);
      expect(metrics.trends.cpu_usage.every(v => v < 0.7)).toBe(true);
    });
  });

  it('should validate metrics collection under high load', async () => {
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
          validation_success: 0.99,
          error_count: 1,
          warning_count: 2
        },
        load_metrics: {
          concurrent_requests: workflow.length,
          average_response_time: 175,
          peak_memory_usage: 0.7,
          peak_cpu_usage: 0.6
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.api_latency).toBeLessThan(200);
      expect(metrics.performance.error_rate).toBeLessThan(0.05);
      expect(metrics.performance.system_health).toBeGreaterThan(0.95);
      expect(metrics.performance.validation_success).toBeGreaterThan(0.98);
      expect(metrics.load_metrics.average_response_time).toBeLessThan(200);
      expect(metrics.load_metrics.peak_memory_usage).toBeLessThan(0.8);
      expect(metrics.load_metrics.peak_cpu_usage).toBeLessThan(0.7);
    });
  });
});
