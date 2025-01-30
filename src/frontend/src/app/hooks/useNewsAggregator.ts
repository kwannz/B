import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMarketSentiment } from './useMarketSentiment';
import { useNewsAnalysis } from './useNewsAnalysis';
import { useSocialAnalysis } from './useSocialAnalysis';

interface NewsSource {
  id: string;
  name: string;
  type: 'news' | 'social';
  url: string;
  language: string;
  reliability_score: number;
}

interface NewsItem {
  id: string;
  source: string;
  title: string;
  content: string;
  url: string;
  published_at: string;
  sentiment: {
    score: number;
    label: 'positive' | 'negative' | 'neutral';
    confidence: number;
  };
  impact: {
    price_correlation: number;
    volume_correlation: number;
    market_impact_score: number;
  };
  metadata: {
    author?: string;
    category?: string;
    tags?: string[];
  };
}

interface SocialMetrics {
  engagement: {
    likes: number;
    shares: number;
    comments: number;
    total_reach: number;
  };
  sentiment: {
    positive: number;
    negative: number;
    neutral: number;
    weighted_score: number;
  };
  influence: {
    author_score: number;
    virality_score: number;
    credibility_score: number;
  };
}

interface NewsAggregatorState {
  news_items: NewsItem[];
  social_metrics: SocialMetrics;
  sources: NewsSource[];
  last_updated: string;
}

export const useNewsAggregator = (botId: string | null) => {
  const [state, setState] = useState<NewsAggregatorState>({
    news_items: [],
    social_metrics: {
      engagement: { likes: 0, shares: 0, comments: 0, total_reach: 0 },
      sentiment: { positive: 0, negative: 0, neutral: 0, weighted_score: 0 },
      influence: { author_score: 0, virality_score: 0, credibility_score: 0 }
    },
    sources: [],
    last_updated: new Date().toISOString()
  });
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { sentiment } = useMarketSentiment(botId);
  const { analysis: newsAnalysis } = useNewsAnalysis(botId);
  const { analysis: socialAnalysis } = useSocialAnalysis(botId);

  useEffect(() => {
    if (!botId) return;

    const aggregationInterval = setInterval(async () => {
      try {
        setIsLoading(true);

        const aggregateNewsItems = () => {
          if (!newsAnalysis?.items) return [];
          
          return newsAnalysis.items.map(item => ({
            id: item.id,
            source: item.source,
            title: item.title,
            content: item.content,
            url: item.url,
            published_at: item.timestamp,
            sentiment: {
              score: item.sentiment_score,
              label: item.sentiment_score > 0.2 ? 'positive' : 
                     item.sentiment_score < -0.2 ? 'negative' : 'neutral',
              confidence: item.confidence
            },
            impact: {
              price_correlation: item.market_impact.price || 0,
              volume_correlation: item.market_impact.volume || 0,
              market_impact_score: item.market_impact.score || 0
            },
            metadata: {
              author: item.metadata?.author,
              category: item.metadata?.category,
              tags: item.metadata?.tags
            }
          }));
        };

        const aggregateSocialMetrics = () => {
          if (!socialAnalysis) return state.social_metrics;

          const totalEngagement = socialAnalysis.platforms.reduce((sum, platform) => 
            sum + platform.engagement_metrics.total, 0
          );

          return {
            engagement: {
              likes: socialAnalysis.total_likes || 0,
              shares: socialAnalysis.total_shares || 0,
              comments: socialAnalysis.total_comments || 0,
              total_reach: totalEngagement
            },
            sentiment: {
              positive: socialAnalysis.sentiment_distribution.positive || 0,
              negative: socialAnalysis.sentiment_distribution.negative || 0,
              neutral: socialAnalysis.sentiment_distribution.neutral || 0,
              weighted_score: socialAnalysis.weighted_sentiment || 0
            },
            influence: {
              author_score: socialAnalysis.influence_metrics.author_reputation || 0,
              virality_score: socialAnalysis.influence_metrics.virality || 0,
              credibility_score: socialAnalysis.influence_metrics.credibility || 0
            }
          };
        };

        const aggregateSources = () => {
          const sources: NewsSource[] = [];
          
          if (newsAnalysis?.sources) {
            sources.push(...newsAnalysis.sources.map(source => ({
              id: source.id,
              name: source.name,
              type: 'news',
              url: source.url,
              language: source.language,
              reliability_score: source.reliability || 0
            })));
          }

          if (socialAnalysis?.platforms) {
            sources.push(...socialAnalysis.platforms.map(platform => ({
              id: platform.id,
              name: platform.name,
              type: 'social',
              url: platform.url,
              language: platform.language || 'en',
              reliability_score: platform.reliability || 0
            })));
          }

          return sources;
        };

        setState({
          news_items: aggregateNewsItems(),
          social_metrics: aggregateSocialMetrics(),
          sources: aggregateSources(),
          last_updated: new Date().toISOString()
        });

        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to aggregate news data',
          code: 'AGGREGATION_ERROR'
        });
      } finally {
        setIsLoading(false);
      }
    }, 60000);

    return () => clearInterval(aggregationInterval);
  }, [botId, newsAnalysis, socialAnalysis]);

  const getRecentNews = (limit: number = 10) => {
    return state.news_items
      .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
      .slice(0, limit);
  };

  const getHighImpactNews = (threshold: number = 0.7) => {
    return state.news_items.filter(item => 
      item.impact.market_impact_score >= threshold
    );
  };

  const getSentimentDistribution = () => {
    const total = state.news_items.length;
    return {
      positive: state.news_items.filter(item => item.sentiment.label === 'positive').length / total,
      negative: state.news_items.filter(item => item.sentiment.label === 'negative').length / total,
      neutral: state.news_items.filter(item => item.sentiment.label === 'neutral').length / total
    };
  };

  const getSourceReliability = () => {
    return state.sources.reduce((acc, source) => {
      acc[source.name] = source.reliability_score;
      return acc;
    }, {} as Record<string, number>);
  };

  return {
    state,
    error,
    isLoading,
    getRecentNews,
    getHighImpactNews,
    getSentimentDistribution,
    getSourceReliability
  };
};
