import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMarketDataStream } from './useMarketDataStream';
import { useOrderFlow } from './useOrderFlow';
import { useMarketMakerAnalysis } from './useMarketMakerAnalysis';

interface MarketUpdate {
  price: {
    current: number;
    change: number;
    change_percent: number;
    high: number;
    low: number;
    vwap: number;
  };
  volume: {
    total: number;
    buy: number;
    sell: number;
    imbalance: number;
  };
  trades: Array<{
    id: string;
    price: number;
    size: number;
    side: 'buy' | 'sell';
    timestamp: string;
  }>;
  orderbook: {
    bids: Array<[number, number]>;
    asks: Array<[number, number]>;
    spread: number;
    depth: number;
  };
}

interface SubscriptionConfig {
  symbol: string;
  channels: Array<'price' | 'trades' | 'orderbook' | 'volume'>;
  interval: number;
  depth?: number;
}

export const useMarketDataSubscription = (config: SubscriptionConfig) => {
  const [data, setData] = useState<MarketUpdate | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const { data: streamData } = useMarketDataStream({
    symbol: config.symbol,
    channels: config.channels,
    interval: config.interval
  });

  const { metrics: flowMetrics } = useOrderFlow(config.symbol);
  const { metrics: makerMetrics } = useMarketMakerAnalysis(null);

  useEffect(() => {
    if (!streamData) return;

    const subscriptionInterval = setInterval(() => {
      try {
        const calculateVWAP = (trades: any[]) => {
          if (!trades.length) return 0;
          const { volumeSum, priceVolumeSum } = trades.reduce(
            (acc, trade) => ({
              volumeSum: acc.volumeSum + trade.size,
              priceVolumeSum: acc.priceVolumeSum + trade.price * trade.size
            }),
            { volumeSum: 0, priceVolumeSum: 0 }
          );
          return priceVolumeSum / volumeSum;
        };

        const trades = streamData.trades || [];
        const orderbook = streamData.orderbook || { bids: [], asks: [] };

        const update: MarketUpdate = {
          price: {
            current: streamData.price.current,
            change: streamData.price.change_24h,
            change_percent: streamData.price.change_percentage_24h,
            high: Math.max(...trades.map(t => t.price)),
            low: Math.min(...trades.map(t => t.price)),
            vwap: calculateVWAP(trades)
          },
          volume: {
            total: flowMetrics?.volume.buy_volume + flowMetrics?.volume.sell_volume || 0,
            buy: flowMetrics?.volume.buy_volume || 0,
            sell: flowMetrics?.volume.sell_volume || 0,
            imbalance: flowMetrics?.volume.net_volume || 0
          },
          trades: trades.map(t => ({
            id: t.id,
            price: t.price,
            size: t.size,
            side: t.side,
            timestamp: t.timestamp
          })),
          orderbook: {
            bids: orderbook.bids.slice(0, config.depth || 10),
            asks: orderbook.asks.slice(0, config.depth || 10),
            spread: makerMetrics?.spread.current || 0,
            depth: makerMetrics?.depth.total_depth || 0
          }
        };

        setData(update);
        setIsSubscribed(true);
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to process market data update',
          code: 'SUBSCRIPTION_ERROR'
        });
        setIsSubscribed(false);
      }
    }, config.interval);

    return () => {
      clearInterval(subscriptionInterval);
      setIsSubscribed(false);
    };
  }, [streamData, flowMetrics, makerMetrics, config]);

  const getPriceData = () => data?.price || null;

  const getVolumeData = () => data?.volume || null;

  const getTradeData = () => data?.trades || [];

  const getOrderBookData = () => data?.orderbook || null;

  const getMarketSnapshot = () => {
    if (!data) return null;

    return {
      price: data.price.current,
      change_24h: data.price.change,
      volume_24h: data.volume.total,
      high_24h: data.price.high,
      low_24h: data.price.low,
      spread: data.orderbook.spread,
      timestamp: new Date().toISOString()
    };
  };

  const getSubscriptionStatus = () => ({
    isSubscribed,
    activeChannels: config.channels,
    lastUpdate: data ? new Date().toISOString() : null,
    error: error?.message
  });

  return {
    data,
    error,
    isSubscribed,
    getPriceData,
    getVolumeData,
    getTradeData,
    getOrderBookData,
    getMarketSnapshot,
    getSubscriptionStatus
  };
};
