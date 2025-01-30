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

describe('Performance Monitoring Metrics Integration', () => {
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

  it('should track performance metrics across system components', async () => {
    const metrics = {
      components: [] as { name: string; metrics: any; timestamp: number }[],
      errors: 0,
      successes: 0
    };

    const mockComponentMetrics = [
      {
        api_gateway: { latency: 150, error_rate: 0.01, requests_per_second: 100 },
        trading_engine: { cpu_usage: 45, memory_usage: 60, active_trades: 5 },
        monitoring: { data_points: 1000, collection_rate: 10, storage_usage: 40 }
      },
      {
        api_gateway: { latency: 160, error_rate: 0.02, requests_per_second: 120 },
        trading_engine: { cpu_usage: 50, memory_usage: 65, active_trades: 7 },
        monitoring: { data_points: 1200, collection_rate: 12, storage_usage: 45 }
      }
    ];

    let updateCount = 0;
    (getBotStatus as jest.Mock).mockImplementation(() => {
      const data = mockComponentMetrics[updateCount++ % mockComponentMetrics.length];
      Object.entries(data).forEach(([component, componentMetrics]) => {
        metrics.components.push({
          name: component,
          metrics: componentMetrics,
          timestamp: Date.now()
        });
      });
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
      expect(metrics.components.length).toBeGreaterThan(0);
    });

    const componentAverages = metrics.components.reduce((acc, component) => {
      if (!acc[component.name]) {
        acc[component.name] = {
          measurements: [],
          timestamps: []
        };
      }
      acc[component.name].measurements.push(component.metrics);
      acc[component.name].timestamps.push(component.timestamp);
      return acc;
    }, {} as Record<string, { measurements: any[]; timestamps: number[] }>);

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / (metrics.errors + metrics.successes),
        apiLatency: componentAverages.api_gateway?.measurements.reduce((sum, m) => sum + m.latency, 0) / 
                   (componentAverages.api_gateway?.measurements.length || 1),
        systemHealth: 1 - (metrics.errors / (metrics.errors + metrics.successes)),
        successRate: metrics.successes / (metrics.errors + metrics.successes),
        totalTrades: componentAverages.trading_engine?.measurements[
          componentAverages.trading_engine.measurements.length - 1
        ]?.active_trades || 0,
        walletBalance: 0
      },
      components: {
        monitored: Object.keys(componentAverages).length,
        measurements: metrics.components.length,
        metrics: Object.entries(componentAverages).reduce((acc, [component, data]) => {
          acc[component] = {
            updateFrequency: data.timestamps.length > 1 ? 
              (data.timestamps[data.timestamps.length - 1] - data.timestamps[0]) / (data.timestamps.length - 1) : 0,
            lastMetrics: data.measurements[data.measurements.length - 1]
          };
          return acc;
        }, {} as Record<string, any>)
      }
    };

    expect(testMetrics.components.monitored).toBeGreaterThan(0);
    expect(testMetrics.performance.apiLatency).toBeLessThan(200);
    expect(testMetrics.components.measurements).toBeGreaterThan(0);
  });

  it('should track performance recovery metrics during component degradation', async () => {
    const metrics = {
      degradation: [] as { component: string; severity: number; timestamp: number }[],
      recovery: [] as { component: string; duration: number; timestamp: number }[]
    };

    const mockDegradation = [
      {
        api_gateway: { status: 'degraded', latency: 300, error_rate: 0.1 },
        trading_engine: { status: 'healthy', cpu_usage: 45, memory_usage: 60 },
        monitoring: { status: 'degraded', collection_rate: 5, storage_usage: 90 }
      },
      {
        api_gateway: { status: 'healthy', latency: 150, error_rate: 0.01 },
        trading_engine: { status: 'healthy', cpu_usage: 50, memory_usage: 65 },
        monitoring: { status: 'healthy', collection_rate: 10, storage_usage: 45 }
      }
    ];

    let degradationIndex = 0;
    (getBotStatus as jest.Mock).mockImplementation(() => {
      const data = mockDegradation[degradationIndex++ % mockDegradation.length];
      
      Object.entries(data).forEach(([component, metrics]) => {
        if (metrics.status === 'degraded') {
          metrics.degradation.push({
            component,
            severity: component === 'api_gateway' ? metrics.error_rate : 
                     component === 'monitoring' ? metrics.storage_usage / 100 : 0,
            timestamp: Date.now()
          });
        } else if (metrics.degradation.find(d => d.component === component)) {
          const degradationStart = metrics.degradation.find(
            d => d.component === component
          )!.timestamp;
          metrics.recovery.push({
            component,
            duration: Date.now() - degradationStart,
            timestamp: Date.now()
          });
        }
      });

      return Promise.resolve({
        id: 'bot-123',
        status: Object.values(data).some(m => m.status === 'degraded') ? 
          'degraded' : 'healthy',
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
      expect(metrics.recovery.length).toBeGreaterThan(0);
    });

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.degradation.length / (metrics.degradation.length + metrics.recovery.length),
        apiLatency: 0,
        systemHealth: metrics.recovery.length / metrics.degradation.length,
        successRate: metrics.recovery.length / metrics.degradation.length,
        totalTrades: 0,
        walletBalance: 0
      },
      recovery: {
        incidents: metrics.degradation.length,
        recoveries: metrics.recovery.length,
        avgRecoveryTime: metrics.recovery.reduce((sum, r) => sum + r.duration, 0) / 
                        metrics.recovery.length,
        componentImpact: metrics.degradation.reduce((acc, d) => {
          if (!acc[d.component]) acc[d.component] = 0;
          acc[d.component]++;
          return acc;
        }, {} as Record<string, number>)
      }
    };

    expect(testMetrics.recovery.incidents).toBeGreaterThan(0);
    expect(testMetrics.recovery.recoveries).toBeGreaterThan(0);
    expect(testMetrics.performance.systemHealth).toBeGreaterThan(0);
  });

  it('should validate performance metrics consistency across components', async () => {
    const metrics = {
      samples: [] as { component: string; metrics: any; timestamp: number }[],
      validations: {
        success: 0,
        failure: 0
      }
    };

    const validateMetrics = (component: string, data: any) => {
      try {
        switch (component) {
          case 'api_gateway':
            expect(data.latency).toBeGreaterThan(0);
            expect(data.error_rate).toBeGreaterThanOrEqual(0);
            expect(data.error_rate).toBeLessThanOrEqual(1);
            break;
          case 'trading_engine':
            expect(data.cpu_usage).toBeGreaterThanOrEqual(0);
            expect(data.cpu_usage).toBeLessThanOrEqual(100);
            expect(data.memory_usage).toBeGreaterThanOrEqual(0);
            expect(data.memory_usage).toBeLessThanOrEqual(100);
            break;
          case 'monitoring':
            expect(data.collection_rate).toBeGreaterThan(0);
            expect(data.storage_usage).toBeGreaterThanOrEqual(0);
            expect(data.storage_usage).toBeLessThanOrEqual(100);
            break;
        }
        metrics.validations.success++;
        return true;
      } catch (error) {
        metrics.validations.failure++;
        return false;
      }
    };

    (getBotStatus as jest.Mock).mockImplementation(() => {
      const data = {
        api_gateway: {
          latency: 150 + Math.random() * 50,
          error_rate: 0.01 + Math.random() * 0.01
        },
        trading_engine: {
          cpu_usage: 45 + Math.random() * 10,
          memory_usage: 60 + Math.random() * 5
        },
        monitoring: {
          collection_rate: 10 + Math.random() * 2,
          storage_usage: 40 + Math.random() * 10
        }
      };

      Object.entries(data).forEach(([component, componentMetrics]) => {
        metrics.samples.push({
          component,
          metrics: componentMetrics,
          timestamp: Date.now()
        });
        validateMetrics(component, componentMetrics);
      });

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

    const componentMetrics = metrics.samples.reduce((acc, sample) => {
      if (!acc[sample.component]) {
        acc[sample.component] = {
          metrics: [],
          timestamps: []
        };
      }
      acc[sample.component].metrics.push(sample.metrics);
      acc[sample.component].timestamps.push(sample.timestamp);
      return acc;
    }, {} as Record<string, { metrics: any[]; timestamps: number[] }>);

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.validations.failure / 
                  (metrics.validations.success + metrics.validations.failure),
        apiLatency: componentMetrics.api_gateway?.metrics.reduce(
          (sum, m) => sum + m.latency, 0
        ) / (componentMetrics.api_gateway?.metrics.length || 1),
        systemHealth: metrics.validations.success / 
                     (metrics.validations.success + metrics.validations.failure),
        successRate: metrics.validations.success / 
                    (metrics.validations.success + metrics.validations.failure),
        totalTrades: 0,
        walletBalance: 0
      },
      validation: {
        components: Object.keys(componentMetrics).length,
        samplesPerComponent: Object.entries(componentMetrics).reduce(
          (acc, [component, data]) => {
            acc[component] = data.metrics.length;
            return acc;
          }, {} as Record<string, number>
        ),
        metricsConsistency: Object.entries(componentMetrics).reduce(
          (acc, [component, data]) => {
            acc[component] = data.metrics.every(m => 
              validateMetrics(component, m)
            );
            return acc;
          }, {} as Record<string, boolean>
        )
      }
    };

    expect(testMetrics.validation.components).toBeGreaterThan(0);
    expect(testMetrics.performance.successRate).toBe(1);
    expect(Object.values(testMetrics.validation.metricsConsistency).every(v => v)).toBe(true);
  });
});
