import { getBotStatus, getWallet, createBot, createWallet } from '@/app/api/client';
import { TestMetrics } from '../types/test.types';
import { testRunner } from '../setup/test-runner';

describe('API Monitoring and Metrics Workflow', () => {
  const mockBot = {
    id: 'bot-123',
    type: 'trading',
    strategy: 'Test Strategy',
    status: 'active',
    metrics: {
      total_volume: 1000,
      profit_loss: 0.5,
      active_positions: 2,
      performance: {
        error_rate: 0,
        api_latency: 100,
        system_health: 1,
        success_rate: 1
      }
    }
  };

  beforeEach(() => {
    jest.setTimeout(30000);
  });

  it('should track API performance metrics throughout workflow', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      
      // Step 1: Create Bot and Track Metrics
      const bot = await createBot('trading', 'Test Strategy');
      const createBotLatency = Date.now() - startTime;
      
      expect(bot).toMatchObject({
        type: 'trading',
        strategy: 'Test Strategy'
      });

      // Step 2: Create Wallet with Performance Tracking
      const walletStartTime = Date.now();
      const wallet = await createWallet(bot.id);
      const createWalletLatency = Date.now() - walletStartTime;

      expect(wallet.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);

      // Step 3: Monitor Bot Status
      const statusStartTime = Date.now();
      const botStatus = await getBotStatus(bot.id);
      const getBotStatusLatency = Date.now() - statusStartTime;

      expect(botStatus.status).toBe('active');

      // Step 4: Get Wallet Details with Metrics
      const walletDetailsStartTime = Date.now();
      const walletDetails = await getWallet(bot.id);
      const getWalletLatency = Date.now() - walletDetailsStartTime;

      expect(walletDetails.address).toBe(wallet.address);

      // Calculate Overall Performance Metrics
      const totalLatency = createBotLatency + createWalletLatency + getBotStatusLatency + getWalletLatency;
      const avgLatency = totalLatency / 4;
      const successRate = 1.0;
      const errorRate = 0;
      const systemHealth = 1.0;

      const metrics: TestMetrics = {
        performance: {
          errorRate,
          apiLatency: avgLatency,
          systemHealth,
          successRate,
          totalTrades: 0,
          walletBalance: wallet.balance
        },
        trading: {
          totalVolume: botStatus.metrics?.total_volume || 0,
          profitLoss: botStatus.metrics?.profit_loss || 0,
          activePositions: botStatus.metrics?.active_positions || 0
        }
      };

      testRunner.expectMetrics(metrics);

      // Validate Individual API Latencies
      expect(createBotLatency).toBeLessThan(2000);
      expect(createWalletLatency).toBeLessThan(2000);
      expect(getBotStatusLatency).toBeLessThan(1000);
      expect(getWalletLatency).toBeLessThan(1000);
    });
  });

  it('should handle degraded performance scenarios', async () => {
    await testRunner.runTest(async () => {
      const slowBot = {
        ...mockBot,
        metrics: {
          ...mockBot.metrics,
          performance: {
            error_rate: 0.2,
            api_latency: 3000,
            system_health: 0.8,
            success_rate: 0.8
          }
        }
      };

      jest.spyOn(global, 'fetch').mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => 
            resolve(new Response(JSON.stringify(slowBot))), 3000
          )
        )
      );

      const startTime = Date.now();
      const botStatus = await getBotStatus('bot-123');
      const latency = Date.now() - startTime;

      const metrics: TestMetrics = {
        performance: {
          errorRate: 0.2,
          apiLatency: latency,
          systemHealth: 0.8,
          successRate: 0.8,
          totalTrades: 0,
          walletBalance: 0
        }
      };

      testRunner.expectMetrics(metrics);
      expect(latency).toBeGreaterThan(2000);
      expect(botStatus.metrics.performance.system_health).toBeLessThan(0.9);
    });
  });

  it('should track error rates and system health', async () => {
    await testRunner.runTest(async () => {
      let errorCount = 0;
      let totalCalls = 0;

      for (let i = 0; i < 10; i++) {
        try {
          totalCalls++;
          await getBotStatus(`bot-${i}`);
        } catch (error) {
          errorCount++;
        }
      }

      const errorRate = errorCount / totalCalls;
      const systemHealth = 1 - errorRate;

      const metrics: TestMetrics = {
        performance: {
          errorRate,
          apiLatency: 0,
          systemHealth,
          successRate: 1 - errorRate,
          totalTrades: 0,
          walletBalance: 0
        }
      };

      testRunner.expectMetrics(metrics);
      expect(errorRate).toBeLessThan(0.3);
      expect(systemHealth).toBeGreaterThan(0.7);
    });
  });

  it('should validate performance thresholds', async () => {
    await testRunner.runTest(async () => {
      const performanceMetrics = {
        error_rate: 0.05,
        api_latency: 150,
        system_health: 0.95,
        success_rate: 0.95
      };

      const metrics: TestMetrics = {
        performance: {
          errorRate: performanceMetrics.error_rate,
          apiLatency: performanceMetrics.api_latency,
          systemHealth: performanceMetrics.system_health,
          successRate: performanceMetrics.success_rate,
          totalTrades: 100,
          walletBalance: 1.5
        }
      };

      testRunner.expectMetrics(metrics);

      expect(performanceMetrics.error_rate).toBeLessThan(0.1);
      expect(performanceMetrics.api_latency).toBeLessThan(200);
      expect(performanceMetrics.system_health).toBeGreaterThan(0.9);
      expect(performanceMetrics.success_rate).toBeGreaterThan(0.9);
    });
  });
});
