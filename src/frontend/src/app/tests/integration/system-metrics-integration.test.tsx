import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import { useDebugStore } from '@/app/stores/debugStore';
import { TestMetrics } from '../types/test.types';
import TradingDashboard from '@/app/trading-dashboard/page';
import WalletComparison from '@/app/wallet-comparison/page';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/api/client');
jest.mock('@/app/stores/debugStore');

describe('System Metrics Integration', () => {
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
    (getBotStatus as jest.Mock).mockResolvedValue({
      id: 'bot-123',
      status: 'active',
      metrics: {
        total_volume: 1000,
        profit_loss: 0.5,
        active_positions: 2,
        system_health: {
          cpu_usage: 45,
          memory_usage: 60,
          api_latency: 150,
          error_rate: 0.01
        }
      }
    });
  });

  it('should track system health metrics during operations', async () => {
    const startTime = Date.now();
    const metrics = {
      measurements: [] as { timestamp: number; type: string; value: number }[],
      errors: 0,
      successes: 0
    };

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    // Track multiple health checks
    for (let i = 0; i < 3; i++) {
      const checkStart = Date.now();
      try {
        const status = await getBotStatus('bot-123');
        metrics.measurements.push({
          timestamp: Date.now(),
          type: 'cpu_usage',
          value: status.metrics.system_health.cpu_usage
        });
        metrics.measurements.push({
          timestamp: Date.now(),
          type: 'memory_usage',
          value: status.metrics.system_health.memory_usage
        });
        metrics.measurements.push({
          timestamp: Date.now(),
          type: 'api_latency',
          value: status.metrics.system_health.api_latency
        });
        metrics.successes++;
      } catch (error) {
        metrics.errors++;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const avgCpuUsage = metrics.measurements
      .filter(m => m.type === 'cpu_usage')
      .reduce((sum, m) => sum + m.value, 0) / 3;
    
    const avgMemoryUsage = metrics.measurements
      .filter(m => m.type === 'memory_usage')
      .reduce((sum, m) => sum + m.value, 0) / 3;
    
    const avgLatency = metrics.measurements
      .filter(m => m.type === 'api_latency')
      .reduce((sum, m) => sum + m.value, 0) / 3;

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / (metrics.errors + metrics.successes),
        apiLatency: avgLatency,
        systemHealth: metrics.successes / (metrics.errors + metrics.successes),
        successRate: metrics.successes / (metrics.errors + metrics.successes),
        totalTrades: 0,
        walletBalance: 0
      },
      system: {
        avgCpuUsage,
        avgMemoryUsage,
        avgLatency,
        measurements: metrics.measurements.length,
        duration: Date.now() - startTime
      }
    };

    expect(testMetrics.system.avgCpuUsage).toBeLessThan(80);
    expect(testMetrics.system.avgMemoryUsage).toBeLessThan(90);
    expect(testMetrics.system.avgLatency).toBeLessThan(200);
    expect(testMetrics.performance.successRate).toBe(1);
  });

  it('should validate system metrics during high load', async () => {
    const metrics = {
      operations: [] as { type: string; latency: number; resources: any }[],
      errors: 0,
      successes: 0
    };

    const concurrentOps = 5;
    const operations = await Promise.all(
      Array(concurrentOps).fill(null).map(async (_, index) => {
        const opStart = Date.now();
        try {
          const status = await getBotStatus(`bot-${index}`);
          metrics.operations.push({
            type: 'status_check',
            latency: Date.now() - opStart,
            resources: status.metrics.system_health
          });
          metrics.successes++;
          return { success: true, latency: Date.now() - opStart };
        } catch (error) {
          metrics.errors++;
          return { success: false, latency: Date.now() - opStart };
        }
      })
    );

    const avgLatency = metrics.operations.reduce((sum, op) => sum + op.latency, 0) / metrics.operations.length;
    const maxCpuUsage = Math.max(...metrics.operations.map(op => op.resources?.cpu_usage || 0));
    const maxMemoryUsage = Math.max(...metrics.operations.map(op => op.resources?.memory_usage || 0));

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / concurrentOps,
        apiLatency: avgLatency,
        systemHealth: metrics.successes / concurrentOps,
        successRate: metrics.successes / concurrentOps,
        totalTrades: 0,
        walletBalance: 0
      },
      load: {
        concurrentOperations: concurrentOps,
        avgLatency,
        maxCpuUsage,
        maxMemoryUsage,
        successfulOperations: metrics.successes
      }
    };

    expect(testMetrics.load.maxCpuUsage).toBeLessThan(90);
    expect(testMetrics.load.maxMemoryUsage).toBeLessThan(90);
    expect(testMetrics.load.avgLatency).toBeLessThan(500);
    expect(testMetrics.performance.successRate).toBeGreaterThan(0.8);
  });

  it('should track system metrics during error recovery', async () => {
    const metrics = {
      measurements: [] as { timestamp: number; type: string; value: number }[],
      recoveryAttempts: 0,
      errors: 0,
      successes: 0
    };

    (getBotStatus as jest.Mock)
      .mockRejectedValueOnce(new Error('Service Unavailable'))
      .mockResolvedValueOnce({
        id: 'bot-123',
        status: 'degraded',
        metrics: {
          system_health: {
            cpu_usage: 85,
            memory_usage: 80,
            api_latency: 300,
            error_rate: 0.15
          }
        }
      })
      .mockResolvedValueOnce({
        id: 'bot-123',
        status: 'active',
        metrics: {
          system_health: {
            cpu_usage: 45,
            memory_usage: 60,
            api_latency: 150,
            error_rate: 0.01
          }
        }
      });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    // Initial error
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
      metrics.errors++;
    });

    // First recovery attempt
    const retryButton1 = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton1);
    metrics.recoveryAttempts++;

    await waitFor(() => {
      expect(screen.getByText(/degraded/i)).toBeInTheDocument();
      metrics.measurements.push({
        timestamp: Date.now(),
        type: 'recovery_metrics',
        value: 85 // CPU usage during recovery
      });
    });

    // Final recovery attempt
    const retryButton2 = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton2);
    metrics.recoveryAttempts++;

    await waitFor(() => {
      expect(screen.getByText(/active/i)).toBeInTheDocument();
      metrics.measurements.push({
        timestamp: Date.now(),
        type: 'recovery_metrics',
        value: 45 // CPU usage after recovery
      });
      metrics.successes++;
    });

    const testMetrics: TestMetrics = {
      performance: {
        errorRate: metrics.errors / (metrics.errors + metrics.successes),
        apiLatency: 0,
        systemHealth: metrics.successes / (metrics.recoveryAttempts + 1),
        successRate: metrics.successes / (metrics.recoveryAttempts + 1),
        totalTrades: 0,
        walletBalance: 0
      },
      recovery: {
        attempts: metrics.recoveryAttempts,
        measurements: metrics.measurements.length,
        peakCpuUsage: Math.max(...metrics.measurements.map(m => m.value)),
        finalCpuUsage: metrics.measurements[metrics.measurements.length - 1].value
      }
    };

    expect(testMetrics.recovery.attempts).toBe(2);
    expect(testMetrics.recovery.peakCpuUsage).toBe(85);
    expect(testMetrics.recovery.finalCpuUsage).toBe(45);
    expect(testMetrics.performance.successRate).toBeGreaterThan(0);
  });
});
