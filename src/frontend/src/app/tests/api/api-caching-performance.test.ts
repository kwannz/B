import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import { TestMetrics } from '../types/test.types';
import { testRunner } from '../setup/test-runner';

describe('API Caching and Performance', () => {
  beforeEach(() => {
    jest.setTimeout(30000);
  });

  it('should cache and reuse bot status responses', async () => {
    await testRunner.runTest(async () => {
      const bot = await createBot('trading', 'Test Strategy');
      const startTime = Date.now();

      // First request - should hit API
      const firstResponse = await getBotStatus(bot.id);
      const firstLatency = Date.now() - startTime;

      // Second request - should use cache
      const secondStartTime = Date.now();
      const secondResponse = await getBotStatus(bot.id);
      const secondLatency = Date.now() - secondStartTime;

      expect(secondLatency).toBeLessThan(firstLatency);
      expect(secondResponse).toEqual(firstResponse);

      const metrics: TestMetrics = {
        performance: {
          errorRate: 0,
          apiLatency: (firstLatency + secondLatency) / 2,
          systemHealth: 1,
          successRate: 1,
          totalTrades: 0,
          walletBalance: 0
        },
        cache: {
          hitRate: 0.5,
          missRate: 0.5,
          avgLatency: secondLatency
        }
      };

      testRunner.expectMetrics(metrics);
    });
  });

  it('should handle cache invalidation on updates', async () => {
    await testRunner.runTest(async () => {
      const bot = await createBot('trading', 'Test Strategy');
      
      // Initial request
      const initialResponse = await getBotStatus(bot.id);
      
      // Update bot status
      await updateBotStatus(bot.id, 'active');
      
      // Request after update should bypass cache
      const updatedResponse = await getBotStatus(bot.id);
      
      expect(updatedResponse).not.toEqual(initialResponse);
      expect(updatedResponse.status).toBe('active');

      const metrics: TestMetrics = {
        performance: {
          errorRate: 0,
          apiLatency: 0,
          systemHealth: 1,
          successRate: 1,
          totalTrades: 0,
          walletBalance: 0
        },
        cache: {
          invalidationRate: 1,
          revalidationLatency: expect.any(Number)
        }
      };

      testRunner.expectMetrics(metrics);
    });
  });

  it('should optimize concurrent requests through caching', async () => {
    await testRunner.runTest(async () => {
      const bot = await createBot('trading', 'Test Strategy');
      const startTime = Date.now();

      // Make concurrent requests
      const requests = Array(5).fill(null).map(() => getBotStatus(bot.id));
      const responses = await Promise.all(requests);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgLatency = totalTime / requests.length;

      // All responses should be identical
      const [firstResponse] = responses;
      responses.forEach(response => {
        expect(response).toEqual(firstResponse);
      });

      const metrics: TestMetrics = {
        performance: {
          errorRate: 0,
          apiLatency: avgLatency,
          systemHealth: 1,
          successRate: 1,
          totalTrades: 0,
          walletBalance: 0
        },
        cache: {
          hitRate: 0.8,
          missRate: 0.2,
          avgLatency
        }
      };

      testRunner.expectMetrics(metrics);
      expect(avgLatency).toBeLessThan(100);
    });
  });

  it('should maintain performance under load with caching', async () => {
    await testRunner.runTest(async () => {
      const bots = await Promise.all([
        createBot('trading', 'Strategy 1'),
        createBot('trading', 'Strategy 2'),
        createBot('trading', 'Strategy 3')
      ]);

      const startTime = Date.now();
      let cacheHits = 0;
      let totalRequests = 0;

      for (const bot of bots) {
        // Make multiple requests for each bot
        const requests = Array(3).fill(null).map(() => getBotStatus(bot.id));
        const responses = await Promise.all(requests);
        
        // Verify responses are consistent
        responses.forEach(response => {
          expect(response.id).toBe(bot.id);
          totalRequests++;
          if (response._fromCache) cacheHits++;
        });
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgLatency = totalTime / totalRequests;

      const metrics: TestMetrics = {
        performance: {
          errorRate: 0,
          apiLatency: avgLatency,
          systemHealth: 1,
          successRate: 1,
          totalTrades: 0,
          walletBalance: 0
        },
        cache: {
          hitRate: cacheHits / totalRequests,
          missRate: (totalRequests - cacheHits) / totalRequests,
          avgLatency
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.cache.hitRate).toBeGreaterThan(0.5);
      expect(avgLatency).toBeLessThan(200);
    });
  });
});
