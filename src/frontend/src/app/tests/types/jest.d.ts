import { ApiClient } from './api.types';

declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveMetric(metricName: string, value: number): R;
      toHaveErrorRate(rate: number): R;
      toHaveLatency(milliseconds: number): R;
    }
  }

  interface Window {
    __DEBUG_METRICS__: {
      performance: {
        errorRate: number;
        apiLatency: number;
        systemHealth: number;
      };
      wallet: {
        balances: Record<string, number>;
        transactions: number;
      };
      trading: {
        activePositions: number;
        totalVolume: number;
        profitLoss: number;
      };
    };
  }

  var mockApiClient: jest.Mocked<ApiClient>;
}

export {};
