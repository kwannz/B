import { createBot, getBotStatus, createWallet, getWallet, transferSOL } from '@/app/api/client';
import { TestMetrics } from '../types/test.types';
import { testRunner } from '../setup/test-runner';

describe('API Workflow Integration', () => {
  const mockBot = {
    id: 'bot-123',
    type: 'trading',
    strategy: 'Test Strategy',
    status: 'active'
  };

  const mockWallet = {
    address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
    balance: 1.5,
    bot_id: 'bot-123'
  };

  beforeEach(() => {
    jest.setTimeout(30000);
  });

  it('should complete full trading workflow with real API endpoints', async () => {
    await testRunner.runTest(async () => {
      // Step 1: Create Trading Bot
      const bot = await createBot('trading', 'Test Strategy');
      expect(bot).toMatchObject({
        type: 'trading',
        strategy: 'Test Strategy'
      });

      // Step 2: Get Bot Status
      const botStatus = await getBotStatus(bot.id);
      expect(botStatus.status).toBe('active');

      // Step 3: Create Wallet
      const wallet = await createWallet(bot.id);
      expect(wallet.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
      expect(wallet.balance).toBeGreaterThanOrEqual(0);

      // Step 4: Get Wallet Details
      const walletDetails = await getWallet(bot.id);
      expect(walletDetails.address).toBe(wallet.address);
      expect(walletDetails.bot_id).toBe(bot.id);

      // Step 5: Transfer SOL (if balance sufficient)
      if (wallet.balance >= 0.1) {
        const transferResult = await transferSOL(bot.id, '7YarSpUQYkiRfGzaRzEbqkEYP1ELXKoZKeMVhxk3YL7F', 0.1);
        expect(transferResult.success).toBe(true);
      }

      // Verify Metrics
      const metrics: TestMetrics = {
        performance: {
          errorRate: 0,
          apiLatency: 0,
          systemHealth: 1,
          successRate: 1,
          totalTrades: 0,
          walletBalance: wallet.balance
        }
      };

      testRunner.expectMetrics(metrics);
    });
  });

  it('should handle API errors gracefully', async () => {
    await testRunner.runTest(async () => {
      try {
        await createBot('invalid_type', '');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
        const metrics: TestMetrics = {
          performance: {
            errorRate: 0.2,
            apiLatency: 0,
            systemHealth: 0.8,
            successRate: 0.8,
            totalTrades: 0,
            walletBalance: 0
          }
        };
        testRunner.expectMetrics(metrics);
      }
    });
  });

  it('should validate minimum balance requirements', async () => {
    await testRunner.runTest(async () => {
      const bot = await createBot('trading', 'Test Strategy');
      const wallet = await createWallet(bot.id);

      if (wallet.balance < 0.5) {
        try {
          await transferSOL(bot.id, '7YarSpUQYkiRfGzaRzEbqkEYP1ELXKoZKeMVhxk3YL7F', 0.1);
          fail('Should have thrown insufficient balance error');
        } catch (error) {
          expect(error).toBeDefined();
          const metrics: TestMetrics = {
            performance: {
              errorRate: 0.2,
              apiLatency: 0,
              systemHealth: 0.8,
              successRate: 0.8,
              totalTrades: 0,
              walletBalance: wallet.balance
            }
          };
          testRunner.expectMetrics(metrics);
        }
      }
    });
  });

  it('should track API performance metrics', async () => {
    await testRunner.runTest(async () => {
      const startTime = Date.now();
      
      const bot = await createBot('trading', 'Test Strategy');
      const wallet = await createWallet(bot.id);
      const botStatus = await getBotStatus(bot.id);
      const walletDetails = await getWallet(bot.id);

      const endTime = Date.now();
      const apiLatency = endTime - startTime;

      const metrics: TestMetrics = {
        performance: {
          errorRate: 0,
          apiLatency,
          systemHealth: 1,
          successRate: 1,
          totalTrades: 0,
          walletBalance: wallet.balance
        }
      };

      testRunner.expectMetrics(metrics);
      expect(apiLatency).toBeLessThan(5000);
    });
  });
});
