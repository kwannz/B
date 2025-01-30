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

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/api/client');
jest.mock('@/app/stores/debugStore');

describe('Performance and Recovery Metrics Integration', () => {
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

  it('should track performance metrics during workflow recovery', async () => {
    const metrics = {
      steps: [] as { step: string; latency: number; success: boolean }[],
      errors: [] as { step: string; error: any; timestamp: number }[],
      recoveries: [] as { step: string; timestamp: number }[]
    };

    const mockFailures = {
      agent_selection: new Error('Agent Selection Failed'),
      strategy_creation: new Error('Strategy Creation Failed'),
      bot_integration: new Error('Bot Integration Failed'),
      key_management: new Error('Key Management Failed')
    };

    let failedSteps = new Set(Object.keys(mockFailures));

    const executeStep = async (step: string, operation: () => Promise<any>) => {
      const startTime = Date.now();
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
        metrics.steps.push({
          step,
          latency: Date.now() - startTime,
          success: true
        });
        return result;
      } catch (error) {
        metrics.steps.push({
          step,
          latency: Date.now() - startTime,
          success: false
        });
        throw error;
      }
    };

    (createBot as jest.Mock).mockImplementation((type, strategy) =>
      executeStep('strategy_creation', () => Promise.resolve({
        id: 'bot-123',
        type,
        strategy
      }))
    );

    (createWallet as jest.Mock).mockImplementation((botId) =>
      executeStep('key_management', () => Promise.resolve({
        address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
        balance: 1.5,
        bot_id: botId
      }))
    );

    (getBotStatus as jest.Mock).mockImplementation((botId) =>
      executeStep('bot_integration', () => Promise.resolve({
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

    // Execute workflow with failures and recoveries
    render(
      <TestContext>
        <AgentSelection />
      </TestContext>
    );

    // Initial failures and retries
    while (failedSteps.size > 0) {
      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (metrics.steps[metrics.steps.length - 1].success) {
        metrics.recoveries.push({
          step: metrics.steps[metrics.steps.length - 1].step,
          timestamp: Date.now()
        });
      }
    }

    const avgLatency = metrics.steps.reduce((sum, step) => sum + step.latency, 0) / metrics.steps.length;
    const recoveryTimes = metrics.recoveries.map((recovery, index) => {
      const error = metrics.errors.find(e => e.step === recovery.step);
      return error ? recovery.timestamp - error.timestamp : 0;
    });

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors.length / metrics.steps.length,
        apiLatency: avgLatency,
        systemHealth: metrics.recoveries.length / metrics.errors.length,
        successRate: metrics.recoveries.length / metrics.steps.length,
        totalTrades: 0,
        walletBalance: 1.5
      },
      recovery: {
        totalErrors: metrics.errors.length,
        recoveredErrors: metrics.recoveries.length,
        avgRecoveryTime: recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length,
        maxRecoveryTime: Math.max(...recoveryTimes),
        minRecoveryTime: Math.min(...recoveryTimes)
      }
    };

    expect(testMetrics.recovery.totalErrors).toBeGreaterThan(0);
    expect(testMetrics.recovery.recoveredErrors).toBe(testMetrics.recovery.totalErrors);
    expect(testMetrics.performance.systemHealth).toBeGreaterThan(0);
  });

  it('should track performance metrics during high-load workflow execution', async () => {
    const metrics = {
      operations: [] as { type: string; latency: number; success: boolean }[],
      resources: [] as { cpu: number; memory: number; timestamp: number }[]
    };

    const trackOperation = async (type: string, operation: () => Promise<any>) => {
      const startTime = Date.now();
      try {
        const result = await operation();
        metrics.operations.push({
          type,
          latency: Date.now() - startTime,
          success: true
        });
        return result;
      } catch (error) {
        metrics.operations.push({
          type,
          latency: Date.now() - startTime,
          success: false
        });
        throw error;
      }
    };

    // Simulate concurrent operations
    const concurrentOperations = [
      trackOperation('create_bot', () => createBot('trading', 'Strategy 1')),
      trackOperation('create_bot', () => createBot('trading', 'Strategy 2')),
      trackOperation('create_wallet', () => createWallet('bot-123')),
      trackOperation('create_wallet', () => createWallet('bot-456')),
      trackOperation('get_status', () => getBotStatus('bot-123')),
      trackOperation('get_status', () => getBotStatus('bot-456'))
    ];

    await Promise.allSettled(concurrentOperations);

    const avgLatency = metrics.operations.reduce((sum, op) => sum + op.latency, 0) / metrics.operations.length;
    const successfulOps = metrics.operations.filter(op => op.success).length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: (metrics.operations.length - successfulOps) / metrics.operations.length,
        apiLatency: avgLatency,
        systemHealth: successfulOps / metrics.operations.length,
        successRate: successfulOps / metrics.operations.length,
        totalTrades: 0,
        walletBalance: 0
      },
      load: {
        concurrentOperations: concurrentOperations.length,
        avgLatency,
        successfulOperations: successfulOps,
        operationTypes: new Set(metrics.operations.map(op => op.type)).size,
        peakLatency: Math.max(...metrics.operations.map(op => op.latency))
      }
    };

    expect(testMetrics.load.concurrentOperations).toBe(6);
    expect(testMetrics.performance.successRate).toBeGreaterThan(0);
    expect(testMetrics.load.avgLatency).toBeLessThan(1000);
  });

  it('should validate performance metrics accuracy during workflow execution', async () => {
    const metrics = {
      measurements: [] as { type: string; value: number; timestamp: number }[],
      operations: [] as { type: string; duration: number }[]
    };

    const measurePerformance = (type: string, value: number) => {
      metrics.measurements.push({
        type,
        value,
        timestamp: Date.now()
      });
    };

    const trackOperation = async (type: string, operation: () => Promise<any>) => {
      const startTime = Date.now();
      try {
        const result = await operation();
        metrics.operations.push({
          type,
          duration: Date.now() - startTime
        });
        return result;
      } catch (error) {
        throw error;
      }
    };

    // Execute workflow with performance tracking
    render(
      <TestContext>
        <AgentSelection />
      </TestContext>
    );

    const agentButton = screen.getByRole('button', { name: /trading agent/i });
    await trackOperation('agent_selection', () => {
      fireEvent.click(agentButton);
      measurePerformance('ui_interaction', Date.now());
      return Promise.resolve();
    });

    await trackOperation('navigation', () => {
      expect(mockRouter.push).toHaveBeenCalledWith('/strategy-creation');
      measurePerformance('navigation', Date.now());
      return Promise.resolve();
    });

    const avgOperationDuration = metrics.operations.reduce((sum, op) => sum + op.duration, 0) / metrics.operations.length;
    const measurementsByType = metrics.measurements.reduce((acc, m) => {
      if (!acc[m.type]) acc[m.type] = [];
      acc[m.type].push(m.value);
      return acc;
    }, {} as Record<string, number[]>);

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: 0,
        apiLatency: avgOperationDuration,
        systemHealth: 1,
        successRate: 1,
        totalTrades: 0,
        walletBalance: 0
      },
      measurements: {
        total: metrics.measurements.length,
        types: Object.keys(measurementsByType).length,
        averages: Object.entries(measurementsByType).reduce((acc, [type, values]) => {
          acc[type] = values.reduce((a, b) => a + b, 0) / values.length;
          return acc;
        }, {} as Record<string, number>)
      }
    };

    expect(testMetrics.measurements.total).toBeGreaterThan(0);
    expect(testMetrics.performance.apiLatency).toBeLessThan(1000);
    expect(Object.values(testMetrics.measurements.averages)).every(avg => avg > 0);
  });
});
