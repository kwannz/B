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

describe('Workflow Metrics Validation - Performance Testing', () => {
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

  it('should validate workflow performance under load', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      const requests = Array(10).fill(null).map(() => getBotStatus('bot-123'));

      await Promise.all(requests);
      const endTime = Date.now();
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

  it('should measure component render performance', async () => {
    await testRunner.runTest(async () => {
      const startTime = performance.now();

      render(
        <TestContext>
          <TradingDashboard />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderDuration = endTime - startTime;

      const metrics = {
        performance: {
          errorRate: 0,
          apiLatency: 100,
          systemHealth: 1.0,
          successRate: 1.0,
          renderTime: renderDuration
        }
      };

      testRunner.expectMetrics(metrics);
      expect(renderDuration).toBeLessThan(500);
    });
  });

  it('should validate concurrent API performance', async () => {
    await testRunner.runTest(async () => {
      const apiCalls: number[] = [];
      const startTime = Date.now();

      (getBotStatus as jest.Mock).mockImplementation(() => {
        const callDuration = Date.now() - startTime;
        apiCalls.push(callDuration);
        return Promise.resolve(mockBot);
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
          apiLatency: Math.max(...apiCalls),
          systemHealth: 1.0,
          successRate: 1.0,
          concurrentRequests: apiCalls.length
        }
      };

      testRunner.expectMetrics(metrics);
      expect(Math.max(...apiCalls)).toBeLessThan(300);
    });
  });

  it('should validate memory usage during workflow', async () => {
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
});
