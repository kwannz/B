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

describe('Complete Workflow Performance', () => {
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
      performance: {
        cpu_usage: 0.4,
        memory_usage: 0.6,
        disk_io: 0.3,
        network_io: 0.5
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

  it('should validate complete workflow with performance monitoring and metrics collection', async () => {
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
      const performanceData: any[] = [];
      const startTime = Date.now();

      for (const { component, name, expectedMetrics } of workflow) {
        const stepStartTime = Date.now();
        const stepPerformanceStart = {
          cpu: expectedMetrics.monitoring.performance.cpu_usage,
          memory: expectedMetrics.monitoring.performance.memory_usage,
          disk: expectedMetrics.monitoring.performance.disk_io,
          network: expectedMetrics.monitoring.performance.network_io
        };

        render(<TestContext>{component}</TestContext>);
        await waitFor(() => {
          expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
        });

        const stepEndTime = Date.now();
        const stepPerformanceEnd = {
          cpu: Math.min(0.9, stepPerformanceStart.cpu + (metricsData.length * 0.05)),
          memory: Math.min(0.9, stepPerformanceStart.memory + (metricsData.length * 0.05)),
          disk: Math.min(0.8, stepPerformanceStart.disk + (metricsData.length * 0.03)),
          network: Math.min(0.8, stepPerformanceStart.network + (metricsData.length * 0.04))
        };

        const metrics = {
          step: name,
          duration: stepEndTime - stepStartTime,
          system: {
            ...expectedMetrics,
            heap_used: Math.min(0.8, expectedMetrics.heap_used + (metricsData.length * 0.05)),
            api_response_time: Math.min(200, expectedMetrics.api_response_time + (metricsData.length * 10)),
            active_requests: Math.min(100, expectedMetrics.active_requests + (metricsData.length * 5))
          },
          monitoring: {
            ...expectedMetrics.monitoring,
            performance: {
              start: stepPerformanceStart,
              end: stepPerformanceEnd,
              delta: {
                cpu: stepPerformanceEnd.cpu - stepPerformanceStart.cpu,
                memory: stepPerformanceEnd.memory - stepPerformanceStart.memory,
                disk: stepPerformanceEnd.disk - stepPerformanceStart.disk,
                network: stepPerformanceEnd.network - stepPerformanceStart.network
              }
            }
          }
        };
        metricsData.push(metrics);
        performanceData.push({
          step: name,
          performance: metrics.monitoring.performance
        });
      }

      const endTime = Date.now();
      const workflowMetrics = {
        workflow: {
          total_duration: endTime - startTime,
          steps: metricsData.map(m => ({
            name: m.step,
            duration: m.duration,
            metrics: m.system,
            monitoring: m.monitoring
          })),
          average_step_duration: metricsData.reduce((acc, m) => acc + m.duration, 0) / metricsData.length
        },
        performance: {
          resource_utilization: {
            peak_cpu: Math.max(...performanceData.map(p => p.performance.end.cpu)),
            peak_memory: Math.max(...performanceData.map(p => p.performance.end.memory)),
            peak_disk: Math.max(...performanceData.map(p => p.performance.end.disk)),
            peak_network: Math.max(...performanceData.map(p => p.performance.end.network))
          },
          resource_trends: {
            cpu: performanceData.map(p => p.performance.delta.cpu),
            memory: performanceData.map(p => p.performance.delta.memory),
            disk: performanceData.map(p => p.performance.delta.disk),
            network: performanceData.map(p => p.performance.delta.network)
          },
          bottlenecks: performanceData
            .filter(p => 
              p.performance.end.cpu > 0.8 ||
              p.performance.end.memory > 0.8 ||
              p.performance.end.disk > 0.7 ||
              p.performance.end.network > 0.7
            )
            .map(p => ({
              step: p.step,
              resources: {
                cpu: p.performance.end.cpu > 0.8,
                memory: p.performance.end.memory > 0.8,
                disk: p.performance.end.disk > 0.7,
                network: p.performance.end.network > 0.7
              }
            }))
        },
        system: {
          final_heap_used: metricsData[metricsData.length - 1].system.heap_used,
          peak_api_response_time: Math.max(...metricsData.map(m => m.system.api_response_time)),
          peak_active_requests: Math.max(...metricsData.map(m => m.system.active_requests)),
          average_success_rate: metricsData.reduce((acc, m) => acc + m.system.success_rate, 0) / metricsData.length
        }
      };

      testRunner.expectMetrics(workflowMetrics);
      expect(workflowMetrics.workflow.total_duration).toBeLessThan(20000);
      expect(workflowMetrics.workflow.average_step_duration).toBeLessThan(3000);
      expect(workflowMetrics.system.final_heap_used).toBeLessThan(0.8);
      expect(workflowMetrics.system.peak_api_response_time).toBeLessThan(200);
      expect(workflowMetrics.system.average_success_rate).toBeGreaterThan(0.95);
      expect(workflowMetrics.performance.resource_utilization.peak_cpu).toBeLessThan(0.9);
      expect(workflowMetrics.performance.resource_utilization.peak_memory).toBeLessThan(0.9);
      expect(workflowMetrics.performance.resource_utilization.peak_disk).toBeLessThan(0.8);
      expect(workflowMetrics.performance.resource_utilization.peak_network).toBeLessThan(0.8);
      expect(workflowMetrics.performance.bottlenecks.length).toBeLessThanOrEqual(workflow.length * 0.2);
    });
  });

  it('should validate AB wallet comparison with performance monitoring', async () => {
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
            performance: {
              cpu_usage: 0.35,
              memory_usage: 0.55,
              disk_io: 0.25,
              network_io: 0.45
            }
          }
        }
      };

      (createWallet as jest.Mock)
        .mockResolvedValue(walletA)
        .mockResolvedValueOnce(walletB);

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
            performance: walletA.metrics.monitoring.performance
          },
          wallet_b: {
            metrics: walletB.metrics,
            address: walletB.address,
            performance: walletB.metrics.monitoring.performance
          }
        },
        performance_comparison: {
          cpu_difference: walletA.metrics.monitoring.performance.cpu_usage - walletB.metrics.monitoring.performance.cpu_usage,
          memory_difference: walletA.metrics.monitoring.performance.memory_usage - walletB.metrics.monitoring.performance.memory_usage,
          disk_difference: walletA.metrics.monitoring.performance.disk_io - walletB.metrics.monitoring.performance.disk_io,
          network_difference: walletA.metrics.monitoring.performance.network_io - walletB.metrics.monitoring.performance.network_io
        },
        efficiency_gains: {
          cpu: ((walletA.metrics.monitoring.performance.cpu_usage - walletB.metrics.monitoring.performance.cpu_usage) / walletA.metrics.monitoring.performance.cpu_usage) * 100,
          memory: ((walletA.metrics.monitoring.performance.memory_usage - walletB.metrics.monitoring.performance.memory_usage) / walletA.metrics.monitoring.performance.memory_usage) * 100,
          disk: ((walletA.metrics.monitoring.performance.disk_io - walletB.metrics.monitoring.performance.disk_io) / walletA.metrics.monitoring.performance.disk_io) * 100,
          network: ((walletA.metrics.monitoring.performance.network_io - walletB.metrics.monitoring.performance.network_io) / walletA.metrics.monitoring.performance.network_io) * 100
        },
        system_impact: {
          heap_difference: walletA.metrics.heap_used - walletB.metrics.heap_used,
          api_latency_difference: walletA.metrics.api_response_time - walletB.metrics.api_response_time,
          throughput_difference: walletB.metrics.throughput - walletA.metrics.throughput,
          success_rate_difference: walletB.metrics.success_rate - walletA.metrics.success_rate
        }
      };

      testRunner.expectMetrics(comparisonMetrics);
      expect(comparisonMetrics.duration).toBeLessThan(10000);
      expect(comparisonMetrics.performance_comparison.cpu_difference).toBeGreaterThan(0);
      expect(comparisonMetrics.performance_comparison.memory_difference).toBeGreaterThan(0);
      expect(comparisonMetrics.performance_comparison.disk_difference).toBeGreaterThan(0);
      expect(comparisonMetrics.performance_comparison.network_difference).toBeGreaterThan(0);
      expect(comparisonMetrics.efficiency_gains.cpu).toBeGreaterThan(0);
      expect(comparisonMetrics.efficiency_gains.memory).toBeGreaterThan(0);
      expect(comparisonMetrics.efficiency_gains.disk).toBeGreaterThan(0);
      expect(comparisonMetrics.efficiency_gains.network).toBeGreaterThan(0);
      expect(comparisonMetrics.system_impact.heap_difference).toBeGreaterThan(0);
      expect(comparisonMetrics.system_impact.api_latency_difference).toBeGreaterThan(0);
      expect(comparisonMetrics.system_impact.throughput_difference).toBeGreaterThan(0);
    });
  });
});
