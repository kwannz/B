import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import { useDebugStore } from '@/app/stores/debugStore';
import { TestMetrics } from '../types/test.types';
import StrategyCreation from '@/app/strategy-creation/page';
import BotIntegration from '@/app/bot-integration/page';
import TradingDashboard from '@/app/trading-dashboard/page';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/api/client');
jest.mock('@/app/stores/debugStore');

describe('Strategy Workflow Metrics Integration', () => {
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

  it('should track metrics during strategy creation and execution', async () => {
    const metrics = {
      workflow: [] as { step: string; duration: number; success: boolean }[],
      strategy: [] as { type: string; metrics: any; timestamp: number }[],
      performance: [] as { type: string; value: number; timestamp: number }[]
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
        return result;
      } catch (error) {
        metrics.workflow.push({
          step,
          duration: Date.now() - startTime,
          success: false
        });
        throw error;
      }
    };

    const mockStrategyMetrics = {
      trades: 10,
      success_rate: 0.8,
      avg_return: 0.05,
      drawdown: 0.02,
      sharpe_ratio: 1.5,
      volatility: 0.15
    };

    (createBot as jest.Mock).mockImplementation((type, strategy) =>
      trackStep('create_strategy', () => {
        metrics.strategy.push({
          type: 'creation',
          metrics: { type, strategy },
          timestamp: Date.now()
        });
        return Promise.resolve({
          id: 'bot-123',
          type,
          strategy
        });
      })
    );

    (getBotStatus as jest.Mock).mockImplementation((botId) =>
      trackStep('strategy_execution', () => {
        metrics.strategy.push({
          type: 'execution',
          metrics: mockStrategyMetrics,
          timestamp: Date.now()
        });
        return Promise.resolve({
          id: botId,
          status: 'active',
          metrics: mockStrategyMetrics
        });
      })
    );

    // Execute strategy creation workflow
    render(
      <TestContext>
        <StrategyCreation />
      </TestContext>
    );

    const strategyInput = screen.getByRole('textbox', { name: /strategy/i });
    fireEvent.change(strategyInput, { target: { value: 'Test Strategy' } });
    const createButton = screen.getByRole('button', { name: /create/i });
    
    await trackStep('strategy_setup', async () => {
      fireEvent.click(createButton);
      await waitFor(() => {
        expect(createBot).toHaveBeenCalled();
      });
    });

    // Track strategy execution
    render(
      <TestContext>
        <BotIntegration />
      </TestContext>
    );

    const integrateButton = screen.getByRole('button', { name: /integrate/i });
    await trackStep('strategy_integration', async () => {
      fireEvent.click(integrateButton);
      await waitFor(() => {
        expect(getBotStatus).toHaveBeenCalled();
      });
    });

    // Monitor strategy performance
    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/80%/)).toBeInTheDocument();
      metrics.performance.push({
        type: 'success_rate',
        value: mockStrategyMetrics.success_rate,
        timestamp: Date.now()
      });
    });

    const avgStepDuration = metrics.workflow.reduce((sum, step) => sum + step.duration, 0) / metrics.workflow.length;
    const successfulSteps = metrics.workflow.filter(step => step.success).length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: (metrics.workflow.length - successfulSteps) / metrics.workflow.length,
        apiLatency: avgStepDuration,
        systemHealth: successfulSteps / metrics.workflow.length,
        successRate: mockStrategyMetrics.success_rate,
        totalTrades: mockStrategyMetrics.trades,
        walletBalance: 0
      },
      strategy: {
        metrics: mockStrategyMetrics,
        execution: {
          steps: metrics.workflow.length,
          avgStepDuration,
          successRate: successfulSteps / metrics.workflow.length
        },
        performance: {
          sharpeRatio: mockStrategyMetrics.sharpe_ratio,
          drawdown: mockStrategyMetrics.drawdown,
          volatility: mockStrategyMetrics.volatility
        }
      }
    };

    expect(testMetrics.strategy.execution.steps).toBeGreaterThan(0);
    expect(testMetrics.performance.successRate).toBeGreaterThan(0.7);
    expect(testMetrics.strategy.performance.sharpeRatio).toBeGreaterThan(1);
  });

  it('should track metrics during strategy optimization', async () => {
    const metrics = {
      optimizations: [] as { type: string; metrics: any; timestamp: number }[],
      performance: [] as { before: any; after: any; timestamp: number }[]
    };

    const mockOptimizationSteps = [
      {
        type: 'parameter_tuning',
        metrics: {
          trades: 12,
          success_rate: 0.85,
          avg_return: 0.06,
          drawdown: 0.015,
          sharpe_ratio: 1.8,
          volatility: 0.12
        }
      },
      {
        type: 'risk_adjustment',
        metrics: {
          trades: 15,
          success_rate: 0.88,
          avg_return: 0.055,
          drawdown: 0.01,
          sharpe_ratio: 2.0,
          volatility: 0.1
        }
      }
    ];

    let optimizationIndex = 0;
    (getBotStatus as jest.Mock).mockImplementation((botId) => {
      const data = mockOptimizationSteps[optimizationIndex++ % mockOptimizationSteps.length];
      metrics.optimizations.push({
        type: data.type,
        metrics: data.metrics,
        timestamp: Date.now()
      });
      return Promise.resolve({
        id: botId,
        status: 'active',
        metrics: data.metrics
      });
    });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    for (const step of mockOptimizationSteps) {
      await waitFor(() => {
        expect(screen.getByText(new RegExp(`${(step.metrics.success_rate * 100).toFixed(0)}%`))).toBeInTheDocument();
        metrics.performance.push({
          before: metrics.performance[metrics.performance.length - 1]?.after || step.metrics,
          after: step.metrics,
          timestamp: Date.now()
        });
      });
    }

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: 0,
        apiLatency: 0,
        systemHealth: 1,
        successRate: mockOptimizationSteps[mockOptimizationSteps.length - 1].metrics.success_rate,
        totalTrades: mockOptimizationSteps[mockOptimizationSteps.length - 1].metrics.trades,
        walletBalance: 0
      },
      optimization: {
        steps: metrics.optimizations.length,
        improvements: metrics.performance.map(p => ({
          successRateImprovement: p.after.success_rate - p.before.success_rate,
          sharpeRatioImprovement: p.after.sharpe_ratio - p.before.sharpe_ratio,
          drawdownReduction: p.before.drawdown - p.after.drawdown
        })),
        finalMetrics: mockOptimizationSteps[mockOptimizationSteps.length - 1].metrics
      }
    };

    expect(testMetrics.optimization.steps).toBe(mockOptimizationSteps.length);
    expect(testMetrics.performance.successRate).toBeGreaterThan(0.85);
    expect(testMetrics.optimization.improvements.every(i => i.sharpeRatioImprovement > 0)).toBe(true);
  });

  it('should validate strategy metrics consistency', async () => {
    const metrics = {
      measurements: [] as { timestamp: number; metrics: any }[],
      validations: {
        success: 0,
        failure: 0
      }
    };

    const validateMetrics = (data: any) => {
      try {
        expect(data.trades).toBeGreaterThanOrEqual(0);
        expect(data.success_rate).toBeGreaterThanOrEqual(0);
        expect(data.success_rate).toBeLessThanOrEqual(1);
        expect(data.sharpe_ratio).toBeGreaterThan(0);
        expect(data.drawdown).toBeGreaterThanOrEqual(0);
        expect(data.drawdown).toBeLessThanOrEqual(1);
        metrics.validations.success++;
        return true;
      } catch (error) {
        metrics.validations.failure++;
        return false;
      }
    };

    const mockStrategyData = {
      trades: 20 + Math.floor(Math.random() * 5),
      success_rate: 0.85 + Math.random() * 0.1,
      avg_return: 0.06 + Math.random() * 0.02,
      drawdown: 0.01 + Math.random() * 0.01,
      sharpe_ratio: 1.8 + Math.random() * 0.5,
      volatility: 0.1 + Math.random() * 0.05
    };

    (getBotStatus as jest.Mock).mockImplementation((botId) => {
      metrics.measurements.push({
        timestamp: Date.now(),
        metrics: mockStrategyData
      });

      validateMetrics(mockStrategyData);
      return Promise.resolve({
        id: botId,
        status: 'active',
        metrics: mockStrategyData
      });
    });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(metrics.measurements.length).toBeGreaterThan(0);
    });

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.validations.failure / (metrics.validations.success + metrics.validations.failure),
        apiLatency: 0,
        systemHealth: metrics.validations.success / (metrics.validations.success + metrics.validations.failure),
        successRate: mockStrategyData.success_rate,
        totalTrades: mockStrategyData.trades,
        walletBalance: 0
      },
      validation: {
        measurements: metrics.measurements.length,
        validationRate: metrics.validations.success / (metrics.validations.success + metrics.validations.failure),
        metricsRanges: {
          successRate: {
            min: Math.min(...metrics.measurements.map(m => m.metrics.success_rate)),
            max: Math.max(...metrics.measurements.map(m => m.metrics.success_rate))
          },
          sharpeRatio: {
            min: Math.min(...metrics.measurements.map(m => m.metrics.sharpe_ratio)),
            max: Math.max(...metrics.measurements.map(m => m.metrics.sharpe_ratio))
          },
          drawdown: {
            min: Math.min(...metrics.measurements.map(m => m.metrics.drawdown)),
            max: Math.max(...metrics.measurements.map(m => m.metrics.drawdown))
          }
        }
      }
    };

    expect(testMetrics.validation.measurements).toBeGreaterThan(0);
    expect(testMetrics.validation.validationRate).toBe(1);
    expect(testMetrics.validation.metricsRanges.successRate.max).toBeLessThanOrEqual(1);
    expect(testMetrics.validation.metricsRanges.drawdown.max).toBeLessThanOrEqual(1);
  });
});
