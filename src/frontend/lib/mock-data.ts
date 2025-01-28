export const mockPerformanceData = {
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

export const mockOrderBookData = {
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
  currentPrice: 45100.00
};

export const mockPositionsData = [
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

export const mockTradingChartData = {
  candlesticks: [
    { time: '2024-01-26T10:00:00Z', open: 44500, high: 44800, low: 44400, close: 44750, volume: 120 },
    { time: '2024-01-26T10:15:00Z', open: 44750, high: 45000, low: 44700, close: 44900, volume: 150 },
    { time: '2024-01-26T10:30:00Z', open: 44900, high: 45200, low: 44850, close: 45100, volume: 180 },
    { time: '2024-01-26T10:45:00Z', open: 45100, high: 45300, low: 45000, close: 45200, volume: 200 },
    { time: '2024-01-26T11:00:00Z', open: 45200, high: 45400, low: 45100, close: 45300, volume: 160 }
  ],
  indicators: {
    ma20: [44800, 44900, 45000, 45100, 45200],
    ma50: [44750, 44850, 44950, 45050, 45150],
    rsi: [55, 58, 62, 65, 63]
  }
};
