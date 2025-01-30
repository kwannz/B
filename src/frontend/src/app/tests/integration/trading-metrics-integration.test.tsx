import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet, transferSOL } from '@/app/api/client';
import { useDebugStore } from '@/app/stores/debugStore';
import { TestMetrics } from '../types/test.types';
import TradingDashboard from '@/app/trading-dashboard/page';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/api/client');
jest.mock('@/app/stores/debugStore');

describe('Trading Metrics Integration', () => {
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

  it('should track metrics during trading operations', async () => {
    const metrics = {
      trades: [] as { type: string; amount: number; timestamp: number }[],
      performance: {
        latencies: [] as number[],
        errors: 0,
        successes: 0
      }
    };

    const mockTradingData = [
      {
        id: 'bot-123',
        status: 'active',
        metrics: {
          total_volume: 1000,
          profit_loss: 0.5,
          active_positions: 2,
          trades: [
            { type: 'buy', amount: 0.1, timestamp: Date.now() - 3000 },
            { type: 'sell', amount: 0.1, timestamp: Date.now() - 2000 }
          ]
        }
      },
      {
        id: 'bot-123',
        status: 'active',
        metrics: {
          total_volume: 1200,
          profit_loss: 0.7,
          active_positions: 3,
          trades: [
            { type: 'buy', amount: 0.2, timestamp: Date.now() - 1000 }
          ]
        }
      }
    ];

    let updateCount = 0;
    (getBotStatus as jest.Mock).mockImplementation(() => {
      const startTime = Date.now();
      return Promise.resolve(mockTradingData[updateCount++])
        .then(result => {
          metrics.performance.latencies.push(Date.now() - startTime);
          metrics.performance.successes++;
          metrics.trades.push(...result.metrics.trades);
          return result;
        })
        .catch(error => {
          metrics.performance.errors++;
          throw error;
        });
    });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    // Initial trading data
    await waitFor(() => {
      expect(screen.getByText(/1000/)).toBeInTheDocument();
      expect(screen.getByText(/0.5/)).toBeInTheDocument();
    });

    // Trading update
    await waitFor(() => {
      expect(screen.getByText(/1200/)).toBeInTheDocument();
      expect(screen.getByText(/0.7/)).toBeInTheDocument();
    });

    const avgLatency = metrics.performance.latencies.reduce((a, b) => a + b, 0) / metrics.performance.latencies.length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.performance.errors / (metrics.performance.errors + metrics.performance.successes),
        apiLatency: avgLatency,
        systemHealth: metrics.performance.successes / (metrics.performance.errors + metrics.performance.successes),
        successRate: metrics.performance.successes / (metrics.performance.errors + metrics.performance.successes),
        totalTrades: metrics.trades.length,
        walletBalance: 0
      },
      trading: {
        totalVolume: 1200,
        profitLoss: 0.7,
        activePositions: 3,
        tradeMetrics: {
          totalTrades: metrics.trades.length,
          buyTrades: metrics.trades.filter(t => t.type === 'buy').length,
          sellTrades: metrics.trades.filter(t => t.type === 'sell').length,
          avgTradeAmount: metrics.trades.reduce((sum, t) => sum + t.amount, 0) / metrics.trades.length
        }
      }
    };

    expect(testMetrics.trading.tradeMetrics.totalTrades).toBe(3);
    expect(testMetrics.performance.successRate).toBe(1);
    expect(testMetrics.trading.profitLoss).toBeGreaterThan(0);
  });

  it('should track performance metrics during high-frequency trading', async () => {
    const metrics = {
      trades: [] as { type: string; amount: number; timestamp: number }[],
      latencies: [] as number[],
      errors: 0,
      successes: 0
    };

    const generateMockTrade = (index: number) => ({
      id: 'bot-123',
      status: 'active',
      metrics: {
        total_volume: 1000 + (index * 100),
        profit_loss: 0.5 + (index * 0.1),
        active_positions: 2 + (index % 2),
        trades: [
          {
            type: index % 2 === 0 ? 'buy' : 'sell',
            amount: 0.1 + (index * 0.05),
            timestamp: Date.now() - (1000 * index)
          }
        ]
      }
    });

    let tradeCount = 0;
    (getBotStatus as jest.Mock).mockImplementation(() => {
      const startTime = Date.now();
      return Promise.resolve(generateMockTrade(tradeCount++))
        .then(result => {
          metrics.latencies.push(Date.now() - startTime);
          metrics.successes++;
          metrics.trades.push(...result.metrics.trades);
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

    // Wait for multiple trading updates
    for (let i = 0; i < 5; i++) {
      await waitFor(() => {
        const expectedVolume = 1000 + (i * 100);
        expect(screen.getByText(new RegExp(expectedVolume.toString()))).toBeInTheDocument();
      });
    }

    const avgLatency = metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length;
    const tradingPeriod = metrics.trades[metrics.trades.length - 1].timestamp - metrics.trades[0].timestamp;
    const tradesPerSecond = (metrics.trades.length * 1000) / tradingPeriod;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / (metrics.errors + metrics.successes),
        apiLatency: avgLatency,
        systemHealth: metrics.successes / (metrics.errors + metrics.successes),
        successRate: metrics.successes / (metrics.errors + metrics.successes),
        totalTrades: metrics.trades.length,
        walletBalance: 0
      },
      trading: {
        throughput: {
          tradesPerSecond,
          avgLatency,
          totalTrades: metrics.trades.length,
          tradingPeriod
        },
        performance: {
          buyTrades: metrics.trades.filter(t => t.type === 'buy').length,
          sellTrades: metrics.trades.filter(t => t.type === 'sell').length,
          avgTradeAmount: metrics.trades.reduce((sum, t) => sum + t.amount, 0) / metrics.trades.length
        }
      }
    };

    expect(testMetrics.trading.throughput.tradesPerSecond).toBeGreaterThan(0);
    expect(testMetrics.performance.successRate).toBe(1);
    expect(testMetrics.trading.throughput.avgLatency).toBeLessThan(1000);
  });

  it('should validate trading metrics accuracy', async () => {
    const metrics = {
      trades: [] as { type: string; amount: number; timestamp: number; price: number }[],
      snapshots: [] as { timestamp: number; metrics: any }[]
    };

    const mockTradingData = [
      {
        id: 'bot-123',
        status: 'active',
        metrics: {
          total_volume: 1000,
          profit_loss: 0.5,
          active_positions: 2,
          trades: [
            { type: 'buy', amount: 0.1, price: 100, timestamp: Date.now() - 3000 },
            { type: 'sell', amount: 0.1, price: 105, timestamp: Date.now() - 2000 }
          ]
        }
      },
      {
        id: 'bot-123',
        status: 'active',
        metrics: {
          total_volume: 1200,
          profit_loss: 0.7,
          active_positions: 3,
          trades: [
            { type: 'buy', amount: 0.2, price: 102, timestamp: Date.now() - 1000 }
          ]
        }
      }
    ];

    let updateCount = 0;
    (getBotStatus as jest.Mock).mockImplementation(() => {
      const data = mockTradingData[updateCount++];
      metrics.snapshots.push({
        timestamp: Date.now(),
        metrics: { ...data.metrics }
      });
      metrics.trades.push(...data.metrics.trades);
      return Promise.resolve(data);
    });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(metrics.snapshots.length).toBe(2);
    });

    const calculateMetrics = (trades: any[]) => {
      const buyTrades = trades.filter(t => t.type === 'buy');
      const sellTrades = trades.filter(t => t.type === 'sell');
      
      const totalBuyVolume = buyTrades.reduce((sum, t) => sum + (t.amount * t.price), 0);
      const totalSellVolume = sellTrades.reduce((sum, t) => sum + (t.amount * t.price), 0);
      
      const avgBuyPrice = buyTrades.length > 0 
        ? buyTrades.reduce((sum, t) => sum + t.price, 0) / buyTrades.length 
        : 0;
      
      const avgSellPrice = sellTrades.length > 0
        ? sellTrades.reduce((sum, t) => sum + t.price, 0) / sellTrades.length
        : 0;

      return {
        totalVolume: totalBuyVolume + totalSellVolume,
        profitLoss: totalSellVolume - totalBuyVolume,
        avgBuyPrice,
        avgSellPrice,
        tradeCount: trades.length
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
        volumeAccuracy: Math.abs(calculatedMetrics.totalVolume - lastSnapshot.total_volume) / lastSnapshot.total_volume,
        profitLossAccuracy: Math.abs(calculatedMetrics.profitLoss - lastSnapshot.profit_loss) / lastSnapshot.profit_loss,
        tradeCountAccuracy: calculatedMetrics.tradeCount === metrics.trades.length
      }
    };

    expect(testMetrics.validation.volumeAccuracy).toBeLessThan(0.01);
    expect(testMetrics.validation.profitLossAccuracy).toBeLessThan(0.01);
    expect(testMetrics.validation.tradeCountAccuracy).toBe(true);
  });
});
