import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useTrading } from '@/hooks/useTrading';
import { useErrorHandler } from '@/hooks/useErrorHandler';

export function OrderBook() {
  const { orderBook, refreshData, isLoading } = useTrading();
  const { handleError } = useErrorHandler();
  
  const { asks, bids, currentPrice } = useMemo(() => ({
    asks: orderBook.asks || [],
    bids: orderBook.bids || [],
    currentPrice: orderBook.currentPrice || 0,
  }), [orderBook]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        await refreshData();
      } catch (error) {
        handleError(error, {
          title: 'Order Book Error',
          fallbackMessage: 'Failed to fetch order book data',
          shouldRetry: true,
          onRetry: refreshData,
        });
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [refreshData, handleError]);
  
  return (
    <Card className="relative">
      <CardHeader>
        <CardTitle>Order Book</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium text-red-500">Asks</div>
            {asks.map((ask) => (
              <div
                key={ask.price}
                className="flex justify-between text-sm text-red-500/90"
              >
                <span>
                  {ask.price.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span>
                  {ask.size.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            ))}
          </div>
          <div className="text-2xl font-bold text-center">
            {currentPrice.toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-green-500">Bids</div>
            {bids.map((bid) => (
              <div
                key={bid.price}
                className="flex justify-between text-sm text-green-500/90"
              >
                <span>
                  {bid.price.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span>
                  {bid.size.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
        {isLoading && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
