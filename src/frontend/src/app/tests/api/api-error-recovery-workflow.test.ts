import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import { TestMetrics } from '../types/test.types';
import { testRunner } from '../setup/test-runner';

describe('API Error Recovery and Resilience', () => {
  beforeEach(() => {
    jest.setTimeout(30000);
  });

  it('should handle and recover from transient API failures', async () => {
    await testRunner.runTest(async () => {
      let errorCount = 0;
      let successCount = 0;
      const totalAttempts = 5;

      for (let i = 0; i < totalAttempts; i++) {
        try {
          const bot = await createBot('trading', 'Test Strategy');
          const wallet = await createWallet(bot.id);
          successCount++;
        } catch (error) {
          errorCount++;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const errorRate = errorCount / totalAttempts;
      const successRate = successCount / totalAttempts;
      const systemHealth = 1 - errorRate;

      const metrics: TestMetrics = {
        performance: {
          errorRate,
          apiLatency: 0,
          systemHealth,
          successRate,
          totalTrades: 0,
          walletBalance: 0
        }
      };

      testRunner.expectMetrics(metrics);
      expect(successRate).toBeGreaterThan(0.6);
      expect(systemHealth).toBeGreaterThan(0.6);
    });
  });

  it('should implement exponential backoff for failed requests', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      let lastAttemptTime = startTime;
      let attemptCount = 0;
      let succeeded = false;

      while (!succeeded && attemptCount < 3) {
        try {
          const bot = await createBot('trading', 'Test Strategy');
          const botStatus = await getBotStatus(bot.id);
          succeeded = true;
        } catch (error) {
          const currentTime = Date.now();
          const timeSinceLastAttempt = currentTime - lastAttemptTime;
          const expectedBackoff = Math.pow(2, attemptCount) * 1000;
          
          expect(timeSinceLastAttempt).toBeGreaterThanOrEqual(expectedBackoff);
          
          lastAttemptTime = currentTime;
          attemptCount++;
          await new Promise(resolve => setTimeout(resolve, expectedBackoff));
        }
      }

      const metrics: TestMetrics = {
        performance: {
          errorRate: attemptCount / (attemptCount + 1),
          apiLatency: Date.now() - startTime,
          systemHealth: succeeded ? 1 : 0,
          successRate: succeeded ? 1 : 0,
          totalTrades: 0,
          walletBalance: 0
        }
      };

      testRunner.expectMetrics(metrics);
    });
  });

  it('should maintain system health during partial failures', async () => {
    await testRunner.runTest(async () => {
      const bot = await createBot('trading', 'Test Strategy');
      const operations = [
        getBotStatus(bot.id),
        createWallet(bot.id),
        getWallet(bot.id)
      ];

      const results = await Promise.allSettled(operations);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;

      const metrics: TestMetrics = {
        performance: {
          errorRate: failureCount / operations.length,
          apiLatency: 0,
          systemHealth: successCount / operations.length,
          successRate: successCount / operations.length,
          totalTrades: 0,
          walletBalance: 0
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.systemHealth).toBeGreaterThan(0.5);
    });
  });

  it('should validate error response formats', async () => {
    await testRunner.runTest(async () => {
      try {
        await createBot('invalid_type', '');
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response?.data).toBeDefined();
        expect(error.response?.status).toBeDefined();
        expect(error.response?.data.message).toBeDefined();
        
        const metrics: TestMetrics = {
          performance: {
            errorRate: 1,
            apiLatency: 0,
            systemHealth: 1,
            successRate: 0,
            totalTrades: 0,
            walletBalance: 0
          }
        };

        testRunner.expectMetrics(metrics);
      }
    });
  });

  it('should handle concurrent request failures gracefully', async () => {
    await testRunner.runTest(async () => {
      const bot = await createBot('trading', 'Test Strategy');
      const concurrentRequests = 5;
      const requests = Array(concurrentRequests).fill(null).map(() => 
        getBotStatus(bot.id)
      );

      const startTime = Date.now();
      const results = await Promise.allSettled(requests);
      const endTime = Date.now();

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;

      const metrics: TestMetrics = {
        performance: {
          errorRate: failureCount / concurrentRequests,
          apiLatency: (endTime - startTime) / concurrentRequests,
          systemHealth: successCount / concurrentRequests,
          successRate: successCount / concurrentRequests,
          totalTrades: 0,
          walletBalance: 0
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.systemHealth).toBeGreaterThan(0.6);
      expect(metrics.performance.apiLatency).toBeLessThan(5000);
    });
  });
});
