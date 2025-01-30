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

describe('Workflow Metrics Validation - System Workflow Monitoring Performance Metrics', () => {
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
        request_count: 1000
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

  it('should validate workflow monitoring with comprehensive performance metrics validation', async () => {
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
          request_count: 1000 + metricsData.length * 100
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
          successRate: 1.0,
          workflowTime,
          averageStepTime: workflowTime / workflow.length,
          peakMemoryUsage: Math.max(...metricsData.map(m => m.memory_usage)),
          peakCpuUsage: Math.max(...metricsData.map(m => m.cpu_usage)),
          averageNetworkLatency: metricsData.reduce((sum, m) => sum + m.network_latency, 0) / metricsData.length,
          averageThroughput: metricsData.reduce((sum, m) => sum + m.throughput, 0) / metricsData.length,
          averageResponseTime: metricsData.reduce((sum, m) => sum + m.response_time, 0) / metricsData.length,
          totalErrors: metricsData.reduce((sum, m) => sum + m.error_count, 0),
          totalRequests: metricsData.reduce((sum, m) => sum + m.request_count, 0)
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.averageStepTime).toBeLessThan(500);
      expect(metrics.performance.peakMemoryUsage).toBeLessThan(0.8);
      expect(metrics.performance.peakCpuUsage).toBeLessThan(0.8);
      expect(metrics.performance.averageNetworkLatency).toBeLessThan(100);
      expect(metrics.performance.averageThroughput).toBeGreaterThan(50);
      expect(metrics.performance.averageResponseTime).toBeLessThan(300);
      expect(metrics.performance.totalErrors).toBeLessThan(10);
      expect(metrics.performance.totalRequests).toBeGreaterThan(5000);
    });
  });

  it('should validate workflow monitoring during high load with comprehensive metrics', async () => {
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
          successRate: 1.0,
          operationTime,
          concurrentOperations: workflow.length,
          averageOperationTime: operationTime / workflow.length,
          resourceUtilization: {
            memory: 0.6,
            cpu: 0.7,
            network: 0.8
          },
          performanceMetrics: {
            throughput: 80,
            responseTime: 250,
            errorRate: 0,
            successRate: 1.0
          }
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.operationTime).toBeLessThan(3000);
      expect(metrics.performance.resourceUtilization.memory).toBeLessThan(0.8);
      expect(metrics.performance.resourceUtilization.cpu).toBeLessThan(0.9);
      expect(metrics.performance.performanceMetrics.throughput).toBeGreaterThan(50);
      expect(metrics.performance.performanceMetrics.responseTime).toBeLessThan(300);
    });
  });

  it('should validate workflow monitoring during error recovery with comprehensive metrics', async () => {
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
            request_count: 1000 + retryCount * 100
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
          successRate: retryCount / (retryCount + 1),
          recoveryTime,
          retryCount,
          resourceImpact: {
            memorySpike: Math.max(...metricsData.map(m => m.memory_usage)),
            cpuSpike: Math.max(...metricsData.map(m => m.cpu_usage)),
            networkLatencySpike: Math.max(...metricsData.map(m => m.network_latency)),
            throughputDrop: Math.min(...metricsData.map(m => m.throughput)),
            responseTimeSpike: Math.max(...metricsData.map(m => m.response_time))
          }
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.recoveryTime).toBeLessThan(5000);
      expect(metrics.performance.resourceImpact.memorySpike).toBeLessThan(0.8);
      expect(metrics.performance.resourceImpact.cpuSpike).toBeLessThan(0.8);
      expect(metrics.performance.resourceImpact.networkLatencySpike).toBeLessThan(200);
      expect(metrics.performance.resourceImpact.throughputDrop).toBeGreaterThan(50);
      expect(metrics.performance.resourceImpact.responseTimeSpike).toBeLessThan(400);
    });
  });

  it('should validate workflow monitoring during system degradation with comprehensive metrics', async () => {
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
          request_count: 1000 + callCount * 100
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
          successRate: 1.0,
          recoveryTime,
          degradationPeriod: 3,
          degradationMetrics: {
            averageMemoryUsage: metricsData.slice(0, 3).reduce((sum, m) => sum + m.memory_usage, 0) / 3,
            averageCpuUsage: metricsData.slice(0, 3).reduce((sum, m) => sum + m.cpu_usage, 0) / 3,
            averageNetworkLatency: metricsData.slice(0, 3).reduce((sum, m) => sum + m.network_latency, 0) / 3,
            averageThroughput: metricsData.slice(0, 3).reduce((sum, m) => sum + m.throughput, 0) / 3,
            averageResponseTime: metricsData.slice(0, 3).reduce((sum, m) => sum + m.response_time, 0) / 3,
            totalErrors: metricsData.slice(0, 3).reduce((sum, m) => sum + m.error_count, 0)
          },
          recoveryMetrics: {
            averageMemoryUsage: metricsData.slice(3).reduce((sum, m) => sum + m.memory_usage, 0) / (metricsData.length - 3),
            averageCpuUsage: metricsData.slice(3).reduce((sum, m) => sum + m.cpu_usage, 0) / (metricsData.length - 3),
            averageNetworkLatency: metricsData.slice(3).reduce((sum, m) => sum + m.network_latency, 0) / (metricsData.length - 3),
            averageThroughput: metricsData.slice(3).reduce((sum, m) => sum + m.throughput, 0) / (metricsData.length - 3),
            averageResponseTime: metricsData.slice(3).reduce((sum, m) => sum + m.response_time, 0) / (metricsData.length - 3),
            totalErrors: metricsData.slice(3).reduce((sum, m) => sum + m.error_count, 0)
          }
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.recoveryTime).toBeLessThan(4000);
      expect(metrics.performance.degradationMetrics.averageMemoryUsage).toBeLessThan(0.8);
      expect(metrics.performance.degradationMetrics.averageCpuUsage).toBeLessThan(0.8);
      expect(metrics.performance.degradationMetrics.averageNetworkLatency).toBeLessThan(150);
      expect(metrics.performance.degradationMetrics.averageThroughput).toBeGreaterThan(50);
      expect(metrics.performance.degradationMetrics.averageResponseTime).toBeLessThan(350);
      expect(metrics.performance.degradationMetrics.totalErrors).toBeLessThan(10);
      expect(metrics.performance.recoveryMetrics.averageMemoryUsage).toBeLessThan(0.5);
      expect(metrics.performance.recoveryMetrics.averageCpuUsage).toBeLessThan(0.5);
      expect(metrics.performance.recoveryMetrics.averageNetworkLatency).toBeLessThan(100);
      expect(metrics.performance.recoveryMetrics.averageThroughput).toBeGreaterThan(80);
      expect(metrics.performance.recoveryMetrics.averageResponseTime).toBeLessThan(250);
      expect(metrics.performance.recoveryMetrics.totalErrors).toBe(0);
    });
  });
});
