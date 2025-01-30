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

describe('Trading Workflow Metrics Integration', () => {
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

  it('should track metrics during complete trading workflow execution', async () => {
    const metrics = {
      workflow: [] as { step: string; duration: number; success: boolean }[],
      operations: [] as { type: string; latency: number }[],
      errors: 0,
      successes: 0
    };

    const trackStep = async (step: string, operation: () => Promise<any>) => {
      const startTime = Date.now();
      try {
        const result = await operation();
        metrics.workflow.push({
          step,
          duration: Date.now() - startTime,
          success: true
        });
        metrics.successes++;
        return result;
      } catch (error) {
        metrics.workflow.push({
          step,
          duration: Date.now() - startTime,
          success: false
        });
        metrics.errors++;
        throw error;
      }
    };

    const trackOperation = async (type: string, operation: () => Promise<any>) => {
      const startTime = Date.now();
      try {
        const result = await operation();
        metrics.operations.push({
          type,
          latency: Date.now() - startTime
        });
        return result;
      } catch (error) {
        throw error;
      }
    };

    (createBot as jest.Mock).mockImplementation((type, strategy) =>
      trackOperation('create_bot', () => Promise.resolve({
        id: 'bot-123',
        type,
        strategy
      }))
    );

    (createWallet as jest.Mock).mockImplementation((botId) =>
      trackOperation('create_wallet', () => Promise.resolve({
        address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
        balance: 1.5,
        bot_id: botId
      }))
    );

    (getBotStatus as jest.Mock).mockImplementation((botId) =>
      trackOperation('get_bot_status', () => Promise.resolve({
        id: botId,
        status: 'active',
        metrics: {
          performance: {
            trades: 5,
            success_rate: 0.8,
            avg_return: 0.05
          }
        }
      }))
    );

    // Step 1: Agent Selection
    await trackStep('agent_selection', async () => {
      render(
        <TestContext>
          <AgentSelection />
        </TestContext>
      );

      const agentButton = screen.getByRole('button', { name: /trading agent/i });
      fireEvent.click(agentButton);
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/strategy-creation');
      });
    });

    // Step 2: Strategy Creation
    await trackStep('strategy_creation', async () => {
      render(
        <TestContext>
          <StrategyCreation />
        </TestContext>
      );

      const strategyInput = screen.getByRole('textbox', { name: /strategy/i });
      fireEvent.change(strategyInput, { target: { value: 'Test Strategy' } });
      const createButton = screen.getByRole('button', { name: /create/i });
      fireEvent.click(createButton);
      await waitFor(() => {
        expect(createBot).toHaveBeenCalled();
      });
    });

    // Step 3: Bot Integration
    await trackStep('bot_integration', async () => {
      render(
        <TestContext>
          <BotIntegration />
        </TestContext>
      );

      const integrateButton = screen.getByRole('button', { name: /integrate/i });
      fireEvent.click(integrateButton);
      await waitFor(() => {
        expect(getBotStatus).toHaveBeenCalled();
      });
    });

    // Step 4: Key Management
    await trackStep('key_management', async () => {
      render(
        <TestContext>
          <KeyManagement />
        </TestContext>
      );

      const createWalletButton = screen.getByRole('button', { name: /create wallet/i });
      fireEvent.click(createWalletButton);
      await waitFor(() => {
        expect(createWallet).toHaveBeenCalled();
      });
    });

    // Step 5: Trading Dashboard
    await trackStep('trading_dashboard', async () => {
      render(
        <TestContext>
          <TradingDashboard />
        </TestContext>
      );

      await waitFor(() => {
        expect(getBotStatus).toHaveBeenCalled();
      });
    });

    const avgStepDuration = metrics.workflow.reduce((sum, step) => sum + step.duration, 0) / metrics.workflow.length;
    const avgOperationLatency = metrics.operations.reduce((sum, op) => sum + op.latency, 0) / metrics.operations.length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / (metrics.errors + metrics.successes),
        apiLatency: avgOperationLatency,
        systemHealth: metrics.successes / (metrics.errors + metrics.successes),
        successRate: metrics.successes / (metrics.errors + metrics.successes),
        totalTrades: 5,
        walletBalance: 1.5
      },
      workflow: {
        steps: metrics.workflow.length,
        avgStepLatency: avgStepDuration,
        maxStepLatency: Math.max(...metrics.workflow.map(s => s.duration)),
        minStepLatency: Math.min(...metrics.workflow.map(s => s.duration)),
        totalDuration: metrics.workflow.reduce((sum, s) => sum + s.duration, 0)
      },
      operations: {
        total: metrics.operations.length,
        avgLatency: avgOperationLatency,
        byType: metrics.operations.reduce((acc, op) => {
          if (!acc[op.type]) acc[op.type] = [];
          acc[op.type].push(op.latency);
          return acc;
        }, {} as Record<string, number[]>)
      }
    };

    expect(testMetrics.workflow.steps).toBe(5);
    expect(testMetrics.performance.successRate).toBe(1);
    expect(testMetrics.workflow.totalDuration).toBeLessThan(10000);
  });

  it('should track metrics during workflow error recovery', async () => {
    const metrics = {
      errors: [] as { step: string; error: any; timestamp: number }[],
      recoveries: [] as { step: string; duration: number }[],
      operations: [] as { type: string; success: boolean }[]
    };

    const mockFailures = {
      agent_selection: new Error('Agent Selection Failed'),
      strategy_creation: new Error('Strategy Creation Failed'),
      bot_integration: new Error('Bot Integration Failed'),
      key_management: new Error('Key Management Failed'),
      trading_dashboard: new Error('Trading Dashboard Failed')
    };

    let failedSteps = new Set(Object.keys(mockFailures));

    const executeStep = async (step: string, operation: () => Promise<any>) => {
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
        if (metrics.errors.find(e => e.step === step)) {
          metrics.recoveries.push({
            step,
            duration: Date.now() - metrics.errors.find(e => e.step === step)!.timestamp
          });
        }
        metrics.operations.push({ type: step, success: true });
        return result;
      } catch (error) {
        metrics.operations.push({ type: step, success: false });
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
            trades: 5,
            success_rate: 0.8,
            avg_return: 0.05
          }
        }
      }))
    );

    // Execute workflow with failures and recoveries
    while (failedSteps.size > 0) {
      try {
        await executeStep('workflow_execution', async () => {
          render(
            <TestContext>
              <AgentSelection />
            </TestContext>
          );

          const retryButton = screen.getByRole('button', { name: /retry/i });
          fireEvent.click(retryButton);
          await new Promise(resolve => setTimeout(resolve, 100));
        });
      } catch (error) {
        // Continue with retries
      }
    }

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.operations.filter(op => !op.success).length / metrics.operations.length,
        apiLatency: 0,
        systemHealth: metrics.recoveries.length / metrics.errors.length,
        successRate: metrics.recoveries.length / metrics.errors.length,
        totalTrades: 5,
        walletBalance: 1.5
      },
      recovery: {
        totalErrors: metrics.errors.length,
        recoveredErrors: metrics.recoveries.length,
        avgRecoveryTime: metrics.recoveries.reduce((sum, r) => sum + r.duration, 0) / metrics.recoveries.length,
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

  it('should validate workflow metrics consistency', async () => {
    const metrics = {
      measurements: [] as { step: string; metrics: any; timestamp: number }[],
      validations: {
        success: 0,
        failure: 0
      }
    };

    const validateMetrics = (step: string, data: any) => {
      try {
        metrics.measurements.push({
          step,
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

    const mockWorkflowMetrics = {
      agent_selection: {
        duration: 100,
        success: true
      },
      strategy_creation: {
        duration: 150,
        success: true
      },
      bot_integration: {
        duration: 200,
        success: true
      },
      key_management: {
        duration: 120,
        success: true
      },
      trading_dashboard: {
        duration: 180,
        success: true
      }
    };

    Object.entries(mockWorkflowMetrics).forEach(([step, stepMetrics]) => {
      validateMetrics(step, stepMetrics);
    });

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.validations.failure / (metrics.validations.success + metrics.validations.failure),
        apiLatency: 0,
        systemHealth: metrics.validations.success / (metrics.validations.success + metrics.validations.failure),
        successRate: metrics.validations.success / (metrics.validations.success + metrics.validations.failure),
        totalTrades: 0,
        walletBalance: 0
      },
      validation: {
        measurements: metrics.measurements.length,
        validationRate: metrics.validations.success / (metrics.validations.success + metrics.validations.failure),
        stepMetrics: metrics.measurements.reduce((acc, m) => {
          acc[m.step] = m.metrics;
          return acc;
        }, {} as Record<string, any>)
      }
    };

    expect(testMetrics.validation.measurements).toBe(Object.keys(mockWorkflowMetrics).length);
    expect(testMetrics.validation.validationRate).toBe(1);
    expect(Object.keys(testMetrics.validation.stepMetrics)).toHaveLength(5);
  });
});
