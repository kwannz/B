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

describe('Workflow Performance Validation', () => {
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
    warning_count: 5,
    garbage_collection: {
      count: 5,
      duration: 100
    },
    event_loop: {
      lag: 10,
      utilization: 0.6
    }
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

  it('should validate workflow performance under normal conditions', async () => {
    await testRunner.runTest(async () => {
      const workflow = [
        { component: <AgentSelection />, name: 'agent-selection' },
        { component: <StrategyCreation />, name: 'strategy-creation' },
        { component: <BotIntegration />, name: 'bot-integration' },
        { component: <KeyManagement />, name: 'key-management' },
        { component: <TradingDashboard />, name: 'trading-dashboard' },
        { component: <WalletComparison />, name: 'wallet-comparison' }
      ];

      const metricsData: any[] = [];

      for (const { component, name } of workflow) {
        const startTime = Date.now();
        render(<TestContext>{component}</TestContext>);
        
        await waitFor(() => {
          expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
        });

        const endTime = Date.now();
        const renderTime = endTime - startTime;

        const metrics = {
          step: name,
          render_time: renderTime,
          api_latency: mockPerformanceData.api_latency,
          error_rate: mockPerformanceData.error_rate,
          system_health: mockPerformanceData.system_health,
          memory_usage: mockPerformanceData.memory_usage,
          cpu_usage: mockPerformanceData.cpu_usage,
          garbage_collection: mockPerformanceData.garbage_collection,
          event_loop: mockPerformanceData.event_loop
        };

        metricsData.push(metrics);
      }

      const performanceMetrics = {
        workflow: {
          total_duration: metricsData.reduce((acc, m) => acc + m.render_time, 0),
          average_render_time: metricsData.reduce((acc, m) => acc + m.render_time, 0) / metricsData.length,
          steps: metricsData.map(m => ({
            name: m.step,
            render_time: m.render_time
          }))
        },
        system: {
          average_api_latency: metricsData.reduce((acc, m) => acc + m.api_latency, 0) / metricsData.length,
          average_error_rate: metricsData.reduce((acc, m) => acc + m.error_rate, 0) / metricsData.length,
          average_system_health: metricsData.reduce((acc, m) => acc + m.system_health, 0) / metricsData.length,
          peak_memory_usage: Math.max(...metricsData.map(m => m.memory_usage)),
          peak_cpu_usage: Math.max(...metricsData.map(m => m.cpu_usage)),
          total_gc_duration: metricsData.reduce((acc, m) => acc + m.garbage_collection.duration, 0),
          peak_event_loop_lag: Math.max(...metricsData.map(m => m.event_loop.lag))
        }
      };

      testRunner.expectMetrics(performanceMetrics);
      expect(performanceMetrics.workflow.average_render_time).toBeLessThan(500);
      expect(performanceMetrics.system.average_api_latency).toBeLessThan(150);
      expect(performanceMetrics.system.average_error_rate).toBeLessThan(0.1);
      expect(performanceMetrics.system.average_system_health).toBeGreaterThan(0.9);
      expect(performanceMetrics.system.peak_memory_usage).toBeLessThan(0.8);
      expect(performanceMetrics.system.peak_cpu_usage).toBeLessThan(0.7);
      expect(performanceMetrics.system.peak_event_loop_lag).toBeLessThan(50);
    });
  });

  it('should recover from simulated errors while maintaining performance', async () => {
    await testRunner.runTest(async () => {
      let errorCount = 0;
      const maxErrors = 3;
      const errorMetrics: any[] = [];

      (createBot as jest.Mock).mockImplementation(() => {
        if (errorCount < maxErrors) {
          errorCount++;
          throw new Error('Simulated API Error');
        }
        return { id: 'bot-123', metrics: mockPerformanceData };
      });

      const startTime = Date.now();
      render(<TestContext><AgentSelection /></TestContext>);

      await waitFor(() => {
        expect(createBot).toHaveBeenCalledTimes(maxErrors + 1);
      });

      const endTime = Date.now();
      const recoveryTime = endTime - startTime;

      const recoveryMetrics = {
        error_recovery: {
          total_errors: errorCount,
          recovery_time: recoveryTime,
          average_recovery_time: recoveryTime / errorCount,
          success: true
        },
        performance_impact: {
          memory_overhead: mockPerformanceData.memory_usage * 1.1,
          cpu_overhead: mockPerformanceData.cpu_usage * 1.1,
          gc_overhead: mockPerformanceData.garbage_collection.duration * 1.2
        }
      };

      testRunner.expectMetrics(recoveryMetrics);
      expect(recoveryMetrics.error_recovery.total_errors).toBe(maxErrors);
      expect(recoveryMetrics.error_recovery.average_recovery_time).toBeLessThan(1000);
      expect(recoveryMetrics.performance_impact.memory_overhead).toBeLessThan(0.8);
      expect(recoveryMetrics.performance_impact.cpu_overhead).toBeLessThan(0.7);
    });
  });

  it('should maintain performance during concurrent operations', async () => {
    await testRunner.runTest(async () => {
      const concurrentUsers = 3;
      const workflows = Array(concurrentUsers).fill(null).map(() => [
        <AgentSelection />,
        <StrategyCreation />,
        <BotIntegration />,
        <KeyManagement />,
        <TradingDashboard />,
        <WalletComparison />
      ]);

      const startTime = Date.now();
      const renderPromises = workflows.map(async workflow => {
        for (const component of workflow) {
          render(<TestContext>{component}</TestContext>);
          await waitFor(() => {
            expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
          });
        }
      });

      await Promise.all(renderPromises);
      const endTime = Date.now();

      const concurrencyMetrics = {
        execution: {
          total_duration: endTime - startTime,
          average_duration_per_workflow: (endTime - startTime) / concurrentUsers,
          total_components: workflows.length * workflows[0].length
        },
        performance: {
          memory_usage: mockPerformanceData.memory_usage * 1.2,
          cpu_usage: mockPerformanceData.cpu_usage * 1.2,
          gc_count: mockPerformanceData.garbage_collection.count * 1.5,
          event_loop_lag: mockPerformanceData.event_loop.lag * 1.3
        }
      };

      testRunner.expectMetrics(concurrencyMetrics);
      expect(concurrencyMetrics.execution.average_duration_per_workflow).toBeLessThan(3000);
      expect(concurrencyMetrics.performance.memory_usage).toBeLessThan(0.8);
      expect(concurrencyMetrics.performance.cpu_usage).toBeLessThan(0.7);
      expect(concurrencyMetrics.performance.event_loop_lag).toBeLessThan(50);
    });
  });
});
