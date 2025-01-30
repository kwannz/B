import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMarketStream } from './useMarketStream';
import { useMarketDataProvider } from './useMarketDataProvider';

interface MarketDataStream {
  price: {
    current: number;
    change_24h: number;
    change_percentage_24h: number;
    high_24h: number;
    low_24h: number;
    volume_24h: number;
  };
  orderbook: {
    bids: Array<[number, number]>;
    asks: Array<[number, number]>;
    spread: number;
    depth: number;
    timestamp: string;
  };
  trades: Array<{
    id: string;
    price: number;
    size: number;
    side: 'buy' | 'sell';
    timestamp: string;
  }>;
  market_stats: {
    market_cap: number;
    fully_diluted_valuation: number;
    circulating_supply: number;
    total_supply: number;
    max_supply: number | null;
    ath: number;
    ath_change_percentage: number;
    ath_date: string;
    atl: number;
    atl_change_percentage: number;
    atl_date: string;
  };
}

interface StreamConfig {
  symbol: string;
  channels: Array<'price' | 'orderbook' | 'trades' | 'stats'>;
  interval?: number;
}

export const useMarketDataStream = (config: StreamConfig) => {
  const [data, setData] = useState<MarketDataStream | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const { updates: streamUpdates } = useMarketStream({
    symbols: [config.symbol],
    channels: config.channels as any[],
    interval: config.interval
  });
  const { marketContext } = useMarketDataProvider(config.symbol, null);

  useEffect(() => {
    if (!streamUpdates[config.symbol]) return;

    const update = streamUpdates[config.symbol];
    const currentTime = new Date().toISOString();

    try {
      setData(prev => ({
        price: {
          current: update.price.last,
          change_24h: update.price.last - update.ticker.open_24h,
          change_percentage_24h: ((update.price.last - update.ticker.open_24h) / update.ticker.open_24h) * 100,
          high_24h: update.ticker.high_24h,
          low_24h: update.ticker.low_24h,
          volume_24h: update.ticker.volume_24h
        },
        orderbook: {
          bids: update.orderbook.bids,
          asks: update.orderbook.asks,
          spread: update.price.ask - update.price.bid,
          depth: update.orderbook.bids.reduce((sum, [_, size]) => sum + size, 0) +
                update.orderbook.asks.reduce((sum, [_, size]) => sum + size, 0),
          timestamp: currentTime
        },
        trades: update.trades.map(trade => ({
          id: trade.id,
          price: trade.price,
          size: trade.size,
          side: trade.side,
          timestamp: trade.timestamp
        })),
        market_stats: {
          market_cap: marketContext?.market_cap || 0,
          fully_diluted_valuation: marketContext?.fully_diluted_valuation || 0,
          circulating_supply: marketContext?.circulating_supply || 0,
          total_supply: marketContext?.total_supply || 0,
          max_supply: marketContext?.max_supply || null,
          ath: marketContext?.ath || 0,
          ath_change_percentage: marketContext?.ath_change_percentage || 0,
          ath_date: marketContext?.ath_date || '',
          atl: marketContext?.atl || 0,
          atl_change_percentage: marketContext?.atl_change_percentage || 0,
          atl_date: marketContext?.atl_date || ''
        }
      }));

      setIsConnected(true);
      setError(null);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to process market data stream',
        code: 'STREAM_ERROR'
      });
    }
  }, [streamUpdates, config.symbol, marketContext]);

  const getLatestPrice = () => data?.price.current || null;

  const getPriceChange = () => ({
    absolute: data?.price.change_24h || 0,
    percentage: data?.price.change_percentage_24h || 0
  });

  const getOrderBook = () => data?.orderbook || null;

  const getRecentTrades = (limit: number = 50) => 
    data?.trades.slice(0, limit) || [];

  const getMarketStats = () => data?.market_stats || null;

  const calculateVWAP = () => {
    if (!data?.trades.length) return null;

    const { volumeSum, priceVolumeSum } = data.trades.reduce(
      (acc, trade) => ({
        volumeSum: acc.volumeSum + trade.size,
        priceVolumeSum: acc.priceVolumeSum + trade.price * trade.size
      }),
      { volumeSum: 0, priceVolumeSum: 0 }
    );

    return priceVolumeSum / volumeSum;
  };

  const calculateOrderBookImbalance = () => {
    if (!data?.orderbook) return null;

    const bidVolume = data.orderbook.bids.reduce((sum, [_, size]) => sum + size, 0);
    const askVolume = data.orderbook.asks.reduce((sum, [_, size]) => sum + size, 0);
    const totalVolume = bidVolume + askVolume;

    return totalVolume > 0 ? (bidVolume - askVolume) / totalVolume : 0;
  };

  return {
    data,
    error,
    isConnected,
    getLatestPrice,
    getPriceChange,
    getOrderBook,
    getRecentTrades,
    getMarketStats,
    calculateVWAP,
    calculateOrderBookImbalance
  };
};
