import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMarketDataProvider } from './useMarketDataProvider';
import { useNewsAnalysis } from './useNewsAnalysis';
import { useSocialAnalysis } from './useSocialAnalysis';

interface MarketData {
  price: {
    current: number;
    high_24h: number;
    low_24h: number;
    change_24h: number;
    volume_24h: number;
  };
  indicators: {
    rsi: number;
    macd: {
      value: number;
      signal: number;
      histogram: number;
    };
    bollinger_bands: {
      upper: number;
      middle: number;
      lower: number;
    };
  };
  orderbook: {
    bids: { price: number; size: number }[];
    asks: { price: number; size: number }[];
    spread: number;
    depth: number;
  };
}

interface MarketSignal {
  type: 'price' | 'volume' | 'sentiment' | 'technical' | 'fundamental';
  direction: 'buy' | 'sell' | 'neutral';
  strength: number;
  confidence: number;
  timestamp: string;
  source: string;
  metrics: Record<string, number>;
}

interface AggregatedData {
  market_data: MarketData;
  signals: MarketSignal[];
  sentiment: {
    overall: number;
    news: number;
    social: number;
    technical: number;
  };
  volatility: {
    current: number;
    historical: number;
    forecast: number;
  };
  liquidity: {
    current: number;
    trend: 'increasing' | 'stable' | 'decreasing';
    depth_score: number;
  };
}

export const useMarketAggregator = (botId: string | null) => {
  const [data, setData] = useState<AggregatedData | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { marketContext } = useMarketDataProvider(null, botId);
  const { analysis: newsAnalysis } = useNewsAnalysis(botId);
  const { analysis: socialAnalysis } = useSocialAnalysis(botId);

  useEffect(() => {
    if (!marketContext || !newsAnalysis || !socialAnalysis) return;

    const aggregationInterval = setInterval(() => {
      try {
        setIsLoading(true);

        const calculateVolatility = () => {
          const prices = marketContext.price.history || [];
          if (prices.length < 2) return { current: 0, historical: 0, forecast: 0 };

          const returns = prices.slice(1).map((price, i) => 
            Math.log(price / prices[i])
          );

          const variance = returns.reduce((sum, ret) => sum + ret * ret, 0) / returns.length;
          const volatility = Math.sqrt(variance * 252);

          return {
            current: volatility,
            historical: marketContext.volatility || volatility,
            forecast: volatility * (1 + marketContext.sentiment.score)
          };
        };

        const calculateLiquidity = () => {
          const currentLiquidity = marketContext.volume.current_24h / marketContext.price.current;
          const prevLiquidity = marketContext.volume.previous_24h / marketContext.price.previous;

          return {
            current: currentLiquidity,
            trend: currentLiquidity > prevLiquidity * 1.1 ? 'increasing' :
                   currentLiquidity < prevLiquidity * 0.9 ? 'decreasing' : 'stable',
            depth_score: Math.min(1, currentLiquidity / (marketContext.volume.max_24h || 1))
          };
        };

        const generateSignals = (): MarketSignal[] => {
          const signals: MarketSignal[] = [];
          const timestamp = new Date().toISOString();

          if (Math.abs(marketContext.price.change_24h) > 0.05) {
            signals.push({
              type: 'price',
              direction: marketContext.price.change_24h > 0 ? 'buy' : 'sell',
              strength: Math.abs(marketContext.price.change_24h),
              confidence: 0.8,
              timestamp,
              source: 'price_action',
              metrics: {
                price_change: marketContext.price.change_24h,
                volume_change: marketContext.volume.change_24h
              }
            });
          }

          if (Math.abs(newsAnalysis.overall_sentiment) > 0.3) {
            signals.push({
              type: 'sentiment',
              direction: newsAnalysis.overall_sentiment > 0 ? 'buy' : 'sell',
              strength: Math.abs(newsAnalysis.overall_sentiment),
              confidence: newsAnalysis.confidence_score,
              timestamp,
              source: 'news_analysis',
              metrics: {
                sentiment_score: newsAnalysis.overall_sentiment,
                market_impact: newsAnalysis.market_impact.short_term
              }
            });
          }

          return signals;
        };

        const newData: AggregatedData = {
          market_data: {
            price: {
              current: marketContext.price.current,
              high_24h: marketContext.price.high_24h,
              low_24h: marketContext.price.low_24h,
              change_24h: marketContext.price.change_24h,
              volume_24h: marketContext.volume.current_24h
            },
            indicators: {
              rsi: marketContext.technical.rsi || 50,
              macd: {
                value: marketContext.technical.macd?.value || 0,
                signal: marketContext.technical.macd?.signal || 0,
                histogram: marketContext.technical.macd?.histogram || 0
              },
              bollinger_bands: {
                upper: marketContext.technical.bollinger?.upper || 0,
                middle: marketContext.technical.bollinger?.middle || 0,
                lower: marketContext.technical.bollinger?.lower || 0
              }
            },
            orderbook: {
              bids: marketContext.orderbook?.bids || [],
              asks: marketContext.orderbook?.asks || [],
              spread: marketContext.orderbook?.spread || 0,
              depth: marketContext.orderbook?.depth || 0
            }
          },
          signals: generateSignals(),
          sentiment: {
            overall: (newsAnalysis.overall_sentiment + socialAnalysis.overall_metrics.sentiment_score) / 2,
            news: newsAnalysis.overall_sentiment,
            social: socialAnalysis.overall_metrics.sentiment_score,
            technical: marketContext.technical.sentiment || 0
          },
          volatility: calculateVolatility(),
          liquidity: calculateLiquidity()
        };

        setData(newData);
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to aggregate market data',
          code: 'AGGREGATION_ERROR'
        });
      } finally {
        setIsLoading(false);
      }
    }, 5000);

    return () => clearInterval(aggregationInterval);
  }, [marketContext, newsAnalysis, socialAnalysis]);

  const getSignalsByType = (type: MarketSignal['type']) => {
    return data?.signals.filter(signal => signal.type === type) || [];
  };

  const getSignalsByConfidence = (minConfidence: number) => {
    return data?.signals.filter(signal => signal.confidence >= minConfidence) || [];
  };

  const getStrongSignals = (minStrength: number = 0.7) => {
    return data?.signals.filter(signal => signal.strength >= minStrength) || [];
  };

  return {
    data,
    error,
    isLoading,
    getSignalsByType,
    getSignalsByConfidence,
    getStrongSignals
  };
};
