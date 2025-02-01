import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMarketDataProvider } from './useMarketDataProvider';
import { useMarketMaker } from './useMarketMaker';

interface MarketUpdate {
  symbol: string;
  price: {
    bid: number;
    ask: number;
    last: number;
    timestamp: string;
  };
  orderbook: {
    bids: Array<[number, number]>;
    asks: Array<[number, number]>;
    sequence: number;
  };
  trades: Array<{
    id: string;
    price: number;
    size: number;
    side: 'buy' | 'sell';
    timestamp: string;
  }>;
  ticker: {
    volume_24h: number;
    trades_24h: number;
    high_24h: number;
    low_24h: number;
    open_24h: number;
  };
}

interface StreamConfig {
  symbols: string[];
  channels: Array<'trades' | 'orderbook' | 'ticker'>;
  depth?: number;
  interval?: number;
}

export const useMarketStream = (config: StreamConfig) => {
  const [updates, setUpdates] = useState<Record<string, MarketUpdate>>({});
  const [error, setError] = useState<ApiError | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);

  const { marketContext } = useMarketDataProvider(null, null);
  const { metrics: makerMetrics } = useMarketMaker(null);

  useEffect(() => {
    if (!config.symbols.length || !config.channels.length) return;

    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'}/ws/market`;
    let ws: WebSocket | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 1000;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttempts = 0;

        config.symbols.forEach(symbol => {
          config.channels.forEach(channel => {
            const subscription = {
              type: 'subscribe',
              channel,
              symbol,
              depth: config.depth || 20,
              interval: config.interval || 100
            };
            ws?.send(JSON.stringify(subscription));
          });
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'subscribed') {
            setSubscriptions(prev => [...prev, `${data.channel}:${data.symbol}`]);
            return;
          }

          if (data.type === 'update') {
            setUpdates(prev => ({
              ...prev,
              [data.symbol]: {
                symbol: data.symbol,
                price: {
                  bid: data.data.price?.bid || prev[data.symbol]?.price.bid || 0,
                  ask: data.data.price?.ask || prev[data.symbol]?.price.ask || 0,
                  last: data.data.price?.last || prev[data.symbol]?.price.last || 0,
                  timestamp: data.data.price?.timestamp || new Date().toISOString()
                },
                orderbook: {
                  bids: data.data.orderbook?.bids || prev[data.symbol]?.orderbook.bids || [],
                  asks: data.data.orderbook?.asks || prev[data.symbol]?.orderbook.asks || [],
                  sequence: data.data.orderbook?.sequence || 0
                },
                trades: [
                  ...(data.data.trades || []),
                  ...(prev[data.symbol]?.trades || [])
                ].slice(0, 100),
                ticker: {
                  volume_24h: data.data.ticker?.volume_24h || prev[data.symbol]?.ticker.volume_24h || 0,
                  trades_24h: data.data.ticker?.trades_24h || prev[data.symbol]?.ticker.trades_24h || 0,
                  high_24h: data.data.ticker?.high_24h || prev[data.symbol]?.ticker.high_24h || 0,
                  low_24h: data.data.ticker?.low_24h || prev[data.symbol]?.ticker.low_24h || 0,
                  open_24h: data.data.ticker?.open_24h || prev[data.symbol]?.ticker.open_24h || 0
                }
              }
            }));
          }

          setError(null);
        } catch (err) {
          setError({
            message: err instanceof Error ? err.message : 'Failed to parse market data',
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
        setSubscriptions([]);

        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          setTimeout(connect, reconnectDelay * reconnectAttempts);
        } else {
          setError({
            message: 'Maximum reconnection attempts reached',
            code: 'MAX_RECONNECT_ERROR'
          });
        }
      };
    };

    connect();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [config]);

  const getLatestPrice = (symbol: string) => {
    return updates[symbol]?.price || null;
  };

  const getOrderBook = (symbol: string) => {
    return updates[symbol]?.orderbook || null;
  };

  const getRecentTrades = (symbol: string, limit: number = 50) => {
    return updates[symbol]?.trades.slice(0, limit) || [];
  };

  const getTicker = (symbol: string) => {
    return updates[symbol]?.ticker || null;
  };

  const calculateSpread = (symbol: string) => {
    const update = updates[symbol];
    if (!update?.price.bid || !update?.price.ask) return null;
    return {
      absolute: update.price.ask - update.price.bid,
      percentage: ((update.price.ask - update.price.bid) / update.price.bid) * 100
    };
  };

  return {
    updates,
    error,
    isConnected,
    subscriptions,
    getLatestPrice,
    getOrderBook,
    getRecentTrades,
    getTicker,
    calculateSpread
  };
};
