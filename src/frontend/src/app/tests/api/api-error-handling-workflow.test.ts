import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import { TestMetrics } from '../types/test.types';
import { testRunner } from '../setup/test-runner';

describe('API Error Handling and Recovery', () => {
  beforeEach(() => {
    jest.setTimeout(30000);
  });

  it('should handle and recover from API errors gracefully', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      let errorCount = 0;
      let successCount = 0;
      const totalAttempts = 5;

      for (let i = 0; i < totalAttempts; i++) {
        try {
          const bot = await createBot('trading', 'Test Strategy');
          const wallet = await createWallet(bot.id);
          const status = await getBotStatus(bot.id);
          successCount++;
        } catch (error) {
          errorCount++;
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, errorCount) * 1000));
        }
      }

      const metrics: TestMetrics = {
        performance: {
          errorRate: errorCount / totalAttempts,
          apiLatency: (Date.now() - startTime) / totalAttempts,
          systemHealth: successCount / totalAttempts,
          successRate: successCount / totalAttempts,
          totalTrades: 0,
          walletBalance: 0
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.successRate).toBeGreaterThan(0.6);
    });
  });

  it('should validate error response formats', async () => {
    await testRunner.runTest(async () => {
      try {
        await createBot('invalid_type', '');
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response?.status).toBeDefined();
        expect(error.response?.data?.message).toBeDefined();
        expect(error.response?.data?.code).toBeDefined();

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

  it('should handle network timeouts and retries', async () => {
    await testRunner.runTest(async () => {
      const maxRetries = 3;
      let attempts = 0;
      let success = false;
      const startTime = Date.now();

      while (!success && attempts < maxRetries) {
        try {
          const bot = await createBot('trading', 'Test Strategy');
          const status = await getBotStatus(bot.id);
          success = true;
        } catch (error) {
          attempts++;
          if (attempts < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
          }
        }
      }

      const metrics: TestMetrics = {
        performance: {
          errorRate: attempts / (attempts + 1),
          apiLatency: (Date.now() - startTime) / (attempts + 1),
          systemHealth: success ? 1 : 0,
          successRate: success ? 1 : 0,
          totalTrades: 0,
          walletBalance: 0
        }
      };

      testRunner.expectMetrics(metrics);
      expect(success).toBe(true);
    });
  });

  it('should handle concurrent error scenarios', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      const concurrentRequests = 5;
      
      const requests = Array(concurrentRequests).fill(null).map(() => 
        createBot('trading', 'Test Strategy')
          .catch(error => ({ error }))
      );

      const results = await Promise.all(requests);
      const successCount = results.filter(r => !r.error).length;
      const failureCount = results.filter(r => r.error).length;

      const metrics: TestMetrics = {
        performance: {
          errorRate: failureCount / concurrentRequests,
          apiLatency: (Date.now() - startTime) / concurrentRequests,
          systemHealth: successCount / concurrentRequests,
          successRate: successCount / concurrentRequests,
          totalTrades: 0,
          walletBalance: 0
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.systemHealth).toBeGreaterThan(0.6);
    });
  });

  it('should handle and recover from invalid wallet operations', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      let errorCount = 0;
      let successCount = 0;
      const operations = [
        getWallet('invalid-id'),
        createWallet('invalid-id'),
        getWallet('nonexistent-id')
      ];

      const results = await Promise.allSettled(operations);
      
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          errorCount++;
          expect(result.reason).toHaveProperty('response.status');
          expect(result.reason).toHaveProperty('response.data.message');
        }
      });

      const metrics: TestMetrics = {
        performance: {
          errorRate: errorCount / operations.length,
          apiLatency: (Date.now() - startTime) / operations.length,
          systemHealth: 1,
          successRate: successCount / operations.length,
          totalTrades: 0,
          walletBalance: 0
        }
      };

      testRunner.expectMetrics(metrics);
      expect(errorCount).toBe(operations.length);
    });
  });
});
