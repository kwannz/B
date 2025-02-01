import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';

interface OrderBookEntry {
  price: number;
  size: number;
  total: number;
  count: number;
}

interface OrderBookData {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  spread: number;
  timestamp: string;
  depth: {
    bid_volume: number;
    ask_volume: number;
    imbalance: number;
  };
}

interface OrderBookOptions {
  depth?: number;
  grouping?: number;
  updateInterval?: number;
}

export const useOrderBook = (symbol: string | null, options: OrderBookOptions = {}) => {
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!symbol) return;

    let ws: WebSocket | null = null;
    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'}/ws/orderbook/${symbol}`;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        ws?.send(JSON.stringify({
          type: 'subscribe',
          channel: 'orderbook',
          symbol,
          depth: options.depth || 50,
          grouping: options.grouping || 0.01
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'orderbook_update') {
            const { bids, asks } = data.data;
            const spread = asks[0]?.price - bids[0]?.price || 0;
            const bidVolume = bids.reduce((sum: number, [_, size]: number[]) => sum + size, 0);
            const askVolume = asks.reduce((sum: number, [_, size]: number[]) => sum + size, 0);

            setOrderBook({
              bids: bids.map(([price, size]: number[], index: number) => ({
                price,
                size,
                total: bids.slice(0, index + 1).reduce((sum, [_, s]) => sum + s, 0),
                count: index + 1
              })),
              asks: asks.map(([price, size]: number[], index: number) => ({
                price,
                size,
                total: asks.slice(0, index + 1).reduce((sum, [_, s]) => sum + s, 0),
                count: index + 1
              })),
              spread,
              timestamp: new Date().toISOString(),
              depth: {
                bid_volume: bidVolume,
                ask_volume: askVolume,
                imbalance: (bidVolume - askVolume) / (bidVolume + askVolume)
              }
            });
          }
          setError(null);
        } catch (err) {
          setError({
            message: 'Failed to parse order book data',
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

    connect();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [symbol, options.depth, options.grouping]);

  const getMarketDepth = (depth: number = 10) => {
    if (!orderBook) return null;

    return {
      bids: orderBook.bids.slice(0, depth),
      asks: orderBook.asks.slice(0, depth),
      spread: orderBook.spread,
      imbalance: orderBook.depth.imbalance
    };
  };

  return {
    orderBook,
    getMarketDepth,
    error,
    isConnected
  };
};
