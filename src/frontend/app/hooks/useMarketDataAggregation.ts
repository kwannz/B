import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMarketDataStream } from './useMarketDataStream';
import { useMarketMaker } from './useMarketMaker';
import { useNewsAggregator } from './useNewsAggregator';

interface MarketSnapshot {
  price: {
    current: number;
    change_24h: number;
    change_percentage_24h: number;
    vwap_24h: number;
  };
  volume: {
    total_24h: number;
    buy_24h: number;
    sell_24h: number;
    imbalance_ratio: number;
  };
  liquidity: {
    bid_depth: number;
    ask_depth: number;
    spread: number;
    imbalance: number;
  };
  sentiment: {
    news_score: number;
    social_score: number;
    combined_score: number;
    confidence: number;
  };
  volatility: {
    current: number;
    historical: number;
    forecast: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
}

interface AggregationConfig {
  symbol: string;
  update_interval: number;
  data_window: number;
}

export const useMarketDataAggregation = (config: AggregationConfig) => {
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: marketData } = useMarketDataStream({
    symbol: config.symbol,
    channels: ['price', 'orderbook', 'trades', 'stats']
  });
  const { metrics: makerMetrics } = useMarketMaker(null);
  const { state: newsState } = useNewsAggregator(null);

  useEffect(() => {
    if (!marketData) return;

    const aggregationInterval = setInterval(() => {
      try {
        setIsProcessing(true);

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

        const calculateVolatility = (prices: number[]) => {
          if (prices.length < 2) return 0;
          const returns = prices.slice(1).map((price, i) => 
            Math.log(price / prices[i])
          );
          const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
          const variance = returns.reduce((sum, r) => 
            sum + Math.pow(r - mean, 2), 0
          ) / (returns.length - 1);
          return Math.sqrt(variance * 252);
        };

        const trades = marketData.trades || [];
        const prices = trades.map(t => t.price);
        const buyVolume = trades
          .filter(t => t.side === 'buy')
          .reduce((sum, t) => sum + t.size, 0);
        const sellVolume = trades
          .filter(t => t.side === 'sell')
          .reduce((sum, t) => sum + t.size, 0);

        const newSnapshot: MarketSnapshot = {
          price: {
            current: marketData.price.current,
            change_24h: marketData.price.change_24h,
            change_percentage_24h: marketData.price.change_percentage_24h,
            vwap_24h: calculateVWAP(trades)
          },
          volume: {
            total_24h: marketData.price.volume_24h,
            buy_24h: buyVolume,
            sell_24h: sellVolume,
            imbalance_ratio: (buyVolume - sellVolume) / (buyVolume + sellVolume)
          },
          liquidity: {
            bid_depth: makerMetrics?.depth || 0,
            ask_depth: makerMetrics?.depth || 0,
            spread: makerMetrics?.spread || 0,
            imbalance: makerMetrics?.imbalance || 0
          },
          sentiment: {
            news_score: newsState?.social_metrics.sentiment.weighted_score || 0,
            social_score: newsState?.social_metrics.sentiment.weighted_score || 0,
            combined_score: (
              (newsState?.social_metrics.sentiment.weighted_score || 0) +
              (newsState?.social_metrics.sentiment.weighted_score || 0)
            ) / 2,
            confidence: newsState?.social_metrics.sentiment.positive || 0
          },
          volatility: {
            current: calculateVolatility(prices),
            historical: calculateVolatility(prices.slice(-100)),
            forecast: calculateVolatility(prices.slice(-20)),
            trend: calculateVolatility(prices.slice(-20)) > 
                  calculateVolatility(prices.slice(-100)) ? 
                  'increasing' : 'decreasing'
          }
        };

        setSnapshot(newSnapshot);
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to aggregate market data',
          code: 'AGGREGATION_ERROR'
        });
      } finally {
        setIsProcessing(false);
      }
    }, config.update_interval);

    return () => clearInterval(aggregationInterval);
  }, [marketData, makerMetrics, newsState, config]);

  const getPriceMetrics = () => snapshot?.price || null;

  const getVolumeMetrics = () => snapshot?.volume || null;

  const getLiquidityMetrics = () => snapshot?.liquidity || null;

  const getSentimentMetrics = () => snapshot?.sentiment || null;

  const getVolatilityMetrics = () => snapshot?.volatility || null;

  const getMarketState = () => {
    if (!snapshot) return null;

    const volatilityState = 
      snapshot.volatility.current > 0.5 ? 'high' :
      snapshot.volatility.current > 0.2 ? 'medium' : 'low';

    const sentimentState =
      snapshot.sentiment.combined_score > 0.6 ? 'bullish' :
      snapshot.sentiment.combined_score < -0.6 ? 'bearish' : 'neutral';

    const liquidityState =
      snapshot.liquidity.imbalance > 0.3 ? 'imbalanced' :
      snapshot.liquidity.spread > 0.01 ? 'wide' : 'normal';

    return {
      volatility: volatilityState,
      sentiment: sentimentState,
      liquidity: liquidityState
    };
  };

  return {
    snapshot,
    error,
    isProcessing,
    getPriceMetrics,
    getVolumeMetrics,
    getLiquidityMetrics,
    getSentimentMetrics,
    getVolatilityMetrics,
    getMarketState
  };
};
