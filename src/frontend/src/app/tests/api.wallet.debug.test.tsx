import { renderHook } from '@testing-library/react';
import { useDebugMetrics } from '../hooks/useDebugMetrics';
import { useDebugStore } from '../stores/debugStore';
import { DebugMetricsProvider } from '../providers/DebugMetricsProvider';
import { createWallet, transferSOL } from '../api/client';
import { DEBUG_CONFIG } from '../config/debug.config';

jest.mock('../api/client', () => ({
  createWallet: jest.fn(),
  transferSOL: jest.fn()
}));

describe('Wallet Debug Integration', () => {
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

  it('should allow wallet creation without minimum balance check', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    const mockWallet = {
      address: 'test-wallet',
      private_key: 'test-key',
      balance: 0,
      bot_id: 'test-bot'
    };

    (createWallet as jest.Mock).mockResolvedValue(mockWallet);

    const wallet = await createWallet('test-bot');
    expect(wallet.balance).toBe(0);

    const metrics = result.current.getMetricsSnapshot();
    expect(metrics.wallet.balances['test-wallet']).toBe(0);
  });

  it('should track low balance wallets in debug metrics', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    const mockWallet = {
      address: 'low-balance-wallet',
      private_key: 'test-key',
      balance: 0.01,
      bot_id: 'test-bot'
    };

    (createWallet as jest.Mock).mockResolvedValue(mockWallet);
    await createWallet('test-bot');

    const metrics = result.current.getMetricsSnapshot();
    expect(metrics.wallet.balances['low-balance-wallet']).toBeLessThan(
      DEBUG_CONFIG.thresholds.wallet.min_balance_warning
    );
  });

  it('should allow transfers regardless of balance with debug monitoring', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    const mockTransfer = {
      transaction_hash: 'test-hash',
      from_address: 'wallet-a',
      to_address: 'wallet-b',
      amount: 1.5,
      timestamp: new Date().toISOString(),
      status: 'confirmed' as const
    };

    (transferSOL as jest.Mock).mockResolvedValue(mockTransfer);

    const transfer = await transferSOL('wallet-a', 'wallet-b', 1.5);
    expect(transfer.status).toBe('confirmed');

    const metrics = result.current.getMetricsSnapshot();
    expect(metrics.wallet.transactions).toBe(1);
  });

  it('should track failed transfers in debug metrics', async () => {
    const { result } = renderHook(() => useDebugMetrics(), {
      wrapper: DebugMetricsProvider
    });

    const mockError = new Error('Insufficient funds');
    (transferSOL as jest.Mock).mockRejectedValue(mockError);

    try {
      await transferSOL('wallet-a', 'wallet-b', 2.0);
    } catch (error) {
      const metrics = result.current.getMetricsSnapshot();
      expect(metrics.performance.errorRate).toBe(1);
      expect(metrics.wallet.transactions).toBe(0);
    }
  });
});
