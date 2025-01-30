import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import { useDebugStore } from '@/app/stores/debugStore';
import { TestMetrics } from '../types/test.types';
import BotIntegration from '@/app/bot-integration/page';
import TradingDashboard from '@/app/trading-dashboard/page';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/api/client');
jest.mock('@/app/stores/debugStore');

describe('Bot Workflow Metrics Integration', () => {
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

  it('should track bot creation and integration metrics', async () => {
    const metrics = {
      creation: [] as { timestamp: number; metrics: any }[],
      integration: [] as { timestamp: number; metrics: any }[],
      operations: [] as { type: string; duration: number; success: boolean }[]
    };

    const trackOperation = async (type: string, operation: () => Promise<any>) => {
      const startTime = Date.now();
      try {
        const result = await operation();
        metrics.operations.push({
          type,
          duration: Date.now() - startTime,
          success: true
        });
        return result;
      } catch (error) {
        metrics.operations.push({
          type,
          duration: Date.now() - startTime,
          success: false
        });
        throw error;
      }
    };

    const mockBotData = {
      id: 'bot-123',
      type: 'trading',
      strategy: 'momentum',
      status: 'active',
      metrics: {
        performance: {
          trades: 10,
          success_rate: 0.8,
          avg_return: 0.05
        },
        system: {
          cpu_usage: 45,
          memory_usage: 60,
          latency: 150
        }
      }
    };

    (createBot as jest.Mock).mockImplementation((type, strategy) =>
      trackOperation('create_bot', () => {
        metrics.creation.push({
          timestamp: Date.now(),
          metrics: { type, strategy }
        });
        return Promise.resolve(mockBotData);
      })
    );

    (getBotStatus as jest.Mock).mockImplementation((botId) =>
      trackOperation('get_bot_status', () => {
        metrics.integration.push({
          timestamp: Date.now(),
          metrics: mockBotData.metrics
        });
        return Promise.resolve(mockBotData);
      })
    );

    render(
      <TestContext>
        <BotIntegration />
      </TestContext>
    );

    const integrateButton = screen.getByRole('button', { name: /integrate/i });
    await trackOperation('bot_integration', async () => {
      fireEvent.click(integrateButton);
      await waitFor(() => {
        expect(getBotStatus).toHaveBeenCalled();
      });
    });

    const avgOperationDuration = metrics.operations.reduce((sum, op) => sum + op.duration, 0) / metrics.operations.length;
    const successfulOps = metrics.operations.filter(op => op.success).length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: (metrics.operations.length - successfulOps) / metrics.operations.length,
        apiLatency: avgOperationDuration,
        systemHealth: successfulOps / metrics.operations.length,
        successRate: mockBotData.metrics.performance.success_rate,
        totalTrades: mockBotData.metrics.performance.trades,
        walletBalance: 0
      },
      bot: {
        operations: metrics.operations.length,
        creationTime: metrics.creation[0]?.timestamp,
        integrationTime: metrics.integration[0]?.timestamp,
        performance: mockBotData.metrics.performance,
        system: mockBotData.metrics.system
      }
    };

    expect(testMetrics.bot.operations).toBeGreaterThan(0);
    expect(testMetrics.performance.successRate).toBeGreaterThan(0.7);
    expect(testMetrics.bot.system.cpu_usage).toBeLessThan(80);
  });

  it('should track bot performance metrics during trading', async () => {
    const metrics = {
      performance: [] as { timestamp: number; metrics: any }[],
      trades: [] as { type: string; result: any; timestamp: number }[]
    };

    const mockTradingMetrics = [
      {
        performance: {
          trades: 12,
          success_rate: 0.83,
          avg_return: 0.06,
          drawdown: 0.02,
          sharpe_ratio: 1.5
        },
        system: {
          cpu_usage: 50,
          memory_usage: 65,
          latency: 160
        }
      },
      {
        performance: {
          trades: 15,
          success_rate: 0.85,
          avg_return: 0.055,
          drawdown: 0.018,
          sharpe_ratio: 1.6
        },
        system: {
          cpu_usage: 55,
          memory_usage: 70,
          latency: 170
        }
      }
    ];

    let metricsIndex = 0;
    (getBotStatus as jest.Mock).mockImplementation((botId) => {
      const data = mockTradingMetrics[metricsIndex++ % mockTradingMetrics.length];
      metrics.performance.push({
        timestamp: Date.now(),
        metrics: data
      });
      return Promise.resolve({
        id: botId,
        status: 'active',
        metrics: data
      });
    });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    for (const tradingMetric of mockTradingMetrics) {
      await waitFor(() => {
        expect(screen.getByText(new RegExp(`${(tradingMetric.performance.success_rate * 100).toFixed(0)}%`))).toBeInTheDocument();
        metrics.trades.push({
          type: 'trade_execution',
          result: tradingMetric.performance,
          timestamp: Date.now()
        });
      });
    }

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: 0,
        apiLatency: metrics.performance.reduce((sum, p) => sum + p.metrics.system.latency, 0) / metrics.performance.length,
        systemHealth: 1,
        successRate: metrics.performance[metrics.performance.length - 1].metrics.performance.success_rate,
        totalTrades: metrics.performance[metrics.performance.length - 1].metrics.performance.trades,
        walletBalance: 0
      },
      trading: {
        measurements: metrics.performance.length,
        trades: metrics.trades.length,
        performance: {
          avgSuccessRate: metrics.performance.reduce((sum, p) => sum + p.metrics.performance.success_rate, 0) / metrics.performance.length,
          avgReturn: metrics.performance.reduce((sum, p) => sum + p.metrics.performance.avg_return, 0) / metrics.performance.length,
          sharpeRatio: metrics.performance[metrics.performance.length - 1].metrics.performance.sharpe_ratio
        },
        system: {
          avgCpuUsage: metrics.performance.reduce((sum, p) => sum + p.metrics.system.cpu_usage, 0) / metrics.performance.length,
          avgMemoryUsage: metrics.performance.reduce((sum, p) => sum + p.metrics.system.memory_usage, 0) / metrics.performance.length,
          avgLatency: metrics.performance.reduce((sum, p) => sum + p.metrics.system.latency, 0) / metrics.performance.length
        }
      }
    };

    expect(testMetrics.trading.measurements).toBe(mockTradingMetrics.length);
    expect(testMetrics.trading.performance.avgSuccessRate).toBeGreaterThan(0.8);
    expect(testMetrics.trading.system.avgCpuUsage).toBeLessThan(60);
  });

  it('should validate bot metrics consistency during operation', async () => {
    const metrics = {
      samples: [] as { timestamp: number; metrics: any }[],
      validations: {
        success: 0,
        failure: 0
      }
    };

    const validateMetrics = (data: any) => {
      try {
        expect(data.performance.trades).toBeGreaterThanOrEqual(0);
        expect(data.performance.success_rate).toBeGreaterThanOrEqual(0);
        expect(data.performance.success_rate).toBeLessThanOrEqual(1);
        expect(data.system.cpu_usage).toBeGreaterThanOrEqual(0);
        expect(data.system.cpu_usage).toBeLessThanOrEqual(100);
        expect(data.system.memory_usage).toBeGreaterThanOrEqual(0);
        expect(data.system.memory_usage).toBeLessThanOrEqual(100);
        metrics.validations.success++;
        return true;
      } catch (error) {
        metrics.validations.failure++;
        return false;
      }
    };

    const mockBotMetrics = {
      performance: {
        trades: 20 + Math.floor(Math.random() * 5),
        success_rate: 0.85 + Math.random() * 0.1,
        avg_return: 0.06 + Math.random() * 0.02,
        drawdown: 0.02 + Math.random() * 0.01,
        sharpe_ratio: 1.5 + Math.random() * 0.3
      },
      system: {
        cpu_usage: 45 + Math.random() * 10,
        memory_usage: 60 + Math.random() * 10,
        latency: 150 + Math.random() * 20
      }
    };

    (getBotStatus as jest.Mock).mockImplementation((botId) => {
      metrics.samples.push({
        timestamp: Date.now(),
        metrics: mockBotMetrics
      });

      validateMetrics(mockBotMetrics);
      return Promise.resolve({
        id: botId,
        status: 'active',
        metrics: mockBotMetrics
      });
    });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(metrics.samples.length).toBeGreaterThan(0);
    });

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.validations.failure / (metrics.validations.success + metrics.validations.failure),
        apiLatency: metrics.samples.reduce((sum, s) => sum + s.metrics.system.latency, 0) / metrics.samples.length,
        systemHealth: metrics.validations.success / (metrics.validations.success + metrics.validations.failure),
        successRate: mockBotMetrics.performance.success_rate,
        totalTrades: mockBotMetrics.performance.trades,
        walletBalance: 0
      },
      validation: {
        samples: metrics.samples.length,
        validationRate: metrics.validations.success / (metrics.validations.success + metrics.validations.failure),
        metricsRanges: {
          performance: {
            successRate: {
              min: Math.min(...metrics.samples.map(s => s.metrics.performance.success_rate)),
              max: Math.max(...metrics.samples.map(s => s.metrics.performance.success_rate))
            },
            sharpeRatio: {
              min: Math.min(...metrics.samples.map(s => s.metrics.performance.sharpe_ratio)),
              max: Math.max(...metrics.samples.map(s => s.metrics.performance.sharpe_ratio))
            }
          },
          system: {
            cpuUsage: {
              min: Math.min(...metrics.samples.map(s => s.metrics.system.cpu_usage)),
              max: Math.max(...metrics.samples.map(s => s.metrics.system.cpu_usage))
            },
            memoryUsage: {
              min: Math.min(...metrics.samples.map(s => s.metrics.system.memory_usage)),
              max: Math.max(...metrics.samples.map(s => s.metrics.system.memory_usage))
            }
          }
        }
      }
    };

    expect(testMetrics.validation.samples).toBeGreaterThan(0);
    expect(testMetrics.validation.validationRate).toBe(1);
    expect(testMetrics.validation.metricsRanges.performance.successRate.max).toBeLessThanOrEqual(1);
    expect(testMetrics.validation.metricsRanges.system.cpuUsage.max).toBeLessThanOrEqual(100);
  });
});
