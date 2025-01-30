export interface Agent {
  id: string;
  type: 'trading' | 'defi';
  status: 'active' | 'inactive';
}

export interface Strategy {
  id: string;
  agentId: string;
  type: 'trading' | 'defi';
  parameters: Record<string, any>;
}

export interface Wallet {
  address: string;
  balance: number;
  botId: string;
}

export interface Trade {
  id: string;
  botId: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  timestamp: number;
  status: 'pending' | 'completed' | 'failed';
}
