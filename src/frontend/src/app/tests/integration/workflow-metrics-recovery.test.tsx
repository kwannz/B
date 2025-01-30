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

describe('Workflow Metrics Recovery Integration', () => {
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

  it('should track workflow recovery metrics during component failures', async () => {
    const metrics = {
      failures: [] as { component: string; error: any; timestamp: number }[],
      recoveries: [] as { component: string; duration: number }[],
      retries: [] as { component: string; attempt: number }[]
    };

    const mockFailures = {
      agent_selection: new Error('Agent validation failed'),
      strategy_creation: new Error('Strategy validation failed'),
      bot_integration: new Error('Bot creation failed'),
      key_management: new Error('Wallet creation failed'),
      trading_dashboard: new Error('Status update failed')
    };

    let failureCount = 0;
    const executeWithRecovery = async (component: string, operation: () => Promise<any>) => {
      try {
        if (failureCount++ < Object.keys(mockFailures).length) {
          const error = mockFailures[component];
          if (error) {
            metrics.failures.push({
              component,
              error,
              timestamp: Date.now()
            });
            throw error;
          }
        }

        const startTime = Date.now();
        const result = await operation();

        if (metrics.failures.find(f => f.component === component)) {
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

    (createWallet as jest.Mock).mockImplementation((botId) =>
      executeWithRecovery('key_management', () => Promise.resolve({
        address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
        balance: 1.5,
        bot_id: botId
      }))
    );

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.failures.length / (metrics.failures.length + metrics.recoveries.length),
        apiLatency: metrics.recoveries.reduce((sum, r) => sum + r.duration, 0) / metrics.recoveries.length,
        systemHealth: metrics.recoveries.length / metrics.failures.length,
        successRate: metrics.recoveries.length / metrics.failures.length,
        totalTrades: 10,
        walletBalance: 1.5
      },
      recovery: {
        totalFailures: metrics.failures.length,
        recoveredFailures: metrics.recoveries.length,
        avgRecoveryTime: metrics.recoveries.reduce((sum, r) => sum + r.duration, 0) / metrics.recoveries.length,
        retryAttempts: metrics.retries.length,
        failuresByComponent: metrics.failures.reduce((acc, f) => {
          if (!acc[f.component]) acc[f.component] = 0;
          acc[f.component]++;
          return acc;
        }, {} as Record<string, number>)
      }
    };

    expect(testMetrics.recovery.totalFailures).toBeGreaterThan(0);
    expect(testMetrics.recovery.recoveredFailures).toBe(testMetrics.recovery.totalFailures);
    expect(testMetrics.performance.systemHealth).toBeGreaterThan(0);
  });

  it('should validate workflow state consistency during recovery', async () => {
    const metrics = {
      states: [] as { component: string; state: any; timestamp: number }[],
      validations: [] as { component: string; result: boolean }[],
      inconsistencies: [] as { component: string; expected: any; actual: any }[]
    };

    const mockWorkflowStates = {
      agent_selection: {
        selectedAgent: 'trading',
        validated: true
      },
      strategy_creation: {
        strategy: 'momentum',
        parameters: { timeframe: '1h', threshold: 0.05 }
      },
      bot_integration: {
        botId: 'bot-123',
        status: 'active'
      },
      key_management: {
        walletAddress: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
        balance: 1.5
      },
      trading_dashboard: {
        trades: 10,
        performance: { success_rate: 0.8, avg_return: 0.05 }
      }
    };

    const validateState = (component: string, state: any) => {
      const expectedState = mockWorkflowStates[component];
      const isValid = Object.keys(expectedState).every(key => 
        JSON.stringify(state[key]) === JSON.stringify(expectedState[key])
      );

      metrics.states.push({
        component,
        state,
        timestamp: Date.now()
      });

      metrics.validations.push({
        component,
        result: isValid
      });

      if (!isValid) {
        metrics.inconsistencies.push({
          component,
          expected: expectedState,
          actual: state
        });
      }

      return isValid;
    };

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.validations.filter(v => !v.result).length / metrics.validations.length,
        apiLatency: 0,
        systemHealth: metrics.validations.filter(v => v.result).length / metrics.validations.length,
        successRate: metrics.validations.filter(v => v.result).length / metrics.validations.length,
        totalTrades: mockWorkflowStates.trading_dashboard.trades,
        walletBalance: mockWorkflowStates.key_management.balance
      },
      validation: {
        total: metrics.validations.length,
        successful: metrics.validations.filter(v => v.result).length,
        inconsistencies: metrics.inconsistencies.length,
        stateTransitions: metrics.states.length,
        byComponent: metrics.validations.reduce((acc, v) => {
          if (!acc[v.component]) acc[v.component] = { success: 0, total: 0 };
          acc[v.component].total++;
          if (v.result) acc[v.component].success++;
          return acc;
        }, {} as Record<string, { success: number; total: number }>)
      }
    };

    expect(testMetrics.validation.total).toBeGreaterThan(0);
    expect(testMetrics.validation.inconsistencies).toBe(0);
    expect(testMetrics.performance.successRate).toBe(1);
  });

  it('should track workflow metrics during concurrent component recovery', async () => {
    const metrics = {
      operations: [] as { component: string; type: string; timestamp: number }[],
      recoveries: [] as { component: string; duration: number }[],
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

      if (Math.random() > 0.7) {
        const error = new Error(`${operation.component} operation failed`);
        metrics.errors.push({
          component: operation.component,
          error
        });
        throw error;
      }

      const startTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, 100));

      metrics.recoveries.push({
        component: operation.component,
        duration: Date.now() - startTime
      });

      return true;
    };

    const concurrentOperations = mockOperations.map(op => executeOperation(op));
    await Promise.allSettled(concurrentOperations);

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors.length / mockOperations.length,
        apiLatency: metrics.recoveries.reduce((sum, r) => sum + r.duration, 0) / metrics.recoveries.length,
        systemHealth: metrics.recoveries.length / mockOperations.length,
        successRate: metrics.recoveries.length / mockOperations.length,
        totalTrades: 0,
        walletBalance: 0
      },
      concurrent: {
        totalOperations: metrics.operations.length,
        successfulOperations: metrics.recoveries.length,
        failedOperations: metrics.errors.length,
        avgRecoveryTime: metrics.recoveries.reduce((sum, r) => sum + r.duration, 0) / metrics.recoveries.length,
        operationsByComponent: metrics.operations.reduce((acc, op) => {
          if (!acc[op.component]) acc[op.component] = [];
          acc[op.component].push(op.type);
          return acc;
        }, {} as Record<string, string[]>)
      }
    };

    expect(testMetrics.concurrent.totalOperations).toBe(mockOperations.length);
    expect(testMetrics.performance.systemHealth).toBeGreaterThan(0);
    expect(Object.keys(testMetrics.concurrent.operationsByComponent)).toHaveLength(mockOperations.length);
  });
});
