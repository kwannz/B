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

describe('Workflow Validation Metrics Integration', () => {
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

  it('should validate complete workflow execution metrics', async () => {
    const metrics = {
      workflow: [] as { step: string; duration: number; success: boolean }[],
      validations: [] as { step: string; result: boolean; timestamp: number }[],
      transitions: [] as { from: string; to: string; duration: number }[]
    };

    const workflowSteps = [
      { name: 'agent_selection', component: AgentSelection },
      { name: 'strategy_creation', component: StrategyCreation },
      { name: 'bot_integration', component: BotIntegration },
      { name: 'key_management', component: KeyManagement },
      { name: 'trading_dashboard', component: TradingDashboard }
    ];

    const validateStep = async (step: string, operation: () => Promise<any>) => {
      const startTime = Date.now();
      try {
        const result = await operation();
        metrics.workflow.push({
          step,
          duration: Date.now() - startTime,
          success: true
        });
        metrics.validations.push({
          step,
          result: true,
          timestamp: Date.now()
        });
        return result;
      } catch (error) {
        metrics.workflow.push({
          step,
          duration: Date.now() - startTime,
          success: false
        });
        metrics.validations.push({
          step,
          result: false,
          timestamp: Date.now()
        });
        throw error;
      }
    };

    const trackTransition = (from: string, to: string) => {
      const startTime = Date.now();
      metrics.transitions.push({
        from,
        to,
        duration: Date.now() - startTime
      });
    };

    for (let i = 0; i < workflowSteps.length; i++) {
      const currentStep = workflowSteps[i];
      const nextStep = workflowSteps[i + 1];

      await validateStep(currentStep.name, async () => {
        render(
          <TestContext>
            <currentStep.component />
          </TestContext>
        );

        if (nextStep) {
          await waitFor(() => {
            expect(mockRouter.push).toHaveBeenCalled();
            trackTransition(currentStep.name, nextStep.name);
          });
        }
      });
    }

    const avgStepDuration = metrics.workflow.reduce((sum, step) => sum + step.duration, 0) / metrics.workflow.length;
    const avgTransitionDuration = metrics.transitions.reduce((sum, t) => sum + t.duration, 0) / metrics.transitions.length;
    const successfulSteps = metrics.workflow.filter(step => step.success).length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: (metrics.workflow.length - successfulSteps) / metrics.workflow.length,
        apiLatency: avgStepDuration,
        systemHealth: successfulSteps / metrics.workflow.length,
        successRate: successfulSteps / metrics.workflow.length,
        totalTrades: 0,
        walletBalance: 0
      },
      workflow: {
        steps: metrics.workflow.length,
        avgStepLatency: avgStepDuration,
        maxStepLatency: Math.max(...metrics.workflow.map(s => s.duration)),
        minStepLatency: Math.min(...metrics.workflow.map(s => s.duration)),
        totalDuration: metrics.workflow.reduce((sum, s) => sum + s.duration, 0)
      },
      transitions: {
        total: metrics.transitions.length,
        avgDuration: avgTransitionDuration,
        byStep: metrics.transitions.reduce((acc, t) => {
          const key = `${t.from}->${t.to}`;
          if (!acc[key]) acc[key] = [];
          acc[key].push(t.duration);
          return acc;
        }, {} as Record<string, number[]>)
      }
    };

    expect(testMetrics.workflow.steps).toBe(workflowSteps.length);
    expect(testMetrics.performance.successRate).toBe(1);
    expect(testMetrics.transitions.total).toBe(workflowSteps.length - 1);
  });

  it('should validate workflow state consistency during transitions', async () => {
    const metrics = {
      states: [] as { step: string; state: any; timestamp: number }[],
      validations: [] as { step: string; result: boolean }[],
      inconsistencies: [] as { step: string; expected: any; actual: any }[]
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

    const validateState = (step: string, state: any) => {
      const expectedState = mockWorkflowStates[step];
      const isValid = Object.keys(expectedState).every(key => 
        JSON.stringify(state[key]) === JSON.stringify(expectedState[key])
      );

      metrics.states.push({
        step,
        state,
        timestamp: Date.now()
      });

      metrics.validations.push({
        step,
        result: isValid
      });

      if (!isValid) {
        metrics.inconsistencies.push({
          step,
          expected: expectedState,
          actual: state
        });
      }

      return isValid;
    };

    (createBot as jest.Mock).mockImplementation((type, strategy) =>
      Promise.resolve({
        id: 'bot-123',
        type,
        strategy,
        status: 'created'
      })
    );

    (getBotStatus as jest.Mock).mockImplementation((botId) =>
      Promise.resolve({
        id: botId,
        status: 'active',
        metrics: mockWorkflowStates.trading_dashboard
      })
    );

    (createWallet as jest.Mock).mockImplementation((botId) =>
      Promise.resolve({
        address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
        balance: 1.5,
        bot_id: botId
      })
    );

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
        byStep: metrics.validations.reduce((acc, v) => {
          if (!acc[v.step]) acc[v.step] = { success: 0, total: 0 };
          acc[v.step].total++;
          if (v.result) acc[v.step].success++;
          return acc;
        }, {} as Record<string, { success: number; total: number }>)
      }
    };

    expect(testMetrics.validation.total).toBeGreaterThan(0);
    expect(testMetrics.validation.inconsistencies).toBe(0);
    expect(testMetrics.performance.successRate).toBe(1);
  });

  it('should validate workflow error recovery and state restoration', async () => {
    const metrics = {
      errors: [] as { step: string; error: any; state: any; timestamp: number }[],
      recoveries: [] as { step: string; duration: number; success: boolean }[],
      states: [] as { step: string; state: any; timestamp: number }[]
    };

    const mockErrors = {
      agent_selection: new Error('Agent validation failed'),
      strategy_creation: new Error('Invalid strategy parameters'),
      bot_integration: new Error('Bot creation failed'),
      key_management: new Error('Wallet creation failed'),
      trading_dashboard: new Error('Status update failed')
    };

    const saveState = (step: string, state: any) => {
      metrics.states.push({
        step,
        state,
        timestamp: Date.now()
      });
    };

    const restoreState = (step: string) => {
      const lastState = metrics.states
        .filter(s => s.step === step)
        .sort((a, b) => b.timestamp - a.timestamp)[0];
      return lastState?.state;
    };

    const executeWithRecovery = async (step: string, operation: () => Promise<any>) => {
      try {
        const result = await operation();
        saveState(step, result);
        return result;
      } catch (error) {
        const startTime = Date.now();
        metrics.errors.push({
          step,
          error,
          state: restoreState(step),
          timestamp: startTime
        });

        try {
          const recoveredResult = await operation();
          metrics.recoveries.push({
            step,
            duration: Date.now() - startTime,
            success: true
          });
          saveState(step, recoveredResult);
          return recoveredResult;
        } catch (recoveryError) {
          metrics.recoveries.push({
            step,
            duration: Date.now() - startTime,
            success: false
          });
          throw recoveryError;
        }
      }
    };

    let errorCount = 0;
    (createBot as jest.Mock).mockImplementation((type, strategy) =>
      executeWithRecovery('strategy_creation', () => {
        if (errorCount++ < 1) throw mockErrors.strategy_creation;
        return Promise.resolve({
          id: 'bot-123',
          type,
          strategy
        });
      })
    );

    (getBotStatus as jest.Mock).mockImplementation((botId) =>
      executeWithRecovery('bot_integration', () => {
        if (errorCount++ < 2) throw mockErrors.bot_integration;
        return Promise.resolve({
          id: botId,
          status: 'active',
          metrics: {
            trades: 10,
            success_rate: 0.8
          }
        });
      })
    );

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors.length / (metrics.errors.length + metrics.recoveries.length),
        apiLatency: metrics.recoveries.reduce((sum, r) => sum + r.duration, 0) / metrics.recoveries.length,
        systemHealth: metrics.recoveries.filter(r => r.success).length / metrics.errors.length,
        successRate: metrics.recoveries.filter(r => r.success).length / metrics.recoveries.length,
        totalTrades: 10,
        walletBalance: 0
      },
      recovery: {
        totalErrors: metrics.errors.length,
        recoveredErrors: metrics.recoveries.filter(r => r.success).length,
        avgRecoveryTime: metrics.recoveries.reduce((sum, r) => sum + r.duration, 0) / metrics.recoveries.length,
        stateRestores: metrics.states.length,
        errorsByStep: metrics.errors.reduce((acc, e) => {
          if (!acc[e.step]) acc[e.step] = 0;
          acc[e.step]++;
          return acc;
        }, {} as Record<string, number>)
      }
    };

    expect(testMetrics.recovery.totalErrors).toBeGreaterThan(0);
    expect(testMetrics.recovery.recoveredErrors).toBe(testMetrics.recovery.totalErrors);
    expect(testMetrics.performance.systemHealth).toBeGreaterThan(0);
  });
});
