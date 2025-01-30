import { createWallet, getWallet, createBot, getBotStatus, transferSOL } from '../../api/client';

export type WalletResponse = {
  address: string;
  private_key: string;
  balance: number;
  bot_id: string;
};

export type BotResponse = {
  id: string;
  type: string;
  strategy: string;
  status: 'active' | 'inactive';
  created_at: string;
  metrics: {
    total_volume: number;
    profit_loss: number;
    active_positions: number;
  };
};

export type TransferResponse = {
  transaction_hash: string;
  from_address: string;
  to_address: string;
  amount: number;
  status: 'confirmed' | 'pending' | 'failed';
  timestamp: string;
};

export type ApiError = {
  message: string;
  code: string;
  status: number;
};

export type ApiClient = {
  createWallet: typeof createWallet;
  getWallet: typeof getWallet;
  createBot: typeof createBot;
  getBotStatus: typeof getBotStatus;
  transferSOL: typeof transferSOL;
};
