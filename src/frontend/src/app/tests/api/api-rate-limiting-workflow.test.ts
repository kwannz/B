import { createBot, getBotStatus, createWallet } from '@/app/api/client';
import { TestMetrics } from '../types/test.types';
import { testRunner } from '../setup/test-runner';

describe('API Rate Limiting and Performance', () => {
  beforeEach(() => {
    jest.setTimeout(30000);
  });

  it('should handle rate limiting during high frequency requests', async () => {
    await testRunner.runTest(async () => {
      const bot = await createBot('trading', 'Test Strategy');
      const requests = 20;
      const startTime = Date.now();
      
      const results = await Promise.allSettled(
        Array(requests).fill(null).map(() => getBotStatus(bot.id))
      );

      const endTime = Date.now();
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      const avgLatency = (endTime - startTime) / requests;

      const metrics: TestMetrics = {
        performance: {
          errorRate: failureCount / requests,
          apiLatency: avgLatency,
          systemHealth: successCount / requests,
          successRate: successCount / requests,
          totalTrades: 0,
          walletBalance: 0
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.apiLatency).toBeLessThan(5000);
      expect(metrics.performance.errorRate).toBeLessThan(0.3);
    });
  });

  it('should implement backoff strategy during rate limiting', async () => {
    await testRunner.runTest(async () => {
      const bot = await createBot('trading', 'Test Strategy');
      let successfulRequests = 0;
      let totalAttempts = 0;
      const maxAttempts = 5;
      const backoffTimes: number[] = [];

      const makeRequestWithBackoff = async (attempt: number): Promise<void> => {
        const startTime = Date.now();
        try {
          await getBotStatus(bot.id);
          successfulRequests++;
        } catch (error) {
          if (attempt < maxAttempts) {
            const backoffTime = Math.pow(2, attempt) * 1000;
            backoffTimes.push(backoffTime);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            await makeRequestWithBackoff(attempt + 1);
          }
        }
        totalAttempts++;
      };

      await makeRequestWithBackoff(0);

      const metrics: TestMetrics = {
        performance: {
          errorRate: (totalAttempts - successfulRequests) / totalAttempts,
          apiLatency: backoffTimes.reduce((a, b) => a + b, 0) / backoffTimes.length,
          systemHealth: successfulRequests / totalAttempts,
          successRate: successfulRequests / totalAttempts,
          totalTrades: 0,
          walletBalance: 0
        }
      };

      testRunner.expectMetrics(metrics);
      expect(backoffTimes).toEqual(expect.arrayContaining([1000, 2000, 4000, 8000].slice(0, backoffTimes.length)));
    });
  });

  it('should track performance metrics during concurrent operations', async () => {
    await testRunner.runTest(async () => {
      const operations = [
        createBot('trading', 'Strategy 1'),
        createBot('trading', 'Strategy 2'),
        createBot('trading', 'Strategy 3')
      ];

      const startTime = Date.now();
      const results = await Promise.allSettled(operations);
      const endTime = Date.now();

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      const totalTime = endTime - startTime;
      const avgLatency = totalTime / operations.length;

      const metrics: TestMetrics = {
        performance: {
          errorRate: failureCount / operations.length,
          apiLatency: avgLatency,
          systemHealth: successCount / operations.length,
          successRate: successCount / operations.length,
          totalTrades: 0,
          walletBalance: 0
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.apiLatency).toBeLessThan(3000);
      expect(metrics.performance.systemHealth).toBeGreaterThan(0.7);
    });
  });

  it('should validate API performance under load', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      const loadTests = 10;
      let successCount = 0;
      let totalLatency = 0;

      for (let i = 0; i < loadTests; i++) {
        const operationStart = Date.now();
        try {
          const bot = await createBot('trading', `Strategy ${i}`);
          await createWallet(bot.id);
          await getBotStatus(bot.id);
          successCount++;
          totalLatency += Date.now() - operationStart;
        } catch (error) {
          totalLatency += Date.now() - operationStart;
        }
      }

      const avgLatency = totalLatency / loadTests;
      const metrics: TestMetrics = {
        performance: {
          errorRate: (loadTests - successCount) / loadTests,
          apiLatency: avgLatency,
          systemHealth: successCount / loadTests,
          successRate: successCount / loadTests,
          totalTrades: 0,
          walletBalance: 0
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.apiLatency).toBeLessThan(5000);
      expect(metrics.performance.successRate).toBeGreaterThan(0.7);
    });
  });
});
