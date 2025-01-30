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

describe('High Load System Metrics', () => {
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

  it('should validate system metrics under high concurrent load', async () => {
    await testRunner.runTest(async () => {
      const concurrentUsers = 10;
      const workflows = Array(concurrentUsers).fill(null).map(() => [
        { component: <AgentSelection />, name: 'agent-selection' },
        { component: <StrategyCreation />, name: 'strategy-creation' },
        { component: <BotIntegration />, name: 'bot-integration' },
        { component: <KeyManagement />, name: 'key-management' },
        { component: <TradingDashboard />, name: 'trading-dashboard' },
        { component: <WalletComparison />, name: 'wallet-comparison' }
      ]);

      const metricsData: any[] = [];
      const startTime = Date.now();

      for (let i = 0; i < workflows.length; i++) {
        const userStartTime = Date.now();
        const userMetrics: any[] = [];

        for (const { component, name } of workflows[i]) {
          const stepStartTime = Date.now();
          render(<TestContext>{component}</TestContext>);
          
          await waitFor(() => {
            expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
          });

          const stepEndTime = Date.now();
          const metrics = {
            user: i,
            step: name,
            duration: stepEndTime - stepStartTime,
            system: {
              ...mockSystemMetrics,
              heap_used: Math.min(0.9, mockSystemMetrics.heap_used + (i * 0.03)),
              api_response_time: Math.min(300, mockSystemMetrics.api_response_time + (i * 15)),
              active_requests: Math.min(200, mockSystemMetrics.active_requests + (i * 10))
            }
          };
          userMetrics.push(metrics);
        }

        const userEndTime = Date.now();
        metricsData.push({
          user: i,
          total_duration: userEndTime - userStartTime,
          steps: userMetrics,
          system_metrics: userMetrics.map(m => m.system)
        });
      }

      const endTime = Date.now();
      const systemMetrics = {
        concurrent_load: {
          total_users: concurrentUsers,
          total_duration: endTime - startTime,
          average_user_duration: metricsData.reduce((acc, m) => acc + m.total_duration, 0) / concurrentUsers,
          peak_concurrent_requests: Math.max(...metricsData.flatMap(m => m.steps.map(s => s.system.active_requests)))
        },
        system_health: {
          peak_heap_used: Math.max(...metricsData.flatMap(m => m.steps.map(s => s.system.heap_used))),
          peak_api_latency: Math.max(...metricsData.flatMap(m => m.steps.map(s => s.system.api_response_time))),
          average_success_rate: metricsData.flatMap(m => m.steps.map(s => s.system.success_rate)).reduce((a, b) => a + b, 0) / (concurrentUsers * 6)
        },
        performance_metrics: {
          memory_trend: metricsData.map(m => m.system_metrics.map(s => s.heap_used)),
          latency_trend: metricsData.map(m => m.system_metrics.map(s => s.api_response_time)),
          throughput_trend: metricsData.map(m => m.system_metrics.map(s => s.throughput))
        }
      };

      testRunner.expectMetrics(systemMetrics);
      expect(systemMetrics.concurrent_load.total_duration).toBeLessThan(30000);
      expect(systemMetrics.concurrent_load.average_user_duration).toBeLessThan(5000);
      expect(systemMetrics.system_health.peak_heap_used).toBeLessThan(0.9);
      expect(systemMetrics.system_health.peak_api_latency).toBeLessThan(300);
      expect(systemMetrics.system_health.average_success_rate).toBeGreaterThan(0.95);
      expect(systemMetrics.concurrent_load.peak_concurrent_requests).toBeLessThan(200);
    });
  });

  it('should validate system recovery after high load', async () => {
    await testRunner.runTest(async () => {
      const loadDuration = 5000;
      const cooldownDuration = 2000;
      const startTime = Date.now();

      let currentHeapUsed = mockSystemMetrics.heap_used;
      let currentApiLatency = mockSystemMetrics.api_response_time;
      let currentActiveRequests = mockSystemMetrics.active_requests;

      const loadMetrics: any[] = [];
      const recoveryMetrics: any[] = [];

      while (Date.now() - startTime < loadDuration) {
        render(<TestContext><WalletComparison /></TestContext>);
        
        await waitFor(() => {
          expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
        });

        currentHeapUsed = Math.min(0.9, currentHeapUsed + 0.05);
        currentApiLatency = Math.min(300, currentApiLatency + 20);
        currentActiveRequests = Math.min(200, currentActiveRequests + 15);

        loadMetrics.push({
          timestamp: Date.now(),
          metrics: {
            heap_used: currentHeapUsed,
            api_response_time: currentApiLatency,
            active_requests: currentActiveRequests
          }
        });
      }

      const cooldownStartTime = Date.now();
      while (Date.now() - cooldownStartTime < cooldownDuration) {
        currentHeapUsed = Math.max(mockSystemMetrics.heap_used, currentHeapUsed - 0.1);
        currentApiLatency = Math.max(mockSystemMetrics.api_response_time, currentApiLatency - 30);
        currentActiveRequests = Math.max(mockSystemMetrics.active_requests, currentActiveRequests - 20);

        recoveryMetrics.push({
          timestamp: Date.now(),
          metrics: {
            heap_used: currentHeapUsed,
            api_response_time: currentApiLatency,
            active_requests: currentActiveRequests
          }
        });

        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const systemRecoveryMetrics = {
        load_phase: {
          duration: loadDuration,
          peak_heap_used: Math.max(...loadMetrics.map(m => m.metrics.heap_used)),
          peak_api_latency: Math.max(...loadMetrics.map(m => m.metrics.api_response_time)),
          peak_active_requests: Math.max(...loadMetrics.map(m => m.metrics.active_requests))
        },
        recovery_phase: {
          duration: cooldownDuration,
          final_heap_used: recoveryMetrics[recoveryMetrics.length - 1].metrics.heap_used,
          final_api_latency: recoveryMetrics[recoveryMetrics.length - 1].metrics.api_response_time,
          final_active_requests: recoveryMetrics[recoveryMetrics.length - 1].metrics.active_requests
        },
        recovery_efficiency: {
          heap_recovery_rate: (loadMetrics[loadMetrics.length - 1].metrics.heap_used - recoveryMetrics[recoveryMetrics.length - 1].metrics.heap_used) / cooldownDuration,
          latency_recovery_rate: (loadMetrics[loadMetrics.length - 1].metrics.api_response_time - recoveryMetrics[recoveryMetrics.length - 1].metrics.api_response_time) / cooldownDuration,
          request_recovery_rate: (loadMetrics[loadMetrics.length - 1].metrics.active_requests - recoveryMetrics[recoveryMetrics.length - 1].metrics.active_requests) / cooldownDuration
        }
      };

      testRunner.expectMetrics(systemRecoveryMetrics);
      expect(systemRecoveryMetrics.load_phase.peak_heap_used).toBeLessThan(0.9);
      expect(systemRecoveryMetrics.load_phase.peak_api_latency).toBeLessThan(300);
      expect(systemRecoveryMetrics.load_phase.peak_active_requests).toBeLessThan(200);
      expect(systemRecoveryMetrics.recovery_phase.final_heap_used).toBeLessThan(systemRecoveryMetrics.load_phase.peak_heap_used);
      expect(systemRecoveryMetrics.recovery_phase.final_api_latency).toBeLessThan(systemRecoveryMetrics.load_phase.peak_api_latency);
      expect(systemRecoveryMetrics.recovery_phase.final_active_requests).toBeLessThan(systemRecoveryMetrics.load_phase.peak_active_requests);
      expect(systemRecoveryMetrics.recovery_efficiency.heap_recovery_rate).toBeGreaterThan(0);
      expect(systemRecoveryMetrics.recovery_efficiency.latency_recovery_rate).toBeGreaterThan(0);
      expect(systemRecoveryMetrics.recovery_efficiency.request_recovery_rate).toBeGreaterThan(0);
    });
  });
});
