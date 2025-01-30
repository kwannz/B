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

describe('System Health Metrics Integration', () => {
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

  it('should track system health metrics during normal operation', async () => {
    const metrics = {
      health: [] as { timestamp: number; metrics: any }[],
      errors: 0,
      warnings: 0,
      measurements: 0
    };

    const mockHealthData = [
      {
        system: {
          cpu_usage: 45,
          memory_usage: 60,
          disk_usage: 55,
          network_latency: 150,
          error_rate: 0.01,
          warning_count: 2
        },
        services: {
          api_gateway: 'healthy',
          trading_engine: 'healthy',
          monitoring: 'healthy'
        }
      },
      {
        system: {
          cpu_usage: 50,
          memory_usage: 65,
          disk_usage: 57,
          network_latency: 160,
          error_rate: 0.02,
          warning_count: 3
        },
        services: {
          api_gateway: 'healthy',
          trading_engine: 'degraded',
          monitoring: 'healthy'
        }
      }
    ];

    let updateCount = 0;
    (getBotStatus as jest.Mock).mockImplementation(() => {
      const data = mockHealthData[updateCount++ % mockHealthData.length];
      metrics.health.push({
        timestamp: Date.now(),
        metrics: data
      });
      metrics.measurements++;
      metrics.errors += data.system.error_rate > 0.05 ? 1 : 0;
      metrics.warnings += data.system.warning_count;
      return Promise.resolve({
        id: 'bot-123',
        status: 'active',
        metrics: data
      });
    });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(metrics.health.length).toBeGreaterThan(0);
    });

    const avgCpuUsage = metrics.health.reduce((sum, h) => sum + h.metrics.system.cpu_usage, 0) / metrics.health.length;
    const avgMemoryUsage = metrics.health.reduce((sum, h) => sum + h.metrics.system.memory_usage, 0) / metrics.health.length;
    const avgLatency = metrics.health.reduce((sum, h) => sum + h.metrics.system.network_latency, 0) / metrics.health.length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / metrics.measurements,
        apiLatency: avgLatency,
        systemHealth: 1 - (metrics.errors / metrics.measurements),
        successRate: 1 - (metrics.errors / metrics.measurements),
        totalTrades: 0,
        walletBalance: 0
      },
      system: {
        avgCpuUsage,
        avgMemoryUsage,
        avgLatency,
        warningsPerMeasurement: metrics.warnings / metrics.measurements,
        measurements: metrics.measurements,
        serviceHealth: metrics.health.reduce((acc, h) => {
          Object.entries(h.metrics.services).forEach(([service, status]) => {
            if (!acc[service]) acc[service] = [];
            acc[service].push(status === 'healthy' ? 1 : 0);
          });
          return acc;
        }, {} as Record<string, number[]>)
      }
    };

    expect(testMetrics.system.measurements).toBeGreaterThan(0);
    expect(testMetrics.performance.systemHealth).toBeGreaterThan(0.9);
    expect(testMetrics.system.avgCpuUsage).toBeLessThan(80);
  });

  it('should track system metrics during service degradation', async () => {
    const metrics = {
      degradation: [] as { service: string; timestamp: number; severity: number }[],
      recoveries: [] as { service: string; timestamp: number; duration: number }[]
    };

    const mockDegradation = [
      {
        system: {
          cpu_usage: 85,
          memory_usage: 80,
          network_latency: 300,
          error_rate: 0.1
        },
        services: {
          api_gateway: 'degraded',
          trading_engine: 'healthy',
          monitoring: 'degraded'
        }
      },
      {
        system: {
          cpu_usage: 70,
          memory_usage: 75,
          network_latency: 200,
          error_rate: 0.05
        },
        services: {
          api_gateway: 'healthy',
          trading_engine: 'healthy',
          monitoring: 'healthy'
        }
      }
    ];

    let degradationIndex = 0;
    (getBotStatus as jest.Mock).mockImplementation(() => {
      const data = mockDegradation[degradationIndex++ % mockDegradation.length];
      
      Object.entries(data.services).forEach(([service, status]) => {
        if (status === 'degraded') {
          metrics.degradation.push({
            service,
            timestamp: Date.now(),
            severity: data.system.error_rate
          });
        } else if (metrics.degradation.find(d => d.service === service)) {
          const degradationStart = metrics.degradation.find(d => d.service === service)!.timestamp;
          metrics.recoveries.push({
            service,
            timestamp: Date.now(),
            duration: Date.now() - degradationStart
          });
        }
      });

      return Promise.resolve({
        id: 'bot-123',
        status: data.services.trading_engine === 'healthy' ? 'active' : 'degraded',
        metrics: data
      });
    });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(metrics.degradation.length).toBeGreaterThan(0);
    });

    await waitFor(() => {
      expect(metrics.recoveries.length).toBeGreaterThan(0);
    });

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.degradation.length / (mockDegradation.length * Object.keys(mockDegradation[0].services).length),
        apiLatency: 0,
        systemHealth: metrics.recoveries.length / metrics.degradation.length,
        successRate: metrics.recoveries.length / metrics.degradation.length,
        totalTrades: 0,
        walletBalance: 0
      },
      degradation: {
        incidents: metrics.degradation.length,
        recoveries: metrics.recoveries.length,
        avgRecoveryTime: metrics.recoveries.reduce((sum, r) => sum + r.duration, 0) / metrics.recoveries.length,
        serviceImpact: metrics.degradation.reduce((acc, d) => {
          if (!acc[d.service]) acc[d.service] = 0;
          acc[d.service]++;
          return acc;
        }, {} as Record<string, number>)
      }
    };

    expect(testMetrics.degradation.incidents).toBeGreaterThan(0);
    expect(testMetrics.degradation.recoveries).toBeGreaterThan(0);
    expect(testMetrics.performance.systemHealth).toBeGreaterThan(0);
  });

  it('should validate system metrics accuracy and consistency', async () => {
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
        expect(data.system.error_rate).toBeGreaterThanOrEqual(0);
        expect(data.system.error_rate).toBeLessThanOrEqual(1);
        metrics.validations.success++;
        return true;
      } catch (error) {
        metrics.validations.failure++;
        return false;
      }
    };

    (getBotStatus as jest.Mock).mockImplementation(() => {
      const data = {
        system: {
          cpu_usage: 45 + Math.random() * 10,
          memory_usage: 60 + Math.random() * 5,
          network_latency: 150 + Math.random() * 20,
          error_rate: 0.01 + Math.random() * 0.01
        }
      };

      metrics.samples.push({
        timestamp: Date.now(),
        metrics: data
      });

      validateMetrics(data);
      return Promise.resolve({
        id: 'bot-123',
        status: 'active',
        metrics: data
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
        apiLatency: 0,
        systemHealth: metrics.validations.success / (metrics.validations.success + metrics.validations.failure),
        successRate: metrics.validations.success / (metrics.validations.success + metrics.validations.failure),
        totalTrades: 0,
        walletBalance: 0
      },
      validation: {
        samples: metrics.samples.length,
        validationRate: metrics.validations.success / (metrics.validations.success + metrics.validations.failure),
        metrics: {
          cpuUsageRange: {
            min: Math.min(...metrics.samples.map(s => s.metrics.system.cpu_usage)),
            max: Math.max(...metrics.samples.map(s => s.metrics.system.cpu_usage))
          },
          memoryUsageRange: {
            min: Math.min(...metrics.samples.map(s => s.metrics.system.memory_usage)),
            max: Math.max(...metrics.samples.map(s => s.metrics.system.memory_usage))
          },
          latencyRange: {
            min: Math.min(...metrics.samples.map(s => s.metrics.system.network_latency)),
            max: Math.max(...metrics.samples.map(s => s.metrics.system.network_latency))
          }
        }
      }
    };

    expect(testMetrics.validation.samples).toBeGreaterThan(0);
    expect(testMetrics.validation.validationRate).toBe(1);
    expect(testMetrics.validation.metrics.cpuUsageRange.max).toBeLessThan(100);
    expect(testMetrics.validation.metrics.memoryUsageRange.max).toBeLessThan(100);
  });
});
