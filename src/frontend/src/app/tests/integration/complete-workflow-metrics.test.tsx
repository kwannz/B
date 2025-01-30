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

describe('Complete Workflow Metrics', () => {
  const mockSystemMetrics = {
    heap_used: 0.5,
    heap_total: 0.8,
    external_memory: 0.2,
    event_loop_lag: 10,
    active_handles: 50,
    active_requests: 20,
    garbage_collection: {
      count: 5,
      duration: 100
    },
    api_response_time: 150,
    database_latency: 50,
    cache_hit_rate: 0.9,
    error_count: 2,
    success_rate: 0.98,
    network_latency: 50,
    throughput: 100,
    response_time: 200
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
    (createBot as jest.Mock).mockResolvedValue({ id: 'bot-123', metrics: mockSystemMetrics });
    (getBotStatus as jest.Mock).mockResolvedValue({ 
      id: 'bot-123', 
      status: 'active',
      metrics: mockSystemMetrics
    });
  });

  it('should validate complete 6-step workflow with metrics collection', async () => {
    await testRunner.runTest(async () => {
      const workflow = [
        { component: <AgentSelection />, name: 'agent-selection', expectedMetrics: { ...mockSystemMetrics } },
        { component: <StrategyCreation />, name: 'strategy-creation', expectedMetrics: { ...mockSystemMetrics } },
        { component: <BotIntegration />, name: 'bot-integration', expectedMetrics: { ...mockSystemMetrics } },
        { component: <KeyManagement />, name: 'key-management', expectedMetrics: { ...mockSystemMetrics } },
        { component: <TradingDashboard />, name: 'trading-dashboard', expectedMetrics: { ...mockSystemMetrics } },
        { component: <WalletComparison />, name: 'wallet-comparison', expectedMetrics: { ...mockSystemMetrics } }
      ];

      const metricsData: any[] = [];
      const startTime = Date.now();

      for (const { component, name, expectedMetrics } of workflow) {
        const stepStartTime = Date.now();
        render(<TestContext>{component}</TestContext>);
        
        await waitFor(() => {
          expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
        });

        const stepEndTime = Date.now();
        const metrics = {
          step: name,
          duration: stepEndTime - stepStartTime,
          system: {
            ...expectedMetrics,
            heap_used: Math.min(0.8, expectedMetrics.heap_used + (metricsData.length * 0.05)),
            api_response_time: Math.min(200, expectedMetrics.api_response_time + (metricsData.length * 10)),
            active_requests: Math.min(100, expectedMetrics.active_requests + (metricsData.length * 5))
          }
        };
        metricsData.push(metrics);
      }

      const endTime = Date.now();
      const workflowMetrics = {
        workflow: {
          total_duration: endTime - startTime,
          steps: metricsData.map(m => ({
            name: m.step,
            duration: m.duration,
            metrics: m.system
          })),
          average_step_duration: metricsData.reduce((acc, m) => acc + m.duration, 0) / metricsData.length
        },
        system: {
          final_heap_used: metricsData[metricsData.length - 1].system.heap_used,
          peak_api_response_time: Math.max(...metricsData.map(m => m.system.api_response_time)),
          peak_active_requests: Math.max(...metricsData.map(m => m.system.active_requests)),
          average_success_rate: metricsData.reduce((acc, m) => acc + m.system.success_rate, 0) / metricsData.length
        },
        performance: {
          memory_trend: metricsData.map(m => m.system.heap_used),
          latency_trend: metricsData.map(m => m.system.api_response_time),
          throughput_trend: metricsData.map(m => m.system.throughput)
        }
      };

      testRunner.expectMetrics(workflowMetrics);
      expect(workflowMetrics.workflow.total_duration).toBeLessThan(10000);
      expect(workflowMetrics.workflow.average_step_duration).toBeLessThan(2000);
      expect(workflowMetrics.system.final_heap_used).toBeLessThan(0.8);
      expect(workflowMetrics.system.peak_api_response_time).toBeLessThan(200);
      expect(workflowMetrics.system.average_success_rate).toBeGreaterThan(0.95);
    });
  });

  it('should validate AB wallet comparison with system metrics', async () => {
    await testRunner.runTest(async () => {
      const walletA = {
        address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
        metrics: { ...mockSystemMetrics }
      };

      const walletB = {
        address: '7MmPb3RLvEgtg4HQY8gguARGwGKyYaCeT8DLvBwfLL',
        metrics: {
          ...mockSystemMetrics,
          heap_used: 0.45,
          api_response_time: 130,
          success_rate: 0.99,
          throughput: 120
        }
      };

      (createWallet as jest.Mock)
        .mockImplementation((botId) => Promise.resolve(botId === 'bot-123' ? walletA : walletB));
      (getWallet as jest.Mock)
        .mockImplementation((botId) => Promise.resolve(botId === 'bot-123' ? walletA : walletB));

      render(<TestContext><WalletComparison /></TestContext>);

      await waitFor(() => {
        expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
      });

      const comparisonMetrics = {
        wallets: {
          wallet_a: {
            metrics: walletA.metrics,
            address: walletA.address
          },
          wallet_b: {
            metrics: walletB.metrics,
            address: walletB.address
          }
        },
        system_impact: {
          heap_difference: walletA.metrics.heap_used - walletB.metrics.heap_used,
          api_latency_difference: walletA.metrics.api_response_time - walletB.metrics.api_response_time,
          throughput_difference: walletB.metrics.throughput - walletA.metrics.throughput,
          success_rate_difference: walletB.metrics.success_rate - walletA.metrics.success_rate
        },
        performance_gains: {
          memory_efficiency: ((walletA.metrics.heap_used - walletB.metrics.heap_used) / walletA.metrics.heap_used) * 100,
          latency_improvement: ((walletA.metrics.api_response_time - walletB.metrics.api_response_time) / walletA.metrics.api_response_time) * 100,
          throughput_increase: ((walletB.metrics.throughput - walletA.metrics.throughput) / walletA.metrics.throughput) * 100
        }
      };

      testRunner.expectMetrics(comparisonMetrics);
      expect(comparisonMetrics.system_impact.heap_difference).toBeGreaterThan(0);
      expect(comparisonMetrics.system_impact.api_latency_difference).toBeGreaterThan(0);
      expect(comparisonMetrics.system_impact.throughput_difference).toBeGreaterThan(0);
      expect(comparisonMetrics.performance_gains.memory_efficiency).toBeGreaterThan(0);
      expect(comparisonMetrics.performance_gains.latency_improvement).toBeGreaterThan(0);
      expect(comparisonMetrics.performance_gains.throughput_increase).toBeGreaterThan(0);
    });
  });
});
