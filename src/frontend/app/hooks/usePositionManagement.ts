import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useOrderExecution } from './useOrderExecution';
import { useRiskController } from './useRiskController';
import { useMarketDataStream } from './useMarketDataStream';

interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entry_price: number;
  current_price: number;
  unrealized_pnl: number;
  realized_pnl: number;
  margin_used: number;
  liquidation_price: number;
  timestamp: string;
  status: 'open' | 'closing' | 'closed';
}

interface PositionMetrics {
  total_positions: number;
  total_margin_used: number;
  average_position_size: number;
  largest_position: number;
  total_unrealized_pnl: number;
  total_realized_pnl: number;
}

interface PositionUpdate {
  type: 'open' | 'modify' | 'close';
  position_id: string;
  size_delta?: number;
  price?: number;
  reason?: string;
}

export const usePositionManagement = (botId: string | null) => {
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [metrics, setMetrics] = useState<PositionMetrics>({
    total_positions: 0,
    total_margin_used: 0,
    average_position_size: 0,
    largest_position: 0,
    total_unrealized_pnl: 0,
    total_realized_pnl: 0
  });
  const [error, setError] = useState<ApiError | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const { executeOrder, getOrderStatus } = useOrderExecution(botId);
  const { state: riskState } = useRiskController(botId);
  const { data: marketData } = useMarketDataStream({ 
    symbol: 'SOL/USD', 
    channels: ['price', 'orderbook'] 
  });

  useEffect(() => {
    if (!botId || !marketData) return;

    const updateInterval = setInterval(() => {
      try {
        setIsUpdating(true);

        const updatePositions = () => {
          const updatedPositions = { ...positions };

          Object.values(updatedPositions).forEach(position => {
            if (position.status === 'closed') return;

            const currentPrice = marketData.price.current;
            const priceDiff = position.side === 'long' ? 
              currentPrice - position.entry_price :
              position.entry_price - currentPrice;

            const unrealizedPnl = priceDiff * position.size;
            const marginUsed = position.size * position.entry_price * 0.1;
            const liquidationPrice = position.side === 'long' ?
              position.entry_price * (1 - 1/0.1) :
              position.entry_price * (1 + 1/0.1);

            updatedPositions[position.id] = {
              ...position,
              current_price: currentPrice,
              unrealized_pnl: unrealizedPnl,
              margin_used: marginUsed,
              liquidation_price: liquidationPrice
            };
          });

          setPositions(updatedPositions);
        };

        const updateMetrics = () => {
          const activePositions = Object.values(positions).filter(
            p => p.status === 'open'
          );

          if (activePositions.length === 0) return;

          setMetrics({
            total_positions: activePositions.length,
            total_margin_used: activePositions.reduce(
              (sum, p) => sum + p.margin_used, 0
            ),
            average_position_size: activePositions.reduce(
              (sum, p) => sum + p.size, 0
            ) / activePositions.length,
            largest_position: Math.max(...activePositions.map(p => p.size)),
            total_unrealized_pnl: activePositions.reduce(
              (sum, p) => sum + p.unrealized_pnl, 0
            ),
            total_realized_pnl: activePositions.reduce(
              (sum, p) => sum + p.realized_pnl, 0
            )
          });
        };

        updatePositions();
        updateMetrics();
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to update positions',
          code: 'POSITION_ERROR'
        });
      } finally {
        setIsUpdating(false);
      }
    }, 5000);

    return () => clearInterval(updateInterval);
  }, [botId, positions, marketData]);

  const updatePosition = async (update: PositionUpdate) => {
    try {
      if (!marketData) {
        throw new Error('Market data not available');
      }

      if (riskState?.status === 'warning') {
        throw new Error('Risk limits approaching threshold');
      }

      const position = positions[update.position_id];
      if (!position) {
        throw new Error('Position not found');
      }

      switch (update.type) {
        case 'open':
          const orderId = await executeOrder({
            symbol: position.symbol,
            side: position.side === 'long' ? 'buy' : 'sell',
            type: 'market',
            quantity: update.size_delta || 0
          });

          const orderStatus = await getOrderStatus(orderId);
          if (!orderStatus) break;

          setPositions(prev => ({
            ...prev,
            [position.id]: {
              ...position,
              size: (position.size || 0) + (update.size_delta || 0),
              entry_price: orderStatus.averagePrice,
              timestamp: new Date().toISOString(),
              status: 'open'
            }
          }));
          break;

        case 'modify':
          if (!update.size_delta) break;

          const modifyOrderId = await executeOrder({
            symbol: position.symbol,
            side: update.size_delta > 0 ? 
              (position.side === 'long' ? 'buy' : 'sell') :
              (position.side === 'long' ? 'sell' : 'buy'),
            type: 'market',
            quantity: Math.abs(update.size_delta)
          });

          const modifyStatus = await getOrderStatus(modifyOrderId);
          if (!modifyStatus) break;

          setPositions(prev => ({
            ...prev,
            [position.id]: {
              ...position,
              size: position.size + update.size_delta,
              entry_price: (position.entry_price * position.size + 
                          modifyStatus.averagePrice * Math.abs(update.size_delta)) /
                         (position.size + Math.abs(update.size_delta)),
              timestamp: new Date().toISOString()
            }
          }));
          break;

        case 'close':
          const closeOrderId = await executeOrder({
            symbol: position.symbol,
            side: position.side === 'long' ? 'sell' : 'buy',
            type: 'market',
            quantity: position.size
          });

          const closeStatus = await getOrderStatus(closeOrderId);
          if (!closeStatus) break;

          const realizedPnl = position.side === 'long' ?
            (closeStatus.averagePrice - position.entry_price) * position.size :
            (position.entry_price - closeStatus.averagePrice) * position.size;

          setPositions(prev => ({
            ...prev,
            [position.id]: {
              ...position,
              size: 0,
              realized_pnl: position.realized_pnl + realizedPnl,
              unrealized_pnl: 0,
              timestamp: new Date().toISOString(),
              status: 'closed'
            }
          }));
          break;
      }
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to update position',
        code: 'UPDATE_ERROR'
      });
      throw err;
    }
  };

  const getActivePositions = () => 
    Object.values(positions).filter(p => p.status === 'open');

  const getPositionById = (id: string) => positions[id] || null;

  const getTotalExposure = () => 
    Object.values(positions)
      .filter(p => p.status === 'open')
      .reduce((sum, p) => sum + p.size * p.current_price, 0);

  return {
    positions,
    metrics,
    error,
    isUpdating,
    updatePosition,
    getActivePositions,
    getPositionById,
    getTotalExposure
  };
};
