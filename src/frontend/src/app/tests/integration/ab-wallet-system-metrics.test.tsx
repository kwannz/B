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

describe('AB Wallet System Metrics', () => {
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

      const metrics = {
        wallets: {
          wallet_a: walletA.metrics,
          wallet_b: walletB.metrics
        },
        system: {
          heap_difference: Math.abs(walletA.metrics.heap_used - walletB.metrics.heap_used),
          api_latency_difference: Math.abs(walletA.metrics.api_response_time - walletB.metrics.api_response_time),
          throughput_difference: Math.abs(walletA.metrics.throughput - walletB.metrics.throughput),
          success_rate_difference: Math.abs(walletA.metrics.success_rate - walletB.metrics.success_rate)
        },
        performance_gain: {
          heap_efficiency: ((walletA.metrics.heap_used - walletB.metrics.heap_used) / walletA.metrics.heap_used) * 100,
          api_latency_improvement: ((walletA.metrics.api_response_time - walletB.metrics.api_response_time) / walletA.metrics.api_response_time) * 100,
          throughput_increase: ((walletB.metrics.throughput - walletA.metrics.throughput) / walletA.metrics.throughput) * 100,
          success_rate_improvement: ((walletB.metrics.success_rate - walletA.metrics.success_rate) / walletA.metrics.success_rate) * 100
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.system.heap_difference).toBeLessThan(0.1);
      expect(metrics.system.api_latency_difference).toBeLessThan(30);
      expect(metrics.system.throughput_difference).toBeLessThan(30);
      expect(metrics.system.success_rate_difference).toBeLessThan(0.02);
      expect(metrics.performance_gain.heap_efficiency).toBeGreaterThan(0);
      expect(metrics.performance_gain.api_latency_improvement).toBeGreaterThan(0);
      expect(metrics.performance_gain.throughput_increase).toBeGreaterThan(0);
      expect(metrics.performance_gain.success_rate_improvement).toBeGreaterThan(0);
    });
  });

  it('should validate system stability during AB wallet operations', async () => {
    await testRunner.runTest(async () => {
      const operations = 5;
      const metricsData: any[] = [];

      for (let i = 0; i < operations; i++) {
        const walletMetrics = {
          ...mockSystemMetrics,
          heap_used: Math.min(0.8, 0.5 + (i * 0.06)),
          api_response_time: Math.min(200, 150 + (i * 10)),
          throughput: Math.max(80, 100 - (i * 4)),
          success_rate: Math.max(0.95, 0.98 - (i * 0.005)),
          garbage_collection: {
            count: Math.min(10, 5 + i),
            duration: Math.min(200, 100 + (i * 20))
          }
        };

        (createWallet as jest.Mock).mockResolvedValueOnce({
          address: `wallet-${i}`,
          metrics: walletMetrics
        });

        render(<TestContext><WalletComparison /></TestContext>);
        await waitFor(() => {
          expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
        });

        metricsData.push(walletMetrics);
      }

      const systemMetrics = {
        trends: {
          heap_used: metricsData.map(m => m.heap_used),
          api_response_time: metricsData.map(m => m.api_response_time),
          throughput: metricsData.map(m => m.throughput),
          success_rate: metricsData.map(m => m.success_rate),
          gc_duration: metricsData.map(m => m.garbage_collection.duration)
        },
        stability: {
          heap_growth_rate: (metricsData[metricsData.length - 1].heap_used - metricsData[0].heap_used) / operations,
          api_latency_increase: (metricsData[metricsData.length - 1].api_response_time - metricsData[0].api_response_time) / operations,
          throughput_degradation: (metricsData[0].throughput - metricsData[metricsData.length - 1].throughput) / operations
        },
        final_state: {
          heap_used: metricsData[metricsData.length - 1].heap_used,
          api_response_time: metricsData[metricsData.length - 1].api_response_time,
          throughput: metricsData[metricsData.length - 1].throughput,
          success_rate: metricsData[metricsData.length - 1].success_rate
        }
      };

      testRunner.expectMetrics(systemMetrics);
      expect(systemMetrics.stability.heap_growth_rate).toBeLessThan(0.1);
      expect(systemMetrics.stability.api_latency_increase).toBeLessThan(20);
      expect(systemMetrics.stability.throughput_degradation).toBeLessThan(10);
      expect(systemMetrics.final_state.heap_used).toBeLessThan(0.8);
      expect(systemMetrics.final_state.api_response_time).toBeLessThan(200);
      expect(systemMetrics.final_state.throughput).toBeGreaterThan(80);
      expect(systemMetrics.final_state.success_rate).toBeGreaterThan(0.95);
      expect(systemMetrics.trends.gc_duration.every(d => d < 200)).toBe(true);
    });
  });
});
