import { render, screen, waitFor } from '@testing-library/react';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import AgentSelection from '@/app/agent-selection/page';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('@/app/api/client');

describe('Workflow Metrics Validation with System Performance Monitoring - AB Testing', () => {
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
    }
  };

  const mockWalletA = {
    address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
    metrics: {
      api_latency: 100,
      error_rate: 0.05,
      success_rate: 0.95,
      throughput: 100,
      active_trades: 5,
      total_volume: 10000,
      profit_loss: 500
    }
  };

  const mockWalletB = {
    address: '7MmPb3RLvEgtg4HQY8gguARGwGKyYaCeT8DLvBwfLL',
    metrics: {
      api_latency: 90,
      error_rate: 0.04,
      success_rate: 0.96,
      throughput: 120,
      active_trades: 6,
      total_volume: 12000,
      profit_loss: 600
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createBot as jest.Mock).mockResolvedValue({ id: 'bot-123', metrics: mockSystemMetrics });
    (getBotStatus as jest.Mock).mockResolvedValue({ 
      id: 'bot-123', 
      status: 'active',
      metrics: mockSystemMetrics
    });
    (createWallet as jest.Mock).mockImplementation((botId) => 
      Promise.resolve(botId === 'bot-123' ? mockWalletA : mockWalletB));
    (getWallet as jest.Mock).mockImplementation((botId) => 
      Promise.resolve(botId === 'bot-123' ? mockWalletA : mockWalletB));
  });

  it('validates AB wallet comparison with system performance metrics', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      const metricsData: any[] = [];

      render(<TestContext><WalletComparison /></TestContext>);

      await waitFor(() => {
        expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
      });

      const endTime = Date.now();
      metricsData.push({
        timestamp: endTime,
        system: mockSystemMetrics,
        wallets: {
          wallet_a: mockWalletA.metrics,
          wallet_b: mockWalletB.metrics
        }
      });

      const performanceMetrics = {
        duration: endTime - startTime,
        system_metrics: mockSystemMetrics,
        wallet_comparison: {
          latency_diff: Math.abs(mockWalletA.metrics.api_latency - mockWalletB.metrics.api_latency),
          error_rate_diff: Math.abs(mockWalletA.metrics.error_rate - mockWalletB.metrics.error_rate),
          throughput_diff: mockWalletB.metrics.throughput - mockWalletA.metrics.throughput,
          volume_diff: mockWalletB.metrics.total_volume - mockWalletA.metrics.total_volume
        },
        performance_gains: {
          latency_improvement: ((mockWalletA.metrics.api_latency - mockWalletB.metrics.api_latency) / mockWalletA.metrics.api_latency) * 100,
          error_rate_improvement: ((mockWalletA.metrics.error_rate - mockWalletB.metrics.error_rate) / mockWalletA.metrics.error_rate) * 100,
          throughput_increase: ((mockWalletB.metrics.throughput - mockWalletA.metrics.throughput) / mockWalletA.metrics.throughput) * 100
        }
      };

      testRunner.expectMetrics(performanceMetrics);
      expect(performanceMetrics.duration).toBeLessThan(5000);
      expect(performanceMetrics.wallet_comparison.latency_diff).toBeLessThan(20);
      expect(performanceMetrics.wallet_comparison.error_rate_diff).toBeLessThan(0.02);
      expect(performanceMetrics.performance_gains.throughput_increase).toBeGreaterThan(0);
    });
  });

  it('validates system performance under concurrent AB wallet operations', async () => {
    await testRunner.runTest(async () => {
      const operations = [
        { component: <AgentSelection />, name: 'agent-selection' },
        { component: <WalletComparison />, name: 'wallet-comparison' }
      ];

      const metricsData: any[] = [];
      const startTime = Date.now();

      for (const { component, name } of operations) {
        const stepStartTime = Date.now();
        render(<TestContext>{component}</TestContext>);

        await waitFor(() => {
          expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
        });

        const stepEndTime = Date.now();
        metricsData.push({
          step: name,
          duration: stepEndTime - stepStartTime,
          system: {
            ...mockSystemMetrics,
            heap_used: Math.min(0.8, mockSystemMetrics.heap_used + (metricsData.length * 0.05)),
            active_requests: Math.min(100, mockSystemMetrics.active_requests + (metricsData.length * 5))
          }
        });
      }

      const endTime = Date.now();
      const concurrencyMetrics = {
        total_duration: endTime - startTime,
        operations: metricsData.map(m => ({
          name: m.step,
          duration: m.duration,
          metrics: m.system
        })),
        system_impact: {
          final_heap_used: metricsData[metricsData.length - 1].system.heap_used,
          peak_active_requests: Math.max(...metricsData.map(m => m.system.active_requests)),
          heap_growth: metricsData[metricsData.length - 1].system.heap_used - mockSystemMetrics.heap_used
        }
      };

      testRunner.expectMetrics(concurrencyMetrics);
      expect(concurrencyMetrics.total_duration).toBeLessThan(10000);
      expect(concurrencyMetrics.system_impact.heap_growth).toBeLessThan(0.2);
      expect(concurrencyMetrics.system_impact.peak_active_requests).toBeLessThan(100);
    });
  });
});
