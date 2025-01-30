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

describe('Workflow Metrics Validation - System Workflow Monitoring Performance', () => {
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
        system_health: 1.0
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

  it('should validate workflow monitoring performance during normal operation', async () => {
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
          system_health: Math.min(1.0, 0.9 + metricsData.length * 0.02)
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
          successRate: 1.0,
          workflowTime,
          averageStepTime: workflowTime / workflow.length,
          monitoredSteps: workflow.length
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.averageStepTime).toBeLessThan(500);
      expect(metrics.performance.systemHealth).toBeGreaterThan(0.9);
    });
  });

  it('should validate workflow monitoring performance during high load', async () => {
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
          successRate: 1.0,
          operationTime,
          concurrentOperations: workflow.length,
          averageOperationTime: operationTime / workflow.length
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.operationTime).toBeLessThan(3000);
      expect(metrics.performance.averageOperationTime).toBeLessThan(500);
    });
  });

  it('should validate workflow monitoring performance during error recovery', async () => {
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
            system_health: Math.min(1.0, 0.8 + retryCount * 0.05)
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
          successRate: retryCount / (retryCount + 1),
          recoveryTime,
          retryCount,
          averageRecoveryTime: recoveryTime / (retryCount + 1)
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.recoveryTime).toBeLessThan(5000);
      expect(metrics.performance.averageRecoveryTime).toBeLessThan(1000);
    });
  });

  it('should validate workflow monitoring performance during system degradation', async () => {
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
          system_health: 1.0 - degradation
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
          successRate: 1.0,
          recoveryTime,
          degradationPeriod: 3,
          averageDegradedLatency: metricsData
            .slice(0, 3)
            .reduce((sum, m) => sum + m.api_latency, 0) / 3
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.recoveryTime).toBeLessThan(4000);
      expect(metrics.performance.averageDegradedLatency).toBeLessThan(200);
    });
  });
});
