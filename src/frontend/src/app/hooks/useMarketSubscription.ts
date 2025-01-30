import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';

interface MarketUpdate {
  symbol: string;
  price: number;
  volume: number;
  timestamp: string;
  trades: {
    price: number;
    size: number;
    side: 'buy' | 'sell';
    timestamp: string;
  }[];
  orderbook: {
    bids: [number, number][];
    asks: [number, number][];
  };
}

export const useMarketSubscription = (symbol: string | null) => {
  const [marketData, setMarketData] = useState<MarketUpdate | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!symbol) return;

    let ws: WebSocket | null = null;
    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'}/ws/market/${symbol}`;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        ws?.send(JSON.stringify({
          type: 'subscribe',
          channel: 'market',
          symbol
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'subscribed') {
            setIsSubscribed(true);
          } else if (data.type === 'market_update') {
            setMarketData(data.data);
          }
          setError(null);
        } catch (err) {
          setError({
            message: 'Failed to parse market data',
            code: 'PARSE_ERROR'
          });
        }
      };

      ws.onerror = () => {
        setError({
          message: 'WebSocket connection error',
          code: 'WS_ERROR'
        });
        setIsConnected(false);
        setIsSubscribed(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsSubscribed(false);
        setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [symbol]);

  return {
    marketData,
    error,
    isConnected,
    isSubscribed
  };
};
