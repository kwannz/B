import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import { useDebugStore } from '@/app/stores/debugStore';
import { TestMetrics } from '../types/test.types';
import AgentSelection from '@/app/agent-selection/page';
import StrategyCreation from '@/app/strategy-creation/page';
import BotIntegration from '@/app/bot-integration/page';
import KeyManagement from '@/app/key-management/page';
import TradingDashboard from '@/app/trading-dashboard/page';
import WalletComparison from '@/app/wallet-comparison/page';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/api/client');
jest.mock('@/app/stores/debugStore');

describe('Performance Metrics Integration', () => {
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
    (getBotStatus as jest.Mock).mockResolvedValue({
      id: 'bot-123',
      status: 'active',
      metrics: {
        total_volume: 1000,
        profit_loss: 0.5,
        active_positions: 2,
        performance: {
          latency: 150,
          success_rate: 0.95,
          error_rate: 0.05
        }
      }
    });
    (createBot as jest.Mock).mockResolvedValue({
      id: 'bot-123',
      type: 'trading',
      strategy: 'Test Strategy'
    });
    (createWallet as jest.Mock).mockResolvedValue({
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      balance: 1.5,
      bot_id: 'bot-123'
    });
    (getWallet as jest.Mock).mockResolvedValue({
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      balance: 1.5,
      bot_id: 'bot-123'
    });
  });

  it('should track performance metrics across complete workflow', async () => {
    const startTime = Date.now();
    const metrics = {
      steps: [] as { name: string; latency: number; success: boolean }[],
      errors: 0,
      successes: 0
    };

    // Step 1: Agent Selection
    const { rerender } = render(
      <TestContext>
        <AgentSelection />
      </TestContext>
    );

    const agentStart = Date.now();
    const agentButton = screen.getByRole('button', { name: /trading agent/i });
    fireEvent.click(agentButton);
    metrics.steps.push({
      name: 'agent-selection',
      latency: Date.now() - agentStart,
      success: true
    });
    metrics.successes++;

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/strategy-creation');
    });

    // Step 2: Strategy Creation
    rerender(
      <TestContext>
        <StrategyCreation />
      </TestContext>
    );

    const strategyStart = Date.now();
    const strategyInput = screen.getByRole('textbox', { name: /strategy/i });
    fireEvent.change(strategyInput, { target: { value: 'Test Strategy' } });
    const createButton = screen.getByRole('button', { name: /create strategy/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(createBot).toHaveBeenCalledWith('trading', 'Test Strategy');
      metrics.steps.push({
        name: 'strategy-creation',
        latency: Date.now() - strategyStart,
        success: true
      });
      metrics.successes++;
    });

    // Step 3: Bot Integration
    rerender(
      <TestContext>
        <BotIntegration />
      </TestContext>
    );

    const botStart = Date.now();
    await waitFor(() => {
      expect(getBotStatus).toHaveBeenCalled();
      expect(screen.getByText(/bot active/i)).toBeInTheDocument();
      metrics.steps.push({
        name: 'bot-integration',
        latency: Date.now() - botStart,
        success: true
      });
      metrics.successes++;
    });

    // Step 4: Key Management
    rerender(
      <TestContext>
        <KeyManagement />
      </TestContext>
    );

    const walletStart = Date.now();
    const createWalletButton = screen.getByRole('button', { name: /create wallet/i });
    fireEvent.click(createWalletButton);

    await waitFor(() => {
      expect(createWallet).toHaveBeenCalled();
      expect(screen.getByText(/5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK/)).toBeInTheDocument();
      metrics.steps.push({
        name: 'key-management',
        latency: Date.now() - walletStart,
        success: true
      });
      metrics.successes++;
    });

    // Step 5: Trading Dashboard
    rerender(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    const dashboardStart = Date.now();
    await waitFor(() => {
      expect(screen.getByText(/total volume/i)).toBeInTheDocument();
      expect(screen.getByText(/1000/)).toBeInTheDocument();
      metrics.steps.push({
        name: 'trading-dashboard',
        latency: Date.now() - dashboardStart,
        success: true
      });
      metrics.successes++;
    });

    // Step 6: Wallet Comparison
    rerender(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    const comparisonStart = Date.now();
    await waitFor(() => {
      expect(getWallet).toHaveBeenCalled();
      expect(screen.getByText(/1.5 SOL/)).toBeInTheDocument();
      metrics.steps.push({
        name: 'wallet-comparison',
        latency: Date.now() - comparisonStart,
        success: true
      });
      metrics.successes++;
    });

    const avgLatency = metrics.steps.reduce((sum, step) => sum + step.latency, 0) / metrics.steps.length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / metrics.steps.length,
        apiLatency: avgLatency,
        systemHealth: metrics.successes / metrics.steps.length,
        successRate: metrics.successes / metrics.steps.length,
        totalTrades: 0,
        walletBalance: 1.5
      },
      workflow: {
        steps: metrics.steps.length,
        avgStepLatency: avgLatency,
        maxStepLatency: Math.max(...metrics.steps.map(s => s.latency)),
        minStepLatency: Math.min(...metrics.steps.map(s => s.latency)),
        totalDuration: Date.now() - startTime,
        stepMetrics: metrics.steps
      }
    };

    expect(testMetrics.workflow.steps).toBe(6);
    expect(testMetrics.performance.successRate).toBe(1);
    expect(testMetrics.workflow.avgStepLatency).toBeLessThan(1000);
    expect(testMetrics.performance.systemHealth).toBe(1);
  });

  it('should validate performance under concurrent operations', async () => {
    const startTime = Date.now();
    const metrics = {
      operations: [] as { type: string; latency: number; success: boolean }[],
      errors: 0,
      successes: 0
    };

    const concurrentOps = [
      { component: BotIntegration, name: 'bot-integration' },
      { component: KeyManagement, name: 'key-management' },
      { component: TradingDashboard, name: 'trading-dashboard' }
    ];

    await Promise.all(concurrentOps.map(async ({ component: Component, name }) => {
      const opStart = Date.now();
      render(
        <TestContext>
          <Component />
        </TestContext>
      );

      try {
        await waitFor(() => {
          expect(screen.getByText(/active|1.5 SOL|total volume/i)).toBeInTheDocument();
        });
        metrics.operations.push({
          type: name,
          latency: Date.now() - opStart,
          success: true
        });
        metrics.successes++;
      } catch (error) {
        metrics.operations.push({
          type: name,
          latency: Date.now() - opStart,
          success: false
        });
        metrics.errors++;
      }
    }));

    const avgLatency = metrics.operations.reduce((sum, op) => sum + op.latency, 0) / metrics.operations.length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / metrics.operations.length,
        apiLatency: avgLatency,
        systemHealth: metrics.successes / metrics.operations.length,
        successRate: metrics.successes / metrics.operations.length,
        totalTrades: 0,
        walletBalance: 1.5
      },
      concurrency: {
        operations: metrics.operations.length,
        avgLatency,
        maxLatency: Math.max(...metrics.operations.map(op => op.latency)),
        minLatency: Math.min(...metrics.operations.map(op => op.latency)),
        throughput: metrics.operations.length / ((Date.now() - startTime) / 1000)
      }
    };

    expect(testMetrics.concurrency.operations).toBe(3);
    expect(testMetrics.performance.successRate).toBeGreaterThan(0.8);
    expect(testMetrics.concurrency.avgLatency).toBeLessThan(2000);
    expect(testMetrics.concurrency.throughput).toBeGreaterThan(1);
  });

  it('should track performance impact of component updates', async () => {
    const metrics = {
      updates: [] as { component: string; latency: number }[],
      totalUpdates: 0
    };

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    // Track multiple status updates
    for (let i = 0; i < 3; i++) {
      const updateStart = Date.now();
      (getBotStatus as jest.Mock).mockResolvedValueOnce({
        id: 'bot-123',
        status: 'active',
        metrics: {
          total_volume: 1000 + (i * 100),
          profit_loss: 0.5 + (i * 0.1),
          active_positions: 2 + i
        }
      });

      await waitFor(() => {
        expect(screen.getByText(new RegExp(`${1000 + (i * 100)}`))).toBeInTheDocument();
        metrics.updates.push({
          component: 'trading-dashboard',
          latency: Date.now() - updateStart
        });
        metrics.totalUpdates++;
      });

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const avgUpdateLatency = metrics.updates.reduce((sum, update) => sum + update.latency, 0) / metrics.updates.length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: 0,
        apiLatency: avgUpdateLatency,
        systemHealth: 1,
        successRate: 1,
        totalTrades: 0,
        walletBalance: 1.5
      },
      updates: {
        count: metrics.totalUpdates,
        avgLatency: avgUpdateLatency,
        maxLatency: Math.max(...metrics.updates.map(u => u.latency)),
        minLatency: Math.min(...metrics.updates.map(u => u.latency))
      }
    };

    expect(testMetrics.updates.count).toBe(3);
    expect(testMetrics.updates.avgLatency).toBeLessThan(1000);
    expect(testMetrics.performance.systemHealth).toBe(1);
  });
});
