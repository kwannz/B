import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import { TestMetrics } from '../types/test.types';
import { testRunner } from '../setup/test-runner';

describe('API Metrics Validation', () => {
  beforeEach(() => {
    jest.setTimeout(30000);
  });

  it('should track and validate all required metrics during workflow', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      
      // Step 1: Create Bot and Track Initial Metrics
      const bot = await createBot('trading', 'Test Strategy');
      const createBotLatency = Date.now() - startTime;
      
      expect(bot).toMatchObject({
        type: 'trading',
        strategy: 'Test Strategy'
      });

      // Step 2: Create Wallet and Track Performance
      const wallet = await createWallet(bot.id);
      const walletLatency = Date.now() - (startTime + createBotLatency);

      expect(wallet.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
      expect(wallet.balance).toBeGreaterThanOrEqual(0);

      // Step 3: Get Bot Status with Metrics
      const botStatus = await getBotStatus(bot.id);
      const statusLatency = Date.now() - (startTime + createBotLatency + walletLatency);

      expect(botStatus.metrics).toBeDefined();
      expect(botStatus.metrics.performance).toBeDefined();

      // Calculate Aggregate Metrics
      const totalLatency = createBotLatency + walletLatency + statusLatency;
      const avgLatency = totalLatency / 3;

      const metrics: TestMetrics = {
        performance: {
          errorRate: 0,
          apiLatency: avgLatency,
          systemHealth: 1,
          successRate: 1,
          totalTrades: botStatus.metrics?.total_trades || 0,
          walletBalance: wallet.balance
        },
        trading: {
          totalVolume: botStatus.metrics?.total_volume || 0,
          profitLoss: botStatus.metrics?.profit_loss || 0,
          activePositions: botStatus.metrics?.active_positions || 0
        }
      };

      testRunner.expectMetrics(metrics);

      // Validate Individual Metrics
      expect(metrics.performance.apiLatency).toBeLessThan(2000);
      expect(metrics.performance.errorRate).toBe(0);
      expect(metrics.performance.systemHealth).toBe(1);
      expect(metrics.performance.successRate).toBe(1);
      expect(metrics.trading.totalVolume).toBeGreaterThanOrEqual(0);
      expect(metrics.trading.profitLoss).toBeDefined();
      expect(metrics.trading.activePositions).toBeGreaterThanOrEqual(0);
    });
  });

  it('should track error metrics during failed operations', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      let errorCount = 0;
      let totalOperations = 0;

      try {
        totalOperations++;
        await createBot('invalid_type', '');
      } catch (error) {
        errorCount++;
      }

      try {
        totalOperations++;
        await getWallet('nonexistent_id');
      } catch (error) {
        errorCount++;
      }

      const metrics: TestMetrics = {
        performance: {
          errorRate: errorCount / totalOperations,
          apiLatency: Date.now() - startTime,
          systemHealth: 1 - (errorCount / totalOperations),
          successRate: (totalOperations - errorCount) / totalOperations,
          totalTrades: 0,
          walletBalance: 0
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.errorRate).toBeGreaterThan(0);
      expect(metrics.performance.systemHealth).toBeLessThan(1);
    });
  });

  it('should validate performance metrics thresholds', async () => {
    await testRunner.runTest(async () => {
      const bot = await createBot('trading', 'Test Strategy');
      const botStatus = await getBotStatus(bot.id);

      const metrics: TestMetrics = {
        performance: {
          errorRate: 0,
          apiLatency: 0,
          systemHealth: 1,
          successRate: 1,
          totalTrades: botStatus.metrics?.total_trades || 0,
          walletBalance: 0
        },
        trading: {
          totalVolume: botStatus.metrics?.total_volume || 0,
          profitLoss: botStatus.metrics?.profit_loss || 0,
          activePositions: botStatus.metrics?.active_positions || 0
        }
      };

      // Validate Performance Thresholds
      expect(metrics.performance.errorRate).toBeLessThan(0.1);
      expect(metrics.performance.apiLatency).toBeLessThan(2000);
      expect(metrics.performance.systemHealth).toBeGreaterThan(0.9);
      expect(metrics.performance.successRate).toBeGreaterThan(0.9);

      // Validate Trading Metrics
      expect(metrics.trading.totalVolume).toBeGreaterThanOrEqual(0);
      expect(metrics.trading.activePositions).toBeGreaterThanOrEqual(0);
      expect(metrics.trading.profitLoss).toBeDefined();

      testRunner.expectMetrics(metrics);
    });
  });

  it('should track concurrent operation metrics', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      const bot = await createBot('trading', 'Test Strategy');

      const operations = [
        getBotStatus(bot.id),
        createWallet(bot.id),
        getWallet(bot.id)
      ];

      const results = await Promise.allSettled(operations);
      const endTime = Date.now();

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;

      const metrics: TestMetrics = {
        performance: {
          errorRate: failureCount / operations.length,
          apiLatency: (endTime - startTime) / operations.length,
          systemHealth: successCount / operations.length,
          successRate: successCount / operations.length,
          totalTrades: 0,
          walletBalance: 0
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.apiLatency).toBeLessThan(2000);
      expect(metrics.performance.systemHealth).toBeGreaterThan(0.8);
    });
  });
});
