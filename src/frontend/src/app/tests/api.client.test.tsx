import { renderHook } from './setup/test-utils';
import { useDebugMetrics } from '../hooks/useDebugMetrics';
import { useDebugStore } from '../stores/debugStore';
import { createWallet, getWallet, createBot, getBotStatus, transferSOL } from '../api/client';
import { DEBUG_CONFIG } from '../config/debug.config';

jest.mock('../api/client');

const mockedCreateWallet = createWallet as jest.MockedFunction<typeof createWallet>;
const mockedGetWallet = getWallet as jest.MockedFunction<typeof getWallet>;
const mockedCreateBot = createBot as jest.MockedFunction<typeof createBot>;
const mockedGetBotStatus = getBotStatus as jest.MockedFunction<typeof getBotStatus>;
const mockedTransferSOL = transferSOL as jest.MockedFunction<typeof transferSOL>;

jest.mock('../api/client', () => ({
  createWallet: jest.fn(),
  getWallet: jest.fn(),
  createBot: jest.fn(),
  getBotStatus: jest.fn(),
  transferSOL: jest.fn()
}));

describe('API Client Integration', () => {
  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: {
        performance: [],
        trading: [],
        wallet: []
      }
    });
    jest.clearAllMocks();
  });

  it('should create wallet without minimum balance check', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    const mockWallet = {
      address: 'test-wallet',
      private_key: 'test-key',
      balance: 0,
      bot_id: 'test-bot'
    };

    mockedCreateWallet.mockResolvedValue(mockWallet);
    const wallet = await mockedCreateWallet('test-bot');

    expect(wallet.balance).toBe(0);
    const metrics = result.current.getMetricsSnapshot();
    expect(metrics.wallet.balances['test-wallet']).toBe(0);
    expect(metrics.performance.errorRate).toBe(0);
  });

  it('should allow transfers with zero balance', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    const mockTransfer = {
      transaction_hash: 'test-hash',
      from_address: 'wallet-a',
      to_address: 'wallet-b',
      amount: 1.0,
      status: 'confirmed' as const
    };

    mockedTransferSOL.mockResolvedValue(mockTransfer);
    const transfer = await transferSOL('wallet-a', 'wallet-b', 1.0);

    expect(transfer.status).toBe('confirmed');
    const metrics = result.current.getMetricsSnapshot();
    expect(metrics.wallet.transactions).toBe(1);
    expect(metrics.performance.errorRate).toBe(0);
  });

  it('should track API performance without balance validation', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    const mockBot = {
      id: 'test-bot',
      status: 'active'
    };

    mockedGetBotStatus.mockImplementation(() => 
      new Promise(resolve => {
        setTimeout(() => resolve(mockBot), 100);
      })
    );

    const startTime = performance.now();
    await getBotStatus('test-bot');
    const endTime = performance.now();

    const metrics = result.current.getMetricsSnapshot();
    expect(metrics.performance.apiLatency).toBeGreaterThanOrEqual(0);
    expect(metrics.performance.apiLatency).toBeLessThanOrEqual(endTime - startTime);
  });

  it('should handle concurrent operations without balance checks', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    const mockWallet = {
      address: 'test-wallet',
      private_key: 'test-key',
      balance: 0,
      bot_id: 'test-bot'
    };

    const mockBot = {
      id: 'test-bot',
      status: 'active'
    };

    (createWallet as jest.Mock).mockResolvedValue(mockWallet);
    (getBotStatus as jest.Mock).mockResolvedValue(mockBot);

    await Promise.all([
      createWallet('bot-1'),
      createWallet('bot-2'),
      getBotStatus('test-bot-1'),
      getBotStatus('test-bot-2')
    ]);

    const metrics = result.current.getMetricsSnapshot();
    expect(metrics.performance.apiLatency).toBeGreaterThanOrEqual(0);
    expect(metrics.performance.errorRate).toBe(0);
  });

  it('should track system health without balance requirements', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    const mockBot = {
      id: 'test-bot',
      status: 'active'
    };

    (getBotStatus as jest.Mock).mockImplementation(() => 
      new Promise(resolve => {
        setTimeout(() => resolve(mockBot), DEBUG_CONFIG.thresholds.system.latency + 100);
      })
    );

    await getBotStatus('test-bot');

    const metrics = result.current.getMetricsSnapshot();
    expect(metrics.performance.systemHealth).toBeLessThan(1);
    expect(metrics.performance.apiLatency).toBeGreaterThan(DEBUG_CONFIG.thresholds.system.latency);
  });
});
