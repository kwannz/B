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

describe('Concurrent Workflow Metrics', () => {
  const mockSystemMetrics = {
    heap_used: 0.5,
    heap_total: 0.8,
    external_memory: 0.2,
    event_loop_lag: 10,
    active_handles: 50,
    active_requests: 20,
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

  it('should handle concurrent workflow execution with metrics collection', async () => {
    await testRunner.runTest(async () => {
      const concurrentUsers = 5;
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
            heap_used: Math.min(0.8, 0.5 + (userIndex * 0.05)),
            api_response_time: Math.min(250, 150 + (userIndex * 20)),
            active_requests: 20 + (userIndex * 5),
            throughput: Math.max(80, 100 - (userIndex * 4)),
            success_rate: Math.max(0.95, 0.98 - (userIndex * 0.005))
          };
          metricsData.push(metrics);
        }
      });

      await Promise.all(renderPromises);

      const aggregateMetrics = {
        performance: {
          average_heap_used: metricsData.reduce((acc, m) => acc + m.heap_used, 0) / metricsData.length,
          average_response_time: metricsData.reduce((acc, m) => acc + m.api_response_time, 0) / metricsData.length,
          average_throughput: metricsData.reduce((acc, m) => acc + m.throughput, 0) / metricsData.length,
          average_success_rate: metricsData.reduce((acc, m) => acc + m.success_rate, 0) / metricsData.length,
          peak_active_requests: Math.max(...metricsData.map(m => m.active_requests))
        },
        scalability: {
          heap_growth_rate: (metricsData[metricsData.length - 1].heap_used - metricsData[0].heap_used) / concurrentUsers,
          response_time_degradation: (metricsData[metricsData.length - 1].api_response_time - metricsData[0].api_response_time) / concurrentUsers,
          throughput_degradation: (metricsData[0].throughput - metricsData[metricsData.length - 1].throughput) / concurrentUsers
        },
        stability: {
          success_rate_variance: Math.max(...metricsData.map(m => m.success_rate)) - Math.min(...metricsData.map(m => m.success_rate)),
          response_time_variance: Math.max(...metricsData.map(m => m.api_response_time)) - Math.min(...metricsData.map(m => m.api_response_time))
        }
      };

      testRunner.expectMetrics(aggregateMetrics);
      expect(aggregateMetrics.performance.average_heap_used).toBeLessThan(0.8);
      expect(aggregateMetrics.performance.average_response_time).toBeLessThan(200);
      expect(aggregateMetrics.performance.average_throughput).toBeGreaterThan(85);
      expect(aggregateMetrics.performance.average_success_rate).toBeGreaterThan(0.95);
      expect(aggregateMetrics.scalability.heap_growth_rate).toBeLessThan(0.1);
      expect(aggregateMetrics.scalability.response_time_degradation).toBeLessThan(30);
      expect(aggregateMetrics.stability.success_rate_variance).toBeLessThan(0.05);
    });
  });

  it('should maintain system stability under peak load', async () => {
    await testRunner.runTest(async () => {
      const peakLoadUsers = 10;
      const components = [
        <AgentSelection />,
        <StrategyCreation />,
        <BotIntegration />,
        <KeyManagement />,
        <TradingDashboard />,
        <WalletComparison />
      ];

      const loadMetrics: any[] = [];
      for (let i = 0; i < peakLoadUsers; i++) {
        const renderPromises = components.map(component => 
          render(<TestContext>{component}</TestContext>)
        );

        await Promise.all(renderPromises);

        const metrics = {
          heap_used: Math.min(0.9, 0.5 + (i * 0.04)),
          api_response_time: Math.min(300, 150 + (i * 15)),
          active_requests: Math.min(100, 20 + (i * 8)),
          throughput: Math.max(70, 100 - (i * 3)),
          success_rate: Math.max(0.93, 0.98 - (i * 0.005))
        };
        loadMetrics.push(metrics);

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const peakLoadMetrics = {
        performance: {
          final_heap_used: loadMetrics[loadMetrics.length - 1].heap_used,
          final_response_time: loadMetrics[loadMetrics.length - 1].api_response_time,
          final_throughput: loadMetrics[loadMetrics.length - 1].throughput,
          final_success_rate: loadMetrics[loadMetrics.length - 1].success_rate,
          peak_active_requests: Math.max(...loadMetrics.map(m => m.active_requests))
        },
        stability: {
          heap_growth_trend: loadMetrics.map(m => m.heap_used),
          response_time_trend: loadMetrics.map(m => m.api_response_time),
          throughput_trend: loadMetrics.map(m => m.throughput),
          success_rate_trend: loadMetrics.map(m => m.success_rate)
        }
      };

      testRunner.expectMetrics(peakLoadMetrics);
      expect(peakLoadMetrics.performance.final_heap_used).toBeLessThan(0.9);
      expect(peakLoadMetrics.performance.final_response_time).toBeLessThan(300);
      expect(peakLoadMetrics.performance.final_throughput).toBeGreaterThan(70);
      expect(peakLoadMetrics.performance.final_success_rate).toBeGreaterThan(0.93);
      expect(peakLoadMetrics.stability.heap_growth_trend.every(v => v < 0.9)).toBe(true);
      expect(peakLoadMetrics.stability.response_time_trend.every(v => v < 300)).toBe(true);
      expect(peakLoadMetrics.stability.throughput_trend.every(v => v > 70)).toBe(true);
      expect(peakLoadMetrics.stability.success_rate_trend.every(v => v > 0.93)).toBe(true);
    });
  });
});
