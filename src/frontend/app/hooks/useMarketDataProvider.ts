import { useState, useEffect, useCallback } from 'react';
import { ApiError } from '../api/client';
import { useMarketData } from './useMarketData';
import { useMarketAnalysis } from './useMarketAnalysis';
import { useMarketSentiment } from './useMarketSentiment';
import { useTradingSignals } from './useTradingSignals';
import { useMarketSubscription } from './useMarketSubscription';

interface MarketDataContext {
  price: {
    current: number;
    change_24h: number;
    high_24h: number;
    low_24h: number;
  };
  volume: {
    current_24h: number;
    change_24h: number;
  };
  orderbook: {
    bids: [number, number][];
    asks: [number, number][];
  };
  analysis: {
    trend: 'bullish' | 'bearish' | 'neutral';
    strength: number;
    support: number;
    resistance: number;
    indicators: {
      rsi: number;
      macd: {
        value: number;
        signal: number;
        histogram: number;
      };
    };
  };
  sentiment: {
    overall: number;
    social: number;
    news: number;
    market: number;
  };
  signals: {
    type: 'buy' | 'sell' | 'hold';
    strength: number;
    timestamp: string;
  };
}

export const useMarketDataProvider = (symbol: string | null, botId: string | null) => {
  const [marketContext, setMarketContext] = useState<MarketDataContext | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { marketData, error: marketError } = useMarketData(symbol);
  const { analysis, error: analysisError } = useMarketAnalysis(botId);
  const { sentiment, error: sentimentError } = useMarketSentiment(botId);
  const { signals, error: signalsError } = useTradingSignals(botId);
  const { marketData: realtimeData, error: subscriptionError } = useMarketSubscription(symbol);

  const updateMarketContext = useCallback(() => {
    if (!marketData && !realtimeData) return;

    const currentData = realtimeData || marketData;
    if (!currentData || !analysis || !sentiment || !signals?.length) return;

    const latestSignal = signals[0];

    setMarketContext({
      price: {
        current: currentData.price,
        change_24h: currentData.price_change_24h,
        high_24h: currentData.high_24h,
        low_24h: currentData.low_24h
      },
      volume: {
        current_24h: currentData.volume_24h,
        change_24h: analysis.fundamental.volume_24h
      },
      orderbook: currentData.orderbook || { bids: [], asks: [] },
      analysis: {
        trend: analysis.technical.trend,
        strength: analysis.technical.strength,
        support: analysis.technical.support_levels[0] || 0,
        resistance: analysis.technical.resistance_levels[0] || 0,
        indicators: {
          rsi: analysis.technical.indicators.rsi,
          macd: analysis.technical.indicators.macd
        }
      },
      sentiment: {
        overall: sentiment.overall_score,
        social: sentiment.components.social,
        news: sentiment.components.news,
        market: sentiment.components.onchain
      },
      signals: {
        type: latestSignal.type,
        strength: latestSignal.strength,
        timestamp: latestSignal.timestamp
      }
    });
  }, [marketData, realtimeData, analysis, sentiment, signals]);

  useEffect(() => {
    updateMarketContext();
  }, [updateMarketContext]);

  useEffect(() => {
    const errors = [marketError, analysisError, sentimentError, signalsError, subscriptionError].filter(Boolean);
    if (errors.length > 0) {
      setError(errors[0]);
    } else {
      setError(null);
    }
  }, [marketError, analysisError, sentimentError, signalsError, subscriptionError]);

  return { marketContext, error, isLoading };
};
