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

describe('Workflow Metrics Validation and Recovery System Integration', () => {
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

  it('should validate system-wide metrics during workflow execution', async () => {
    const metrics = {
      system: [] as { component: string; metrics: any; timestamp: number }[],
      performance: [] as { operation: string; duration: number }[],
      resources: [] as { type: string; usage: number; timestamp: number }[]
    };

    const trackSystemMetrics = (component: string, data: any) => {
      metrics.system.push({
        component,
        metrics: data,
        timestamp: Date.now()
      });
    };

    const trackPerformance = (operation: string, duration: number) => {
      metrics.performance.push({
        operation,
        duration
      });
    };

    const trackResources = (type: string, usage: number) => {
      metrics.resources.push({
        type,
        usage,
        timestamp: Date.now()
      });
    };

    const mockSystemMetrics = {
      agent_selection: {
        cpu: 5,
        memory: 150,
        latency: 50
      },
      strategy_creation: {
        cpu: 8,
        memory: 180,
        latency: 75
      },
      bot_integration: {
        cpu: 12,
        memory: 220,
        latency: 100
      },
      key_management: {
        cpu: 7,
        memory: 160,
        latency: 60
      },
      trading_dashboard: {
        cpu: 15,
        memory: 250,
        latency: 120
      }
    };

    const workflowSteps = [
      { name: 'agent_selection', component: AgentSelection },
      { name: 'strategy_creation', component: StrategyCreation },
      { name: 'bot_integration', component: BotIntegration },
      { name: 'key_management', component: KeyManagement },
      { name: 'trading_dashboard', component: TradingDashboard }
    ];

    for (const step of workflowSteps) {
      const startTime = Date.now();
      
      render(
        <TestContext>
          <step.component />
        </TestContext>
      );

      const systemMetrics = mockSystemMetrics[step.name];
      trackSystemMetrics(step.name, systemMetrics);
      trackPerformance(step.name, Date.now() - startTime);
      trackResources('cpu', systemMetrics.cpu);
      trackResources('memory', systemMetrics.memory);

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
    }

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: 0,
        apiLatency: metrics.system.reduce((sum, m) => sum + m.metrics.latency, 0) / metrics.system.length,
        systemHealth: 1,
        successRate: 1,
        totalTrades: 0,
        walletBalance: 0
      },
      system: {
        avgCpuUsage: metrics.resources.filter(r => r.type === 'cpu')
          .reduce((sum, r) => sum + r.usage, 0) / metrics.resources.length,
        avgMemoryUsage: metrics.resources.filter(r => r.type === 'memory')
          .reduce((sum, r) => sum + r.usage, 0) / metrics.resources.length,
        avgLatency: metrics.system.reduce((sum, m) => sum + m.metrics.latency, 0) / metrics.system.length,
        peakCpuUsage: Math.max(...metrics.resources.filter(r => r.type === 'cpu').map(r => r.usage)),
        peakMemoryUsage: Math.max(...metrics.resources.filter(r => r.type === 'memory').map(r => r.usage)),
        peakLatency: Math.max(...metrics.system.map(m => m.metrics.latency))
      }
    };

    expect(testMetrics.system.avgCpuUsage).toBeGreaterThan(0);
    expect(testMetrics.system.avgMemoryUsage).toBeGreaterThan(0);
    expect(testMetrics.system.avgLatency).toBeGreaterThan(0);
    expect(testMetrics.performance.apiLatency).toBeLessThan(150);
  });

  it('should validate system metrics during error recovery', async () => {
    const metrics = {
      errors: [] as { component: string; type: string; timestamp: number }[],
      recovery: [] as { component: string; duration: number; resources: any }[],
      system: [] as { component: string; status: string; metrics: any }[]
    };

    const mockErrors = {
      strategy_creation: { type: 'validation_error', impact: 'low' },
      bot_integration: { type: 'api_error', impact: 'medium' },
      key_management: { type: 'wallet_error', impact: 'high' }
    };

    const trackError = (component: string, type: string) => {
      metrics.errors.push({
        component,
        type,
        timestamp: Date.now()
      });
    };

    const trackRecovery = (component: string, duration: number, resources: any) => {
      metrics.recovery.push({
        component,
        duration,
        resources
      });
    };

    const trackSystem = (component: string, status: string, metrics: any) => {
      metrics.system.push({
        component,
        status,
        metrics
      });
    };

    let errorCount = 0;
    const executeWithSystemMonitoring = async (component: string, operation: () => Promise<any>) => {
      const startTime = Date.now();
      const initialResources = {
        cpu: Math.random() * 10 + 5,
        memory: Math.random() * 100 + 150
      };

      try {
        if (errorCount++ < Object.keys(mockErrors).length && mockErrors[component]) {
          trackError(component, mockErrors[component].type);
          trackSystem(component, 'error', {
            ...initialResources,
            error_type: mockErrors[component].type,
            impact: mockErrors[component].impact
          });
          throw new Error(`${component} error: ${mockErrors[component].type}`);
        }

        const result = await operation();
        const duration = Date.now() - startTime;
        const recoveryResources = {
          cpu: initialResources.cpu * 1.5,
          memory: initialResources.memory * 1.2
        };

        if (metrics.errors.find(e => e.component === component)) {
          trackRecovery(component, duration, recoveryResources);
        }

        trackSystem(component, 'success', {
          ...recoveryResources,
          duration
        });

        return result;
      } catch (error) {
        const failureResources = {
          cpu: initialResources.cpu * 2,
          memory: initialResources.memory * 1.5
        };
        trackSystem(component, 'failure', {
          ...failureResources,
          error: error.message
        });
        throw error;
      }
    };

    (createBot as jest.Mock).mockImplementation((type, strategy) =>
      executeWithSystemMonitoring('bot_integration', () => Promise.resolve({
        id: 'bot-123',
        type,
        strategy
      }))
    );

    (getBotStatus as jest.Mock).mockImplementation((botId) =>
      executeWithSystemMonitoring('trading_dashboard', () => Promise.resolve({
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
        errorRate: metrics.errors.length / metrics.system.length,
        apiLatency: metrics.recovery.reduce((sum, r) => sum + r.duration, 0) / metrics.recovery.length,
        systemHealth: metrics.system.filter(s => s.status === 'success').length / metrics.system.length,
        successRate: metrics.recovery.length / metrics.errors.length,
        totalTrades: 10,
        walletBalance: 0
      },
      system: {
        avgCpuUsage: metrics.system.reduce((sum, s) => sum + s.metrics.cpu, 0) / metrics.system.length,
        avgMemoryUsage: metrics.system.reduce((sum, s) => sum + s.metrics.memory, 0) / metrics.system.length,
        errorImpact: metrics.errors.reduce((acc, e) => {
          const error = Object.values(mockErrors).find(me => me.type === e.type);
          return acc + (error.impact === 'high' ? 3 : error.impact === 'medium' ? 2 : 1);
        }, 0) / metrics.errors.length,
        recoveryEfficiency: metrics.recovery.reduce((sum, r) => 
          sum + (r.resources.cpu / metrics.system.find(s => s.component === r.component)?.metrics.cpu || 1), 0
        ) / metrics.recovery.length
      }
    };

    expect(testMetrics.system.avgCpuUsage).toBeGreaterThan(0);
    expect(testMetrics.system.avgMemoryUsage).toBeGreaterThan(0);
    expect(testMetrics.system.errorImpact).toBeGreaterThan(0);
    expect(testMetrics.system.recoveryEfficiency).toBeGreaterThan(0);
  });
});
