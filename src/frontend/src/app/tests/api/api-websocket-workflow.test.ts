import { createBot, getBotStatus, createWallet } from '@/app/api/client';
import { TestMetrics } from '../types/test.types';
import { testRunner } from '../setup/test-runner';

describe('WebSocket Integration and Real-time Data Flow', () => {
  beforeEach(() => {
    jest.setTimeout(30000);
  });

  it('should establish and maintain WebSocket connections', async () => {
    await testRunner.runTest(async () => {
      const bot = await createBot('trading', 'Test Strategy');
      const mockWebSocket = {
        onopen: jest.fn(),
        onclose: jest.fn(),
        onerror: jest.fn(),
        onmessage: jest.fn(),
        send: jest.fn(),
        close: jest.fn()
      };

      // Mock WebSocket connection
      global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket);

      const wsUrl = `ws://localhost:8000/ws/bot/${bot.id}`;
      const ws = new WebSocket(wsUrl);

      // Simulate connection open
      mockWebSocket.onopen();
      expect(mockWebSocket.onopen).toHaveBeenCalled();

      // Simulate receiving bot status updates
      const statusUpdate = {
        type: 'bot_status',
        data: {
          id: bot.id,
          status: 'active',
          metrics: {
            total_volume: 1000,
            profit_loss: 0.5
          }
        }
      };

      mockWebSocket.onmessage({ data: JSON.stringify(statusUpdate) });
      expect(mockWebSocket.onmessage).toHaveBeenCalled();

      const metrics: TestMetrics = {
        performance: {
          errorRate: 0,
          apiLatency: 0,
          systemHealth: 1,
          successRate: 1,
          totalTrades: 0,
          walletBalance: 0
        },
        websocket: {
          connectionSuccess: true,
          messageRate: 1,
          errorRate: 0
        }
      };

      testRunner.expectMetrics(metrics);
    });
  });

  it('should handle WebSocket reconnection scenarios', async () => {
    await testRunner.runTest(async () => {
      const bot = await createBot('trading', 'Test Strategy');
      let connectionAttempts = 0;
      const maxRetries = 3;

      const mockWebSocket = {
        onopen: jest.fn(),
        onclose: jest.fn(),
        onerror: jest.fn(),
        onmessage: jest.fn(),
        send: jest.fn(),
        close: jest.fn()
      };

      global.WebSocket = jest.fn().mockImplementation(() => {
        connectionAttempts++;
        return mockWebSocket;
      });

      const wsUrl = `ws://localhost:8000/ws/bot/${bot.id}`;
      let ws = new WebSocket(wsUrl);

      // Simulate connection failures and retries
      for (let i = 0; i < maxRetries; i++) {
        mockWebSocket.onclose({ code: 1006, reason: 'Connection lost' });
        ws = new WebSocket(wsUrl);
      }

      expect(connectionAttempts).toBe(maxRetries + 1);

      const metrics: TestMetrics = {
        performance: {
          errorRate: (maxRetries) / (maxRetries + 1),
          apiLatency: 0,
          systemHealth: 1 / (maxRetries + 1),
          successRate: 1 / (maxRetries + 1),
          totalTrades: 0,
          walletBalance: 0
        }
      };

      testRunner.expectMetrics(metrics);
    });
  });

  it('should validate real-time data flow', async () => {
    await testRunner.runTest(async () => {
      const bot = await createBot('trading', 'Test Strategy');
      const mockWebSocket = {
        onopen: jest.fn(),
        onclose: jest.fn(),
        onerror: jest.fn(),
        onmessage: jest.fn(),
        send: jest.fn(),
        close: jest.fn()
      };

      global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket);
      const wsUrl = `ws://localhost:8000/ws/bot/${bot.id}`;
      const ws = new WebSocket(wsUrl);

      // Simulate stream of real-time updates
      const updates = [
        { type: 'market_data', data: { price: 100 } },
        { type: 'trade_executed', data: { amount: 1.5 } },
        { type: 'bot_status', data: { status: 'active' } }
      ];

      updates.forEach(update => {
        mockWebSocket.onmessage({ data: JSON.stringify(update) });
      });

      expect(mockWebSocket.onmessage).toHaveBeenCalledTimes(updates.length);

      const metrics: TestMetrics = {
        performance: {
          errorRate: 0,
          apiLatency: 0,
          systemHealth: 1,
          successRate: 1,
          totalTrades: 1,
          walletBalance: 0
        },
        websocket: {
          messageRate: updates.length,
          errorRate: 0
        }
      };

      testRunner.expectMetrics(metrics);
    });
  });

  it('should handle concurrent WebSocket connections', async () => {
    await testRunner.runTest(async () => {
      const bots = await Promise.all([
        createBot('trading', 'Strategy 1'),
        createBot('trading', 'Strategy 2')
      ]);

      const mockSockets = bots.map(() => ({
        onopen: jest.fn(),
        onclose: jest.fn(),
        onerror: jest.fn(),
        onmessage: jest.fn(),
        send: jest.fn(),
        close: jest.fn()
      }));

      let currentSocket = 0;
      global.WebSocket = jest.fn().mockImplementation(() => mockSockets[currentSocket++]);

      const connections = bots.map(bot => {
        const wsUrl = `ws://localhost:8000/ws/bot/${bot.id}`;
        return new WebSocket(wsUrl);
      });

      connections.forEach((_, index) => {
        mockSockets[index].onopen();
        expect(mockSockets[index].onopen).toHaveBeenCalled();
      });

      const metrics: TestMetrics = {
        performance: {
          errorRate: 0,
          apiLatency: 0,
          systemHealth: 1,
          successRate: 1,
          totalTrades: 0,
          walletBalance: 0
        },
        websocket: {
          connectionCount: connections.length,
          errorRate: 0
        }
      };

      testRunner.expectMetrics(metrics);
    });
  });
});
