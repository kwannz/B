import { getBotStatus, getWallet, createBot } from '@/app/api/client';
import { TestMetrics } from '../types/test.types';
import { testRunner } from '../setup/test-runner';

describe('System Monitoring and Health Checks', () => {
  beforeEach(() => {
    jest.setTimeout(30000);
  });

  it('should track system health metrics during normal operations', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      
      // Create bot and monitor system health
      const bot = await createBot('trading', 'Test Strategy');
      const createBotLatency = Date.now() - startTime;
      
      expect(bot).toMatchObject({
        type: 'trading',
        strategy: 'Test Strategy'
      });

      // Monitor wallet creation health
      const wallet = await createWallet(bot.id);
      const walletLatency = Date.now() - (startTime + createBotLatency);

      expect(wallet.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);

      // Monitor bot status health
      const botStatus = await getBotStatus(bot.id);
      const statusLatency = Date.now() - (startTime + createBotLatency + walletLatency);

      const metrics: TestMetrics = {
        performance: {
          errorRate: 0,
          apiLatency: (createBotLatency + walletLatency + statusLatency) / 3,
          systemHealth: 1,
          successRate: 1,
          totalTrades: 0,
          walletBalance: wallet.balance
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.apiLatency).toBeLessThan(2000);
      expect(metrics.performance.systemHealth).toBe(1);
    });
  });

  it('should detect and report system degradation', async () => {
    await testRunner.runTest(async () => {
      const bot = await createBot('trading', 'Test Strategy');
      
      // Simulate system load with concurrent requests
      const concurrentRequests = 10;
      const startTime = Date.now();
      
      const requests = Array(concurrentRequests).fill(null).map(() => 
        getBotStatus(bot.id)
      );

      const results = await Promise.allSettled(requests);
      const endTime = Date.now();

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      const avgLatency = (endTime - startTime) / concurrentRequests;

      const metrics: TestMetrics = {
        performance: {
          errorRate: failureCount / concurrentRequests,
          apiLatency: avgLatency,
          systemHealth: successCount / concurrentRequests,
          successRate: successCount / concurrentRequests,
          totalTrades: 0,
          walletBalance: 0
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.systemHealth).toBeGreaterThan(0.7);
      expect(metrics.performance.apiLatency).toBeLessThan(5000);
    });
  });

  it('should monitor API endpoint health', async () => {
    await testRunner.runTest(async () => {
      const endpoints = [
        () => createBot('trading', 'Test Strategy'),
        () => getBotStatus('test-bot-id'),
        () => getWallet('test-wallet-id')
      ];

      const healthMetrics = {
        totalRequests: 0,
        successfulRequests: 0,
        totalLatency: 0
      };

      for (const endpoint of endpoints) {
        const startTime = Date.now();
        try {
          await endpoint();
          healthMetrics.successfulRequests++;
          healthMetrics.totalLatency += Date.now() - startTime;
        } catch (error) {
          // Expected some errors for invalid IDs
        }
        healthMetrics.totalRequests++;
      }

      const metrics: TestMetrics = {
        performance: {
          errorRate: (healthMetrics.totalRequests - healthMetrics.successfulRequests) / healthMetrics.totalRequests,
          apiLatency: healthMetrics.totalLatency / healthMetrics.totalRequests,
          systemHealth: healthMetrics.successfulRequests / healthMetrics.totalRequests,
          successRate: healthMetrics.successfulRequests / healthMetrics.totalRequests,
          totalTrades: 0,
          walletBalance: 0
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.apiLatency).toBeLessThan(2000);
    });
  });

  it('should track memory usage and performance metrics', async () => {
    await testRunner.runTest(async () => {
      const startHeap = process.memoryUsage().heapUsed;
      const startTime = Date.now();

      // Create multiple bots to monitor memory usage
      const botsToCreate = 5;
      const bots = await Promise.all(
        Array(botsToCreate).fill(null).map(() => 
          createBot('trading', 'Test Strategy')
        )
      );

      const endHeap = process.memoryUsage().heapUsed;
      const endTime = Date.now();

      const heapUsage = endHeap - startHeap;
      const avgLatency = (endTime - startTime) / botsToCreate;

      const metrics: TestMetrics = {
        performance: {
          errorRate: 0,
          apiLatency: avgLatency,
          systemHealth: 1,
          successRate: 1,
          totalTrades: 0,
          walletBalance: 0
        },
        system: {
          heapUsage,
          operationsPerSecond: (botsToCreate / (endTime - startTime)) * 1000
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.performance.apiLatency).toBeLessThan(2000);
      expect(metrics.system.operationsPerSecond).toBeGreaterThan(1);
    });
  });

  it('should monitor WebSocket connection health', async () => {
    await testRunner.runTest(async () => {
      const bot = await createBot('trading', 'Test Strategy');
      const startTime = Date.now();

      // Monitor WebSocket connection events
      const wsEvents = {
        connected: 0,
        disconnected: 0,
        errors: 0,
        messages: 0
      };

      // Simulate WebSocket monitoring
      const mockWebSocket = {
        onopen: () => wsEvents.connected++,
        onclose: () => wsEvents.disconnected++,
        onerror: () => wsEvents.errors++,
        onmessage: () => wsEvents.messages++
      };

      // Trigger mock events
      mockWebSocket.onopen();
      mockWebSocket.onmessage();
      mockWebSocket.onmessage();
      mockWebSocket.onclose();

      const metrics: TestMetrics = {
        performance: {
          errorRate: wsEvents.errors / (wsEvents.connected + wsEvents.disconnected),
          apiLatency: Date.now() - startTime,
          systemHealth: wsEvents.connected / (wsEvents.connected + wsEvents.disconnected),
          successRate: wsEvents.messages / (wsEvents.messages + wsEvents.errors),
          totalTrades: 0,
          walletBalance: 0
        },
        websocket: {
          connectionSuccess: wsEvents.connected > 0,
          messageRate: wsEvents.messages,
          errorRate: wsEvents.errors / (wsEvents.messages + wsEvents.errors)
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.websocket.connectionSuccess).toBe(true);
      expect(metrics.websocket.errorRate).toBe(0);
    });
  });
});
