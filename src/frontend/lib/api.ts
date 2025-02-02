import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const TRADING_URL = process.env.NEXT_PUBLIC_TRADING_URL || 'http://localhost:8001';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8002';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const tradingClient = axios.create({
  baseURL: TRADING_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface SocialMetrics {
  twitterMentions: number;
  redditScore: number;
  telegramActivity: number;
  timestamp: string;
}

export interface WhaleActivity {
  id: string;
  type: 'BUY' | 'SELL';
  amount: string;
  price: string;
  timestamp: string;
}

export const fetchSocialMetrics = async (): Promise<SocialMetrics> => {
  const { data } = await apiClient.get('/api/metrics/social');
  return data;
};

export const fetchWhaleActivity = async (): Promise<WhaleActivity[]> => {
  const { data } = await apiClient.get('/api/metrics/whale-activity');
  return data;
};

export const createOrder = async (order: any) => {
  const { data } = await tradingClient.post('/orders', order);
  return data;
};

export const getPositions = async () => {
  const { data } = await tradingClient.get('/positions');
  return data;
};

export const connectWebSocket = (onMessage: (data: any) => void) => {
  const ws = new WebSocket(WS_URL);
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  return ws;
};

export const subscribeToMarketData = (ws: WebSocket, symbol: string) => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'market',
    symbol,
  }));
};

export const unsubscribeFromMarketData = (ws: WebSocket, symbol: string) => {
  ws.send(JSON.stringify({
    type: 'unsubscribe',
    channel: 'market',
    symbol,
  }));
};
