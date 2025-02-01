import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useTradeExecution } from './useTradeExecution';
import { useBotMetrics } from './useBotMetrics';

interface TradeHistoryEntry {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  amount: number;
  price: number;
  total: number;
  fee: number;
  status: 'filled' | 'partially_filled' | 'cancelled' | 'failed';
  timestamp: string;
  profit_loss?: number;
  execution_time?: number;
}

interface TradeHistoryStats {
  total_trades: number;
  successful_trades: number;
  failed_trades: number;
  total_volume: number;
  total_fees: number;
  average_execution_time: number;
  profit_loss: {
    total: number;
    average: number;
    best: number;
    worst: number;
  };
}

export const useTradeHistory = (botId: string | null) => {
  const [trades, setTrades] = useState<TradeHistoryEntry[]>([]);
  const [stats, setStats] = useState<TradeHistoryStats | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { lastTrade } = useTradeExecution(botId);
  const { metrics } = useBotMetrics(botId);

  useEffect(() => {
    if (!botId) return;

    const fetchTradeHistory = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/trades/${botId}`);
        if (!response.ok) throw new Error('Failed to fetch trade history');
        
        const data = await response.json();
        setTrades(data.trades);
        
        const successfulTrades = data.trades.filter((t: TradeHistoryEntry) => t.status === 'filled');
        const failedTrades = data.trades.filter((t: TradeHistoryEntry) => t.status === 'failed');
        
        const totalVolume = data.trades.reduce((sum: number, t: TradeHistoryEntry) => sum + t.total, 0);
        const totalFees = data.trades.reduce((sum: number, t: TradeHistoryEntry) => sum + t.fee, 0);
        const executionTimes = data.trades
          .filter((t: TradeHistoryEntry) => t.execution_time)
          .map((t: TradeHistoryEntry) => t.execution_time as number);
        
        const profitLosses = successfulTrades
          .filter(t => t.profit_loss !== undefined)
          .map(t => t.profit_loss as number);

        setStats({
          total_trades: data.trades.length,
          successful_trades: successfulTrades.length,
          failed_trades: failedTrades.length,
          total_volume: totalVolume,
          total_fees: totalFees,
          average_execution_time: executionTimes.length ? 
            executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length : 0,
          profit_loss: {
            total: profitLosses.reduce((a, b) => a + b, 0),
            average: profitLosses.length ? 
              profitLosses.reduce((a, b) => a + b, 0) / profitLosses.length : 0,
            best: profitLosses.length ? Math.max(...profitLosses) : 0,
            worst: profitLosses.length ? Math.min(...profitLosses) : 0
          }
        });
        
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to fetch trade history',
          code: 'FETCH_ERROR'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchTradeHistory();
    const interval = setInterval(fetchTradeHistory, 30000);

    return () => clearInterval(interval);
  }, [botId]);

  useEffect(() => {
    if (lastTrade) {
      setTrades(prev => {
        const exists = prev.some(t => t.id === lastTrade.orderId);
        if (!exists) {
          return [{
            id: lastTrade.orderId,
            symbol: lastTrade.symbol,
            side: lastTrade.side,
            type: 'market',
            amount: lastTrade.amount,
            price: lastTrade.price,
            total: lastTrade.amount * lastTrade.price,
            fee: lastTrade.amount * lastTrade.price * 0.001,
            status: lastTrade.status === 'filled' ? 'filled' : 'partially_filled',
            timestamp: lastTrade.timestamp
          }, ...prev];
        }
        return prev;
      });
    }
  }, [lastTrade]);

  return {
    trades,
    stats,
    error,
    isLoading,
    getTradeById: (id: string) => trades.find(t => t.id === id)
  };
};
