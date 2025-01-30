import { useState, useEffect } from 'react';
import { getBotStatus, ApiError, Bot } from '../api/client';

interface Trade {
  timestamp: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  status: 'completed' | 'pending' | 'failed';
}

export const useTradingHistory = (botId: string | null) => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!botId) return;

    const fetchTrades = async () => {
      try {
        setIsLoading(true);
        const data = await getBotStatus(botId);
        if (data.last_trade) {
          setTrades(prev => {
            const exists = prev.some(t => 
              t.timestamp === data.last_trade?.timestamp && 
              t.type === data.last_trade?.type
            );
            if (!exists && data.last_trade) {
              return [...prev, data.last_trade as Trade];
            }
            return prev;
          });
        }
        setError(null);
      } catch (err) {
        setError(err as ApiError);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrades();
    const interval = setInterval(fetchTrades, 10000); // Update every 10 seconds

    return () => {
      clearInterval(interval);
    };
  }, [botId]);

  return { trades, error, isLoading };
};
