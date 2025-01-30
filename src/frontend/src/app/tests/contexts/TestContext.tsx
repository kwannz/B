import React, { createContext, useContext, ReactNode } from 'react';
import { TestMetrics } from '../types/test.types';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { mockAPI } from '../setup/test-config';

type TestContextType = {
  metrics: TestMetrics;
  updateMetrics: (metrics: Partial<TestMetrics>) => void;
  resetMetrics: () => void;
  mockSuccessfulAPI: () => void;
  mockFailedAPI: () => void;
  mockSlowAPI: () => void;
};

const TestContext = createContext<TestContextType | undefined>(undefined);

export const TestProvider = ({ children }: { children: ReactNode }) => {
  const [metrics, setMetrics] = React.useState<TestMetrics>(createDebugMetrics());

  const updateMetrics = (newMetrics: Partial<TestMetrics>) => {
    setMetrics(current => ({
      ...current,
      ...newMetrics,
      performance: {
        ...current.performance,
        ...newMetrics.performance
      },
      wallet: {
        ...current.wallet,
        ...newMetrics.wallet
      },
      trading: {
        ...current.trading,
        ...newMetrics.trading
      }
    }));
  };

  const resetMetrics = () => {
    setMetrics(createDebugMetrics());
  };

  const mockSuccessfulAPI = () => {
    mockAPI.createWallet.mockResolvedValue({
      address: 'test-wallet',
      private_key: 'test-key',
      balance: 0,
      bot_id: 'test-bot'
    });

    mockAPI.getWallet.mockResolvedValue({
      address: 'test-wallet',
      private_key: 'test-key',
      balance: 0,
      bot_id: 'test-bot'
    });

    mockAPI.createBot.mockResolvedValue({
      id: 'test-bot',
      type: 'trading',
      strategy: 'test-strategy',
      status: 'active',
      created_at: new Date().toISOString(),
      metrics: {
        total_volume: 1000,
        profit_loss: 100,
        active_positions: 2
      }
    });

    mockAPI.getBotStatus.mockResolvedValue({
      id: 'test-bot',
      status: 'active'
    });

    mockAPI.transferSOL.mockResolvedValue({
      transaction_hash: 'test-hash',
      from_address: 'wallet-a',
      to_address: 'wallet-b',
      amount: 1.0,
      status: 'confirmed',
      timestamp: new Date().toISOString()
    });
  };

  const mockFailedAPI = () => {
    const error = {
      message: 'API Error',
      code: 'API_ERROR',
      status: 500
    };
    Object.values(mockAPI).forEach(mock => mock.mockRejectedValue(error));
  };

  const mockSlowAPI = () => {
    Object.values(mockAPI).forEach(mock => {
      mock.mockImplementation(() => new Promise(resolve => 
        setTimeout(() => resolve({}), 2000)
      ));
    });
  };

  const value = {
    metrics,
    updateMetrics,
    resetMetrics,
    mockSuccessfulAPI,
    mockFailedAPI,
    mockSlowAPI
  };

  return (
    <TestContext.Provider value={value}>
      {children}
    </TestContext.Provider>
  );
};

export const useTestContext = () => {
  const context = useContext(TestContext);
  if (context === undefined) {
    throw new Error('useTestContext must be used within a TestProvider');
  }
  return context;
};
