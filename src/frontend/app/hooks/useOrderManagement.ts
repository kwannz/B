import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMarketDataProvider } from './useMarketDataProvider';
import { useRiskController } from './useRiskController';
import { usePositionSizing } from './usePositionSizing';

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

interface Order extends OrderParams {
  id: string;
  status: 'new' | 'filled' | 'partially_filled' | 'canceled' | 'rejected';
  filledQuantity: number;
  averagePrice: number;
  timestamp: string;
  lastUpdate: string;
  fees: {
    amount: number;
    currency: string;
  };
}

interface OrderBook {
  bids: Array<[number, number]>;
  asks: Array<[number, number]>;
  timestamp: string;
  spread: number;
  depth: number;
}

interface OrderExecutionMetrics {
  slippage: number;
  impact: number;
  speed: number;
  success_rate: number;
  fill_ratio: number;
}

export const useOrderManagement = (botId: string | null) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [metrics, setMetrics] = useState<OrderExecutionMetrics | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const { marketContext } = useMarketDataProvider(null, botId);
  const { state: riskState } = useRiskController(botId);
  const { sizing } = usePositionSizing(botId);

  useEffect(() => {
    if (!marketContext || !orderBook) return;

    const calculateMetrics = (orders: Order[]): OrderExecutionMetrics => {
      const filledOrders = orders.filter(o => 
        o.status === 'filled' || o.status === 'partially_filled'
      );

      if (filledOrders.length === 0) {
        return {
          slippage: 0,
          impact: 0,
          speed: 0,
          success_rate: 0,
          fill_ratio: 0
        };
      }

      const totalOrders = orders.length;
      const successfulOrders = filledOrders.length;
      const totalFillRatio = filledOrders.reduce((acc, order) => 
        acc + (order.filledQuantity / order.quantity), 0
      );

      const averageSlippage = filledOrders.reduce((acc, order) => {
        const expectedPrice = order.type === 'market' ? 
          marketContext.price.current : order.price || 0;
        return acc + Math.abs(order.averagePrice - expectedPrice) / expectedPrice;
      }, 0) / successfulOrders;

      return {
        slippage: averageSlippage,
        impact: calculateMarketImpact(filledOrders),
        speed: calculateExecutionSpeed(filledOrders),
        success_rate: successfulOrders / totalOrders,
        fill_ratio: totalFillRatio / successfulOrders
      };
    };

    const calculateMarketImpact = (orders: Order[]): number => {
      const totalVolume = marketContext.volume.current_24h;
      const orderVolume = orders.reduce((acc, order) => 
        acc + order.filledQuantity * order.averagePrice, 0
      );
      return orderVolume / totalVolume;
    };

    const calculateExecutionSpeed = (orders: Order[]): number => {
      return orders.reduce((acc, order) => {
        const executionTime = new Date(order.lastUpdate).getTime() - 
                            new Date(order.timestamp).getTime();
        return acc + executionTime;
      }, 0) / orders.length / 1000;
    };

    setMetrics(calculateMetrics(orders));
  }, [orders, marketContext, orderBook]);

  const placeOrder = async (params: OrderParams): Promise<Order | null> => {
    try {
      setIsExecuting(true);

      if (!sizing || !riskState) {
        throw new Error('Risk management data not available');
      }

      const validateOrder = () => {
        if (params.quantity <= 0) {
          throw new Error('Invalid order quantity');
        }

        if (params.type === 'limit' && !params.price) {
          throw new Error('Limit order requires price');
        }

        const orderValue = params.price ? 
          params.quantity * params.price : 
          params.quantity * marketContext.price.current;

        if (orderValue > sizing.max_allowed) {
          throw new Error('Order size exceeds risk limits');
        }
      };

      validateOrder();

      const mockOrder: Order = {
        ...params,
        id: `order-${Date.now()}`,
        status: 'new',
        filledQuantity: 0,
        averagePrice: 0,
        timestamp: new Date().toISOString(),
        lastUpdate: new Date().toISOString(),
        fees: {
          amount: 0,
          currency: 'SOL'
        }
      };

      setOrders(prev => [...prev, mockOrder]);
      setError(null);
      return mockOrder;
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to place order',
        code: 'ORDER_ERROR'
      });
      return null;
    } finally {
      setIsExecuting(false);
    }
  };

  const cancelOrder = async (orderId: string): Promise<boolean> => {
    try {
      setIsExecuting(true);
      setOrders(prev => prev.map(order => 
        order.id === orderId ? 
        { ...order, status: 'canceled', lastUpdate: new Date().toISOString() } : 
        order
      ));
      setError(null);
      return true;
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to cancel order',
        code: 'CANCEL_ERROR'
      });
      return false;
    } finally {
      setIsExecuting(false);
    }
  };

  const getOrderHistory = (status?: Order['status']) => {
    return status ? 
      orders.filter(order => order.status === status) : 
      orders;
  };

  const getActiveOrders = () => {
    return orders.filter(order => 
      ['new', 'partially_filled'].includes(order.status)
    );
  };

  return {
    orders,
    orderBook,
    metrics,
    error,
    isExecuting,
    placeOrder,
    cancelOrder,
    getOrderHistory,
    getActiveOrders
  };
};
