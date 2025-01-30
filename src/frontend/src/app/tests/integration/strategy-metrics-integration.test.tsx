import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import { useDebugStore } from '@/app/stores/debugStore';
import { TestMetrics } from '../types/test.types';
import StrategyCreation from '@/app/strategy-creation/page';
import BotIntegration from '@/app/bot-integration/page';
import TradingDashboard from '@/app/trading-dashboard/page';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/api/client');
jest.mock('@/app/stores/debugStore');

describe('Strategy Metrics Integration', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn()
  };

  const mockWallet = {
    connected: true,
    connecting: false,
    publicKey: { toString: () => '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK' },
    connect: jest.fn(),
    disconnect: jest.fn(),
    signTransaction: jest.fn(),
    signAllTransactions: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useWallet as jest.Mock).mockReturnValue(mockWallet);
  });

  it('should track metrics during strategy creation and execution', async () => {
    const metrics = {
      operations: [] as { type: string; latency: number; success: boolean }[],
      errors: 0,
      successes: 0
    };

    const mockStrategyResponse = {
      id: 'bot-123',
      type: 'trading',
      strategy: 'Test Strategy',
      metrics: {
        execution_time: 150,
        success_rate: 0.95,
        performance: {
          win_rate: 0.65,
          profit_loss: 0.8,
          trades: 100
        }
      }
    };

    (createBot as jest.Mock).mockImplementation((type, strategy) => {
      const startTime = Date.now();
      return Promise.resolve(mockStrategyResponse)
        .then(result => {
          metrics.operations.push({
            type: 'create_strategy',
            latency: Date.now() - startTime,
            success: true
          });
          metrics.successes++;
          return result;
        })
        .catch(error => {
          metrics.operations.push({
            type: 'create_strategy',
            latency: Date.now() - startTime,
            success: false
          });
          metrics.errors++;
          throw error;
        });
    });

    render(
      <TestContext>
        <StrategyCreation />
      </TestContext>
    );

    const strategyInput = screen.getByRole('textbox', { name: /strategy/i });
    fireEvent.change(strategyInput, { target: { value: 'Test Strategy' } });
    const createButton = screen.getByRole('button', { name: /create strategy/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(createBot).toHaveBeenCalledWith('trading', 'Test Strategy');
      expect(mockRouter.push).toHaveBeenCalled();
    });

    const avgLatency = metrics.operations.reduce((sum, op) => sum + op.latency, 0) / metrics.operations.length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / metrics.operations.length,
        apiLatency: avgLatency,
        systemHealth: metrics.successes / metrics.operations.length,
        successRate: metrics.successes / metrics.operations.length,
        totalTrades: mockStrategyResponse.metrics.performance.trades,
        walletBalance: 0
      },
      strategy: {
        executionTime: mockStrategyResponse.metrics.execution_time,
        successRate: mockStrategyResponse.metrics.success_rate,
        performance: mockStrategyResponse.metrics.performance
      }
    };

    expect(testMetrics.strategy.executionTime).toBeLessThan(1000);
    expect(testMetrics.performance.successRate).toBe(1);
    expect(testMetrics.strategy.performance.win_rate).toBeGreaterThan(0.6);
  });

  it('should track metrics during strategy performance monitoring', async () => {
    const metrics = {
      updates: [] as { timestamp: number; performance: any }[],
      errors: 0,
      successes: 0
    };

    const mockPerformanceUpdates = [
      {
        win_rate: 0.65,
        profit_loss: 0.8,
        trades: 100,
        active_positions: 2
      },
      {
        win_rate: 0.67,
        profit_loss: 0.9,
        trades: 110,
        active_positions: 3
      },
      {
        win_rate: 0.70,
        profit_loss: 1.1,
        trades: 120,
        active_positions: 2
      }
    ];

    let updateCount = 0;
    (getBotStatus as jest.Mock).mockImplementation(() => {
      const startTime = Date.now();
      return Promise.resolve({
        id: 'bot-123',
        status: 'active',
        metrics: {
          performance: mockPerformanceUpdates[updateCount++]
        }
      })
        .then(result => {
          metrics.updates.push({
            timestamp: Date.now(),
            performance: result.metrics.performance
          });
          metrics.successes++;
          return result;
        })
        .catch(error => {
          metrics.errors++;
          throw error;
        });
    });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    for (let i = 0; i < mockPerformanceUpdates.length; i++) {
      await waitFor(() => {
        const update = mockPerformanceUpdates[i];
        expect(screen.getByText(new RegExp(`${update.win_rate * 100}%`))).toBeInTheDocument();
      });
    }

    const avgWinRate = metrics.updates.reduce((sum, update) => sum + update.performance.win_rate, 0) / metrics.updates.length;
    const avgProfitLoss = metrics.updates.reduce((sum, update) => sum + update.performance.profit_loss, 0) / metrics.updates.length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / (metrics.errors + metrics.successes),
        apiLatency: 0,
        systemHealth: metrics.successes / (metrics.errors + metrics.successes),
        successRate: metrics.successes / (metrics.errors + metrics.successes),
        totalTrades: mockPerformanceUpdates[mockPerformanceUpdates.length - 1].trades,
        walletBalance: 0
      },
      strategy: {
        updates: metrics.updates.length,
        performance: {
          avgWinRate,
          avgProfitLoss,
          improvement: (mockPerformanceUpdates[mockPerformanceUpdates.length - 1].win_rate - mockPerformanceUpdates[0].win_rate) / mockPerformanceUpdates[0].win_rate
        }
      }
    };

    expect(testMetrics.strategy.updates).toBe(mockPerformanceUpdates.length);
    expect(testMetrics.performance.successRate).toBe(1);
    expect(testMetrics.strategy.performance.improvement).toBeGreaterThan(0);
  });

  it('should validate strategy metrics accuracy', async () => {
    const metrics = {
      trades: [] as { type: string; profit: number; timestamp: number }[],
      snapshots: [] as { timestamp: number; metrics: any }[]
    };

    const mockTrades = [
      { type: 'buy', profit: 0.1, timestamp: Date.now() - 3000 },
      { type: 'sell', profit: 0.2, timestamp: Date.now() - 2000 },
      { type: 'buy', profit: -0.1, timestamp: Date.now() - 1000 }
    ];

    (getBotStatus as jest.Mock).mockImplementation(() => {
      const data = {
        id: 'bot-123',
        status: 'active',
        metrics: {
          performance: {
            trades: mockTrades,
            win_rate: mockTrades.filter(t => t.profit > 0).length / mockTrades.length,
            total_profit: mockTrades.reduce((sum, t) => sum + t.profit, 0)
          }
        }
      };
      metrics.snapshots.push({
        timestamp: Date.now(),
        metrics: { ...data.metrics }
      });
      metrics.trades.push(...mockTrades);
      return Promise.resolve(data);
    });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(metrics.snapshots.length).toBeGreaterThan(0);
    });

    const calculateMetrics = (trades: any[]) => {
      const winningTrades = trades.filter(t => t.profit > 0);
      return {
        winRate: winningTrades.length / trades.length,
        totalProfit: trades.reduce((sum, t) => sum + t.profit, 0),
        avgProfit: trades.reduce((sum, t) => sum + t.profit, 0) / trades.length
      };
    };

    const calculatedMetrics = calculateMetrics(metrics.trades);
    const lastSnapshot = metrics.snapshots[metrics.snapshots.length - 1].metrics;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: 0,
        apiLatency: 0,
        systemHealth: 1,
        successRate: 1,
        totalTrades: metrics.trades.length,
        walletBalance: 0
      },
      validation: {
        winRateAccuracy: Math.abs(calculatedMetrics.winRate - lastSnapshot.performance.win_rate),
        profitAccuracy: Math.abs(calculatedMetrics.totalProfit - lastSnapshot.performance.total_profit),
        tradeCount: metrics.trades.length === mockTrades.length
      }
    };

    expect(testMetrics.validation.winRateAccuracy).toBeLessThan(0.01);
    expect(testMetrics.validation.profitAccuracy).toBeLessThan(0.01);
    expect(testMetrics.validation.tradeCount).toBe(true);
  });
});
