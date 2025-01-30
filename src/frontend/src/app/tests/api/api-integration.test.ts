import { createWallet, getWallet, listWallets, createBot, getBotStatus, updateBotStatus } from '@/app/api/client';
import { errorHandlingMiddleware } from '@/app/middleware/errorHandlingMiddleware';
import { TestMetrics } from '../types/test.types';

jest.mock('@/app/stores/debugStore', () => ({
  useDebugStore: {
    getState: jest.fn(() => ({
      metrics: {
        performance: {
          errorRate: 0,
          apiLatency: 0,
          systemHealth: 1
        }
      },
      updateMetrics: jest.fn(),
      addLog: jest.fn()
    }))
  }
}));

describe('API Client Integration', () => {
  const mockWallet = {
    address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
    balance: 1.5,
    bot_id: 'bot-123',
    performance: {
      total_trades: 50,
      success_rate: 0.8,
      profit_loss: 0.5,
      avg_trade_duration: 120,
      max_drawdown: 0.1
    }
  };

  const mockBot = {
    id: 'bot-123',
    type: 'trading',
    strategy: 'Test Strategy',
    status: 'active',
    metrics: {
      total_volume: 1000,
      profit_loss: 0.5,
      active_positions: 2
    }
  };

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('should handle successful API calls with metrics tracking', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockWallet)
    });

    const result = await errorHandlingMiddleware(() => getWallet('bot-123'));
    expect(result).toEqual(mockWallet);

    const metrics = useDebugStore.getState().metrics as TestMetrics;
    expect(metrics).toHaveErrorRate(0);
    expect(metrics).toHaveLatency(1000);
    expect(metrics.performance.systemHealth).toBeGreaterThan(0.9);
  });

  it('should handle API errors with proper error tracking', async () => {
    const error = new Error('API Error');
    (global.fetch as jest.Mock).mockRejectedValueOnce(error);

    await expect(errorHandlingMiddleware(() => getWallet('bot-123')))
      .rejects.toThrow('API Error');

    const metrics = useDebugStore.getState().metrics as TestMetrics;
    expect(metrics).toHaveErrorRate(0.2);
    expect(metrics.performance.systemHealth).toBeLessThan(0.9);
  });

  it('should track performance metrics for batch operations', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockWallet])
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBot)
      });

    await Promise.all([
      errorHandlingMiddleware(() => listWallets()),
      errorHandlingMiddleware(() => getBotStatus('bot-123'))
    ]);

    const metrics = useDebugStore.getState().metrics as TestMetrics;
    expect(metrics).toHaveLatency(2000);
    expect(metrics.performance.systemHealth).toBeGreaterThan(0.8);
  });

  it('should handle network timeouts gracefully', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() => 
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
    );

    await expect(errorHandlingMiddleware(() => getWallet('bot-123')))
      .rejects.toThrow('Timeout');

    const metrics = useDebugStore.getState().metrics as TestMetrics;
    expect(metrics).toHaveErrorRate(0.2);
    expect(metrics).toHaveLatency(5000);
  });

  it('should validate response data structure', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ invalid: 'data' })
    });

    await expect(errorHandlingMiddleware(() => getWallet('bot-123')))
      .rejects.toThrow();

    const metrics = useDebugStore.getState().metrics as TestMetrics;
    expect(metrics).toHaveErrorRate(0.2);
  });

  it('should handle rate limiting responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: 'Too Many Requests' })
    });

    await expect(errorHandlingMiddleware(() => getWallet('bot-123')))
      .rejects.toThrow('Too Many Requests');

    const metrics = useDebugStore.getState().metrics as TestMetrics;
    expect(metrics).toHaveErrorRate(0.2);
    expect(metrics.performance.systemHealth).toBeLessThan(0.9);
  });

  it('should track successful wallet operations', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockWallet)
    });

    const result = await errorHandlingMiddleware(() => createWallet('bot-123'));
    expect(result).toEqual(mockWallet);

    const metrics = useDebugStore.getState().metrics as TestMetrics;
    expect(metrics).toHaveErrorRate(0);
    expect(metrics).toHaveLatency(1000);
    expect(metrics.performance.systemHealth).toBeGreaterThan(0.9);
  });

  it('should handle bot status updates with metrics', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ...mockBot, status: 'inactive' })
    });

    const result = await errorHandlingMiddleware(() => 
      updateBotStatus('bot-123', 'inactive')
    );
    expect(result.status).toBe('inactive');

    const metrics = useDebugStore.getState().metrics as TestMetrics;
    expect(metrics).toHaveErrorRate(0);
    expect(metrics.performance.systemHealth).toBeGreaterThan(0.9);
  });
});
