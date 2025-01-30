import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import { TestMetrics } from '../types/test.types';
import { testRunner } from '../setup/test-runner';

describe('API Performance and Optimization', () => {
  beforeEach(() => {
    jest.setTimeout(30000);
  });

  it('should track API performance metrics across operations', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      const operations = [];
      const latencies = [];

      // Operation 1: Create Bot
      const botStartTime = Date.now();
      const bot = await createBot('trading', 'Test Strategy');
      latencies.push(Date.now() - botStartTime);
      operations.push('createBot');

      // Operation 2: Create Wallet
      const walletStartTime = Date.now();
      const wallet = await createWallet(bot.id);
      latencies.push(Date.now() - walletStartTime);
      operations.push('createWallet');

      // Operation 3: Get Bot Status
      const statusStartTime = Date.now();
      const status = await getBotStatus(bot.id);
      latencies.push(Date.now() - statusStartTime);
      operations.push('getBotStatus');

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

      const metrics: TestMetrics = {
        performance: {
          errorRate: 0,
          apiLatency: avgLatency,
          systemHealth: 1,
          successRate: 1,
          totalTrades: 0,
          walletBalance: wallet.balance
        },
        operations: {
          count: operations.length,
          avgLatency,
          maxLatency: Math.max(...latencies),
          minLatency: Math.min(...latencies)
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.operations.maxLatency).toBeLessThan(2000);
      expect(metrics.operations.avgLatency).toBeLessThan(1000);
    });
  });

  it('should maintain performance during parallel operations', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      const parallelCount = 3;
      
      const operations = await Promise.all(
        Array(parallelCount).fill(null).map(async () => {
          const opStartTime = Date.now();
          const bot = await createBot('trading', 'Test Strategy');
          const wallet = await createWallet(bot.id);
          const status = await getBotStatus(bot.id);
          return {
            latency: Date.now() - opStartTime,
            success: bot && wallet && status
          };
        })
      );

      const totalTime = Date.now() - startTime;
      const avgLatency = operations.reduce((sum, op) => sum + op.latency, 0) / operations.length;
      const successCount = operations.filter(op => op.success).length;

      const metrics: TestMetrics = {
        performance: {
          errorRate: (parallelCount - successCount) / parallelCount,
          apiLatency: avgLatency,
          systemHealth: successCount / parallelCount,
          successRate: successCount / parallelCount,
          totalTrades: 0,
          walletBalance: 0
        }
      };

      testRunner.expectMetrics(metrics);
      expect(totalTime).toBeLessThan(parallelCount * 2000);
      expect(avgLatency).toBeLessThan(2000);
    });
  });

  it('should optimize response times for repeated operations', async () => {
    await testRunner.runTest(async () => {
      const bot = await createBot('trading', 'Test Strategy');
      const iterations = 5;
      const latencies = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        await getBotStatus(bot.id);
        latencies.push(Date.now() - startTime);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const latencyTrend = latencies.slice(1).map((latency, index) => 
        latency - latencies[index]
      );

      const metrics: TestMetrics = {
        performance: {
          errorRate: 0,
          apiLatency: avgLatency,
          systemHealth: 1,
          successRate: 1,
          totalTrades: 0,
          walletBalance: 0
        },
        optimization: {
          avgLatency,
          latencyTrend,
          improvement: (latencies[0] - latencies[latencies.length - 1]) / latencies[0]
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.optimization.improvement).toBeGreaterThan(-0.5);
      expect(avgLatency).toBeLessThan(500);
    });
  });

  it('should handle high-throughput scenarios efficiently', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      const requestCount = 10;
      const batchSize = 3;
      let completedRequests = 0;
      let totalLatency = 0;

      for (let i = 0; i < requestCount; i += batchSize) {
        const batchStart = Date.now();
        const batch = await Promise.all(
          Array(Math.min(batchSize, requestCount - i)).fill(null).map(() =>
            createBot('trading', 'Test Strategy')
          )
        );
        const batchLatency = Date.now() - batchStart;
        totalLatency += batchLatency;
        completedRequests += batch.length;
      }

      const avgLatency = totalLatency / completedRequests;
      const throughput = completedRequests / ((Date.now() - startTime) / 1000);

      const metrics: TestMetrics = {
        performance: {
          errorRate: 0,
          apiLatency: avgLatency,
          systemHealth: 1,
          successRate: 1,
          totalTrades: 0,
          walletBalance: 0
        },
        throughput: {
          requestsPerSecond: throughput,
          avgLatency,
          totalRequests: completedRequests
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.throughput.requestsPerSecond).toBeGreaterThan(1);
      expect(avgLatency).toBeLessThan(1000);
    });
  });
});
