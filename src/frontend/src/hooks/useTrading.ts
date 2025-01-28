import { useCallback } from 'react';
import useTradingStore from '../store/useTradingStore';
import { toast } from '../components/ui/use-toast';

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

  const handleClosePosition = useCallback(async (positionId: string) => {
    try {
      await closePosition(positionId);
      toast({
        title: 'Position Closed',
        description: 'Position has been successfully closed',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to close position',
      });
    }
  }, [closePosition]);

  const refreshData = useCallback(async () => {
    try {
      await Promise.all([
        fetchPositions(),
        fetchOrderBook(),
      ]);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to refresh trading data',
      });
    }
  }, [fetchPositions, fetchOrderBook]);

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
