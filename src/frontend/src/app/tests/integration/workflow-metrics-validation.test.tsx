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

describe('Workflow Metrics Validation', () => {
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

  it('should track metrics during complete workflow execution', async () => {
    const metrics = {
      steps: [] as { step: string; latency: number; success: boolean }[],
      errors: 0,
      successes: 0,
      transitions: [] as { from: string; to: string; timestamp: number }[]
    };

    const trackStep = async (step: string, action: () => Promise<any>) => {
      const startTime = Date.now();
      try {
        const result = await action();
        metrics.steps.push({
          step,
          latency: Date.now() - startTime,
          success: true
        });
        metrics.successes++;
        return result;
      } catch (error) {
        metrics.steps.push({
          step,
          latency: Date.now() - startTime,
          success: false
        });
        metrics.errors++;
        throw error;
      }
    };

    (createBot as jest.Mock).mockImplementation((type, strategy) =>
      trackStep('create_bot', () => Promise.resolve({
        id: 'bot-123',
        type,
        strategy
      }))
    );

    (createWallet as jest.Mock).mockImplementation((botId) =>
      trackStep('create_wallet', () => Promise.resolve({
        address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
        balance: 1.5,
        bot_id: botId
      }))
    );

    (getBotStatus as jest.Mock).mockImplementation((botId) =>
      trackStep('get_bot_status', () => Promise.resolve({
        id: botId,
        status: 'active',
        metrics: {
          performance: {
            cpu_usage: 45,
            memory_usage: 60,
            latency: 150
          }
        }
      }))
    );

    // Step 1: Agent Selection
    render(
      <TestContext>
        <AgentSelection />
      </TestContext>
    );

    const agentButton = screen.getByRole('button', { name: /trading agent/i });
    fireEvent.click(agentButton);
    metrics.transitions.push({
      from: 'agent_selection',
      to: 'strategy_creation',
      timestamp: Date.now()
    });

    // Step 2: Strategy Creation
    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/strategy-creation');
    });

    render(
      <TestContext>
        <StrategyCreation />
      </TestContext>
    );

    const strategyInput = screen.getByRole('textbox', { name: /strategy/i });
    fireEvent.change(strategyInput, { target: { value: 'Test Strategy' } });
    const createButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(createButton);
    metrics.transitions.push({
      from: 'strategy_creation',
      to: 'bot_integration',
      timestamp: Date.now()
    });

    // Continue through remaining steps...
    const avgLatency = metrics.steps.reduce((sum, step) => sum + step.latency, 0) / metrics.steps.length;
    const transitionTimes = metrics.transitions.map((t, i, arr) => 
      i > 0 ? t.timestamp - arr[i-1].timestamp : 0
    ).slice(1);
    const avgTransitionTime = transitionTimes.reduce((a, b) => a + b, 0) / transitionTimes.length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / (metrics.errors + metrics.successes),
        apiLatency: avgLatency,
        systemHealth: metrics.successes / (metrics.errors + metrics.successes),
        successRate: metrics.successes / (metrics.errors + metrics.successes),
        totalTrades: 0,
        walletBalance: 1.5
      },
      workflow: {
        steps: metrics.steps.length,
        transitions: metrics.transitions.length,
        avgStepLatency: avgLatency,
        avgTransitionTime,
        completionRate: metrics.steps.filter(s => s.success).length / metrics.steps.length
      }
    };

    expect(testMetrics.workflow.steps).toBeGreaterThan(0);
    expect(testMetrics.performance.successRate).toBe(1);
    expect(testMetrics.workflow.completionRate).toBe(1);
  });

  it('should validate metrics during workflow error recovery', async () => {
    const metrics = {
      errors: [] as { step: string; error: any; timestamp: number }[],
      recoveries: [] as { step: string; timestamp: number }[],
      attempts: 0
    };

    const mockFailures = {
      create_bot: new Error('Strategy Creation Failed'),
      create_wallet: new Error('Wallet Creation Failed'),
      get_bot_status: new Error('Status Check Failed')
    };

    let failedSteps = new Set(['create_bot', 'create_wallet', 'get_bot_status']);

    const attemptOperation = async (step: string, operation: () => Promise<any>) => {
      metrics.attempts++;
      try {
        if (failedSteps.has(step)) {
          metrics.errors.push({
            step,
            error: mockFailures[step],
            timestamp: Date.now()
          });
          failedSteps.delete(step);
          throw mockFailures[step];
        }
        const result = await operation();
        metrics.recoveries.push({
          step,
          timestamp: Date.now()
        });
        return result;
      } catch (error) {
        throw error;
      }
    };

    (createBot as jest.Mock).mockImplementation((type, strategy) =>
      attemptOperation('create_bot', () => Promise.resolve({
        id: 'bot-123',
        type,
        strategy
      }))
    );

    (createWallet as jest.Mock).mockImplementation((botId) =>
      attemptOperation('create_wallet', () => Promise.resolve({
        address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
        balance: 1.5,
        bot_id: botId
      }))
    );

    (getBotStatus as jest.Mock).mockImplementation((botId) =>
      attemptOperation('get_bot_status', () => Promise.resolve({
        id: botId,
        status: 'active',
        metrics: {
          performance: {
            cpu_usage: 45,
            memory_usage: 60,
            latency: 150
          }
        }
      }))
    );

    render(
      <TestContext>
        <StrategyCreation />
      </TestContext>
    );

    // Initial failures
    const strategyInput = screen.getByRole('textbox', { name: /strategy/i });
    fireEvent.change(strategyInput, { target: { value: 'Test Strategy' } });
    const createButton = screen.getByRole('button', { name: /create/i });

    // Retry until success
    while (failedSteps.size > 0) {
      fireEvent.click(createButton);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors.length / metrics.attempts,
        apiLatency: 0,
        systemHealth: metrics.recoveries.length / metrics.errors.length,
        successRate: metrics.recoveries.length / metrics.attempts,
        totalTrades: 0,
        walletBalance: 1.5
      },
      recovery: {
        totalErrors: metrics.errors.length,
        recoveredErrors: metrics.recoveries.length,
        errorTypes: new Set(metrics.errors.map(e => e.step)).size,
        avgRecoveryTime: metrics.recoveries.length > 0 
          ? (metrics.recoveries[metrics.recoveries.length - 1].timestamp - 
             metrics.errors[0].timestamp) / metrics.recoveries.length
          : 0
      }
    };

    expect(testMetrics.recovery.totalErrors).toBeGreaterThan(0);
    expect(testMetrics.recovery.recoveredErrors).toBe(testMetrics.recovery.totalErrors);
    expect(testMetrics.performance.systemHealth).toBeGreaterThan(0);
  });

  it('should validate metrics during concurrent workflow operations', async () => {
    const metrics = {
      operations: [] as { type: string; latency: number; success: boolean }[],
      errors: 0,
      successes: 0
    };

    const executeOperation = async (operation: () => Promise<any>, type: string) => {
      const startTime = Date.now();
      try {
        const result = await operation();
        metrics.operations.push({
          type,
          latency: Date.now() - startTime,
          success: true
        });
        metrics.successes++;
        return result;
      } catch (error) {
        metrics.operations.push({
          type,
          latency: Date.now() - startTime,
          success: false
        });
        metrics.errors++;
        throw error;
      }
    };

    const concurrentOperations = [
      executeOperation(() => createBot('trading', 'Strategy 1'), 'create_bot_1'),
      executeOperation(() => createBot('trading', 'Strategy 2'), 'create_bot_2'),
      executeOperation(() => createWallet('bot-123'), 'create_wallet_1'),
      executeOperation(() => createWallet('bot-456'), 'create_wallet_2')
    ];

    await Promise.allSettled(concurrentOperations);

    const avgLatency = metrics.operations.reduce((sum, op) => sum + op.latency, 0) / metrics.operations.length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / metrics.operations.length,
        apiLatency: avgLatency,
        systemHealth: metrics.successes / metrics.operations.length,
        successRate: metrics.successes / metrics.operations.length,
        totalTrades: 0,
        walletBalance: 0
      },
      concurrent: {
        operations: metrics.operations.length,
        successfulOperations: metrics.successes,
        avgOperationLatency: avgLatency,
        maxConcurrency: concurrentOperations.length,
        operationTypes: new Set(metrics.operations.map(op => op.type)).size
      }
    };

    expect(testMetrics.concurrent.operations).toBe(concurrentOperations.length);
    expect(testMetrics.performance.successRate).toBeGreaterThan(0);
    expect(testMetrics.concurrent.avgOperationLatency).toBeLessThan(1000);
  });
});
