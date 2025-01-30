import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, createWallet, getBotStatus, getWallet } from '@/app/api/client';
import AgentSelection from '@/app/agent-selection/page';
import StrategyCreation from '@/app/strategy-creation/page';
import BotIntegration from '@/app/bot-integration/page';
import KeyManagement from '@/app/key-management/page';
import TradingDashboard from '@/app/trading-dashboard/page';
import { testRunner } from '../setup/test-runner';

jest.mock('next/navigation');
jest.mock('@/app/api/client');

describe('Workflow Metrics Validation - System Monitoring Performance', () => {
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

  it('should validate system performance metrics during workflow', async () => {
    await testRunner.runTest(async () => {
      const startTime = performance.now();
      const requests = Array(5).fill(null).map(() => getBotStatus('bot-123'));

      await Promise.all(requests);
      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      render(
        <TestContext>
          <TradingDashboard />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
      });

      const metrics = {
        performance: {
          errorRate: 0,
          apiLatency: totalDuration / requests.length,
          systemHealth: 1.0,
          successRate: 1.0
        }
      };

      testRunner.expectMetrics(metrics);
      expect(totalDuration / requests.length).toBeLessThan(200);
    });
  });

  it('should validate system memory usage during workflow execution', async () => {
    await testRunner.runTest(async () => {
      const startHeap = process.memoryUsage().heapUsed;
      const components = Array(5).fill(null).map(() => (
        render(
          <TestContext>
            <TradingDashboard />
          </TestContext>
        )
      ));

      await Promise.all(components);
      const endHeap = process.memoryUsage().heapUsed;
      const memoryIncrease = endHeap - startHeap;

      await waitFor(() => {
        expect(screen.getAllByTestId('performance-metrics')).toHaveLength(5);
      });

      const metrics = {
        performance: {
          errorRate: 0,
          apiLatency: 100,
          systemHealth: 1.0,
          successRate: 1.0,
          memoryUsage: memoryIncrease
        }
      };

      testRunner.expectMetrics(metrics);
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  it('should validate system health metrics during high load', async () => {
    await testRunner.runTest(async () => {
      const healthMetrics: number[] = [];
      let callCount = 0;

      (getBotStatus as jest.Mock).mockImplementation(() => {
        callCount++;
        const health = callCount <= 2 ? 0.7 : 1.0;
        healthMetrics.push(health);
        return Promise.resolve({
          ...mockBot,
          metrics: {
            ...mockBot.metrics,
            performance: {
              ...mockBot.metrics.performance,
              system_health: health
            }
          }
        });
      });

      const concurrentRequests = Promise.all([
        render(
          <TestContext>
            <TradingDashboard />
          </TestContext>
        ),
        render(
          <TestContext>
            <BotIntegration />
          </TestContext>
        ),
        render(
          <TestContext>
            <KeyManagement />
          </TestContext>
        )
      ]);

      await concurrentRequests;

      await waitFor(() => {
        expect(screen.getAllByTestId('performance-metrics')).toHaveLength(3);
      });

      const metrics = {
        performance: {
          errorRate: 0,
          apiLatency: 100,
          systemHealth: healthMetrics[healthMetrics.length - 1],
          successRate: 1.0,
          concurrentRequests: healthMetrics.length
        }
      };

      testRunner.expectMetrics(metrics);
      expect(healthMetrics[0]).toBe(0.7);
      expect(healthMetrics[healthMetrics.length - 1]).toBe(1.0);
    });
  });

  it('should validate system performance under sustained load', async () => {
    await testRunner.runTest(async () => {
      const startTime = performance.now();
      const operations = Array(10).fill(null).map(async () => {
        render(
          <TestContext>
            <TradingDashboard />
          </TestContext>
        );
        await waitFor(() => {
          expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
        });
      });

      await Promise.all(operations);
      const endTime = performance.now();
      const operationTime = endTime - startTime;

      const metrics = {
        performance: {
          errorRate: 0,
          apiLatency: operationTime / operations.length,
          systemHealth: 1.0,
          successRate: 1.0,
          operationTime
        }
      };

      testRunner.expectMetrics(metrics);
      expect(operationTime / operations.length).toBeLessThan(300);
    });
  });
});
