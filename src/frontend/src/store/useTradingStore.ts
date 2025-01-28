import create from 'zustand';
import { toast } from '../components/ui/use-toast';
import { logger } from './middleware/logger';
import { errorBoundary } from './middleware/errorBoundary';
import { configurePersist } from './middleware/persistMiddleware';
import { Position, OrderBook, TradingState } from '../types/trading';

// Using types from trading.ts

const useTradingStore = create<TradingState>(
  logger(
    errorBoundary(
      configurePersist(
      (set, get) => ({
  positions: [],
  orderBook: {
    asks: [],
    bids: [],
    currentPrice: 0,
  },
  totalPnl: 0,
  trades: {
    total: 0,
    successful: 0,
  },
  isLoading: false,
  error: null,

  setPositions: (positions) => {
    const totalPnl = positions.reduce((sum, pos) => sum + pos.pnl, 0);
    set({ positions, totalPnl });
  },

  setOrderBook: (orderBook) => set({ orderBook }),

  updatePosition: (positionId, updates) => {
    const positions = get().positions.map((pos) =>
      pos.id === positionId ? { ...pos, ...updates } : pos
    );
    get().setPositions(positions);
  },

  closePosition: async (positionId) => {
    set({ isLoading: true, error: null });
    try {
      // API call to close position would go here
      const positions = get().positions.filter((pos) => pos.id !== positionId);
      get().setPositions(positions);
      
      toast({
        title: "Position Closed",
        description: "Position has been successfully closed",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to close position';
      set({ error: errorMessage });
      
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchOrderBook: async () => {
    set({ isLoading: true, error: null });
    try {
      // API call to fetch order book would go here
      // For now, using mock data
      const mockOrderBook = {
        asks: [
          { price: 45200, size: 1.2 },
          { price: 45150, size: 0.8 },
          { price: 45100, size: 2.1 },
        ],
        bids: [
          { price: 45050, size: 1.5 },
          { price: 45000, size: 2.0 },
          { price: 44950, size: 1.1 },
        ],
        currentPrice: 45100,
      };
      set({ orderBook: mockOrderBook, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch order book';
      set({ error: errorMessage, isLoading: false });
      
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    }
  },

  fetchPositions: async () => {
    set({ isLoading: true, error: null });
    try {
      // API call to fetch positions would go here
      // For now, using mock data
      const mockPositions = [
        {
          id: '1',
          symbol: 'BTC/USD',
          size: 1.5,
          entryPrice: 44000,
          currentPrice: 45100,
          pnl: 1650,
          type: 'long' as const,
        },
      ];
      get().setPositions(mockPositions);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch positions';
      set({ error: errorMessage });
      
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      set({ isLoading: false });
    }
  },
}),
      {
        name: 'trading-store',
        getStorage: () => localStorage,
      }
    ),
    { name: 'trading-store' }
  ),
  'tradingStore'
)
);

export default useTradingStore;
