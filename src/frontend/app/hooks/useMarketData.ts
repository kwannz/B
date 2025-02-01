import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';

interface MarketData {
  symbol: string;
  price: number;
  volume_24h: number;
  price_change_24h: number;
  high_24h: number;
  low_24h: number;
  timestamp: string;
}

interface OrderBook {
  bids: [number, number][];
  asks: [number, number][];
  timestamp: string;
}

export const useMarketData = (symbol: string | null) => {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!symbol) return;

    let ws: WebSocket | null = null;
    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'}/ws/market/${symbol}`;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'market_data') {
          setMarketData(data.data);
        } else if (data.type === 'order_book') {
          setOrderBook(data.data);
        }
        setError(null);
      };

      ws.onerror = (event) => {
        setError({
          message: 'WebSocket connection error',
          code: 'WS_ERROR'
        });
      };

      ws.onclose = () => {
        setTimeout(connect, 5000);
      };
    };

    connect();
    setIsLoading(true);

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [symbol]);

  return {
    marketData,
    orderBook,
    error,
    isLoading
  };
};
