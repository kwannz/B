import { useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useTrading } from '@/hooks/useTrading';
import { useErrorHandler } from '@/hooks/useErrorHandler';

export function TradingChart() {
  const { orderBook, refreshData, isLoading } = useTrading();
  const { handleError } = useErrorHandler();

  useEffect(() => {
    const fetchData = async () => {
      try {
        await refreshData();
      } catch (error) {
        handleError(error, {
          title: 'Chart Data Error',
          fallbackMessage: 'Failed to fetch trading data',
        });
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [refreshData, handleError]);

  // Transform order book data for visualization
  const chartData = useMemo(() => {
    const data = orderBook.asks.map((ask) => ({
      time: new Date().toLocaleTimeString(),
      price: ask.price,
      volume: ask.size,
      type: 'ask'
    })).concat(orderBook.bids.map((bid) => ({
      time: new Date().toLocaleTimeString(),
      price: bid.price,
      volume: bid.size,
      type: 'bid'
    }))).sort((a, b) => a.price - b.price);

    // Calculate simple moving averages
    const prices = data.map(d => d.price);
    const ma20 = prices.map((_, i) => {
      if (i < 19) return null;
      const slice = prices.slice(i - 19, i + 1);
      return slice.reduce((a, b) => a + b, 0) / 20;
    });
    const ma50 = prices.map((_, i) => {
      if (i < 49) return null;
      const slice = prices.slice(i - 49, i + 1);
      return slice.reduce((a, b) => a + b, 0) / 50;
    });

    // Add moving averages to chart data
    return data.map((d, i) => ({
      ...d,
      ma20: ma20[i],
      ma50: ma50[i],
    }));
  }, [orderBook]);

  return (
    <Card className="col-span-3 relative">
      <CardHeader>
        <CardTitle>BTC/USD Price Chart</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={enrichedChartData}>
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={true}
                />
                <YAxis
                  yAxisId="price"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={true}
                  width={80}
                  domain={['auto', 'auto']}
                />
                <YAxis
                  yAxisId="volume"
                  orientation="left"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={true}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
                {/* Price bars */}
                <Bar
                  yAxisId="price"
                  dataKey="price"
                  fill={(data) => data.type === 'ask' ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
                  opacity={0.5}
                />
                {/* Moving averages */}
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="ma20"
                  stroke="hsl(var(--primary))"
                  dot={false}
                  strokeWidth={1}
                />
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="ma50"
                  stroke="hsl(var(--secondary))"
                  dot={false}
                  strokeWidth={1}
                />
                {/* Volume bars */}
                <Bar
                  yAxisId="volume"
                  dataKey="volume"
                  fill="hsl(var(--muted))"
                  opacity={0.5}
                />
              </ComposedChart>
            </ResponsiveContainer>
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
