import apiClient from './apiClient';

interface Strategy {
  id: string;
  name: string;
  configuration: Record<string, unknown>;
}

interface BotStatus {
  status: 'running' | 'stopped' | 'error';
  lastUpdated: string;
  currentBalance?: number;
}

interface Wallet {
  id: string;
  name: string;
  exchange: string;
  apiKey: string;
}

const tradingBotService = {
  // Strategy endpoints
  createStrategy: async (strategy: Omit<Strategy, 'id'>) => {
    return apiClient.post('/strategies', strategy);
  },

  getStrategies: async () => {
    return apiClient.get<Strategy[]>('/strategies');
  },

  // Bot management endpoints
  startBot: async (strategyId: string) => {
    return apiClient.post(`/bot/start`, { strategyId });
  },

  stopBot: async () => {
    return apiClient.post('/bot/stop');
  },

  getBotStatus: async () => {
    return apiClient.get<BotStatus>('/bot/status');
  },

  // Wallet endpoints
  createWallet: async (wallet: Wallet) => {
    return apiClient.post('/wallets', wallet);
  },

  getWallets: async () => {
    return apiClient.get<Wallet[]>('/wallets');
  },

  // API key management
  storeApiKey: async (key: string, secret: string) => {
    return apiClient.post('/keys', { key, secret });
  },
};

export default tradingBotService;
