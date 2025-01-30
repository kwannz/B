import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, createWallet, getBotStatus, getWallet } from '@/app/api/client';
import AgentSelection from '@/app/agent-selection/page';
import StrategyCreation from '@/app/strategy-creation/page';
import BotIntegration from '@/app/bot-integration/page';
import KeyManagement from '@/app/key-management/page';
import TradingDashboard from '@/app/trading-dashboard/page';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('next/navigation');
jest.mock('@/app/api/client');

describe('Workflow Metrics Validation - System Workflow Monitoring Performance Metrics Validation System', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  };

  const mockBot = {
    id: 'bot-123',
    type: 'trading',
    strategy: 'Test Strategy',
    status: 'active',
    metrics: {
      trades: 10,
      success_rate: 0.8,
      profit_loss: 0.15,
      performance: {
        api_latency: 100,
        error_rate: 0,
        system_health: 1.0,
        memory_usage: 0.4,
        cpu_usage: 0.3,
        network_latency: 50,
        throughput: 100,
        response_time: 200,
        error_count: 0,
        request_count: 1000,
        recovery_time: 0,
        recovery_success_rate: 1.0,
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
  };

  const mockWallet = {
    address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
    private_key: 'mock_private_key',
    balance: 1.5,
    transactions: [
      { type: 'trade', amount: 0.1, timestamp: Date.now() }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (createBot as jest.Mock).mockResolvedValue(mockBot);
    (getBotStatus as jest.Mock).mockResolvedValue(mockBot);
    (createWallet as jest.Mock).mockResolvedValue(mockWallet);
    (getWallet as jest.Mock).mockResolvedValue(mockWallet);
  });

  it('should validate workflow monitoring with comprehensive system metrics', async () => {
    await testRunner.runTest(async () => {
      const startTime = performance.now();
      const metricsData: any[] = [];

      const workflow = [
        <AgentSelection />,
        <StrategyCreation />,
        <BotIntegration />,
        <KeyManagement />,
        <TradingDashboard />,
        <WalletComparison />
      ];

      for (const component of workflow) {
        render(
          <TestContext>
            {component}
          </TestContext>
        );

        await waitFor(() => {
          expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
        });

        const metrics = {
          api_latency: 100 + metricsData.length * 10,
          error_rate: Math.max(0, 0.1 - metricsData.length * 0.02),
          system_health: Math.min(1.0, 0.9 + metricsData.length * 0.02),
          memory_usage: 0.4 + metricsData.length * 0.05,
          cpu_usage: 0.3 + metricsData.length * 0.05,
          network_latency: 50 + metricsData.length * 5,
          throughput: 100 - metricsData.length * 5,
          response_time: 200 + metricsData.length * 20,
          error_count: Math.max(0, 5 - metricsData.length),
          request_count: 1000 + metricsData.length * 100,
          system_metrics: {
            heap_used: 0.5 + metricsData.length * 0.05,
            heap_total: 0.8,
            external_memory: 0.2 + metricsData.length * 0.02,
            event_loop_lag: 10 + metricsData.length * 2,
            active_handles: 50 + metricsData.length * 5,
            active_requests: 20 + metricsData.length * 2,
            garbage_collection_count: 5 + metricsData.length,
            garbage_collection_time: 100 + metricsData.length * 10
          }
        };
        metricsData.push(metrics);
      }

      const endTime = performance.now();
      const workflowTime = endTime - startTime;

      const metrics = {
        performance: {
          errorRate: metricsData[metricsData.length - 1].error_rate,
          apiLatency: metricsData[metricsData.length - 1].api_latency,
          systemHealth: metricsData[metricsData.length - 1].system_health,
          memoryUsage: metricsData[metricsData.length - 1].memory_usage,
          cpuUsage: metricsData[metricsData.length - 1].cpu_usage,
          networkLatency: metricsData[metricsData.length - 1].network_latency,
          throughput: metricsData[metricsData.length - 1].throughput,
          responseTime: metricsData[metricsData.length - 1].response_time,
          errorCount: metricsData[metricsData.length - 1].error_count,
          requestCount: metricsData[metricsData.length - 1].request_count,
          workflowTime,
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
          averages: {
            heapUsed: metricsData.reduce((sum, m) => sum + m.system_metrics.heap_used, 0) / metricsData.length,
            eventLoopLag: metricsData.reduce((sum, m) => sum + m.system_metrics.event_loop_lag, 0) / metricsData.length,
            activeHandles: metricsData.reduce((sum, m) => sum + m.system_metrics.active_handles, 0) / metricsData.length,
            garbageCollectionTime: metricsData.reduce((sum, m) => sum + m.system_metrics.garbage_collection_time, 0) / metricsData.length
          }
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.systemMetrics.heapUsed).toBeLessThan(0.8);
      expect(metrics.performance.systemMetrics.eventLoopLag).toBeLessThan(30);
      expect(metrics.performance.systemMetrics.activeHandles).toBeLessThan(100);
      expect(metrics.performance.systemMetrics.garbageCollectionTime).toBeLessThan(200);
      expect(metrics.performance.averages.heapUsed).toBeLessThan(0.7);
      expect(metrics.performance.averages.eventLoopLag).toBeLessThan(20);
      expect(metrics.performance.averages.activeHandles).toBeLessThan(80);
      expect(metrics.performance.averages.garbageCollectionTime).toBeLessThan(150);
    });
  });

  it('should validate workflow monitoring during high load with system metrics', async () => {
    await testRunner.runTest(async () => {
      const startTime = performance.now();
      const metricsData: any[] = [];

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

      const endTime = performance.now();
      const operationTime = endTime - startTime;

      await waitFor(() => {
        expect(screen.getAllByTestId('performance-metrics')).toHaveLength(workflow.length);
      });

      const metrics = {
        performance: {
          errorRate: 0,
          apiLatency: operationTime / workflow.length,
          systemHealth: 1.0,
          memoryUsage: 0.6,
          cpuUsage: 0.7,
          networkLatency: 80,
          throughput: 80,
          responseTime: 250,
          errorCount: 0,
          requestCount: workflow.length * 1000,
          operationTime,
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
          resourceUtilization: {
            memory: 0.7,
            cpu: 0.7,
            network: 0.8,
            eventLoop: 0.6
          }
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.operationTime).toBeLessThan(3000);
      expect(metrics.performance.systemMetrics.heapUsed).toBeLessThan(0.8);
      expect(metrics.performance.systemMetrics.eventLoopLag).toBeLessThan(30);
      expect(metrics.performance.systemMetrics.activeHandles).toBeLessThan(100);
      expect(metrics.performance.systemMetrics.garbageCollectionTime).toBeLessThan(200);
      expect(metrics.performance.resourceUtilization.eventLoop).toBeLessThan(0.7);
    });
  });

  it('should validate workflow monitoring during error recovery with system metrics', async () => {
    await testRunner.runTest(async () => {
      const error = new Error('API Error');
      const startTime = performance.now();
      const metricsData: any[] = [];
      let retryCount = 0;

      (getBotStatus as jest.Mock)
        .mockRejectedValueOnce(error)
        .mockImplementation(() => {
          retryCount++;
          const metrics = {
            api_latency: 100 + retryCount * 25,
            error_rate: Math.max(0, 0.2 - retryCount * 0.05),
            system_health: Math.min(1.0, 0.8 + retryCount * 0.05),
            memory_usage: 0.5 + retryCount * 0.05,
            cpu_usage: 0.4 + retryCount * 0.05,
            network_latency: 60 + retryCount * 10,
            throughput: 90 - retryCount * 5,
            response_time: 220 + retryCount * 20,
            error_count: Math.max(0, 3 - retryCount),
            request_count: 1000 + retryCount * 100,
            system_metrics: {
              heap_used: 0.5 + retryCount * 0.05,
              heap_total: 0.8,
              external_memory: 0.2 + retryCount * 0.02,
              event_loop_lag: 15 + retryCount * 3,
              active_handles: 60 + retryCount * 5,
              active_requests: 25 + retryCount * 3,
              garbage_collection_count: 7 + retryCount,
              garbage_collection_time: 120 + retryCount * 15
            }
          };
          metricsData.push(metrics);
          return Promise.resolve({
            ...mockBot,
            metrics: {
              ...mockBot.metrics,
              performance: metrics
            }
          });
        });

      const workflow = [
        <AgentSelection />,
        <StrategyCreation />,
        <BotIntegration />,
        <KeyManagement />,
        <TradingDashboard />,
        <WalletComparison />
      ];

      for (const component of workflow) {
        render(
          <TestContext>
            {component}
          </TestContext>
        );

        await waitFor(() => {
          expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
        });
      }

      const endTime = performance.now();
      const recoveryTime = endTime - startTime;

      const metrics = {
        performance: {
          errorRate: metricsData[metricsData.length - 1].error_rate,
          apiLatency: metricsData[metricsData.length - 1].api_latency,
          systemHealth: metricsData[metricsData.length - 1].system_health,
          memoryUsage: metricsData[metricsData.length - 1].memory_usage,
          cpuUsage: metricsData[metricsData.length - 1].cpu_usage,
          networkLatency: metricsData[metricsData.length - 1].network_latency,
          throughput: metricsData[metricsData.length - 1].throughput,
          responseTime: metricsData[metricsData.length - 1].response_time,
          errorCount: metricsData[metricsData.length - 1].error_count,
          requestCount: metricsData[metricsData.length - 1].request_count,
          recoveryTime,
          retryCount,
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
          systemImpact: {
            peakHeapUsed: Math.max(...metricsData.map(m => m.system_metrics.heap_used)),
            peakEventLoopLag: Math.max(...metricsData.map(m => m.system_metrics.event_loop_lag)),
            peakActiveHandles: Math.max(...metricsData.map(m => m.system_metrics.active_handles)),
            totalGarbageCollectionTime: metricsData.reduce((sum, m) => sum + m.system_metrics.garbage_collection_time, 0)
          }
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.recoveryTime).toBeLessThan(5000);
      expect(metrics.performance.systemImpact.peakHeapUsed).toBeLessThan(0.8);
      expect(metrics.performance.systemImpact.peakEventLoopLag).toBeLessThan(30);
      expect(metrics.performance.systemImpact.peakActiveHandles).toBeLessThan(100);
      expect(metrics.performance.systemImpact.totalGarbageCollectionTime).toBeLessThan(1000);
    });
  });

  it('should validate workflow monitoring during system degradation with system metrics', async () => {
    await testRunner.runTest(async () => {
      const startTime = performance.now();
      const metricsData: any[] = [];
      let callCount = 0;

      (getBotStatus as jest.Mock).mockImplementation(() => {
        callCount++;
        const degradation = callCount <= 3 ? 0.3 : 0;
        const metrics = {
          api_latency: 100 + (degradation * 200),
          error_rate: degradation,
          system_health: 1.0 - degradation,
          memory_usage: 0.4 + (degradation * 0.3),
          cpu_usage: 0.3 + (degradation * 0.4),
          network_latency: 50 + (degradation * 100),
          throughput: 100 - (degradation * 50),
          response_time: 200 + (degradation * 150),
          error_count: Math.floor(degradation * 10),
          request_count: 1000 + callCount * 100,
          system_metrics: {
            heap_used: 0.5 + (degradation * 0.2),
            heap_total: 0.8,
            external_memory: 0.2 + (degradation * 0.1),
            event_loop_lag: 10 + (degradation * 30),
            active_handles: 50 + (degradation * 40),
            active_requests: 20 + (degradation * 20),
            garbage_collection_count: 5 + Math.floor(degradation * 10),
            garbage_collection_time: 100 + (degradation * 200)
          }
        };
        metricsData.push(metrics);
        return Promise.resolve({
          ...mockBot,
          metrics: {
            ...mockBot.metrics,
            performance: metrics
          }
        });
      });

      const workflow = [
        <AgentSelection />,
        <StrategyCreation />,
        <BotIntegration />,
        <KeyManagement />,
        <TradingDashboard />,
        <WalletComparison />
      ];

      for (const component of workflow) {
        render(
          <TestContext>
            {component}
          </TestContext>
        );

        await waitFor(() => {
          expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
        });
      }

      const endTime = performance.now();
      const recoveryTime = endTime - startTime;

      const metrics = {
        performance: {
          errorRate: metricsData[metricsData.length - 1].error_rate,
          apiLatency: metricsData[metricsData.length - 1].api_latency,
          systemHealth: metricsData[metricsData.length - 1].system_health,
          memoryUsage: metricsData[metricsData.length - 1].memory_usage,
          cpuUsage: metricsData[metricsData.length - 1].cpu_usage,
          networkLatency: metricsData[metricsData.length - 1].network_latency,
          throughput: metricsData[metricsData.length - 1].throughput,
          responseTime: metricsData[metricsData.length - 1].response_time,
          errorCount: metricsData[metricsData.length - 1].error_count,
          requestCount: metricsData[metricsData.length - 1].request_count,
          recoveryTime,
          degradationPeriod: 3,
          systemMetrics: {
            degraded: {
              averageHeapUsed: metricsData.slice(0, 3).reduce((sum, m) => sum + m.system_metrics.heap_used, 0) / 3,
              averageEventLoopLag: metricsData.slice(0, 3).reduce((sum, m) => sum + m.system_metrics.event_loop_lag, 0) / 3,
              averageActiveHandles: metricsData.slice(0, 3).reduce((sum, m) => sum + m.system_metrics.active_handles, 0) / 3,
              averageGarbageCollectionTime: metricsData.slice(0, 3).reduce((sum, m) => sum + m.system_metrics.garbage_collection_time, 0) / 3
            },
            recovered: {
              averageHeapUsed: metricsData.slice(3).reduce((sum, m) => sum + m.system_metrics.heap_used, 0) / (metricsData.length - 3),
              averageEventLoopLag: metricsData.slice(3).reduce((sum, m) => sum + m.system_metrics.event_loop_lag, 0) / (metricsData.length - 3),
              averageActiveHandles: metricsData.slice(3).reduce((sum, m) => sum + m.system_metrics.active_handles, 0) / (metricsData.length - 3),
              averageGarbageCollectionTime: metricsData.slice(3).reduce((sum, m) => sum + m.system_metrics.garbage_collection_time, 0) / (metricsData.length - 3)
            }
          }
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.recoveryTime).toBeLessThan(4000);
      expect(metrics.performance.systemMetrics.degraded.averageHeapUsed).toBeLessThan(0.8);
      expect(metrics.performance.systemMetrics.degraded.averageEventLoopLag).toBeLessThan(30);
      expect(metrics.performance.systemMetrics.degraded.averageActiveHandles).toBeLessThan(100);
      expect(metrics.performance.systemMetrics.degraded.averageGarbageCollectionTime).toBeLessThan(200);
      expect(metrics.performance.systemMetrics.recovered.averageHeapUsed).toBeLessThan(0.6);
      expect(metrics.performance.systemMetrics.recovered.averageEventLoopLag).toBeLessThan(15);
      expect(metrics.performance.systemMetrics.recovered.averageActiveHandles).toBeLessThan(70);
      expect(metrics.performance.systemMetrics.recovered.averageGarbageCollectionTime).toBeLessThan(150);
    });
  });
});
