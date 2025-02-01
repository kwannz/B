import { useState, useEffect } from 'react';
import { getBotStatus, ApiError } from '../api/client';

interface MarketAnalysis {
  technical: {
    trend: 'bullish' | 'bearish' | 'neutral';
    strength: number;
    support_levels: number[];
    resistance_levels: number[];
    indicators: {
      rsi: number;
      macd: {
        value: number;
        signal: number;
        histogram: number;
      };
      moving_averages: {
        ma_20: number;
        ma_50: number;
        ma_200: number;
      };
    };
  };
  fundamental: {
    market_cap: number;
    volume_24h: number;
    liquidity_score: number;
    volatility_index: number;
  };
  sentiment: {
    overall_score: number;
    social_sentiment: number;
    news_sentiment: number;
    market_sentiment: number;
  };
  timestamp: string;
}

export const useMarketAnalysis = (botId: string | null) => {
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!botId) return;

    const fetchAnalysis = async () => {
      try {
        setIsLoading(true);
        const data = await getBotStatus(botId);
        if (data.market_analysis) {
          setAnalysis(data.market_analysis);
        }
        setError(null);
      } catch (err) {
        setError(err as ApiError);
        setAnalysis(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalysis();
    const interval = setInterval(fetchAnalysis, 60000); // Update every minute

    return () => {
      clearInterval(interval);
    };
  }, [botId]);

  return { analysis, error, isLoading };
};
