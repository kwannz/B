import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMarketDataProvider } from './useMarketDataProvider';
import { useRiskAnalyzer } from './useRiskAnalyzer';

interface NewsSource {
  name: string;
  language: 'en' | 'cn';
  category: 'international' | 'chinese' | 'aggregator' | 'social';
  reliability_score: number;
}

interface NewsItem {
  id: string;
  source: NewsSource;
  title: string;
  content: string;
  url: string;
  published_at: string;
  sentiment: {
    score: number;
    label: 'positive' | 'neutral' | 'negative';
    confidence: number;
  };
  impact_analysis: {
    price_impact: number;
    volatility_impact: number;
    trading_volume_impact: number;
    confidence: number;
  };
  relevance_score: number;
}

interface SentimentAnalysis {
  overall_sentiment: number;
  sentiment_breakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  source_weights: Record<string, number>;
  confidence_score: number;
  market_impact: {
    short_term: number;
    medium_term: number;
    long_term: number;
  };
}

export const useNewsAnalysis = (botId: string | null) => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [analysis, setAnalysis] = useState<SentimentAnalysis | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { marketContext } = useMarketDataProvider(null, botId);
  const { score: riskScore } = useRiskAnalyzer(botId);

  useEffect(() => {
    if (!marketContext) return;

    const fetchInterval = setInterval(async () => {
      try {
        setIsLoading(true);

        const sourceWeights: Record<string, number> = {
          'Coindesk': 0.9,
          'Cointelegraph': 0.85,
          'Decrypt': 0.8,
          'Bloomberg': 0.95,
          'Reuters': 0.95,
          'CryptoSlate': 0.75,
          'Ambcrypto': 0.7,
          'Binance Square CN': 0.85,
          'Odaily': 0.8,
          'Jinse': 0.8,
          'TheBlockBeats': 0.75,
          'ChainCatcher': 0.75,
          'Foresightnews': 0.7,
          'Coinglass': 0.9,
          'BWEnews': 0.8
        };

        const calculateImpact = (sentiment: number, reliability: number) => {
          const volatility = marketContext.volatility || 0.1;
          const baseImpact = sentiment * reliability * volatility;
          return {
            short_term: baseImpact * 1.5,
            medium_term: baseImpact * 1.0,
            long_term: baseImpact * 0.7
          };
        };

        const processNewsItems = (items: NewsItem[]) => {
          let totalSentiment = 0;
          let totalWeight = 0;
          const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };

          items.forEach(item => {
            const weight = sourceWeights[item.source.name] || 0.5;
            totalSentiment += item.sentiment.score * weight;
            totalWeight += weight;

            if (item.sentiment.score > 0.2) sentimentCounts.positive++;
            else if (item.sentiment.score < -0.2) sentimentCounts.negative++;
            else sentimentCounts.neutral++;
          });

          const overallSentiment = totalWeight > 0 ? totalSentiment / totalWeight : 0;
          const totalItems = items.length || 1;

          return {
            overall_sentiment: overallSentiment,
            sentiment_breakdown: {
              positive: sentimentCounts.positive / totalItems,
              neutral: sentimentCounts.neutral / totalItems,
              negative: sentimentCounts.negative / totalItems
            },
            source_weights: sourceWeights,
            confidence_score: Math.min(1, items.length / 50),
            market_impact: calculateImpact(
              overallSentiment,
              items.reduce((acc, item) => acc + (sourceWeights[item.source.name] || 0.5), 0) / items.length
            )
          };
        };

        const mockNewsItems: NewsItem[] = [
          {
            id: `news-${Date.now()}`,
            source: {
              name: 'Coindesk',
              language: 'en',
              category: 'international',
              reliability_score: 0.9
            },
            title: 'Market Analysis',
            content: 'Market analysis content',
            url: 'https://example.com',
            published_at: new Date().toISOString(),
            sentiment: {
              score: marketContext.sentiment?.score || 0,
              label: marketContext.sentiment?.score > 0 ? 'positive' : 'negative',
              confidence: 0.85
            },
            impact_analysis: {
              price_impact: marketContext.price.change_24h || 0,
              volatility_impact: marketContext.volatility || 0,
              trading_volume_impact: marketContext.volume.change_24h || 0,
              confidence: 0.8
            },
            relevance_score: 0.9
          }
        ];

        setNews(mockNewsItems);
        setAnalysis(processNewsItems(mockNewsItems));
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to fetch news analysis',
          code: 'NEWS_ERROR'
        });
      } finally {
        setIsLoading(false);
      }
    }, 3600000);

    return () => clearInterval(fetchInterval);
  }, [marketContext, riskScore]);

  const filterNewsBySource = (category: NewsSource['category']) => {
    return news.filter(item => item.source.category === category);
  };

  const filterNewsBySentiment = (sentiment: 'positive' | 'neutral' | 'negative') => {
    return news.filter(item => item.sentiment.label === sentiment);
  };

  const getHighImpactNews = (threshold: number = 0.7) => {
    return news.filter(item => 
      Math.abs(item.impact_analysis.price_impact) > threshold ||
      item.impact_analysis.volatility_impact > threshold
    );
  };

  return {
    news,
    analysis,
    error,
    isLoading,
    filterNewsBySource,
    filterNewsBySentiment,
    getHighImpactNews
  };
};
