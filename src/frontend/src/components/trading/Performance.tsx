import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";
import { LineChartComponent } from '@/components/charts/LineChartComponent';
import { TrendingUp, TrendingDown, Activity, DollarSign } from "lucide-react";
import { useTrading } from '@/hooks/useTrading';
import { useEffect } from 'react';

export function Performance() {
  const { totalPnl, trades, refreshData, isLoading } = useTrading();
  const { handleError } = useErrorHandler();
  
  const { avgWinRate, avgTradeValue } = useMemo(() => ({
    avgWinRate: trades.total > 0 ? Math.round((trades.successful / trades.total) * 100) : 0,
    avgTradeValue: trades.total > 0 ? Math.round(totalPnl / trades.total) : 0,
  }), [trades.total, trades.successful, totalPnl]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        await refreshData();
      } catch (error) {
        handleError(error, {
          title: 'Performance Data Error',
          fallbackMessage: 'Failed to fetch performance data',
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
    <div className="space-y-8 relative">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Performance Analytics</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
            <DollarSign className={`h-4 w-4 ${totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalPnl >= 0 ? '+' : ''}{totalPnl.toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground">Current trading session</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgWinRate}%</div>
            <p className="text-xs text-muted-foreground">{trades.total} total trades</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Trade</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {avgTradeValue.toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground">Per completed trade</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Positions</CardTitle>
            <TrendingDown className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trades.total}</div>
            <p className="text-xs text-muted-foreground">Currently open</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <LineChartComponent 
              data={[]} // Will be updated when we implement real-time data
              dataKey="pnl" 
              xAxisKey="date"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  );
}
