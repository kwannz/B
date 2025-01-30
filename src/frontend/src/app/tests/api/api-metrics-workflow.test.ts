import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import { TestMetrics } from '../types/test.types';
import { testRunner } from '../setup/test-runner';

describe('API Metrics Collection and Monitoring', () => {
  beforeEach(() => {
    jest.setTimeout(30000);
  });

  it('should track comprehensive system metrics during operations', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      const metrics = {
        operations: [] as string[],
        latencies: [] as number[],
        errors: 0,
        successes: 0
      };

      try {
        // Operation 1: Create Bot
        const opStart = Date.now();
        const bot = await createBot('trading', 'Test Strategy');
        metrics.latencies.push(Date.now() - opStart);
        metrics.operations.push('createBot');
        metrics.successes++;

        // Operation 2: Create Wallet
        const walletStart = Date.now();
        const wallet = await createWallet(bot.id);
        metrics.latencies.push(Date.now() - walletStart);
        metrics.operations.push('createWallet');
        metrics.successes++;

        // Operation 3: Get Bot Status
        const statusStart = Date.now();
        const status = await getBotStatus(bot.id);
        metrics.latencies.push(Date.now() - statusStart);
        metrics.operations.push('getBotStatus');
        metrics.successes++;

      } catch (error) {
        metrics.errors++;
      }

      const avgLatency = metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length;

      const testMetrics: TestMetrics = {
        performance: {
          errorRate: metrics.errors / metrics.operations.length,
          apiLatency: avgLatency,
          systemHealth: metrics.successes / metrics.operations.length,
          successRate: metrics.successes / metrics.operations.length,
          totalTrades: 0,
          walletBalance: 0
        },
        monitoring: {
          operationCount: metrics.operations.length,
          avgLatency,
          maxLatency: Math.max(...metrics.latencies),
          minLatency: Math.min(...metrics.latencies)
        }
      };

      testRunner.expectMetrics(testMetrics);
      expect(testMetrics.monitoring.avgLatency).toBeLessThan(1000);
      expect(testMetrics.monitoring.maxLatency).toBeLessThan(2000);
    });
  });

  it('should validate metrics during concurrent operations', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      const concurrentOps = 3;
      const metrics = {
        latencies: [] as number[],
        errors: 0,
        successes: 0
      };

      const operations = await Promise.all(
        Array(concurrentOps).fill(null).map(async () => {
          const opStart = Date.now();
          try {
            const bot = await createBot('trading', 'Test Strategy');
            const wallet = await createWallet(bot.id);
            metrics.successes += 2;
            return {
              latency: Date.now() - opStart,
              success: true
            };
          } catch (error) {
            metrics.errors++;
            return {
              latency: Date.now() - opStart,
              success: false
            };
          }
        })
      );

      operations.forEach(op => {
        metrics.latencies.push(op.latency);
      });

      const avgLatency = metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length;
      const totalOps = concurrentOps * 2;

      const testMetrics: TestMetrics = {
        performance: {
          errorRate: metrics.errors / totalOps,
          apiLatency: avgLatency,
          systemHealth: metrics.successes / totalOps,
          successRate: metrics.successes / totalOps,
          totalTrades: 0,
          walletBalance: 0
        },
        monitoring: {
          concurrentOperations: concurrentOps,
          avgLatency,
          maxLatency: Math.max(...metrics.latencies),
          minLatency: Math.min(...metrics.latencies),
          throughput: totalOps / ((Date.now() - startTime) / 1000)
        }
      };

      testRunner.expectMetrics(testMetrics);
      expect(testMetrics.monitoring.throughput).toBeGreaterThan(1);
      expect(testMetrics.performance.successRate).toBeGreaterThan(0.8);
    });
  });

  it('should track error metrics and recovery', async () => {
    await testRunner.runTest(async () => {
      const metrics = {
        attempts: 0,
        recoveries: 0,
        errors: 0,
        latencies: [] as number[]
      };

      const maxRetries = 3;
      let success = false;

      while (!success && metrics.attempts < maxRetries) {
        const opStart = Date.now();
        try {
          const bot = await createBot('trading', 'Test Strategy');
          const wallet = await createWallet(bot.id);
          success = true;
          metrics.latencies.push(Date.now() - opStart);
        } catch (error) {
          metrics.errors++;
          metrics.attempts++;
          if (metrics.attempts < maxRetries) {
            metrics.recoveries++;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, metrics.attempts) * 1000));
          }
        }
      }

      const avgLatency = metrics.latencies.length > 0 
        ? metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length 
        : 0;

      const testMetrics: TestMetrics = {
        performance: {
          errorRate: metrics.errors / (metrics.attempts + 1),
          apiLatency: avgLatency,
          systemHealth: success ? 1 : 0,
          successRate: success ? 1 : 0,
          totalTrades: 0,
          walletBalance: 0
        },
        errorHandling: {
          recoveryAttempts: metrics.recoveries,
          totalAttempts: metrics.attempts + 1,
          finalSuccess: success,
          avgRecoveryTime: metrics.latencies.length > 1 
            ? (metrics.latencies[metrics.latencies.length - 1] - metrics.latencies[0]) / (metrics.latencies.length - 1)
            : 0
        }
      };

      testRunner.expectMetrics(testMetrics);
      expect(testMetrics.errorHandling.finalSuccess).toBe(true);
    });
  });

  it('should validate system health metrics over time', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      const healthChecks = [];
      const metrics = {
        latencies: [] as number[],
        errors: 0,
        successes: 0
      };

      for (let i = 0; i < 3; i++) {
        const checkStart = Date.now();
        try {
          const bot = await createBot('trading', 'Test Strategy');
          const status = await getBotStatus(bot.id);
          metrics.successes += 2;
          healthChecks.push({
            timestamp: Date.now(),
            latency: Date.now() - checkStart,
            success: true
          });
        } catch (error) {
          metrics.errors++;
          healthChecks.push({
            timestamp: Date.now(),
            latency: Date.now() - checkStart,
            success: false
          });
        }
        metrics.latencies.push(Date.now() - checkStart);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const avgLatency = metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length;
      const successRate = healthChecks.filter(check => check.success).length / healthChecks.length;

      const testMetrics: TestMetrics = {
        performance: {
          errorRate: metrics.errors / (metrics.successes + metrics.errors),
          apiLatency: avgLatency,
          systemHealth: successRate,
          successRate,
          totalTrades: 0,
          walletBalance: 0
        },
        health: {
          checks: healthChecks.length,
          avgLatency,
          maxLatency: Math.max(...metrics.latencies),
          minLatency: Math.min(...metrics.latencies),
          uptime: (Date.now() - startTime) / 1000,
          successRate
        }
      };

      testRunner.expectMetrics(testMetrics);
      expect(testMetrics.health.successRate).toBeGreaterThan(0.8);
      expect(testMetrics.health.avgLatency).toBeLessThan(2000);
    });
  });
});
