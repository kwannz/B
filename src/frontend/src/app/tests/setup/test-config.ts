import { DebugMetricsProvider } from '../../providers/DebugMetricsProvider';
import { createWallet, getWallet, createBot, getBotStatus, transferSOL } from '../../api/client';

export const mockProviders = {
  wrapper: DebugMetricsProvider
};

export const mockAPI = {
  createWallet: jest.fn(),
  getWallet: jest.fn(),
  createBot: jest.fn(),
  getBotStatus: jest.fn(),
  transferSOL: jest.fn()
};

export const mockWallet = {
  address: 'test-wallet',
  private_key: 'test-key',
  balance: 0,
  bot_id: 'test-bot'
};

export const mockBot = {
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
};

export const mockTransfer = {
  transaction_hash: 'test-hash',
  from_address: 'wallet-a',
  to_address: 'wallet-b',
  amount: 1.0,
  status: 'confirmed' as const,
  timestamp: new Date().toISOString()
};

beforeEach(() => {
  jest.resetAllMocks();
  Object.values(mockAPI).forEach(mock => {
    mock.mockClear();
  });
});

jest.mock('../../api/client', () => ({
  createWallet: mockAPI.createWallet,
  getWallet: mockAPI.getWallet,
  createBot: mockAPI.createBot,
  getBotStatus: mockAPI.getBotStatus,
  transferSOL: mockAPI.transferSOL
}));
