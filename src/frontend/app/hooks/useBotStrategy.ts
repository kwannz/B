import { useState, useEffect } from 'react';
import { getBotStatus, ApiError, Bot } from '../api/client';

interface Strategy {
  id: string;
  name: string;
  description: string;
  parameters: {
    risk_level: 'low' | 'medium' | 'high';
    trade_size: number;
    stop_loss: number;
    take_profit: number;
    max_trades_per_day: number;
  };
  performance?: {
    win_rate: number;
    avg_return: number;
    sharpe_ratio: number;
    max_drawdown: number;
  };
}

export const useBotStrategy = (botId: string | null) => {
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!botId) return;

    const fetchStrategy = async () => {
      try {
        setIsLoading(true);
        const data = await getBotStatus(botId);
        if (data.strategy) {
          setStrategy(data.strategy);
        }
        setError(null);
      } catch (err) {
        setError(err as ApiError);
        setStrategy(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStrategy();
    const interval = setInterval(fetchStrategy, 60000); // Update every minute

    return () => {
      clearInterval(interval);
    };
  }, [botId]);

  const updateStrategy = async (parameters: Partial<Strategy['parameters']>) => {
    try {
      setIsLoading(true);
      const data = await getBotStatus(botId as string);
      if (data.strategy) {
        setStrategy({
          ...data.strategy,
          parameters: {
            ...data.strategy.parameters,
            ...parameters
          }
        });
      }
      setError(null);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setIsLoading(false);
    }
  };

  return { strategy, error, isLoading, updateStrategy };
};
