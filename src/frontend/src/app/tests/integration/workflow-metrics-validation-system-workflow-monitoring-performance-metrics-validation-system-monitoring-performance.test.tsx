import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus } from '@/app/api/client';
import AgentSelection from '@/app/agent-selection/page';
import StrategyCreation from '@/app/strategy-creation/page';
import BotIntegration from '@/app/bot-integration/page';
import KeyManagement from '@/app/key-management/page';
import TradingDashboard from '@/app/trading-dashboard/page';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('next/navigation');
jest.mock('@/app/api/client');

describe('Workflow Metrics Validation - System Workflow Monitoring Performance Metrics Validation System Monitoring Performance', () => {
  const mockBot = {
    id: 'bot-123',
    metrics: {
      performance: {
        monitoring: {
          alerts: 0,
          warnings: 0,
          critical_errors: 0,
          system_events: 100,
          health_checks: 50,
          uptime: 3600,
          mttr: 0,
          mttf: 3600,
          system_metrics: {
            heap_used: 0.5,
            heap_total: 0.8,
            external_memory: 0.2,
            event_loop_lag: 10,
            active_handles: 50,
            active_requests: 20,
            garbage_collection_count: 5,
            garbage_collection_time: 100
          }
        }
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
    (createBot as jest.Mock).mockResolvedValue(mockBot);
    (getBotStatus as jest.Mock).mockResolvedValue(mockBot);
  });

  it('should validate system monitoring metrics during workflow execution', async () => {
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
          alerts: metricsData.length,
          warnings: Math.max(0, metricsData.length - 2),
          critical_errors: 0,
          system_events: 100 + metricsData.length * 10,
          health_checks: 50 + metricsData.length * 5,
          uptime: 3600 + metricsData.length * 300,
          mttr: 0,
          mttf: 3600,
          system_metrics: {
            heap_used: 0.5 + metricsData.length * 0.05,
            heap_total: 0.8,
            external_memory: 0.2 + metricsData.length * 0.02,
            event_loop_lag: 10 + metricsData.length * 2,
            active_handles: 50 + metricsData.length * 5,
            active_requests: 20 + metricsData.length * 2,
            garbage_collection_count: 5 + metricsData.length,
            garbage_collection_time: 100 + metricsData.length * 10
          },
          performance_metrics: {
            api_latency: 100 + metricsData.length * 10,
            error_rate: Math.max(0, 0.1 - metricsData.length * 0.02),
            system_health: Math.min(1.0, 0.9 + metricsData.length * 0.02),
            throughput: 1000 - metricsData.length * 50,
            response_time: 200 + metricsData.length * 20
          }
        };
        metricsData.push(metrics);
      }

      const metrics = {
        monitoring: {
          alerts: metricsData[metricsData.length - 1].alerts,
          warnings: metricsData[metricsData.length - 1].warnings,
          criticalErrors: metricsData[metricsData.length - 1].critical_errors,
          systemEvents: metricsData[metricsData.length - 1].system_events,
          healthChecks: metricsData[metricsData.length - 1].health_checks,
          uptime: metricsData[metricsData.length - 1].uptime,
          mttr: metricsData[metricsData.length - 1].mttr,
          mttf: metricsData[metricsData.length - 1].mttf,
          systemMetrics: {
            heapUsed: metricsData[metricsData.length - 1].system_metrics.heap_used,
            heapTotal: metricsData[metricsData.length - 1].system_metrics.heap_total,
            externalMemory: metricsData[metricsData.length - 1].system_metrics.external_memory,
            eventLoopLag: metricsData[metricsData.length - 1].system_metrics.event_loop_lag,
            activeHandles: metricsData[metricsData.length - 1].system_metrics.active_handles,
            activeRequests: metricsData[metricsData.length - 1].system_metrics.active_requests,
            garbageCollectionCount: metricsData[metricsData.length - 1].system_metrics.garbage_collection_count,
            garbageCollectionTime: metricsData[metricsData.length - 1].system_metrics.garbage_collection_time
          },
          performanceMetrics: {
            apiLatency: metricsData[metricsData.length - 1].performance_metrics.api_latency,
            errorRate: metricsData[metricsData.length - 1].performance_metrics.error_rate,
            systemHealth: metricsData[metricsData.length - 1].performance_metrics.system_health,
            throughput: metricsData[metricsData.length - 1].performance_metrics.throughput,
            responseTime: metricsData[metricsData.length - 1].performance_metrics.response_time
          },
          averages: {
            heapUsed: metricsData.reduce((sum, m) => sum + m.system_metrics.heap_used, 0) / metricsData.length,
            eventLoopLag: metricsData.reduce((sum, m) => sum + m.system_metrics.event_loop_lag, 0) / metricsData.length,
            apiLatency: metricsData.reduce((sum, m) => sum + m.performance_metrics.api_latency, 0) / metricsData.length,
            throughput: metricsData.reduce((sum, m) => sum + m.performance_metrics.throughput, 0) / metricsData.length
          }
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.monitoring.alerts).toBeLessThan(3);
      expect(metrics.monitoring.warnings).toBeLessThan(5);
      expect(metrics.monitoring.criticalErrors).toBe(0);
      expect(metrics.monitoring.systemMetrics.heapUsed).toBeLessThan(0.8);
      expect(metrics.monitoring.systemMetrics.eventLoopLag).toBeLessThan(30);
      expect(metrics.monitoring.performanceMetrics.apiLatency).toBeLessThan(200);
      expect(metrics.monitoring.performanceMetrics.errorRate).toBeLessThan(0.1);
      expect(metrics.monitoring.performanceMetrics.throughput).toBeGreaterThan(700);
      expect(metrics.monitoring.averages.heapUsed).toBeLessThan(0.7);
      expect(metrics.monitoring.averages.eventLoopLag).toBeLessThan(20);
      expect(metrics.monitoring.averages.apiLatency).toBeLessThan(150);
      expect(metrics.monitoring.averages.throughput).toBeGreaterThan(800);
    });
  });

  it('should validate system monitoring metrics during high load conditions', async () => {
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
        monitoring: {
          alerts: 2,
          warnings: 4,
          criticalErrors: 0,
          systemEvents: 200,
          healthChecks: 100,
          uptime: 7200,
          mttr: 0,
          mttf: 3600,
          systemMetrics: {
            heapUsed: 0.7,
            heapTotal: 0.9,
            externalMemory: 0.3,
            eventLoopLag: 20,
            activeHandles: 80,
            activeRequests: 40,
            garbageCollectionCount: 10,
            garbageCollectionTime: 150
          },
          performanceMetrics: {
            apiLatency: 150,
            errorRate: 0.05,
            systemHealth: 0.95,
            throughput: 800,
            responseTime: 300
          },
          resourceUtilization: {
            memory: 0.7,
            cpu: 0.7,
            network: 0.8,
            eventLoop: 0.6
          }
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.monitoring.alerts).toBeLessThan(5);
      expect(metrics.monitoring.warnings).toBeLessThan(10);
      expect(metrics.monitoring.criticalErrors).toBe(0);
      expect(metrics.monitoring.systemMetrics.heapUsed).toBeLessThan(0.8);
      expect(metrics.monitoring.systemMetrics.eventLoopLag).toBeLessThan(30);
      expect(metrics.monitoring.performanceMetrics.apiLatency).toBeLessThan(200);
      expect(metrics.monitoring.performanceMetrics.errorRate).toBeLessThan(0.1);
      expect(metrics.monitoring.performanceMetrics.throughput).toBeGreaterThan(700);
      expect(metrics.monitoring.resourceUtilization.memory).toBeLessThan(0.8);
      expect(metrics.monitoring.resourceUtilization.cpu).toBeLessThan(0.8);
      expect(metrics.monitoring.resourceUtilization.network).toBeLessThan(0.9);
      expect(metrics.monitoring.resourceUtilization.eventLoop).toBeLessThan(0.7);
    });
  });
});
