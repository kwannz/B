import { useState, useEffect } from 'react';
import { getBotStatus, ApiError } from '../api/client';

interface MarketSentiment {
  overall_score: number;
  components: {
    technical: number;
    social: number;
    news: number;
    onchain: number;
  };
  signals: {
    short_term: 'bullish' | 'bearish' | 'neutral';
    medium_term: 'bullish' | 'bearish' | 'neutral';
    long_term: 'bullish' | 'bearish' | 'neutral';
  };
  indicators: {
    rsi: number;
    volume_change: number;
    price_momentum: number;
    social_sentiment: number;
    news_sentiment: number;
  };
  timestamp: string;
}

export const useMarketSentiment = (botId: string | null) => {
  const [sentiment, setSentiment] = useState<MarketSentiment | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!botId) return;

    const fetchSentiment = async () => {
      try {
        setIsLoading(true);
        const data = await getBotStatus(botId);
        if (data.market_sentiment) {
          setSentiment(data.market_sentiment);
        }
        setError(null);
      } catch (err) {
        setError(err as ApiError);
        setSentiment(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSentiment();
    const interval = setInterval(fetchSentiment, 60000); // Update every minute

    return () => {
      clearInterval(interval);
    };
  }, [botId]);

  return { sentiment, error, isLoading };
};
