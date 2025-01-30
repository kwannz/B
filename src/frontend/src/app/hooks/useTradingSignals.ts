import { useState, useEffect } from 'react';
import { getBotStatus, ApiError } from '../api/client';

interface TradingSignal {
  type: 'buy' | 'sell' | 'hold';
  strength: number;
  timestamp: string;
  indicators: {
    rsi?: number;
    macd?: {
      value: number;
      signal: number;
      histogram: number;
    };
    volume?: number;
    price_action?: {
      trend: 'bullish' | 'bearish' | 'neutral';
      support: number;
      resistance: number;
    };
  };
  sentiment?: {
    overall: number;
    social: number;
    news: number;
    technical: number;
  };
}

export const useTradingSignals = (botId: string | null) => {
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!botId) return;

    const fetchSignals = async () => {
      try {
        setIsLoading(true);
        const data = await getBotStatus(botId);
        if (data.signals) {
          setSignals(prev => {
            const newSignals = data.signals.filter((signal: TradingSignal) => 
              !prev.some(s => s.timestamp === signal.timestamp)
            );
            return [...prev, ...newSignals].sort((a, b) => 
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
          });
        }
        setError(null);
      } catch (err) {
        setError(err as ApiError);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSignals();
    const interval = setInterval(fetchSignals, 30000); // Update every 30 seconds

    return () => {
      clearInterval(interval);
    };
  }, [botId]);

  const getLatestSignal = () => signals[0] || null;

  const getSignalsByType = (type: TradingSignal['type']) => 
    signals.filter(signal => signal.type === type);

  return {
    signals,
    latestSignal: getLatestSignal(),
    getSignalsByType,
    error,
    isLoading
  };
};
