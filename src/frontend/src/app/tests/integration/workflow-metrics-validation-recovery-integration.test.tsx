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

  it('should validate workflow metrics during component transitions with recovery', async () => {
    const metrics = {
      transitions: [] as { from: string; to: string; duration: number }[],
      validations: [] as { component: string; result: boolean }[],
      errors: [] as { component: string; error: any }[],
      recoveries: [] as { component: string; duration: number }[]
    };

    const workflowSteps = [
      { name: 'agent_selection', component: AgentSelection },
      { name: 'strategy_creation', component: StrategyCreation },
      { name: 'bot_integration', component: BotIntegration },
      { name: 'key_management', component: KeyManagement },
      { name: 'trading_dashboard', component: TradingDashboard }
    ];

    const mockErrors = {
      strategy_creation: new Error('Strategy validation failed'),
      bot_integration: new Error('Bot creation failed'),
      key_management: new Error('Wallet creation failed')
    };

    let errorCount = 0;
    const validateTransition = async (from: string, to: string) => {
      const startTime = Date.now();
      try {
        if (errorCount++ < Object.keys(mockErrors).length && mockErrors[to]) {
          const error = mockErrors[to];
          metrics.errors.push({
            component: to,
            error
          });
          throw error;
        }

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

        if (metrics.errors.find(e => e.component === to)) {
          metrics.recoveries.push({
            component: to,
            duration: Date.now() - startTime
          });
        }
      } catch (error) {
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

      try {
        await validateTransition(currentStep.name, nextStep.name);
      } catch (error) {
        await validateTransition(currentStep.name, nextStep.name);
      }
    }

    const avgTransitionTime = metrics.transitions.reduce((sum, t) => sum + t.duration, 0) / metrics.transitions.length;
    const avgRecoveryTime = metrics.recoveries.reduce((sum, r) => sum + r.duration, 0) / metrics.recoveries.length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors.length / (metrics.transitions.length + metrics.errors.length),
        apiLatency: avgTransitionTime,
        systemHealth: metrics.recoveries.length / metrics.errors.length,
        successRate: metrics.validations.filter(v => v.result).length / metrics.validations.length,
        totalTrades: 0,
        walletBalance: 0
      },
      workflow: {
        steps: workflowSteps.length,
        avgStepLatency: avgTransitionTime,
        maxStepLatency: Math.max(...metrics.transitions.map(t => t.duration)),
        minStepLatency: Math.min(...metrics.transitions.map(t => t.duration)),
        totalDuration: metrics.transitions.reduce((sum, t) => sum + t.duration, 0)
      },
      recovery: {
        totalErrors: metrics.errors.length,
        recoveredErrors: metrics.recoveries.length,
        avgRecoveryTime,
        errorsByComponent: metrics.errors.reduce((acc, e) => {
          if (!acc[e.component]) acc[e.component] = 0;
          acc[e.component]++;
          return acc;
        }, {} as Record<string, number>)
      }
    };

    expect(testMetrics.workflow.steps).toBe(workflowSteps.length);
    expect(testMetrics.recovery.totalErrors).toBeGreaterThan(0);
    expect(testMetrics.recovery.recoveredErrors).toBe(testMetrics.recovery.totalErrors);
    expect(testMetrics.performance.systemHealth).toBeGreaterThan(0);
  });

  it('should validate workflow metrics during concurrent operations with recovery', async () => {
    const metrics = {
      operations: [] as { component: string; type: string; timestamp: number }[],
      validations: [] as { component: string; result: boolean }[],
      errors: [] as { component: string; error: any }[],
      recoveries: [] as { component: string; duration: number }[]
    };

    const mockOperations = [
      { component: 'agent_selection', type: 'validation' },
      { component: 'strategy_creation', type: 'creation' },
      { component: 'bot_integration', type: 'integration' },
      { component: 'key_management', type: 'wallet_creation' },
      { component: 'trading_dashboard', type: 'status_update' }
    ];

    const executeOperation = async (operation: { component: string; type: string }) => {
      const startTime = Date.now();
      metrics.operations.push({
        component: operation.component,
        type: operation.type,
        timestamp: startTime
      });

      try {
        if (Math.random() > 0.7) {
          const error = new Error(`${operation.component} operation failed`);
          metrics.errors.push({
            component: operation.component,
            error
          });
          throw error;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
        metrics.validations.push({
          component: operation.component,
          result: true
        });

        if (metrics.errors.find(e => e.component === operation.component)) {
          metrics.recoveries.push({
            component: operation.component,
            duration: Date.now() - startTime
          });
        }
      } catch (error) {
        metrics.validations.push({
          component: operation.component,
          result: false
        });
        throw error;
      }
    };

    const executeWithRetry = async (operation: { component: string; type: string }) => {
      try {
        await executeOperation(operation);
      } catch (error) {
        await executeOperation(operation);
      }
    };

    const concurrentOperations = mockOperations.map(op => executeWithRetry(op));
    await Promise.allSettled(concurrentOperations);

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors.length / metrics.operations.length,
        apiLatency: metrics.recoveries.reduce((sum, r) => sum + r.duration, 0) / metrics.recoveries.length,
        systemHealth: metrics.recoveries.length / metrics.errors.length,
        successRate: metrics.validations.filter(v => v.result).length / metrics.validations.length,
        totalTrades: 0,
        walletBalance: 0
      },
      concurrent: {
        totalOperations: metrics.operations.length,
        successfulOperations: metrics.validations.filter(v => v.result).length,
        failedOperations: metrics.errors.length,
        recoveredOperations: metrics.recoveries.length,
        operationsByComponent: metrics.operations.reduce((acc, op) => {
          if (!acc[op.component]) acc[op.component] = [];
          acc[op.component].push(op.type);
          return acc;
        }, {} as Record<string, string[]>)
      }
    };

    expect(testMetrics.concurrent.totalOperations).toBe(mockOperations.length);
    expect(testMetrics.concurrent.recoveredOperations).toBe(testMetrics.concurrent.failedOperations);
    expect(testMetrics.performance.systemHealth).toBeGreaterThan(0);
  });

  it('should validate workflow metrics consistency during recovery', async () => {
    const metrics = {
      samples: [] as { component: string; metrics: any; timestamp: number }[],
      validations: {
        success: 0,
        failure: 0
      },
      recoveries: [] as { component: string; duration: number }[]
    };

    const validateMetrics = (component: string, data: any) => {
      try {
        metrics.samples.push({
          component,
          metrics: data,
          timestamp: Date.now()
        });
        metrics.validations.success++;
        return true;
      } catch (error) {
        metrics.validations.failure++;
        return false;
      }
    };

    const mockComponentMetrics = {
      agent_selection: {
        renders: 1,
        interactions: 2,
        validations: 1
      },
      strategy_creation: {
        renders: 1,
        interactions: 3,
        validations: 2
      },
      bot_integration: {
        renders: 1,
        interactions: 2,
        validations: 1
      },
      key_management: {
        renders: 1,
        interactions: 2,
        validations: 1
      },
      trading_dashboard: {
        renders: 1,
        interactions: 4,
        validations: 2
      }
    };

    Object.entries(mockComponentMetrics).forEach(([component, metrics]) => {
      if (Math.random() > 0.7) {
        const startTime = Date.now();
        validateMetrics(component, { ...metrics, error: true });
        validateMetrics(component, metrics);
        metrics.recoveries.push({
          component,
          duration: Date.now() - startTime
        });
      } else {
        validateMetrics(component, metrics);
      }
    });

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.validations.failure / (metrics.validations.success + metrics.validations.failure),
        apiLatency: metrics.recoveries.reduce((sum, r) => sum + r.duration, 0) / metrics.recoveries.length,
        systemHealth: metrics.validations.success / (metrics.validations.success + metrics.validations.failure),
        successRate: metrics.validations.success / (metrics.validations.success + metrics.validations.failure),
        totalTrades: 0,
        walletBalance: 0
      },
      validation: {
        samples: metrics.samples.length,
        validationRate: metrics.validations.success / (metrics.validations.success + metrics.validations.failure),
        recoveries: metrics.recoveries.length,
        metricsConsistency: metrics.samples.reduce((acc, s) => {
          if (!acc[s.component]) acc[s.component] = [];
          acc[s.component].push(s.metrics);
          return acc;
        }, {} as Record<string, any[]>)
      }
    };

    expect(testMetrics.validation.samples).toBeGreaterThan(Object.keys(mockComponentMetrics).length);
    expect(testMetrics.validation.validationRate).toBeGreaterThan(0.8);
    expect(Object.keys(testMetrics.validation.metricsConsistency)).toHaveLength(Object.keys(mockComponentMetrics).length);
  });
});
