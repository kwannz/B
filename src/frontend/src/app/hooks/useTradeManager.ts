import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useTradeExecution } from './useTradeExecution';
import { useOrderBook } from './useOrderBook';
import { usePriceFeed } from './usePriceFeed';

interface TradeManagerConfig {
  maxSlippage: number;
  minTradeSize: number;
  maxTradeSize: number;
  retryAttempts: number;
  retryDelay: number;
}

interface TradeRequest {
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  type: 'market' | 'limit';
  price?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
}

interface TradeStatus {
  orderId: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  fills: {
    price: number;
    amount: number;
    timestamp: string;
  }[];
  averagePrice: number;
  totalFilled: number;
  remainingAmount: number;
  error?: string;
}

export const useTradeManager = (botId: string | null, config: Partial<TradeManagerConfig> = {}) => {
  const [activeOrders, setActiveOrders] = useState<Map<string, TradeStatus>>(new Map());
  const [error, setError] = useState<ApiError | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { executeTrade, cancelTrade } = useTradeExecution(botId);
  const { orderBook } = useOrderBook(null);
  const { priceData } = usePriceFeed(null);

  const defaultConfig: TradeManagerConfig = {
    maxSlippage: 0.01,
    minTradeSize: 0.01,
    maxTradeSize: 10,
    retryAttempts: 3,
    retryDelay: 1000,
    ...config
  };

  const validateTradeRequest = (request: TradeRequest): boolean => {
    if (request.amount < defaultConfig.minTradeSize) {
      setError({ message: 'Trade size too small', code: 'INVALID_SIZE' });
      return false;
    }
    if (request.amount > defaultConfig.maxTradeSize) {
      setError({ message: 'Trade size too large', code: 'INVALID_SIZE' });
      return false;
    }
    if (request.type === 'limit' && !request.price) {
      setError({ message: 'Price required for limit orders', code: 'INVALID_PRICE' });
      return false;
    }
    return true;
  };

  const executeTradeSafely = async (request: TradeRequest): Promise<string | null> => {
    if (!validateTradeRequest(request)) return null;

    try {
      setIsProcessing(true);
      const result = await executeTrade({
        symbol: request.symbol,
        side: request.side,
        amount: request.amount,
        type: request.type,
        price: request.price,
        timeInForce: request.timeInForce
      });

      const tradeStatus: TradeStatus = {
        orderId: result.orderId,
        status: 'pending',
        fills: [],
        averagePrice: 0,
        totalFilled: 0,
        remainingAmount: request.amount
      };

      setActiveOrders(prev => new Map(prev).set(result.orderId, tradeStatus));
      return result.orderId;
    } catch (err) {
      setError(err as ApiError);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelOrder = async (orderId: string): Promise<boolean> => {
    try {
      setIsProcessing(true);
      const success = await cancelTrade(orderId);
      if (success) {
        setActiveOrders(prev => {
          const updated = new Map(prev);
          const order = updated.get(orderId);
          if (order) {
            order.status = 'cancelled';
            updated.set(orderId, order);
          }
          return updated;
        });
      }
      return success;
    } catch (err) {
      setError(err as ApiError);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const getOrderStatus = (orderId: string): TradeStatus | null => {
    return activeOrders.get(orderId) || null;
  };

  const clearError = () => {
    setError(null);
  };

  return {
    executeTradeSafely,
    cancelOrder,
    getOrderStatus,
    activeOrders,
    error,
    isProcessing,
    clearError
  };
};
