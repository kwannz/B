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

describe('System Performance Metrics Integration', () => {
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

  it('should track system performance metrics during high load', async () => {
    const metrics = {
      measurements: [] as { timestamp: number; metrics: any }[],
      operations: [] as { type: string; duration: number }[],
      errors: 0,
      successes: 0
    };

    const mockSystemMetrics = [
      {
        cpu: { usage: 45, processes: 100 },
        memory: { usage: 60, available: 16384 },
        network: { latency: 150, throughput: 1000 },
        storage: { usage: 55, iops: 500 }
      },
      {
        cpu: { usage: 75, processes: 150 },
        memory: { usage: 80, available: 16384 },
        network: { latency: 200, throughput: 800 },
        storage: { usage: 65, iops: 400 }
      },
      {
        cpu: { usage: 60, processes: 120 },
        memory: { usage: 70, available: 16384 },
        network: { latency: 175, throughput: 900 },
        storage: { usage: 60, iops: 450 }
      }
    ];

    let metricsIndex = 0;
    (getBotStatus as jest.Mock).mockImplementation(() => {
      const data = mockSystemMetrics[metricsIndex++ % mockSystemMetrics.length];
      metrics.measurements.push({
        timestamp: Date.now(),
        metrics: data
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

    for (let i = 0; i < mockSystemMetrics.length; i++) {
      await waitFor(() => {
        const currentMetrics = mockSystemMetrics[i];
        expect(screen.getByText(new RegExp(`${currentMetrics.cpu.usage}%`))).toBeInTheDocument();
      });
    }

    const avgCpuUsage = metrics.measurements.reduce((sum, m) => sum + m.metrics.cpu.usage, 0) / metrics.measurements.length;
    const avgMemoryUsage = metrics.measurements.reduce((sum, m) => sum + m.metrics.memory.usage, 0) / metrics.measurements.length;
    const avgNetworkLatency = metrics.measurements.reduce((sum, m) => sum + m.metrics.network.latency, 0) / metrics.measurements.length;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / (metrics.errors + metrics.successes),
        apiLatency: avgNetworkLatency,
        systemHealth: metrics.successes / (metrics.errors + metrics.successes),
        successRate: metrics.successes / (metrics.errors + metrics.successes),
        totalTrades: 0,
        walletBalance: 0
      },
      system: {
        avgCpuUsage,
        avgMemoryUsage,
        avgLatency: avgNetworkLatency,
        measurements: metrics.measurements.length,
        peakUsage: {
          cpu: Math.max(...metrics.measurements.map(m => m.metrics.cpu.usage)),
          memory: Math.max(...metrics.measurements.map(m => m.metrics.memory.usage)),
          network: Math.max(...metrics.measurements.map(m => m.metrics.network.latency))
        }
      }
    };

    expect(testMetrics.system.measurements).toBe(mockSystemMetrics.length);
    expect(testMetrics.system.peakUsage.cpu).toBeLessThan(90);
    expect(testMetrics.performance.apiLatency).toBeLessThan(250);
  });

  it('should track system metrics during component scaling', async () => {
    const metrics = {
      scaling: [] as { component: string; metrics: any; timestamp: number }[],
      operations: [] as { type: string; duration: number }[]
    };

    const mockScalingEvents = [
      {
        api_gateway: { instances: 2, load: 45 },
        trading_engine: { instances: 3, load: 60 },
        monitoring: { instances: 2, load: 40 }
      },
      {
        api_gateway: { instances: 3, load: 65 },
        trading_engine: { instances: 4, load: 75 },
        monitoring: { instances: 3, load: 55 }
      },
      {
        api_gateway: { instances: 2, load: 50 },
        trading_engine: { instances: 3, load: 65 },
        monitoring: { instances: 2, load: 45 }
      }
    ];

    let eventIndex = 0;
    (getBotStatus as jest.Mock).mockImplementation(() => {
      const data = mockScalingEvents[eventIndex++ % mockScalingEvents.length];
      Object.entries(data).forEach(([component, componentMetrics]) => {
        metrics.scaling.push({
          component,
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

    for (let i = 0; i < mockScalingEvents.length; i++) {
      await waitFor(() => {
        const currentEvent = mockScalingEvents[i];
        expect(screen.getByText(new RegExp(`${currentEvent.trading_engine.instances}`))).toBeInTheDocument();
      });
    }

    const componentMetrics = metrics.scaling.reduce((acc, event) => {
      if (!acc[event.component]) {
        acc[event.component] = {
          instances: [],
          load: []
        };
      }
      acc[event.component].instances.push(event.metrics.instances);
      acc[event.component].load.push(event.metrics.load);
      return acc;
    }, {} as Record<string, { instances: number[]; load: number[] }>);

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: 0,
        apiLatency: 0,
        systemHealth: 1,
        successRate: 1,
        totalTrades: 0,
        walletBalance: 0
      },
      scaling: {
        events: metrics.scaling.length,
        components: Object.keys(componentMetrics).length,
        metrics: Object.entries(componentMetrics).reduce((acc, [component, data]) => {
          acc[component] = {
            avgInstances: data.instances.reduce((a, b) => a + b, 0) / data.instances.length,
            avgLoad: data.load.reduce((a, b) => a + b, 0) / data.load.length,
            peakInstances: Math.max(...data.instances),
            peakLoad: Math.max(...data.load)
          };
          return acc;
        }, {} as Record<string, any>)
      }
    };

    expect(testMetrics.scaling.events).toBeGreaterThan(0);
    expect(Object.values(testMetrics.scaling.metrics)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          avgLoad: expect.any(Number),
          peakLoad: expect.any(Number)
        })
      ])
    );
  });

  it('should validate system metrics consistency during load changes', async () => {
    const metrics = {
      load: [] as { timestamp: number; metrics: any }[],
      thresholds: {
        cpu: 90,
        memory: 85,
        latency: 500
      }
    };

    const validateMetrics = (data: any) => {
      expect(data.cpu.usage).toBeLessThan(metrics.thresholds.cpu);
      expect(data.memory.usage).toBeLessThan(metrics.thresholds.memory);
      expect(data.network.latency).toBeLessThan(metrics.thresholds.latency);
      return true;
    };

    const generateLoad = (baseLoad: number, variance: number) => ({
      cpu: { usage: baseLoad + Math.random() * variance },
      memory: { usage: baseLoad + Math.random() * variance },
      network: { latency: 100 + Math.random() * 100 }
    });

    const mockLoadScenarios = [
      generateLoad(40, 10),
      generateLoad(60, 15),
      generateLoad(75, 10),
      generateLoad(50, 10)
    ];

    let scenarioIndex = 0;
    (getBotStatus as jest.Mock).mockImplementation(() => {
      const data = mockLoadScenarios[scenarioIndex++ % mockLoadScenarios.length];
      metrics.load.push({
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

    for (const scenario of mockLoadScenarios) {
      await waitFor(() => {
        expect(screen.getByText(new RegExp(`${Math.floor(scenario.cpu.usage)}%`))).toBeInTheDocument();
      });
    }

    const loadTransitions = metrics.load.slice(1).map((load, index) => ({
      cpuDelta: load.metrics.cpu.usage - metrics.load[index].metrics.cpu.usage,
      memoryDelta: load.metrics.memory.usage - metrics.load[index].metrics.memory.usage,
      latencyDelta: load.metrics.network.latency - metrics.load[index].metrics.network.latency,
      timeDelta: load.timestamp - metrics.load[index].timestamp
    }));

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: 0,
        apiLatency: metrics.load.reduce((sum, l) => sum + l.metrics.network.latency, 0) / metrics.load.length,
        systemHealth: 1,
        successRate: 1,
        totalTrades: 0,
        walletBalance: 0
      },
      load: {
        measurements: metrics.load.length,
        transitions: loadTransitions.length,
        stability: {
          maxCpuJump: Math.max(...loadTransitions.map(t => Math.abs(t.cpuDelta))),
          maxMemoryJump: Math.max(...loadTransitions.map(t => Math.abs(t.memoryDelta))),
          maxLatencyJump: Math.max(...loadTransitions.map(t => Math.abs(t.latencyDelta))),
          avgTransitionTime: loadTransitions.reduce((sum, t) => sum + t.timeDelta, 0) / loadTransitions.length
        }
      }
    };

    expect(testMetrics.load.measurements).toBe(mockLoadScenarios.length);
    expect(testMetrics.load.stability.maxCpuJump).toBeLessThan(30);
    expect(testMetrics.load.stability.maxMemoryJump).toBeLessThan(30);
    expect(testMetrics.load.stability.maxLatencyJump).toBeLessThan(200);
  });
});
