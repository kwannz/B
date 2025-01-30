import axios from 'axios';

const API_URL = process.env.VITE_API_URL || 'http://localhost:8000';

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const createWallet = async (botId: string) => {
  const response = await client.post('/wallets', { bot_id: botId });
  return response.data;
};

export const getWallet = async (botId: string) => {
  const response = await client.get(`/wallets/${botId}`);
  return response.data;
};

export const listWallets = async () => {
  const response = await client.get('/wallets');
  return response.data;
};

export const compareWallets = async (walletA: string, walletB: string) => {
  const response = await client.get(`/wallets/compare?wallet_a=${walletA}&wallet_b=${walletB}`);
  return response.data;
};

export const transferSOL = async (fromAddress: string, toAddress: string, amount: number) => {
  const response = await client.post('/wallets/transfer', {
    from_address: fromAddress,
    to_address: toAddress,
    amount
  });
  return response.data;
};

export const createBot = async (type: string, strategy: string) => {
  const response = await client.post('/bots', { type, strategy });
  return response.data;
};

export const getBotStatus = async (botId: string) => {
  const response = await client.get(`/bots/${botId}`);
  return response.data;
};

export const updateBotStatus = async (botId: string, status: 'active' | 'inactive') => {
  const response = await client.patch(`/bots/${botId}`, { status });
  return response.data;
};

export default client;
