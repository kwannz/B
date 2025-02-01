import { useState } from 'react';
import { ApiError } from '../api/client';
import { usePriceFeed } from './usePriceFeed';
import { useOrderBook } from './useOrderBook';
import { useMarketDataProvider } from './useMarketDataProvider';

interface TradeParams {
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
  type: 'market' | 'limit';
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
}

interface TradeResult {
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  status: 'pending' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected';
  timestamp: string;
  fills: {
    price: number;
    amount: number;
    timestamp: string;
  }[];
}

export const useTradeExecution = (botId: string | null) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [lastTrade, setLastTrade] = useState<TradeResult | null>(null);

  const { priceData } = usePriceFeed(lastTrade?.symbol || null);
  const { orderBook } = useOrderBook(lastTrade?.symbol || null);
  const { marketContext } = useMarketDataProvider(lastTrade?.symbol || null, botId);

  const executeTrade = async (params: TradeParams): Promise<TradeResult> => {
    try {
      setIsExecuting(true);
      setError(null);

      const currentPrice = priceData?.price;
      if (!currentPrice) {
        throw new Error('Price data not available');
      }

      const marketDepth = orderBook?.depth;
      if (!marketDepth) {
        throw new Error('Order book data not available');
      }

      const tradePrice = params.type === 'market' ? currentPrice : params.price;
      if (!tradePrice) {
        throw new Error('Trade price not specified for limit order');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/trade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bot_id: botId,
          ...params,
          price: tradePrice,
        }),
      });

      if (!response.ok) {
        throw new Error('Trade execution failed');
      }

      const result: TradeResult = await response.json();
      setLastTrade(result);
      return result;
    } catch (err) {
      const apiError = {
        message: err instanceof Error ? err.message : 'Trade execution failed',
        code: 'TRADE_ERROR'
      };
      setError(apiError);
      throw apiError;
    } finally {
      setIsExecuting(false);
    }
  };

  const cancelTrade = async (orderId: string): Promise<boolean> => {
    try {
      setIsExecuting(true);
      setError(null);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/trade/${orderId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bot_id: botId }),
      });

      if (!response.ok) {
        throw new Error('Failed to cancel trade');
      }

      return true;
    } catch (err) {
      const apiError = {
        message: err instanceof Error ? err.message : 'Trade cancellation failed',
        code: 'CANCEL_ERROR'
      };
      setError(apiError);
      throw apiError;
    } finally {
      setIsExecuting(false);
    }
  };

  return {
    executeTrade,
    cancelTrade,
    isExecuting,
    error,
    lastTrade,
    marketData: {
      currentPrice: priceData?.price,
      orderBookDepth: orderBook?.depth,
      marketContext
    }
  };
};
