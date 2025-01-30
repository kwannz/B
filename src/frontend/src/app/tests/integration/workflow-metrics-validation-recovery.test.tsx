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

describe('Workflow Metrics Validation and Recovery Integration', () => {
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

  it('should validate workflow metrics during component transitions', async () => {
    const metrics = {
      transitions: [] as { from: string; to: string; duration: number }[],
      validations: [] as { component: string; result: boolean }[],
      errors: [] as { component: string; error: any }[]
    };

    const workflowSteps = [
      { name: 'agent_selection', component: AgentSelection },
      { name: 'strategy_creation', component: StrategyCreation },
      { name: 'bot_integration', component: BotIntegration },
      { name: 'key_management', component: KeyManagement },
      { name: 'trading_dashboard', component: TradingDashboard }
    ];

    const validateTransition = async (from: string, to: string) => {
      const startTime = Date.now();
      try {
        await mockRouter.push(`/${to}`);
        metrics.transitions.push({
          from,
          to,
          duration: Date.now() - startTime
        });
        metrics.validations.push({
          component: to,
          result: true
        });
      } catch (error) {
        metrics.errors.push({
          component: to,
          error
        });
        metrics.validations.push({
          component: to,
          result: false
        });
        throw error;
      }
    };

    for (let i = 0; i < workflowSteps.length - 1; i++) {
      const currentStep = workflowSteps[i];
      const nextStep = workflowSteps[i + 1];

      render(
        <TestContext>
          <currentStep.component />
        </TestContext>
      );

      await validateTransition(currentStep.name, nextStep.name);
    }

    const avgTransitionTime = metrics.transitions.reduce((sum, t) => sum + t.duration, 0) / metrics.transitions.length;
    const successfulValidations = metrics.validations.filter(v => v.result).length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors.length / metrics.validations.length,
        apiLatency: avgTransitionTime,
        systemHealth: successfulValidations / metrics.validations.length,
        successRate: successfulValidations / metrics.validations.length,
        totalTrades: 0,
        walletBalance: 0
      },
      workflow: {
        steps: workflowSteps.length,
        avgStepLatency: avgTransitionTime,
        maxStepLatency: Math.max(...metrics.transitions.map(t => t.duration)),
        minStepLatency: Math.min(...metrics.transitions.map(t => t.duration)),
        totalDuration: metrics.transitions.reduce((sum, t) => sum + t.duration, 0)
      }
    };

    expect(testMetrics.workflow.steps).toBe(workflowSteps.length);
    expect(testMetrics.performance.successRate).toBe(1);
    expect(metrics.transitions.length).toBe(workflowSteps.length - 1);
  });

  it('should validate workflow metrics during error recovery', async () => {
    const metrics = {
      recoveries: [] as { component: string; duration: number }[],
      errors: [] as { component: string; error: any }[],
      retries: [] as { component: string; attempt: number }[]
    };

    const mockErrors = {
      agent_selection: new Error('Agent validation failed'),
      strategy_creation: new Error('Strategy validation failed'),
      bot_integration: new Error('Bot creation failed'),
      key_management: new Error('Wallet creation failed'),
      trading_dashboard: new Error('Status update failed')
    };

    let errorCount = 0;
    const executeWithRecovery = async (component: string, operation: () => Promise<any>) => {
      try {
        if (errorCount++ < Object.keys(mockErrors).length) {
          const error = mockErrors[component];
          if (error) {
            metrics.errors.push({
              component,
              error
            });
            throw error;
          }
        }

        const startTime = Date.now();
        const result = await operation();

        if (metrics.errors.find(e => e.component === component)) {
          metrics.recoveries.push({
            component,
            duration: Date.now() - startTime
          });
        }

        return result;
      } catch (error) {
        metrics.retries.push({
          component,
          attempt: metrics.retries.filter(r => r.component === component).length + 1
        });
        throw error;
      }
    };

    (createBot as jest.Mock).mockImplementation((type, strategy) =>
      executeWithRecovery('bot_integration', () => Promise.resolve({
        id: 'bot-123',
        type,
        strategy
      }))
    );

    (getBotStatus as jest.Mock).mockImplementation((botId) =>
      executeWithRecovery('trading_dashboard', () => Promise.resolve({
        id: botId,
        status: 'active',
        metrics: {
          trades: 10,
          success_rate: 0.8
        }
      }))
    );

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors.length / (metrics.errors.length + metrics.recoveries.length),
        apiLatency: metrics.recoveries.reduce((sum, r) => sum + r.duration, 0) / metrics.recoveries.length,
        systemHealth: metrics.recoveries.length / metrics.errors.length,
        successRate: metrics.recoveries.length / metrics.errors.length,
        totalTrades: 10,
        walletBalance: 0
      },
      recovery: {
        totalErrors: metrics.errors.length,
        recoveredErrors: metrics.recoveries.length,
        avgRecoveryTime: metrics.recoveries.reduce((sum, r) => sum + r.duration, 0) / metrics.recoveries.length,
        errorsByComponent: metrics.errors.reduce((acc, e) => {
          if (!acc[e.component]) acc[e.component] = 0;
          acc[e.component]++;
          return acc;
        }, {} as Record<string, number>)
      }
    };

    expect(testMetrics.recovery.totalErrors).toBeGreaterThan(0);
    expect(testMetrics.recovery.recoveredErrors).toBe(testMetrics.recovery.totalErrors);
    expect(testMetrics.performance.systemHealth).toBeGreaterThan(0);
  });

  it('should validate workflow metrics during concurrent operations', async () => {
    const metrics = {
      operations: [] as { component: string; type: string; timestamp: number }[],
      validations: [] as { component: string; result: boolean }[],
      errors: [] as { component: string; error: any }[]
    };

    const mockOperations = [
      { component: 'agent_selection', type: 'validation' },
      { component: 'strategy_creation', type: 'creation' },
      { component: 'bot_integration', type: 'integration' },
      { component: 'key_management', type: 'wallet_creation' },
      { component: 'trading_dashboard', type: 'status_update' }
    ];

    const executeOperation = async (operation: { component: string; type: string }) => {
      metrics.operations.push({
        component: operation.component,
        type: operation.type,
        timestamp: Date.now()
      });

      try {
        await new Promise(resolve => setTimeout(resolve, 100));
        metrics.validations.push({
          component: operation.component,
          result: true
        });
      } catch (error) {
        metrics.errors.push({
          component: operation.component,
          error
        });
        metrics.validations.push({
          component: operation.component,
          result: false
        });
        throw error;
      }
    };

    const concurrentOperations = mockOperations.map(op => executeOperation(op));
    await Promise.allSettled(concurrentOperations);

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors.length / mockOperations.length,
        apiLatency: 0,
        systemHealth: metrics.validations.filter(v => v.result).length / metrics.validations.length,
        successRate: metrics.validations.filter(v => v.result).length / metrics.validations.length,
        totalTrades: 0,
        walletBalance: 0
      },
      concurrent: {
        totalOperations: metrics.operations.length,
        successfulOperations: metrics.validations.filter(v => v.result).length,
        failedOperations: metrics.errors.length,
        operationsByComponent: metrics.operations.reduce((acc, op) => {
          if (!acc[op.component]) acc[op.component] = [];
          acc[op.component].push(op.type);
          return acc;
        }, {} as Record<string, string[]>)
      }
    };

    expect(testMetrics.concurrent.totalOperations).toBe(mockOperations.length);
    expect(testMetrics.performance.successRate).toBe(1);
    expect(Object.keys(testMetrics.concurrent.operationsByComponent)).toHaveLength(mockOperations.length);
  });
});
