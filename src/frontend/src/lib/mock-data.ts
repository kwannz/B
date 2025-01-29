export interface Trade {
  total: number;
  successful: number;
  failed: number;
}

export interface PerformanceData {
  totalPnl: number;
  dailyPnl: number;
  weeklyPnl: number;
  monthlyPnl: number;
  trades: Trade;
  performance: {
    daily: Array<{ date: string; value: number }>;
    weekly: Array<{ date: string; value: number }>;
    monthly: Array<{ date: string; value: number }>;
  };
}

export interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number;
  pnl: number;
  pnlPercentage: number;
  liquidationPrice: number;
  timestamp: string;
}

export const mockPerformanceData: PerformanceData = {
  totalPnl: 12500.50,
  dailyPnl: 450.25,
  weeklyPnl: 2150.75,
  monthlyPnl: 8900.00,
  trades: {
    total: 156,
    successful: 98,
    failed: 58
  },
  performance: {
    daily: [
      { date: '2024-01-20', value: 100 },
      { date: '2024-01-21', value: 120 },
      { date: '2024-01-22', value: 115 },
      { date: '2024-01-23', value: 140 },
      { date: '2024-01-24', value: 135 },
      { date: '2024-01-25', value: 155 },
      { date: '2024-01-26', value: 165 }
    ],
    weekly: [
      { date: '2024-W1', value: 500 },
      { date: '2024-W2', value: 750 },
      { date: '2024-W3', value: 900 },
      { date: '2024-W4', value: 1000 }
    ],
    monthly: [
      { date: '2023-10', value: 2000 },
      { date: '2023-11', value: 3500 },
      { date: '2023-12', value: 5000 },
      { date: '2024-01', value: 8900 }
    ]
  }
};

export const mockPositionsData: Position[] = [
  {
    id: '1',
    symbol: 'BTC-PERP',
    side: 'long',
    size: 0.5,
    entryPrice: 44800,
    markPrice: 45100,
    pnl: 150,
    pnlPercentage: 0.67,
    liquidationPrice: 42000,
    timestamp: '2024-01-26T10:30:00Z'
  },
  {
    id: '2',
    symbol: 'ETH-PERP',
    side: 'short',
    size: 2.0,
    entryPrice: 2300,
    markPrice: 2250,
    pnl: 100,
    pnlPercentage: 2.17,
    liquidationPrice: 2600,
    timestamp: '2024-01-26T11:15:00Z'
  }
];
