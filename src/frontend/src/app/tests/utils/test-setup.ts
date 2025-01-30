import { TestMetrics, TestWallet, TestBot, TestTransfer } from '../types/test.types';
import { createMockApiResponse } from './api-test-utils';
import { createDebugMetrics } from './debug-test-utils';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';

export const setupTestSuite = () => {
  const metrics = createDebugMetrics();
  const debugStore = {
    isEnabled: true,
    logs: [],
    metrics
  };

  beforeEach(() => {
    jest.resetAllMocks();
    Object.values(mockAPI).forEach(mock => mock.mockClear());
    setupMockAPI();
  });

  const setupMockAPI = () => {
    mockAPI.createWallet.mockResolvedValue({
      address: 'test-wallet',
      private_key: 'test-key',
      balance: 0,
      bot_id: 'test-bot'
    });

    mockAPI.getWallet.mockResolvedValue({
      address: 'test-wallet',
      private_key: 'test-key',
      balance: 0,
      bot_id: 'test-bot'
    });

    mockAPI.createBot.mockResolvedValue({
      id: 'test-bot',
      type: 'trading',
      strategy: 'test-strategy',
      status: 'active',
      created_at: new Date().toISOString(),
      metrics: {
        total_volume: 1000,
        profit_loss: 100,
        active_positions: 2
      }
    });

    mockAPI.getBotStatus.mockResolvedValue({
      id: 'test-bot',
      status: 'active'
    });

    mockAPI.transferSOL.mockResolvedValue({
      transaction_hash: 'test-hash',
      from_address: 'wallet-a',
      to_address: 'wallet-b',
      amount: 1.0,
      status: 'confirmed',
      timestamp: new Date().toISOString()
    });
  };

  const setupErrorAPI = () => {
    const error = {
      message: 'API Error',
      code: 'API_ERROR',
      status: 500
    };
    Object.values(mockAPI).forEach(mock => mock.mockRejectedValue(error));
  };

  const setupSlowAPI = () => {
    const delay = DEBUG_CONFIG.thresholds.system.latency + 100;
    Object.values(mockAPI).forEach(mock => {
      mock.mockImplementation(() => new Promise(resolve => 
        setTimeout(() => resolve({}), delay)
      ));
    });
  };

  return {
    debugStore,
    setupMockAPI,
    setupErrorAPI,
    setupSlowAPI
  };
};
