export interface OrderBookEntry {
  price: number;
  size: number;
  type: 'ask' | 'bid';
}

export interface OrderBook {
  asks: OrderBookEntry[];
  bids: OrderBookEntry[];
  currentPrice: number;
}

export interface Position {
  id: string;
  symbol: string;
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  type: 'long' | 'short';
  timestamp: string;
}

export interface TradingState {
  positions: Position[];
  orderBook: OrderBook;
  isLoading: boolean;
  error: string | null;
  totalPnl: number;
  trades: any[];
  setPositions: (positions: Position[]) => void;
  updatePosition: (id: string, updates: Partial<Position>) => void;
  closePosition: (id: string) => Promise<void>;
}
