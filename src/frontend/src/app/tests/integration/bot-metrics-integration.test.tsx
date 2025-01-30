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

describe('Bot Metrics Integration', () => {
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

  it('should track bot performance metrics during operation', async () => {
    const metrics = {
      operations: [] as { type: string; latency: number; success: boolean }[],
      errors: 0,
      successes: 0
    };

    const mockBotResponses = [
      {
        id: 'bot-123',
        status: 'initializing',
        metrics: {
          performance: {
            cpu_usage: 30,
            memory_usage: 40,
            latency: 100
          }
        }
      },
      {
        id: 'bot-123',
        status: 'active',
        metrics: {
          performance: {
            cpu_usage: 45,
            memory_usage: 55,
            latency: 150,
            trades: [
              { type: 'buy', amount: 0.1, timestamp: Date.now() - 1000 }
            ]
          }
        }
      },
      {
        id: 'bot-123',
        status: 'active',
        metrics: {
          performance: {
            cpu_usage: 50,
            memory_usage: 60,
            latency: 120,
            trades: [
              { type: 'buy', amount: 0.1, timestamp: Date.now() - 1000 },
              { type: 'sell', amount: 0.1, timestamp: Date.now() - 500 }
            ]
          }
        }
      }
    ];

    let responseIndex = 0;
    (getBotStatus as jest.Mock).mockImplementation(() => {
      const startTime = Date.now();
      return Promise.resolve(mockBotResponses[responseIndex++])
        .then(result => {
          metrics.operations.push({
            type: 'status_check',
            latency: Date.now() - startTime,
            success: true
          });
          metrics.successes++;
          return result;
        })
        .catch(error => {
          metrics.errors++;
          metrics.operations.push({
            type: 'status_check',
            latency: Date.now() - startTime,
            success: false
          });
          throw error;
        });
    });

    render(
      <TestContext>
        <BotIntegration />
      </TestContext>
    );

    // Initial status
    await waitFor(() => {
      expect(screen.getByText(/initializing/i)).toBeInTheDocument();
    });

    // First update
    await waitFor(() => {
      expect(screen.getByText(/active/i)).toBeInTheDocument();
      expect(screen.getByText(/45%/)).toBeInTheDocument();
    });

    // Second update
    await waitFor(() => {
      expect(screen.getByText(/50%/)).toBeInTheDocument();
    });

    const avgLatency = metrics.operations.reduce((sum, op) => sum + op.latency, 0) / metrics.operations.length;
    const lastResponse = mockBotResponses[mockBotResponses.length - 1];

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / metrics.operations.length,
        apiLatency: avgLatency,
        systemHealth: metrics.successes / metrics.operations.length,
        successRate: metrics.successes / metrics.operations.length,
        totalTrades: lastResponse.metrics.performance.trades.length,
        walletBalance: 0
      },
      bot: {
        status: lastResponse.status,
        performance: {
          cpuUsage: lastResponse.metrics.performance.cpu_usage,
          memoryUsage: lastResponse.metrics.performance.memory_usage,
          latency: lastResponse.metrics.performance.latency
        },
        operations: metrics.operations.length
      }
    };

    expect(testMetrics.bot.operations).toBe(3);
    expect(testMetrics.performance.successRate).toBe(1);
    expect(testMetrics.bot.performance.cpuUsage).toBeLessThan(80);
  });

  it('should track bot metrics during high load operations', async () => {
    const metrics = {
      operations: [] as { timestamp: number; metrics: any }[],
      errors: 0,
      successes: 0
    };

    const generateMockResponse = (index: number) => ({
      id: 'bot-123',
      status: 'active',
      metrics: {
        performance: {
          cpu_usage: 45 + (index * 5),
          memory_usage: 55 + (index * 3),
          latency: 150 + (index * 10),
          operations_per_second: 10 + index,
          active_connections: 5 + index
        }
      }
    });

    const operationCount = 5;
    let currentOperation = 0;
    (getBotStatus as jest.Mock).mockImplementation(() => {
      const response = generateMockResponse(currentOperation++);
      metrics.operations.push({
        timestamp: Date.now(),
        metrics: response.metrics
      });
      return Promise.resolve(response);
    });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    for (let i = 0; i < operationCount; i++) {
      await waitFor(() => {
        const expectedCpu = 45 + (i * 5);
        expect(screen.getByText(new RegExp(`${expectedCpu}%`))).toBeInTheDocument();
      });
    }

    const avgCpuUsage = metrics.operations.reduce((sum, op) => sum + op.metrics.performance.cpu_usage, 0) / metrics.operations.length;
    const avgMemoryUsage = metrics.operations.reduce((sum, op) => sum + op.metrics.performance.memory_usage, 0) / metrics.operations.length;
    const avgLatency = metrics.operations.reduce((sum, op) => sum + op.metrics.performance.latency, 0) / metrics.operations.length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / operationCount,
        apiLatency: avgLatency,
        systemHealth: metrics.successes / operationCount,
        successRate: metrics.successes / operationCount,
        totalTrades: 0,
        walletBalance: 0
      },
      load: {
        avgCpuUsage,
        avgMemoryUsage,
        avgLatency,
        operationCount: metrics.operations.length,
        peakCpuUsage: Math.max(...metrics.operations.map(op => op.metrics.performance.cpu_usage)),
        peakMemoryUsage: Math.max(...metrics.operations.map(op => op.metrics.performance.memory_usage))
      }
    };

    expect(testMetrics.load.operationCount).toBe(operationCount);
    expect(testMetrics.load.peakCpuUsage).toBeLessThan(90);
    expect(testMetrics.load.avgLatency).toBeLessThan(200);
  });

  it('should validate bot metrics accuracy during state transitions', async () => {
    const metrics = {
      transitions: [] as { from: string; to: string; metrics: any }[],
      errors: 0,
      successes: 0
    };

    const mockTransitions = [
      {
        status: 'initializing',
        metrics: { cpu_usage: 30, memory_usage: 40, latency: 100 }
      },
      {
        status: 'configuring',
        metrics: { cpu_usage: 45, memory_usage: 50, latency: 120 }
      },
      {
        status: 'active',
        metrics: { cpu_usage: 55, memory_usage: 60, latency: 110 }
      }
    ];

    let transitionIndex = 0;
    (getBotStatus as jest.Mock).mockImplementation(() => {
      const current = mockTransitions[transitionIndex];
      const next = mockTransitions[transitionIndex + 1];
      
      if (next) {
        metrics.transitions.push({
          from: current.status,
          to: next.status,
          metrics: { current: current.metrics, next: next.metrics }
        });
      }
      
      transitionIndex = Math.min(transitionIndex + 1, mockTransitions.length - 1);
      return Promise.resolve({
        id: 'bot-123',
        status: current.status,
        metrics: {
          performance: current.metrics
        }
      });
    });

    render(
      <TestContext>
        <BotIntegration />
      </TestContext>
    );

    for (const transition of mockTransitions) {
      await waitFor(() => {
        expect(screen.getByText(new RegExp(transition.status, 'i'))).toBeInTheDocument();
        expect(screen.getByText(new RegExp(`${transition.metrics.cpu_usage}%`))).toBeInTheDocument();
      });
    }

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / mockTransitions.length,
        apiLatency: mockTransitions[mockTransitions.length - 1].metrics.latency,
        systemHealth: metrics.successes / mockTransitions.length,
        successRate: metrics.successes / mockTransitions.length,
        totalTrades: 0,
        walletBalance: 0
      },
      transitions: {
        count: metrics.transitions.length,
        states: metrics.transitions.map(t => ({ from: t.from, to: t.to })),
        metrics: metrics.transitions.map(t => ({
          cpuDelta: t.metrics.next.cpu_usage - t.metrics.current.cpu_usage,
          memoryDelta: t.metrics.next.memory_usage - t.metrics.current.memory_usage,
          latencyDelta: t.metrics.next.latency - t.metrics.current.latency
        }))
      }
    };

    expect(testMetrics.transitions.count).toBe(mockTransitions.length - 1);
    expect(testMetrics.performance.successRate).toBe(1);
    expect(testMetrics.transitions.states[testMetrics.transitions.count - 1].to).toBe('active');
  });
});
