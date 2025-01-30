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

describe('Workflow Metrics Integration', () => {
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
        active_positions: 2
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

  it('should track metrics across complete workflow', async () => {
    const startTime = Date.now();
    const metrics = {
      steps: [] as string[],
      latencies: [] as number[],
      errors: 0,
      successes: 0
    };

    // Step 1: Agent Selection
    const { rerender } = render(
      <TestContext>
        <AgentSelection />
      </TestContext>
    );

    const stepStart = Date.now();
    const agentButton = screen.getByRole('button', { name: /trading agent/i });
    fireEvent.click(agentButton);
    metrics.latencies.push(Date.now() - stepStart);
    metrics.steps.push('agent-selection');
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
    metrics.latencies.push(Date.now() - strategyStart);
    metrics.steps.push('strategy-creation');
    metrics.successes++;

    await waitFor(() => {
      expect(createBot).toHaveBeenCalledWith('trading', 'Test Strategy');
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
    });
    metrics.latencies.push(Date.now() - botStart);
    metrics.steps.push('bot-integration');
    metrics.successes++;

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
    });
    metrics.latencies.push(Date.now() - walletStart);
    metrics.steps.push('key-management');
    metrics.successes++;

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
    });
    metrics.latencies.push(Date.now() - dashboardStart);
    metrics.steps.push('trading-dashboard');
    metrics.successes++;

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
    });
    metrics.latencies.push(Date.now() - comparisonStart);
    metrics.steps.push('wallet-comparison');
    metrics.successes++;

    const avgLatency = metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length;

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
        completedSteps: metrics.steps.length,
        avgStepLatency: avgLatency,
        maxStepLatency: Math.max(...metrics.latencies),
        minStepLatency: Math.min(...metrics.latencies),
        totalDuration: Date.now() - startTime
      }
    };

    expect(testMetrics.workflow.completedSteps).toBe(6);
    expect(testMetrics.performance.successRate).toBe(1);
    expect(testMetrics.workflow.avgStepLatency).toBeLessThan(1000);
  });

  it('should track error metrics during workflow interruptions', async () => {
    const startTime = Date.now();
    const metrics = {
      completedSteps: 0,
      errors: 0,
      recoveries: 0,
      latencies: [] as number[]
    };

    (getBotStatus as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

    render(
      <TestContext>
        <BotIntegration />
      </TestContext>
    );

    const errorStart = Date.now();
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
      metrics.errors++;
      metrics.latencies.push(Date.now() - errorStart);
    });

    const retryButton = screen.getByRole('button', { name: /retry/i });
    const retryStart = Date.now();
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText(/bot active/i)).toBeInTheDocument();
      metrics.recoveries++;
      metrics.completedSteps++;
      metrics.latencies.push(Date.now() - retryStart);
    });

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / (metrics.errors + metrics.recoveries),
        apiLatency: metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length,
        systemHealth: metrics.recoveries / (metrics.errors + metrics.recoveries),
        successRate: metrics.completedSteps / (metrics.errors + metrics.recoveries),
        totalTrades: 0,
        walletBalance: 0
      },
      errorHandling: {
        totalErrors: metrics.errors,
        successfulRecoveries: metrics.recoveries,
        avgRecoveryTime: metrics.latencies[1] - metrics.latencies[0],
        errorRate: metrics.errors / (metrics.errors + metrics.recoveries)
      }
    };

    expect(testMetrics.errorHandling.successfulRecoveries).toBe(1);
    expect(testMetrics.performance.systemHealth).toBeGreaterThan(0);
  });

  it('should validate performance metrics across workflow transitions', async () => {
    const metrics = {
      transitions: [] as { from: string; to: string; latency: number }[],
      errors: 0,
      successes: 0
    };

    const { rerender } = render(
      <TestContext>
        <AgentSelection />
      </TestContext>
    );

    // Track transition: Agent Selection -> Strategy Creation
    const transitionStart = Date.now();
    const agentButton = screen.getByRole('button', { name: /trading agent/i });
    fireEvent.click(agentButton);

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/strategy-creation');
      metrics.transitions.push({
        from: 'agent-selection',
        to: 'strategy-creation',
        latency: Date.now() - transitionStart
      });
      metrics.successes++;
    });

    rerender(
      <TestContext>
        <StrategyCreation />
      </TestContext>
    );

    // Track transition: Strategy Creation -> Bot Integration
    const strategyStart = Date.now();
    const strategyInput = screen.getByRole('textbox', { name: /strategy/i });
    fireEvent.change(strategyInput, { target: { value: 'Test Strategy' } });
    const createButton = screen.getByRole('button', { name: /create strategy/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(createBot).toHaveBeenCalled();
      metrics.transitions.push({
        from: 'strategy-creation',
        to: 'bot-integration',
        latency: Date.now() - strategyStart
      });
      metrics.successes++;
    });

    const avgTransitionLatency = metrics.transitions.reduce((sum, t) => sum + t.latency, 0) / metrics.transitions.length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / (metrics.errors + metrics.successes),
        apiLatency: avgTransitionLatency,
        systemHealth: metrics.successes / (metrics.errors + metrics.successes),
        successRate: metrics.successes / (metrics.errors + metrics.successes),
        totalTrades: 0,
        walletBalance: 0
      },
      transitions: {
        count: metrics.transitions.length,
        avgLatency: avgTransitionLatency,
        maxLatency: Math.max(...metrics.transitions.map(t => t.latency)),
        minLatency: Math.min(...metrics.transitions.map(t => t.latency))
      }
    };

    expect(testMetrics.transitions.count).toBe(2);
    expect(testMetrics.performance.successRate).toBe(1);
    expect(testMetrics.transitions.avgLatency).toBeLessThan(1000);
  });
});
