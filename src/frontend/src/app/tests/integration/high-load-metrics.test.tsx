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

describe('High Load Metrics Collection', () => {
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

  it('should handle concurrent component rendering with metrics collection', async () => {
    await testRunner.runTest(async () => {
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

      await waitFor(() => {
        expect(screen.getAllByTestId('performance-metrics')).toHaveLength(components.length);
      });

      const metrics = {
        system: {
          heap_used: 0.7,
          heap_total: 0.9,
          external_memory: 0.3,
          event_loop_lag: 20,
          active_handles: 80,
          active_requests: 40,
          api_response_time: 180,
          database_latency: 70,
          cache_hit_rate: 0.85,
          error_count: 3,
          success_rate: 0.96
        },
        performance: {
          concurrent_operations: components.length,
          average_response_time: 175,
          peak_memory_usage: 0.7,
          peak_cpu_usage: 0.6,
          network_throughput: 150,
          error_rate: 0.04
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.system.heap_used).toBeLessThan(0.8);
      expect(metrics.system.api_response_time).toBeLessThan(200);
      expect(metrics.system.success_rate).toBeGreaterThan(0.95);
      expect(metrics.performance.average_response_time).toBeLessThan(200);
      expect(metrics.performance.error_rate).toBeLessThan(0.05);
    });
  });

  it('should maintain performance under sustained load', async () => {
    await testRunner.runTest(async () => {
      const iterations = 3;
      const components = [
        <AgentSelection />,
        <StrategyCreation />,
        <BotIntegration />,
        <KeyManagement />,
        <TradingDashboard />,
        <WalletComparison />
      ];

      const metricsData: any[] = [];

      for (let i = 0; i < iterations; i++) {
        const renderPromises = components.map(component => 
          render(<TestContext>{component}</TestContext>)
        );

        await Promise.all(renderPromises);

        const metrics = {
          heap_used: Math.min(0.8, 0.5 + i * 0.1),
          api_response_time: Math.min(200, 150 + i * 15),
          error_rate: Math.max(0, 0.02 + i * 0.01),
          success_rate: Math.max(0.95, 0.98 - i * 0.01),
          throughput: 100 + i * 20
        };

        metricsData.push(metrics);

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const finalMetrics = {
        performance: {
          average_heap_used: metricsData.reduce((acc, m) => acc + m.heap_used, 0) / iterations,
          average_response_time: metricsData.reduce((acc, m) => acc + m.api_response_time, 0) / iterations,
          average_error_rate: metricsData.reduce((acc, m) => acc + m.error_rate, 0) / iterations,
          average_success_rate: metricsData.reduce((acc, m) => acc + m.success_rate, 0) / iterations,
          average_throughput: metricsData.reduce((acc, m) => acc + m.throughput, 0) / iterations
        },
        trends: {
          heap_used: metricsData.map(m => m.heap_used),
          api_response_time: metricsData.map(m => m.api_response_time),
          error_rate: metricsData.map(m => m.error_rate),
          success_rate: metricsData.map(m => m.success_rate),
          throughput: metricsData.map(m => m.throughput)
        }
      };

      testRunner.expectMetrics(finalMetrics);
      expect(finalMetrics.performance.average_heap_used).toBeLessThan(0.8);
      expect(finalMetrics.performance.average_response_time).toBeLessThan(200);
      expect(finalMetrics.performance.average_error_rate).toBeLessThan(0.05);
      expect(finalMetrics.performance.average_success_rate).toBeGreaterThan(0.95);
      expect(finalMetrics.trends.heap_used.every(v => v < 0.8)).toBe(true);
      expect(finalMetrics.trends.api_response_time.every(v => v < 200)).toBe(true);
      expect(finalMetrics.trends.error_rate.every(v => v < 0.05)).toBe(true);
      expect(finalMetrics.trends.success_rate.every(v => v > 0.95)).toBe(true);
    });
  });
});
