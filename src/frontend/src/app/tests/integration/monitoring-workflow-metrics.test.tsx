import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import { useDebugStore } from '@/app/stores/debugStore';
import { TestMetrics } from '../types/test.types';
import TradingDashboard from '@/app/trading-dashboard/page';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/api/client');
jest.mock('@/app/stores/debugStore');

describe('Monitoring Workflow Metrics Integration', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn()
  };

  const mockWallet = {
    connected: true,
    connecting: false,
    publicKey: { toString: () => '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK' },
    connect: jest.fn(),
    disconnect: jest.fn(),
    signTransaction: jest.fn(),
    signAllTransactions: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useWallet as jest.Mock).mockReturnValue(mockWallet);
  });

  it('should track monitoring metrics during system operation', async () => {
    const metrics = {
      monitoring: [] as { type: string; metrics: any; timestamp: number }[],
      alerts: [] as { type: string; severity: string; timestamp: number }[],
      recoveries: [] as { type: string; duration: number; timestamp: number }[]
    };

    const mockMonitoringData = [
      {
        system: {
          cpu_usage: 45,
          memory_usage: 60,
          disk_usage: 55,
          network_latency: 150
        },
        services: {
          api_gateway: 'healthy',
          trading_engine: 'healthy',
          monitoring: 'healthy'
        },
        alerts: []
      },
      {
        system: {
          cpu_usage: 85,
          memory_usage: 80,
          disk_usage: 75,
          network_latency: 250
        },
        services: {
          api_gateway: 'degraded',
          trading_engine: 'healthy',
          monitoring: 'degraded'
        },
        alerts: [
          { type: 'high_cpu', severity: 'warning' },
          { type: 'high_memory', severity: 'warning' },
          { type: 'service_degradation', severity: 'critical' }
        ]
      },
      {
        system: {
          cpu_usage: 50,
          memory_usage: 65,
          disk_usage: 60,
          network_latency: 160
        },
        services: {
          api_gateway: 'healthy',
          trading_engine: 'healthy',
          monitoring: 'healthy'
        },
        alerts: []
      }
    ];

    let dataIndex = 0;
    (getBotStatus as jest.Mock).mockImplementation((botId) => {
      const data = mockMonitoringData[dataIndex++ % mockMonitoringData.length];
      
      metrics.monitoring.push({
        type: 'system_metrics',
        metrics: data.system,
        timestamp: Date.now()
      });

      data.alerts.forEach(alert => {
        metrics.alerts.push({
          type: alert.type,
          severity: alert.severity,
          timestamp: Date.now()
        });
      });

      if (dataIndex > 1 && mockMonitoringData[dataIndex - 2].alerts.length > 0) {
        metrics.recoveries.push({
          type: 'system_recovery',
          duration: Date.now() - metrics.alerts[metrics.alerts.length - 1].timestamp,
          timestamp: Date.now()
        });
      }

      return Promise.resolve({
        id: botId,
        status: 'active',
        metrics: data
      });
    });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    for (const data of mockMonitoringData) {
      await waitFor(() => {
        expect(screen.getByText(new RegExp(`${data.system.cpu_usage}%`))).toBeInTheDocument();
      });
    }

    const avgCpuUsage = metrics.monitoring.reduce((sum, m) => sum + m.metrics.cpu_usage, 0) / metrics.monitoring.length;
    const avgMemoryUsage = metrics.monitoring.reduce((sum, m) => sum + m.metrics.memory_usage, 0) / metrics.monitoring.length;
    const avgLatency = metrics.monitoring.reduce((sum, m) => sum + m.metrics.network_latency, 0) / metrics.monitoring.length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.alerts.filter(a => a.severity === 'critical').length / metrics.monitoring.length,
        apiLatency: avgLatency,
        systemHealth: metrics.recoveries.length / metrics.alerts.length,
        successRate: metrics.recoveries.length / metrics.alerts.length,
        totalTrades: 0,
        walletBalance: 0
      },
      monitoring: {
        samples: metrics.monitoring.length,
        alerts: metrics.alerts.length,
        recoveries: metrics.recoveries.length,
        avgMetrics: {
          cpuUsage: avgCpuUsage,
          memoryUsage: avgMemoryUsage,
          latency: avgLatency
        },
        alertsByType: metrics.alerts.reduce((acc, alert) => {
          if (!acc[alert.type]) acc[alert.type] = 0;
          acc[alert.type]++;
          return acc;
        }, {} as Record<string, number>)
      }
    };

    expect(testMetrics.monitoring.samples).toBe(mockMonitoringData.length);
    expect(testMetrics.monitoring.alerts).toBeGreaterThan(0);
    expect(testMetrics.monitoring.recoveries).toBeGreaterThan(0);
  });

  it('should track error recovery metrics during system degradation', async () => {
    const metrics = {
      errors: [] as { type: string; severity: string; timestamp: number }[],
      recoveries: [] as { type: string; duration: number }[],
      actions: [] as { type: string; result: string; timestamp: number }[]
    };

    const mockErrorScenarios = [
      {
        type: 'service_error',
        severity: 'critical',
        services: {
          api_gateway: 'failed',
          trading_engine: 'degraded',
          monitoring: 'healthy'
        }
      },
      {
        type: 'performance_degradation',
        severity: 'warning',
        services: {
          api_gateway: 'degraded',
          trading_engine: 'healthy',
          monitoring: 'healthy'
        }
      },
      {
        type: 'system_overload',
        severity: 'critical',
        services: {
          api_gateway: 'healthy',
          trading_engine: 'failed',
          monitoring: 'degraded'
        }
      }
    ];

    let scenarioIndex = 0;
    (getBotStatus as jest.Mock).mockImplementation((botId) => {
      const scenario = mockErrorScenarios[scenarioIndex++ % mockErrorScenarios.length];
      
      metrics.errors.push({
        type: scenario.type,
        severity: scenario.severity,
        timestamp: Date.now()
      });

      if (scenarioIndex > 1) {
        const previousError = metrics.errors[metrics.errors.length - 2];
        metrics.recoveries.push({
          type: previousError.type,
          duration: Date.now() - previousError.timestamp
        });
      }

      metrics.actions.push({
        type: 'recovery_attempt',
        result: Object.values(scenario.services).every(s => s !== 'failed') ? 'success' : 'failure',
        timestamp: Date.now()
      });

      return Promise.resolve({
        id: botId,
        status: Object.values(scenario.services).some(s => s === 'failed') ? 'error' : 'active',
        metrics: scenario
      });
    });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    for (const scenario of mockErrorScenarios) {
      await waitFor(() => {
        expect(screen.getByText(new RegExp(scenario.type))).toBeInTheDocument();
      });
    }

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors.filter(e => e.severity === 'critical').length / metrics.errors.length,
        apiLatency: 0,
        systemHealth: metrics.recoveries.length / metrics.errors.length,
        successRate: metrics.actions.filter(a => a.result === 'success').length / metrics.actions.length,
        totalTrades: 0,
        walletBalance: 0
      },
      recovery: {
        totalErrors: metrics.errors.length,
        criticalErrors: metrics.errors.filter(e => e.severity === 'critical').length,
        recoveryAttempts: metrics.actions.length,
        successfulRecoveries: metrics.recoveries.length,
        avgRecoveryTime: metrics.recoveries.reduce((sum, r) => sum + r.duration, 0) / metrics.recoveries.length,
        errorsByType: metrics.errors.reduce((acc, error) => {
          if (!acc[error.type]) acc[error.type] = 0;
          acc[error.type]++;
          return acc;
        }, {} as Record<string, number>)
      }
    };

    expect(testMetrics.recovery.totalErrors).toBeGreaterThan(0);
    expect(testMetrics.recovery.successfulRecoveries).toBeGreaterThan(0);
    expect(testMetrics.performance.systemHealth).toBeGreaterThan(0);
  });

  it('should validate monitoring metrics consistency', async () => {
    const metrics = {
      samples: [] as { timestamp: number; metrics: any }[],
      validations: {
        success: 0,
        failure: 0
      }
    };

    const validateMetrics = (data: any) => {
      try {
        expect(data.system.cpu_usage).toBeGreaterThanOrEqual(0);
        expect(data.system.cpu_usage).toBeLessThanOrEqual(100);
        expect(data.system.memory_usage).toBeGreaterThanOrEqual(0);
        expect(data.system.memory_usage).toBeLessThanOrEqual(100);
        expect(data.system.network_latency).toBeGreaterThan(0);
        metrics.validations.success++;
        return true;
      } catch (error) {
        metrics.validations.failure++;
        return false;
      }
    };

    const mockSystemMetrics = {
      system: {
        cpu_usage: 45 + Math.random() * 10,
        memory_usage: 60 + Math.random() * 5,
        network_latency: 150 + Math.random() * 20
      },
      services: {
        api_gateway: 'healthy',
        trading_engine: 'healthy',
        monitoring: 'healthy'
      }
    };

    (getBotStatus as jest.Mock).mockImplementation((botId) => {
      metrics.samples.push({
        timestamp: Date.now(),
        metrics: mockSystemMetrics
      });

      validateMetrics(mockSystemMetrics);
      return Promise.resolve({
        id: botId,
        status: 'active',
        metrics: mockSystemMetrics
      });
    });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(metrics.samples.length).toBeGreaterThan(0);
    });

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.validations.failure / (metrics.validations.success + metrics.validations.failure),
        apiLatency: metrics.samples.reduce((sum, s) => sum + s.metrics.system.network_latency, 0) / metrics.samples.length,
        systemHealth: metrics.validations.success / (metrics.validations.success + metrics.validations.failure),
        successRate: metrics.validations.success / (metrics.validations.success + metrics.validations.failure),
        totalTrades: 0,
        walletBalance: 0
      },
      validation: {
        samples: metrics.samples.length,
        validationRate: metrics.validations.success / (metrics.validations.success + metrics.validations.failure),
        metricsRanges: {
          cpuUsage: {
            min: Math.min(...metrics.samples.map(s => s.metrics.system.cpu_usage)),
            max: Math.max(...metrics.samples.map(s => s.metrics.system.cpu_usage))
          },
          memoryUsage: {
            min: Math.min(...metrics.samples.map(s => s.metrics.system.memory_usage)),
            max: Math.max(...metrics.samples.map(s => s.metrics.system.memory_usage))
          },
          latency: {
            min: Math.min(...metrics.samples.map(s => s.metrics.system.network_latency)),
            max: Math.max(...metrics.samples.map(s => s.metrics.system.network_latency))
          }
        }
      }
    };

    expect(testMetrics.validation.samples).toBeGreaterThan(0);
    expect(testMetrics.validation.validationRate).toBe(1);
    expect(testMetrics.validation.metricsRanges.cpuUsage.max).toBeLessThanOrEqual(100);
    expect(testMetrics.validation.metricsRanges.memoryUsage.max).toBeLessThanOrEqual(100);
  });
});
