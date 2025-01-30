import { useState, useEffect } from 'react';
import { getBotStatus, ApiError, Bot } from '../api/client';

export const useBotMetrics = (botId: string | null) => {
  const [metrics, setMetrics] = useState<Bot['metrics'] | null>(null);
  const [lastTrade, setLastTrade] = useState<Bot['last_trade'] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!botId) return;

    const fetchMetrics = async () => {
      try {
        setIsLoading(true);
        const data = await getBotStatus(botId);
        setMetrics(data.metrics || null);
        setLastTrade(data.last_trade || null);
        setError(null);
      } catch (err) {
        setError(err as ApiError);
        setMetrics(null);
        setLastTrade(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 15000); // Update every 15 seconds

    return () => {
      clearInterval(interval);
    };
  }, [botId]);

  return { metrics, lastTrade, error, isLoading };
};
