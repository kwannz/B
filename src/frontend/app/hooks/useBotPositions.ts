import { useState, useEffect } from 'react';
import { getBotStatus, ApiError, Bot } from '../api/client';

interface Position {
  asset: string;
  amount: number;
  entry_price: number;
  current_price: number;
  profit_loss: number;
  timestamp: string;
}

export const useBotPositions = (botId: string | null) => {
  const [positions, setPositions] = useState<Position[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!botId) return;

    const fetchPositions = async () => {
      try {
        setIsLoading(true);
        const data = await getBotStatus(botId);
        if (data.metrics?.positions) {
          setPositions(data.metrics.positions);
        }
        setError(null);
      } catch (err) {
        setError(err as ApiError);
        setPositions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPositions();
    const interval = setInterval(fetchPositions, 15000); // Update every 15 seconds

    return () => {
      clearInterval(interval);
    };
  }, [botId]);

  return { positions, error, isLoading };
};
