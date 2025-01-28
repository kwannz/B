import { useCallback, useEffect, useRef } from 'react';
import { useTradingStore } from '../store/useTradingStore';
import { useErrorHandler } from './useErrorHandler';
import { useToast } from '../components/ui/use-toast';

export const useTrading = () => {
  const {
    positions,
    orderBook,
    totalPnl,
    trades,
    isLoading,
    error,
    fetchPositions,
    fetchOrderBook,
    closePosition,
  } = useTradingStore();
  
  const { handleError } = useErrorHandler();
  const refreshIntervalRef = useRef<NodeJS.Timeout>();

  const handleClosePosition = useCallback(async (positionId: string) => {
    try {
      await closePosition(positionId);
      const { toast } = useToast(); toast({
        title: 'Success',
        description: 'Position has been successfully closed',
      });
    } catch (error) {
      handleError(error, {
        title: 'Close Position Error',
        fallbackMessage: 'Failed to close position',
        shouldRetry: true,
        onRetry: async () => closePosition(positionId),
      });
    }
  }, [closePosition, handleError]);

  const refreshData = useCallback(async () => {
    try {
      await Promise.all([
        fetchPositions(),
        fetchOrderBook(),
      ]);
    } catch (error) {
      handleError(error, {
        title: 'Data Refresh Error',
        fallbackMessage: 'Failed to refresh trading data',
        shouldRetry: true,
        onRetry: refreshData,
      });
    }
  }, [fetchPositions, fetchOrderBook, handleError]);

  // Set up auto-refresh interval
  useEffect(() => {
    refreshData(); // Initial fetch
    refreshIntervalRef.current = setInterval(refreshData, 5000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [refreshData]);

  return {
    positions,
    orderBook,
    totalPnl,
    trades,
    isLoading,
    error,
    closePosition: handleClosePosition,
    refreshData,
  };
};
