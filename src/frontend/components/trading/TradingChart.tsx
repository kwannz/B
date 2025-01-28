import { useEffect, useMemo } from 'react';
import { ComposedChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import type { ChartData, EnrichedChartData } from '../../types/chart';
import type { OrderBook, OrderBookEntry } from '../../types/trading';

interface TradingChartProps {
  orderBook: OrderBook;
  refreshData: () => void;
}

export function TradingChart({ orderBook, refreshData }: TradingChartProps) {
  const { handleError } = useErrorHandler();

  useEffect(() => {
    try {
      refreshData();
    } catch (error) {
      handleError(error instanceof Error ? error.message : 'Failed to fetch trading data');
    }
  }, [refreshData]);

  const data: ChartData[] = useMemo(() => {
    const asks = orderBook.asks.map((ask: OrderBookEntry) => ({
      time: new Date().toLocaleTimeString(),
      price: ask.price,
      volume: ask.size,
      type: 'ask' as const
    }));

    const bids = orderBook.bids.map((bid: OrderBookEntry) => ({
      time: new Date().toLocaleTimeString(),
      price: bid.price,
      volume: bid.size,
      type: 'bid' as const
    }));

    return [...asks, ...bids].sort((a, b) => a.price - b.price);
  }, [orderBook]);

  const enrichedChartData: EnrichedChartData[] = useMemo(() => {
    const prices = data.map(d => d.price);
    const volumes = data.map(d => d.volume);
    
    const maxPrice = Math.max(...prices);
    const maxVolume = Math.max(...volumes);
    
    return data.map((d, i) => ({
      ...d,
      priceNormalized: d.price / maxPrice,
      volumeNormalized: d.volume / maxVolume
    }));
  }, [data]);

  return (
    <div className="w-full h-[400px] bg-background rounded-lg p-4">
      <ComposedChart width={800} height={400} data={enrichedChartData}>
        <XAxis dataKey="price" />
        <YAxis />
        <Tooltip />
        <Bar
          dataKey="volume"
          fill={(d: ChartData) => d.type === 'ask' ? 'var(--destructive)' : 'var(--primary)'}
        />
      </ComposedChart>
    </div>
  );
}
