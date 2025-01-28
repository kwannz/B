import { ReactNode } from 'react';
import { OrderBook, Position, ChartData } from './trading';

export interface OrderBookProps {
  asks: OrderBook['asks'];
  bids: OrderBook['bids'];
  currentPrice: number;
  onError?: (error: string | Error) => void;
}

export interface PositionsTableProps {
  positions: Position[];
  onClose?: (positionId: string) => void;
  onError?: (error: string | Error) => void;
}

export interface TradingChartProps {
  data: ChartData[];
  width?: number;
  height?: number;
  margin?: { top: number; right: number; bottom: number; left: number };
}

export interface PerformanceProps {
  trades: {
    id: string;
    symbol: string;
    type: 'buy' | 'sell';
    price: number;
    size: number;
    timestamp: string;
    pnl?: number;
  }[];
}
