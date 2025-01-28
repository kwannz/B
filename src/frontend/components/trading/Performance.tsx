import { useMemo } from 'react';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import type { Trade } from '../../types/trading';

interface PerformanceProps {
  trades: Trade[];
  totalPnl: number;
}

export function Performance({ trades, totalPnl }: PerformanceProps) {
  const { handleError } = useErrorHandler();

  const { avgWinRate, avgTradeValue } = useMemo(() => ({
    avgWinRate: trades.length > 0 ? Math.round((trades.filter(t => t.pnl > 0).length / trades.length) * 100) : 0,
    avgTradeValue: trades.length > 0 ? Math.round(totalPnl / trades.length) : 0,
  }), [trades, totalPnl]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 className="tracking-tight text-sm font-medium">Total PnL</h3>
        </div>
        <div className="text-2xl font-bold">${totalPnl.toFixed(2)}</div>
        <p className="text-xs text-muted-foreground">{trades.length} total trades</p>
      </div>
      
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 className="tracking-tight text-sm font-medium">Win Rate</h3>
        </div>
        <div className="text-2xl font-bold">{avgWinRate}%</div>
        <p className="text-xs text-muted-foreground">Average success rate</p>
      </div>
      
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 className="tracking-tight text-sm font-medium">Average Trade</h3>
        </div>
        <div className="text-2xl font-bold">${avgTradeValue}</div>
        <p className="text-xs text-muted-foreground">Per completed trade</p>
      </div>
      
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 className="tracking-tight text-sm font-medium">Total Trades</h3>
        </div>
        <div className="text-2xl font-bold">{trades.length}</div>
        <p className="text-xs text-muted-foreground">Across all pairs</p>
      </div>
    </div>
  );
}
