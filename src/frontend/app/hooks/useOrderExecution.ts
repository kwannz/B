import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useOrderManagement } from './useOrderManagement';
import { useMarketDataStream } from './useMarketDataStream';
import { useRiskController } from './useRiskController';

interface OrderParams {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  quantity: number;
  price?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  stopPrice?: number;
  clientOrderId?: string;
}

interface OrderStatus {
  id: string;
  status: 'new' | 'partially_filled' | 'filled' | 'canceled' | 'rejected';
  filledQuantity: number;
  remainingQuantity: number;
  averagePrice: number;
  lastUpdate: string;
  fees: {
    amount: number;
    currency: string;
  };
}

interface ExecutionMetrics {
  slippage: number;
  impact: number;
  speed: number;
  cost: number;
  success_rate: number;
}

export const useOrderExecution = (botId: string | null) => {
  const [orders, setOrders] = useState<Record<string, OrderStatus>>({});
  const [metrics, setMetrics] = useState<ExecutionMetrics>({
    slippage: 0,
    impact: 0,
    speed: 0,
    cost: 0,
    success_rate: 0
  });
  const [error, setError] = useState<ApiError | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const { placeOrder, cancelOrder, getActiveOrders } = useOrderManagement(botId);
  const { data: marketData } = useMarketDataStream({ symbol: 'SOL/USD', channels: ['price', 'orderbook'] });
  const { state: riskState } = useRiskController(botId);

  useEffect(() => {
    if (!botId || !marketData) return;

    const updateInterval = setInterval(async () => {
      try {
        const activeOrders = await getActiveOrders();
        const updatedOrders: Record<string, OrderStatus> = {};

        for (const order of activeOrders) {
          updatedOrders[order.id] = {
            id: order.id,
            status: order.status,
            filledQuantity: order.filledQuantity,
            remainingQuantity: order.quantity - order.filledQuantity,
            averagePrice: order.averagePrice,
            lastUpdate: order.lastUpdate,
            fees: order.fees
          };
        }

        setOrders(updatedOrders);

        const calculateMetrics = () => {
          const filledOrders = Object.values(updatedOrders).filter(
            order => order.status === 'filled'
          );

          if (filledOrders.length === 0) return;

          const totalOrders = Object.keys(updatedOrders).length;
          const avgSlippage = filledOrders.reduce((sum, order) => {
            const expectedPrice = marketData.price.current;
            return sum + Math.abs(order.averagePrice - expectedPrice) / expectedPrice;
          }, 0) / filledOrders.length;

          const avgSpeed = filledOrders.reduce((sum, order) => {
            const executionTime = new Date(order.lastUpdate).getTime() - 
                                new Date().getTime();
            return sum + executionTime;
          }, 0) / filledOrders.length;

          const totalFees = filledOrders.reduce((sum, order) => 
            sum + order.fees.amount, 0
          );

          setMetrics({
            slippage: avgSlippage,
            impact: filledOrders.length > 0 ? avgSlippage * 100 : 0,
            speed: avgSpeed,
            cost: totalFees,
            success_rate: filledOrders.length / totalOrders
          });
        };

        calculateMetrics();
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to update order status',
          code: 'EXECUTION_ERROR'
        });
      }
    }, 5000);

    return () => clearInterval(updateInterval);
  }, [botId, marketData, getActiveOrders]);

  const executeOrder = async (params: OrderParams) => {
    try {
      setIsExecuting(true);

      if (!marketData) {
        throw new Error('Market data not available');
      }

      if (riskState?.status === 'warning') {
        throw new Error('Risk limits approaching threshold');
      }

      const validateOrder = () => {
        if (params.quantity <= 0) {
          throw new Error('Invalid order quantity');
        }

        if (params.type === 'limit' && !params.price) {
          throw new Error('Price required for limit orders');
        }

        if (params.stopPrice && params.stopPrice <= 0) {
          throw new Error('Invalid stop price');
        }
      };

      validateOrder();

      const order = await placeOrder({
        ...params,
        clientOrderId: params.clientOrderId || `${Date.now()}`
      });

      setOrders(prev => ({
        ...prev,
        [order.id]: {
          id: order.id,
          status: 'new',
          filledQuantity: 0,
          remainingQuantity: params.quantity,
          averagePrice: 0,
          lastUpdate: new Date().toISOString(),
          fees: { amount: 0, currency: 'USD' }
        }
      }));

      return order.id;
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to execute order',
        code: 'EXECUTION_ERROR'
      });
      throw err;
    } finally {
      setIsExecuting(false);
    }
  };

  const cancelActiveOrder = async (orderId: string) => {
    try {
      await cancelOrder(orderId);
      setOrders(prev => {
        const updated = { ...prev };
        if (updated[orderId]) {
          updated[orderId].status = 'canceled';
          updated[orderId].lastUpdate = new Date().toISOString();
        }
        return updated;
      });
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to cancel order',
        code: 'CANCEL_ERROR'
      });
      throw err;
    }
  };

  const getOrderStatus = (orderId: string) => orders[orderId] || null;

  const getActiveOrdersCount = () => 
    Object.values(orders).filter(o => 
      ['new', 'partially_filled'].includes(o.status)
    ).length;

  const getFilledOrdersCount = () =>
    Object.values(orders).filter(o => o.status === 'filled').length;

  return {
    orders,
    metrics,
    error,
    isExecuting,
    executeOrder,
    cancelActiveOrder,
    getOrderStatus,
    getActiveOrdersCount,
    getFilledOrdersCount
  };
};
