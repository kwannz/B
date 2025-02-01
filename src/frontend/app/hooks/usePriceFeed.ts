import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';

interface PriceData {
  symbol: string;
  price: number;
  timestamp: string;
  change_24h: number;
  volume_24h: number;
  trades: {
    price: number;
    size: number;
    side: 'buy' | 'sell';
    timestamp: string;
  }[];
}

interface PriceFeedOptions {
  interval?: number;
  useWebSocket?: boolean;
}

export const usePriceFeed = (symbol: string | null, options: PriceFeedOptions = {}) => {
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!symbol) return;

    let ws: WebSocket | null = null;
    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'}/ws/price/${symbol}`;

    const connect = () => {
      if (!options.useWebSocket) return;

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        ws?.send(JSON.stringify({
          type: 'subscribe',
          channel: 'price',
          symbol
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'price_update') {
            setPriceData(data.data);
          }
          setError(null);
        } catch (err) {
          setError({
            message: 'Failed to parse price data',
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
      };

      ws.onclose = () => {
        setIsConnected(false);
        setTimeout(connect, 5000);
      };
    };

    const fetchPrice = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/price/${symbol}`);
        if (!response.ok) throw new Error('Failed to fetch price data');
        const data = await response.json();
        setPriceData(data);
        setError(null);
      } catch (err) {
        setError({
          message: 'Failed to fetch price data',
          code: 'FETCH_ERROR'
        });
      }
    };

    if (options.useWebSocket) {
      connect();
    } else {
      fetchPrice();
      const interval = setInterval(fetchPrice, options.interval || 15000);
      return () => clearInterval(interval);
    }

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [symbol, options.useWebSocket, options.interval]);

  return {
    priceData,
    error,
    isConnected
  };
};
