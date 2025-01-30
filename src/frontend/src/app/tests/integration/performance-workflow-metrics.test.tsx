import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import AgentSelection from '@/app/agent-selection/page';
import StrategyCreation from '@/app/strategy-creation/page';
import BotIntegration from '@/app/bot-integration/page';
import KeyManagement from '@/app/key-management/page';
import TradingDashboard from '@/app/trading-dashboard/page';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('next/navigation');
jest.mock('@/app/api/client');

describe('Performance Workflow Metrics', () => {
  const mockPerformanceData = {
    api_latency: 100,
    error_rate: 0.05,
    system_health: 0.95,
    memory_usage: 0.4,
    cpu_usage: 0.3,
    network_latency: 50,
    throughput: 100,
    response_time: 200,
    validation_success: 0.98,
    error_count: 2,
    warning_count: 5,
    garbage_collection: {
      count: 5,
      duration: 100
    },
    event_loop: {
      lag: 10,
      utilization: 0.6
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
    (createBot as jest.Mock).mockResolvedValue({ id: 'bot-123', metrics: mockPerformanceData });
    (getBotStatus as jest.Mock).mockResolvedValue({ 
      id: 'bot-123', 
      status: 'active',
      metrics: mockPerformanceData
    });
    (createWallet as jest.Mock).mockResolvedValue({
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      metrics: mockPerformanceData
    });
    (getWallet as jest.Mock).mockResolvedValue({
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      metrics: mockPerformanceData
    });
  });

  it('should validate performance metrics across workflow steps', async () => {
    await testRunner.runTest(async () => {
      const workflow = [
        { component: <AgentSelection />, name: 'agent-selection' },
        { component: <StrategyCreation />, name: 'strategy-creation' },
        { component: <BotIntegration />, name: 'bot-integration' },
        { component: <KeyManagement />, name: 'key-management' },
        { component: <TradingDashboard />, name: 'trading-dashboard' },
        { component: <WalletComparison />, name: 'wallet-comparison' }
      ];

      const metricsData: any[] = [];

      for (const { component, name } of workflow) {
        render(<TestContext>{component}</TestContext>);
        await waitFor(() => {
          expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
        });

        const metrics = {
          ...mockPerformanceData,
          step: name,
          timestamp: Date.now(),
          api_latency: Math.min(200, 100 + metricsData.length * 10),
          error_rate: Math.max(0, 0.05 - metricsData.length * 0.01),
          system_health: Math.min(1.0, 0.95 + metricsData.length * 0.01),
          memory_usage: Math.min(0.8, 0.4 + metricsData.length * 0.05),
          cpu_usage: Math.min(0.7, 0.3 + metricsData.length * 0.05),
          garbage_collection: {
            count: Math.min(20, 5 + metricsData.length),
            duration: Math.min(500, 100 + metricsData.length * 40)
          },
          event_loop: {
            lag: Math.min(50, 10 + metricsData.length * 4),
            utilization: Math.min(0.9, 0.6 + metricsData.length * 0.05)
          }
        };
        metricsData.push(metrics);
      }

      const performanceMetrics = {
        workflow: {
          steps: metricsData.map(m => ({
            name: m.step,
            metrics: {
              api_latency: m.api_latency,
              error_rate: m.error_rate,
              system_health: m.system_health
            }
          })),
          duration: metricsData[metricsData.length - 1].timestamp - metricsData[0].timestamp
        },
        system: {
          peak_memory: Math.max(...metricsData.map(m => m.memory_usage)),
          peak_cpu: Math.max(...metricsData.map(m => m.cpu_usage)),
          peak_event_loop_lag: Math.max(...metricsData.map(m => m.event_loop.lag)),
          total_gc_time: metricsData.reduce((acc, m) => acc + m.garbage_collection.duration, 0)
        },
        trends: {
          api_latency: metricsData.map(m => m.api_latency),
          error_rate: metricsData.map(m => m.error_rate),
          system_health: metricsData.map(m => m.system_health),
          memory_usage: metricsData.map(m => m.memory_usage),
          cpu_usage: metricsData.map(m => m.cpu_usage)
        }
      };

      testRunner.expectMetrics(performanceMetrics);
      expect(performanceMetrics.workflow.duration).toBeLessThan(10000);
      expect(performanceMetrics.system.peak_memory).toBeLessThan(0.8);
      expect(performanceMetrics.system.peak_cpu).toBeLessThan(0.7);
      expect(performanceMetrics.system.peak_event_loop_lag).toBeLessThan(50);
      expect(performanceMetrics.trends.api_latency.every(v => v < 200)).toBe(true);
      expect(performanceMetrics.trends.error_rate.every(v => v < 0.05)).toBe(true);
      expect(performanceMetrics.trends.system_health.every(v => v > 0.95)).toBe(true);
    });
  });

  it('should validate AB wallet performance comparison', async () => {
    await testRunner.runTest(async () => {
      const walletA = {
        address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
        metrics: { ...mockPerformanceData }
      };

      const walletB = {
        address: '7MmPb3RLvEgtg4HQY8gguARGwGKyYaCeT8DLvBwfLL',
        metrics: {
          ...mockPerformanceData,
          api_latency: 90,
          error_rate: 0.04,
          system_health: 0.96
        }
      };

      (getWallet as jest.Mock)
        .mockImplementation((botId) => Promise.resolve(botId === 'bot-123' ? walletA : walletB));

      render(<TestContext><WalletComparison /></TestContext>);

      await waitFor(() => {
        expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
      });

      const comparisonMetrics = {
        wallets: {
          wallet_a: walletA.metrics,
          wallet_b: walletB.metrics
        },
        differences: {
          api_latency: Math.abs(walletA.metrics.api_latency - walletB.metrics.api_latency),
          error_rate: Math.abs(walletA.metrics.error_rate - walletB.metrics.error_rate),
          system_health: Math.abs(walletA.metrics.system_health - walletB.metrics.system_health)
        },
        performance_gain: {
          api_latency: ((walletA.metrics.api_latency - walletB.metrics.api_latency) / walletA.metrics.api_latency) * 100,
          error_rate: ((walletA.metrics.error_rate - walletB.metrics.error_rate) / walletA.metrics.error_rate) * 100,
          system_health: ((walletB.metrics.system_health - walletA.metrics.system_health) / walletA.metrics.system_health) * 100
        }
      };

      testRunner.expectMetrics(comparisonMetrics);
      expect(comparisonMetrics.differences.api_latency).toBeLessThan(20);
      expect(comparisonMetrics.differences.error_rate).toBeLessThan(0.02);
      expect(comparisonMetrics.differences.system_health).toBeLessThan(0.02);
      expect(comparisonMetrics.performance_gain.api_latency).toBeGreaterThan(0);
      expect(comparisonMetrics.performance_gain.error_rate).toBeGreaterThan(0);
      expect(comparisonMetrics.performance_gain.system_health).toBeGreaterThan(0);
    });
  });
});
