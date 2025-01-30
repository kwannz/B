import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, createWallet, getBotStatus, getWallet } from '@/app/api/client';
import TradingDashboard from '@/app/trading-dashboard/page';
import { testRunner } from '../setup/test-runner';

jest.mock('next/navigation');
jest.mock('@/app/api/client');

describe('Workflow Metrics Validation - Performance Monitoring', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (createBot as jest.Mock).mockResolvedValue(mockBot);
    (getBotStatus as jest.Mock).mockResolvedValue(mockBot);
  });

  it('should track API performance metrics', async () => {
    await testRunner.runTest(async () => {
      const apiCalls: number[] = [];
      const startTime = Date.now();

      (getBotStatus as jest.Mock).mockImplementation(() => {
        const callDuration = Date.now() - startTime;
        apiCalls.push(callDuration);
        return Promise.resolve(mockBot);
      });

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
          apiLatency: Math.max(...apiCalls),
          systemHealth: 1.0,
          successRate: 1.0
        }
      };

      testRunner.expectMetrics(metrics);
      expect(apiCalls.length).toBeGreaterThan(0);
      expect(Math.max(...apiCalls)).toBeLessThan(200);
    });
  });

  it('should monitor system health metrics', async () => {
    await testRunner.runTest(async () => {
      const healthMetrics: number[] = [];
      let callCount = 0;

      (getBotStatus as jest.Mock).mockImplementation(() => {
        callCount++;
        const health = callCount <= 2 ? 0.8 : 1.0;
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

      render(
        <TestContext>
          <TradingDashboard />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByTestId('system-health')).toHaveTextContent(/100%/);
      });

      const metrics = {
        performance: {
          errorRate: 0,
          apiLatency: 100,
          systemHealth: healthMetrics[healthMetrics.length - 1],
          successRate: 1.0
        }
      };

      testRunner.expectMetrics(metrics);
      expect(healthMetrics[healthMetrics.length - 1]).toBe(1.0);
    });
  });

  it('should validate performance under load', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      const requests = Array(5).fill(null).map(() => getBotStatus('bot-123'));

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
      expect(totalDuration / requests.length).toBeLessThan(150);
    });
  });

  it('should monitor error recovery performance', async () => {
    await testRunner.runTest(async () => {
      const error = new Error('API Error');
      const startTime = Date.now();
      let retryCount = 0;

      (getBotStatus as jest.Mock)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockBot);

      render(
        <TestContext>
          <TradingDashboard />
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByText(/Success Rate: 80%/i)).toBeInTheDocument();
      });

      const endTime = Date.now();
      const recoveryDuration = endTime - startTime;

      const metrics = {
        performance: {
          errorRate: 0.67,
          apiLatency: recoveryDuration / 3,
          systemHealth: 0.8,
          successRate: 0.33
        }
      };

      testRunner.expectMetrics(metrics);
      expect(recoveryDuration).toBeLessThan(3000);
    });
  });
});
