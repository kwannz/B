import { create } from 'zustand';
import { useToast } from '../components/ui/use-toast';
import type { TradingState, Position, OrderBook } from '../types/trading';

const mockPositions: Position[] = [
  {
    id: '1',
    symbol: 'SOL/USDC',
    size: 10,
    entryPrice: 100,
    currentPrice: 105,
    pnl: 50,
    type: 'long',
    timestamp: new Date().toISOString()
  }
];

const mockOrderBook: OrderBook = {
  asks: [
    { price: 105, size: 100, type: 'ask' },
    { price: 106, size: 200, type: 'ask' }
  ],
  bids: [
    { price: 104, size: 150, type: 'bid' },
    { price: 103, size: 300, type: 'bid' }
  ],
  currentPrice: 104.5
};

export const useTradingStore = create<TradingState>((set, get) => ({
  positions: [],
  orderBook: { asks: [], bids: [], currentPrice: 0 },
  isLoading: false,
  error: null,
  totalPnl: 0,
  trades: [],

  setPositions: (positions: Position[]) => {
    const totalPnl = positions.reduce((sum, pos) => sum + pos.pnl, 0);
    set({ positions, totalPnl });
  },

  setOrderBook: (orderBook: OrderBook) => set({ orderBook }),

  updatePosition: (positionId: string, updates: Partial<Position>) => {
    const positions = get().positions.map(p =>
      p.id === positionId ? { ...p, ...updates } : p
    );
    get().setPositions(positions);
  },

  closePosition: async (positionId: string) => {
    try {
      set({ isLoading: true });
      const positions = get().positions.filter(p => p.id !== positionId);
      get().setPositions(positions);
      set({ isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
    }
  },

  loadMockData: () => {
    set({ orderBook: mockOrderBook, isLoading: false });
    get().setPositions(mockPositions);
  }
}));
