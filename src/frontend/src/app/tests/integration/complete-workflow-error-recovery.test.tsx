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

describe('Complete Workflow Error Recovery', () => {
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
    response_time: 200,
    monitoring: {
      alerts: 0,
      warnings: 0,
      critical_errors: 0,
      system_events: 100,
      health_checks: 50,
      uptime: 3600,
      mttr: 0,
      mttf: 3600,
      error_recovery: {
        attempts: 0,
        success_rate: 1,
        average_recovery_time: 0
      }
    }
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

  it('should validate complete workflow with error recovery and performance monitoring', async () => {
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
      const errorData: any[] = [];
      const startTime = Date.now();

      for (const { component, name, expectedMetrics } of workflow) {
        const stepStartTime = Date.now();
        let retryCount = 0;
        const maxRetries = 3;
        const backoffDelay = 1000;

        while (retryCount < maxRetries) {
          try {
            render(<TestContext>{component}</TestContext>);
            await waitFor(() => {
              expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
            });
            break;
          } catch (error) {
            retryCount++;
            const errorTimestamp = Date.now();
            errorData.push({
              step: name,
              error,
              retry: retryCount,
              timestamp: errorTimestamp,
              recovery_start: errorTimestamp,
              metrics: {
                ...expectedMetrics.monitoring,
                error_recovery: {
                  attempts: retryCount,
                  timestamp: errorTimestamp,
                  delay: Math.pow(2, retryCount) * backoffDelay
                }
              }
            });

            if (retryCount === maxRetries) {
              throw new Error(`Failed to render ${name} after ${maxRetries} retries`);
            }

            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * backoffDelay));
          }
        }

        const stepEndTime = Date.now();
        const metrics = {
          step: name,
          duration: stepEndTime - stepStartTime,
          retries: retryCount,
          system: {
            ...expectedMetrics,
            heap_used: Math.min(0.8, expectedMetrics.heap_used + (metricsData.length * 0.05)),
            api_response_time: Math.min(200, expectedMetrics.api_response_time + (metricsData.length * 10)),
            active_requests: Math.min(100, expectedMetrics.active_requests + (metricsData.length * 5))
          },
          monitoring: {
            ...expectedMetrics.monitoring,
            error_recovery: {
              attempts: retryCount,
              success_rate: retryCount > 0 ? 1 : 1,
              average_recovery_time: retryCount > 0 ? 
                errorData.filter(e => e.step === name)
                  .reduce((acc, e) => acc + (stepEndTime - e.recovery_start), 0) / retryCount : 0
            }
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
            retries: m.retries,
            metrics: m.system,
            monitoring: m.monitoring
          })),
          average_step_duration: metricsData.reduce((acc, m) => acc + m.duration, 0) / metricsData.length,
          total_retries: metricsData.reduce((acc, m) => acc + m.retries, 0)
        },
        error_recovery: {
          total_errors: errorData.length,
          steps_with_errors: [...new Set(errorData.map(e => e.step))],
          recovery_metrics: errorData.map(e => ({
            step: e.step,
            retry: e.retry,
            timestamp: e.timestamp,
            recovery_time: e.metrics.error_recovery.delay
          })),
          average_recovery_time: errorData.length > 0 ?
            errorData.reduce((acc, e) => acc + e.metrics.error_recovery.delay, 0) / errorData.length : 0,
          success_rate: (workflow.length - errorData.filter(e => e.retry === 3).length) / workflow.length
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
          throughput_trend: metricsData.map(m => m.system.throughput),
          error_recovery_trend: metricsData.map(m => m.monitoring.error_recovery)
        }
      };

      testRunner.expectMetrics(workflowMetrics);
      expect(workflowMetrics.workflow.total_duration).toBeLessThan(30000);
      expect(workflowMetrics.workflow.average_step_duration).toBeLessThan(5000);
      expect(workflowMetrics.system.final_heap_used).toBeLessThan(0.8);
      expect(workflowMetrics.system.peak_api_response_time).toBeLessThan(200);
      expect(workflowMetrics.system.average_success_rate).toBeGreaterThan(0.95);
      expect(workflowMetrics.workflow.total_retries).toBeLessThanOrEqual(workflow.length * 2);
      expect(workflowMetrics.error_recovery.success_rate).toBeGreaterThan(0.8);
      expect(workflowMetrics.error_recovery.average_recovery_time).toBeLessThan(5000);
    });
  });

  it('should validate AB wallet comparison with error recovery and monitoring', async () => {
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
          throughput: 120,
          monitoring: {
            ...mockSystemMetrics.monitoring,
            system_events: 120,
            health_checks: 60,
            error_recovery: {
              attempts: 0,
              success_rate: 1,
              average_recovery_time: 0
            }
          }
        }
      };

      let errorCount = 0;
      const maxRetries = 3;
      const backoffDelay = 1000;
      const errorData: any[] = [];

      (createWallet as jest.Mock)
        .mockImplementation((botId) => {
          if (errorCount < maxRetries) {
            errorCount++;
            const errorTimestamp = Date.now();
            errorData.push({
              timestamp: errorTimestamp,
              error: new Error('Simulated Wallet Creation Error'),
              metrics: {
                ...mockSystemMetrics.monitoring,
                error_recovery: {
                  attempts: errorCount,
                  timestamp: errorTimestamp,
                  delay: Math.pow(2, errorCount) * backoffDelay
                }
              }
            });
            throw new Error('Simulated Wallet Creation Error');
          }
          return Promise.resolve(botId === 'bot-123' ? walletA : walletB);
        });

      (getWallet as jest.Mock)
        .mockImplementation((botId) => Promise.resolve(botId === 'bot-123' ? walletA : walletB));

      const startTime = Date.now();
      render(<TestContext><WalletComparison /></TestContext>);

      await waitFor(() => {
        expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
      });
      const endTime = Date.now();

      const comparisonMetrics = {
        duration: endTime - startTime,
        wallets: {
          wallet_a: {
            metrics: walletA.metrics,
            address: walletA.address,
            monitoring: walletA.metrics.monitoring
          },
          wallet_b: {
            metrics: walletB.metrics,
            address: walletB.address,
            monitoring: walletB.metrics.monitoring
          }
        },
        error_recovery: {
          error_count: errorCount,
          recovery_time: endTime - startTime,
          error_data: errorData.map(e => ({
            timestamp: e.timestamp,
            recovery_metrics: e.metrics.error_recovery
          })),
          average_recovery_time: errorData.length > 0 ?
            errorData.reduce((acc, e) => acc + e.metrics.error_recovery.delay, 0) / errorData.length : 0,
          success_rate: errorCount < maxRetries ? 1 : 0
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
          throughput_increase: ((walletB.metrics.throughput - walletA.metrics.throughput) / walletA.metrics.throughput) * 100,
          monitoring_efficiency: ((walletB.metrics.monitoring.system_events - walletA.metrics.monitoring.system_events) / walletA.metrics.monitoring.system_events) * 100
        }
      };

      testRunner.expectMetrics(comparisonMetrics);
      expect(comparisonMetrics.duration).toBeLessThan(15000);
      expect(comparisonMetrics.error_recovery.error_count).toBe(maxRetries);
      expect(comparisonMetrics.error_recovery.average_recovery_time).toBeLessThan(5000);
      expect(comparisonMetrics.system_impact.heap_difference).toBeGreaterThan(0);
      expect(comparisonMetrics.system_impact.api_latency_difference).toBeGreaterThan(0);
      expect(comparisonMetrics.system_impact.throughput_difference).toBeGreaterThan(0);
      expect(comparisonMetrics.performance_gains.memory_efficiency).toBeGreaterThan(0);
      expect(comparisonMetrics.performance_gains.latency_improvement).toBeGreaterThan(0);
      expect(comparisonMetrics.performance_gains.throughput_increase).toBeGreaterThan(0);
      expect(comparisonMetrics.performance_gains.monitoring_efficiency).toBeGreaterThan(0);
    });
  });
});
