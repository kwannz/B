import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import { TestMetrics } from '../types/test.types';
import { testRunner } from '../setup/test-runner';

describe('API Batch Operations and Performance', () => {
  beforeEach(() => {
    jest.setTimeout(30000);
  });

  it('should handle batch bot creation efficiently', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      const batchSize = 5;
      
      const bots = await Promise.all(
        Array(batchSize).fill(null).map((_, index) => 
          createBot('trading', `Strategy ${index + 1}`)
        )
      );

      const endTime = Date.now();
      const avgLatency = (endTime - startTime) / batchSize;

      expect(bots).toHaveLength(batchSize);
      bots.forEach(bot => {
        expect(bot.id).toBeDefined();
        expect(bot.type).toBe('trading');
      });

      const metrics: TestMetrics = {
        performance: {
          errorRate: 0,
          apiLatency: avgLatency,
          systemHealth: 1,
          successRate: 1,
          totalTrades: 0,
          walletBalance: 0
        }
      };

      testRunner.expectMetrics(metrics);
      expect(avgLatency).toBeLessThan(1000);
    });
  });

  it('should optimize batch wallet operations', async () => {
    await testRunner.runTest(async () => {
      const bot = await createBot('trading', 'Test Strategy');
      const startTime = Date.now();
      const operationCount = 3;

      const operations = [
        createWallet(bot.id),
        getWallet(bot.id),
        getBotStatus(bot.id)
      ];

      const results = await Promise.all(operations);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgLatency = totalTime / operationCount;

      expect(results).toHaveLength(operationCount);
      expect(results[0].bot_id).toBe(bot.id);
      expect(results[1].bot_id).toBe(bot.id);
      expect(results[2].id).toBe(bot.id);

      const metrics: TestMetrics = {
        performance: {
          errorRate: 0,
          apiLatency: avgLatency,
          systemHealth: 1,
          successRate: 1,
          totalTrades: 0,
          walletBalance: results[0].balance
        }
      };

      testRunner.expectMetrics(metrics);
      expect(avgLatency).toBeLessThan(500);
    });
  });

  it('should maintain performance during parallel operations', async () => {
    await testRunner.runTest(async () => {
      const bots = await Promise.all([
        createBot('trading', 'Strategy 1'),
        createBot('trading', 'Strategy 2'),
        createBot('trading', 'Strategy 3')
      ]);

      const startTime = Date.now();
      const walletOperations = bots.map(bot => createWallet(bot.id));
      const statusOperations = bots.map(bot => getBotStatus(bot.id));

      const [wallets, statuses] = await Promise.all([
        Promise.all(walletOperations),
        Promise.all(statusOperations)
      ]);

      const endTime = Date.now();
      const totalOperations = wallets.length + statuses.length;
      const avgLatency = (endTime - startTime) / totalOperations;

      expect(wallets).toHaveLength(bots.length);
      expect(statuses).toHaveLength(bots.length);

      const metrics: TestMetrics = {
        performance: {
          errorRate: 0,
          apiLatency: avgLatency,
          systemHealth: 1,
          successRate: 1,
          totalTrades: 0,
          walletBalance: wallets.reduce((sum, w) => sum + w.balance, 0)
        }
      };

      testRunner.expectMetrics(metrics);
      expect(avgLatency).toBeLessThan(300);
    });
  });

  it('should handle mixed operation batches', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      let successCount = 0;
      let totalOperations = 0;

      const executeBatch = async () => {
        const bot = await createBot('trading', 'Test Strategy');
        const wallet = await createWallet(bot.id);
        const status = await getBotStatus(bot.id);
        return { bot, wallet, status };
      };

      const batches = await Promise.all([
        executeBatch(),
        executeBatch(),
        executeBatch()
      ]);

      const endTime = Date.now();
      totalOperations = batches.length * 3;
      successCount = batches.filter(batch => 
        batch.bot && batch.wallet && batch.status
      ).length * 3;

      const avgLatency = (endTime - startTime) / totalOperations;

      const metrics: TestMetrics = {
        performance: {
          errorRate: (totalOperations - successCount) / totalOperations,
          apiLatency: avgLatency,
          systemHealth: successCount / totalOperations,
          successRate: successCount / totalOperations,
          totalTrades: 0,
          walletBalance: batches.reduce((sum, b) => sum + b.wallet.balance, 0)
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.successRate).toBeGreaterThan(0.9);
      expect(avgLatency).toBeLessThan(400);
    });
  });
});
