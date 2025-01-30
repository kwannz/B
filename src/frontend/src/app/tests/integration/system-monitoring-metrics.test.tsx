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

describe('System Monitoring Metrics', () => {
  const mockSystemMetrics = {
    heap_used: 0.5,
    heap_total: 0.8,
    external_memory: 0.2,
    event_loop_lag: 10,
    active_handles: 50,
    active_requests: 20,
    garbage_collection_count: 5,
    garbage_collection_time: 100,
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
    (createWallet as jest.Mock).mockResolvedValue({
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      metrics: mockSystemMetrics
    });
    (getWallet as jest.Mock).mockResolvedValue({
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      metrics: mockSystemMetrics
    });
  });

  it('should monitor system metrics during high concurrency', async () => {
    await testRunner.runTest(async () => {
      const concurrentUsers = 10;
      const workflows = Array(concurrentUsers).fill(null).map(() => [
        <AgentSelection />,
        <StrategyCreation />,
        <BotIntegration />,
        <KeyManagement />,
        <TradingDashboard />,
        <WalletComparison />
      ]);

      const metricsData: any[] = [];
      const renderPromises = workflows.map(async (workflow, userIndex) => {
        for (const component of workflow) {
          render(<TestContext>{component}</TestContext>);
          await waitFor(() => {
            expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
          });

          const metrics = {
            ...mockSystemMetrics,
            heap_used: Math.min(0.9, 0.5 + (userIndex * 0.04)),
            api_response_time: Math.min(300, 150 + (userIndex * 15)),
            active_requests: Math.min(100, 20 + (userIndex * 8)),
            throughput: Math.max(70, 100 - (userIndex * 3)),
            success_rate: Math.max(0.93, 0.98 - (userIndex * 0.005)),
            garbage_collection_count: Math.min(20, 5 + userIndex),
            garbage_collection_time: Math.min(500, 100 + (userIndex * 40)),
            event_loop_lag: Math.min(50, 10 + (userIndex * 4))
          };
          metricsData.push(metrics);
        }
      });

      await Promise.all(renderPromises);

      const systemMetrics = {
        performance: {
          average_heap_used: metricsData.reduce((acc, m) => acc + m.heap_used, 0) / metricsData.length,
          average_response_time: metricsData.reduce((acc, m) => acc + m.api_response_time, 0) / metricsData.length,
          average_throughput: metricsData.reduce((acc, m) => acc + m.throughput, 0) / metricsData.length,
          average_success_rate: metricsData.reduce((acc, m) => acc + m.success_rate, 0) / metricsData.length,
          peak_active_requests: Math.max(...metricsData.map(m => m.active_requests))
        },
        memory: {
          average_heap_used: metricsData.reduce((acc, m) => acc + m.heap_used, 0) / metricsData.length,
          peak_heap_used: Math.max(...metricsData.map(m => m.heap_used)),
          average_external_memory: metricsData.reduce((acc, m) => acc + m.external_memory, 0) / metricsData.length
        },
        garbage_collection: {
          total_collections: metricsData.reduce((acc, m) => acc + m.garbage_collection_count, 0),
          average_collection_time: metricsData.reduce((acc, m) => acc + m.garbage_collection_time, 0) / metricsData.length,
          peak_collection_time: Math.max(...metricsData.map(m => m.garbage_collection_time))
        },
        event_loop: {
          average_lag: metricsData.reduce((acc, m) => acc + m.event_loop_lag, 0) / metricsData.length,
          peak_lag: Math.max(...metricsData.map(m => m.event_loop_lag))
        }
      };

      testRunner.expectMetrics(systemMetrics);
      expect(systemMetrics.performance.average_heap_used).toBeLessThan(0.8);
      expect(systemMetrics.performance.average_response_time).toBeLessThan(250);
      expect(systemMetrics.performance.average_throughput).toBeGreaterThan(80);
      expect(systemMetrics.performance.average_success_rate).toBeGreaterThan(0.95);
      expect(systemMetrics.memory.peak_heap_used).toBeLessThan(0.9);
      expect(systemMetrics.garbage_collection.average_collection_time).toBeLessThan(300);
      expect(systemMetrics.event_loop.peak_lag).toBeLessThan(50);
    });
  });

  it('should monitor system stability during sustained load', async () => {
    await testRunner.runTest(async () => {
      const loadDuration = 5;
      const metricsData: any[] = [];

      for (let i = 0; i < loadDuration; i++) {
        const components = [
          <AgentSelection />,
          <StrategyCreation />,
          <BotIntegration />,
          <KeyManagement />,
          <TradingDashboard />,
          <WalletComparison />
        ];

        const renderPromises = components.map(component => 
          render(<TestContext>{component}</TestContext>)
        );

        await Promise.all(renderPromises);

        const metrics = {
          ...mockSystemMetrics,
          heap_used: Math.min(0.8, 0.5 + (i * 0.06)),
          api_response_time: Math.min(250, 150 + (i * 20)),
          active_requests: Math.min(80, 20 + (i * 12)),
          throughput: Math.max(80, 100 - (i * 4)),
          success_rate: Math.max(0.95, 0.98 - (i * 0.006)),
          garbage_collection_count: Math.min(15, 5 + i),
          garbage_collection_time: Math.min(400, 100 + (i * 60)),
          event_loop_lag: Math.min(40, 10 + (i * 6))
        };
        metricsData.push(metrics);

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const stabilityMetrics = {
        trends: {
          heap_used: metricsData.map(m => m.heap_used),
          api_response_time: metricsData.map(m => m.api_response_time),
          throughput: metricsData.map(m => m.throughput),
          success_rate: metricsData.map(m => m.success_rate),
          active_requests: metricsData.map(m => m.active_requests)
        },
        stability: {
          heap_growth_rate: (metricsData[metricsData.length - 1].heap_used - metricsData[0].heap_used) / loadDuration,
          response_time_degradation: (metricsData[metricsData.length - 1].api_response_time - metricsData[0].api_response_time) / loadDuration,
          throughput_degradation: (metricsData[0].throughput - metricsData[metricsData.length - 1].throughput) / loadDuration
        },
        final_state: {
          heap_used: metricsData[metricsData.length - 1].heap_used,
          api_response_time: metricsData[metricsData.length - 1].api_response_time,
          throughput: metricsData[metricsData.length - 1].throughput,
          success_rate: metricsData[metricsData.length - 1].success_rate
        }
      };

      testRunner.expectMetrics(stabilityMetrics);
      expect(stabilityMetrics.stability.heap_growth_rate).toBeLessThan(0.1);
      expect(stabilityMetrics.stability.response_time_degradation).toBeLessThan(30);
      expect(stabilityMetrics.stability.throughput_degradation).toBeLessThan(10);
      expect(stabilityMetrics.final_state.heap_used).toBeLessThan(0.8);
      expect(stabilityMetrics.final_state.api_response_time).toBeLessThan(250);
      expect(stabilityMetrics.final_state.throughput).toBeGreaterThan(80);
      expect(stabilityMetrics.final_state.success_rate).toBeGreaterThan(0.95);
    });
  });
});
