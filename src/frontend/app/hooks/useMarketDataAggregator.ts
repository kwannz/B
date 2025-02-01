import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMarketData } from './useMarketData';
import { useMarketAnalysis } from './useMarketAnalysis';
import { useMarketSentiment } from './useMarketSentiment';
import { useTradingSignals } from './useTradingSignals';

interface AggregatedMarketData {
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
  technical: {
    trend: 'bullish' | 'bearish' | 'neutral';
    strength: number;
    support: number;
    resistance: number;
  };
  sentiment: {
    overall: number;
    social: number;
    news: number;
    market: number;
  };
  signals: {
    recommendation: 'buy' | 'sell' | 'hold';
    confidence: number;
    timestamp: string;
  };
}

export const useMarketDataAggregator = (symbol: string | null, botId: string | null) => {
  const [aggregatedData, setAggregatedData] = useState<AggregatedMarketData | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { marketData, error: marketError } = useMarketData(symbol);
  const { analysis, error: analysisError } = useMarketAnalysis(botId);
  const { sentiment, error: sentimentError } = useMarketSentiment(botId);
  const { signals, error: signalsError } = useTradingSignals(botId);

  useEffect(() => {
    if (!marketData || !analysis || !sentiment || !signals?.length) return;

    const latestSignal = signals[0];
    
    setAggregatedData({
      price: {
        current: marketData.price,
        change_24h: marketData.price_change_24h,
        high_24h: marketData.high_24h,
        low_24h: marketData.low_24h
      },
      volume: {
        current_24h: marketData.volume_24h,
        change_24h: analysis.fundamental.volume_24h
      },
      technical: {
        trend: analysis.technical.trend,
        strength: analysis.technical.strength,
        support: analysis.technical.support_levels[0] || 0,
        resistance: analysis.technical.resistance_levels[0] || 0
      },
      sentiment: {
        overall: sentiment.overall_score,
        social: sentiment.components.social,
        news: sentiment.components.news,
        market: sentiment.components.onchain
      },
      signals: {
        recommendation: latestSignal.type,
        confidence: latestSignal.strength,
        timestamp: latestSignal.timestamp
      }
    });

    setError(null);
  }, [marketData, analysis, sentiment, signals]);

  useEffect(() => {
    const errors = [marketError, analysisError, sentimentError, signalsError].filter(Boolean);
    if (errors.length > 0) {
      setError(errors[0]);
    }
  }, [marketError, analysisError, sentimentError, signalsError]);

  return { aggregatedData, error, isLoading };
};
