import { TestMetrics, TestWallet, TestBot, TestTransfer } from '../types/test.types';
import { createMockApiResponse } from './api-test-utils';
import { createDebugMetrics } from './debug-test-utils';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';

export const waitForMetricsUpdate = (timeout = 1000): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, timeout));

export const simulateApiCall = async <T>(
  mockFn: jest.Mock,
  response: T,
  delay = 0
): Promise<T> => {
  mockFn.mockImplementation(() => 
    new Promise(resolve => 
      setTimeout(() => resolve(response), delay)
    )
  );
  return response;
};

export const simulateApiError = (
  mockFn: jest.Mock,
  error: { message: string; code: string; status: number }
): void => {
  mockFn.mockRejectedValue(error);
};

export const simulateNetworkLatency = (
  mockFn: jest.Mock,
  response: any,
  latency = DEBUG_CONFIG.thresholds.system.latency + 100
): void => {
  mockFn.mockImplementation(() => 
    new Promise(resolve => 
      setTimeout(() => resolve(response), latency)
    )
  );
};

export const createTestWallet = (overrides?: Partial<TestWallet>): TestWallet => ({
  address: 'test-wallet',
  private_key: 'test-key',
  balance: 0,
  bot_id: 'test-bot',
  ...overrides
});

export const createTestBot = (overrides?: Partial<TestBot>): TestBot => ({
  id: 'test-bot',
  type: 'trading',
  strategy: 'test-strategy',
  status: 'active',
  created_at: new Date().toISOString(),
  metrics: {
    total_volume: 1000,
    profit_loss: 100,
    active_positions: 2
  },
  ...overrides
});

export const createTestTransfer = (overrides?: Partial<TestTransfer>): TestTransfer => ({
  transaction_hash: 'test-hash',
  from_address: 'wallet-a',
  to_address: 'wallet-b',
  amount: 1.0,
  status: 'confirmed',
  timestamp: new Date().toISOString(),
  ...overrides
});

export const mockApiResponses = () => {
  mockAPI.createWallet.mockResolvedValue(createTestWallet());
  mockAPI.getWallet.mockResolvedValue(createTestWallet());
  mockAPI.createBot.mockResolvedValue(createTestBot());
  mockAPI.getBotStatus.mockResolvedValue(createTestBot());
  mockAPI.transferSOL.mockResolvedValue(createTestTransfer());
};

export const mockApiErrors = () => {
  const error = {
    message: 'API Error',
    code: 'API_ERROR',
    status: 500
  };
  Object.values(mockAPI).forEach(mock => mock.mockRejectedValue(error));
};

export const mockApiLatency = () => {
  Object.values(mockAPI).forEach(mock => {
    simulateNetworkLatency(mock, {});
  });
};
