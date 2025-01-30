import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useNewsAnalysis } from './useNewsAnalysis';
import { useMarketDataProvider } from './useMarketDataProvider';

interface SocialMetrics {
  sentiment_score: number;
  engagement_level: number;
  influence_score: number;
  reach: number;
  velocity: number;
}

interface SocialSource {
  platform: 'twitter' | 'reddit' | 'telegram';
  channel_name: string;
  follower_count: number;
  engagement_rate: number;
  reliability_score: number;
}

interface SocialPost {
  id: string;
  source: SocialSource;
  content: string;
  timestamp: string;
  metrics: {
    likes: number;
    shares: number;
    comments: number;
    reach: number;
  };
  sentiment: {
    score: number;
    label: 'bullish' | 'neutral' | 'bearish';
    confidence: number;
  };
  topics: string[];
  relevance_score: number;
}

interface SocialAnalysis {
  overall_metrics: SocialMetrics;
  trending_topics: {
    topic: string;
    volume: number;
    sentiment: number;
    momentum: number;
  }[];
  key_influencers: {
    id: string;
    platform: string;
    influence_score: number;
    sentiment_bias: number;
    recent_activity: number;
  }[];
  sentiment_trends: {
    timestamp: string;
    sentiment: number;
    volume: number;
  }[];
}

export const useSocialAnalysis = (botId: string | null) => {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [analysis, setAnalysis] = useState<SocialAnalysis | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { analysis: newsAnalysis } = useNewsAnalysis(botId);
  const { marketContext } = useMarketDataProvider(null, botId);

  useEffect(() => {
    if (!marketContext) return;

    const fetchInterval = setInterval(async () => {
      try {
        setIsLoading(true);

        const calculateMetrics = (posts: SocialPost[]): SocialMetrics => {
          const totalPosts = posts.length || 1;
          return {
            sentiment_score: posts.reduce((acc, post) => 
              acc + post.sentiment.score * post.source.reliability_score, 0) / totalPosts,
            engagement_level: posts.reduce((acc, post) => 
              acc + (post.metrics.likes + post.metrics.shares * 2 + post.metrics.comments * 3), 0) / totalPosts,
            influence_score: posts.reduce((acc, post) => 
              acc + post.source.follower_count * post.source.engagement_rate, 0) / totalPosts,
            reach: posts.reduce((acc, post) => acc + post.metrics.reach, 0),
            velocity: posts.length / (24 * 3600)
          };
        };

        const calculateTrendingTopics = (posts: SocialPost[]) => {
          const topics = new Map<string, {
            count: number,
            sentiment: number,
            timestamps: number[]
          }>();

          posts.forEach(post => {
            post.topics.forEach(topic => {
              const existing = topics.get(topic) || { count: 0, sentiment: 0, timestamps: [] };
              topics.set(topic, {
                count: existing.count + 1,
                sentiment: existing.sentiment + post.sentiment.score,
                timestamps: [...existing.timestamps, new Date(post.timestamp).getTime()]
              });
            });
          });

          return Array.from(topics.entries())
            .map(([topic, data]) => ({
              topic,
              volume: data.count,
              sentiment: data.sentiment / data.count,
              momentum: calculateMomentum(data.timestamps)
            }))
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 10);
        };

        const calculateMomentum = (timestamps: number[]) => {
          const now = Date.now();
          const hourlyBuckets = new Array(24).fill(0);
          timestamps.forEach(ts => {
            const hoursAgo = Math.floor((now - ts) / (3600 * 1000));
            if (hoursAgo < 24) hourlyBuckets[hoursAgo]++;
          });
          return hourlyBuckets.reduce((acc, count, hour) => 
            acc + count * (24 - hour) / 24, 0) / Math.max(1, timestamps.length);
        };

        const mockPosts: SocialPost[] = [
          {
            id: `post-${Date.now()}`,
            source: {
              platform: 'twitter',
              channel_name: 'CryptoAnalyst',
              follower_count: 50000,
              engagement_rate: 0.05,
              reliability_score: 0.8
            },
            content: 'Market analysis content',
            timestamp: new Date().toISOString(),
            metrics: {
              likes: 100,
              shares: 50,
              comments: 30,
              reach: 10000
            },
            sentiment: {
              score: marketContext.sentiment?.score || 0,
              label: marketContext.sentiment?.score > 0 ? 'bullish' : 'bearish',
              confidence: 0.85
            },
            topics: ['SOL', 'DeFi', 'Trading'],
            relevance_score: 0.9
          }
        ];

        setPosts(mockPosts);
        setAnalysis({
          overall_metrics: calculateMetrics(mockPosts),
          trending_topics: calculateTrendingTopics(mockPosts),
          key_influencers: mockPosts
            .map(post => ({
              id: post.source.channel_name,
              platform: post.source.platform,
              influence_score: post.source.follower_count * post.source.engagement_rate,
              sentiment_bias: post.sentiment.score,
              recent_activity: calculateMomentum([new Date(post.timestamp).getTime()])
            }))
            .sort((a, b) => b.influence_score - a.influence_score)
            .slice(0, 5),
          sentiment_trends: [{
            timestamp: new Date().toISOString(),
            sentiment: mockPosts[0].sentiment.score,
            volume: mockPosts.length
          }]
        });

        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to fetch social analysis',
          code: 'SOCIAL_ERROR'
        });
      } finally {
        setIsLoading(false);
      }
    }, 3600000);

    return () => clearInterval(fetchInterval);
  }, [marketContext, newsAnalysis]);

  const filterPostsByPlatform = (platform: SocialSource['platform']) => {
    return posts.filter(post => post.source.platform === platform);
  };

  const filterPostsBySentiment = (sentiment: SocialPost['sentiment']['label']) => {
    return posts.filter(post => post.sentiment.label === sentiment);
  };

  const getHighInfluencePosts = (threshold: number = 0.7) => {
    return posts.filter(post => 
      post.source.follower_count * post.source.engagement_rate > threshold
    );
  };

  return {
    posts,
    analysis,
    error,
    isLoading,
    filterPostsByPlatform,
    filterPostsBySentiment,
    getHighInfluencePosts
  };
};
