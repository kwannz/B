import { useState, useEffect } from 'react';
import { getBotStatus, ApiError, Bot } from '../api/client';

interface BotPerformance {
  total_trades: number;
  successful_trades: number;
  profit_loss: number;
  win_rate: number;
  avg_trade_size: number;
  largest_gain: number;
  largest_loss: number;
  active_positions: number;
  total_volume: number;
}

export const useBotPerformance = (botId: string | null) => {
  const [performance, setPerformance] = useState<BotPerformance | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!botId) return;

    const fetchPerformance = async () => {
      try {
        setIsLoading(true);
        const data = await getBotStatus(botId);
        if (data.metrics) {
          setPerformance({
            total_trades: data.metrics.total_trades || 0,
            successful_trades: data.metrics.successful_trades || 0,
            profit_loss: data.metrics.profit_loss || 0,
            win_rate: data.metrics.win_rate || 0,
            avg_trade_size: data.metrics.avg_trade_size || 0,
            largest_gain: data.metrics.largest_gain || 0,
            largest_loss: data.metrics.largest_loss || 0,
            active_positions: data.metrics.active_positions || 0,
            total_volume: data.metrics.total_volume || 0
          });
        }
        setError(null);
      } catch (err) {
        setError(err as ApiError);
        setPerformance(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPerformance();
    const interval = setInterval(fetchPerformance, 20000); // Update every 20 seconds

    return () => {
      clearInterval(interval);
    };
  }, [botId]);

  return { performance, error, isLoading };
};
