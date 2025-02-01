export interface Trade {
  id: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  timestamp: string;
  status: 'completed' | 'failed' | 'processing';
  profitLoss?: number;
  reason?: string;
  // 额外交易信息
  symbol: string;
  orderType: 'market' | 'limit';
  fees?: number;
  slippage?: number;
  strategy?: {
    name: string;
    confidence: number;
    reasoning: string;
  };
  marketConditions?: {
    sentiment: string;
    volatility: number;
    volume24h: number;
  };
}
