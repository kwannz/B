import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useRiskStrategy } from './useRiskStrategy';
import { useTradeExecution } from './useTradeExecution';
import { useMarketDataProvider } from './useMarketDataProvider';

interface StrategyExecutionConfig {
  maxPositionSize: number;
  minTradeSize: number;
  maxSlippage: number;
  rebalanceThreshold: number;
  hedgeThreshold: number;
}

interface ExecutionState {
  status: 'idle' | 'executing' | 'completed' | 'failed';
  current_action: string | null;
  pending_orders: number;
  completed_orders: number;
  failed_orders: number;
}

interface ExecutionResult {
  success: boolean;
  orders_placed: number;
  orders_filled: number;
  average_price: number;
  total_size: number;
  execution_time: number;
}

export const useStrategyExecution = (botId: string | null, config: Partial<StrategyExecutionConfig> = {}) => {
  const [executionState, setExecutionState] = useState<ExecutionState>({
    status: 'idle',
    current_action: null,
    pending_orders: 0,
    completed_orders: 0,
    failed_orders: 0
  });
  const [results, setResults] = useState<ExecutionResult[]>([]);
  const [error, setError] = useState<ApiError | null>(null);

  const { strategy, recommendations } = useRiskStrategy(botId);
  const { executeTrade, cancelTrade } = useTradeExecution(botId);
  const { marketContext } = useMarketDataProvider(null, botId);

  const defaultConfig: StrategyExecutionConfig = {
    maxPositionSize: 10,
    minTradeSize: 0.01,
    maxSlippage: 0.01,
    rebalanceThreshold: 0.05,
    hedgeThreshold: 0.2,
    ...config
  };

  const executeRecommendation = async (recommendation: StrategyRecommendation) => {
    if (!strategy || !marketContext) return;

    try {
      setExecutionState(prev => ({
        ...prev,
        status: 'executing',
        current_action: `Executing ${recommendation.action} strategy`
      }));

      const currentPrice = marketContext.price.current;
      const targetSize = recommendation.target_allocation * defaultConfig.maxPositionSize;

      if (targetSize < defaultConfig.minTradeSize) {
        throw new Error('Trade size too small');
      }

      const orderParams = {
        symbol: 'SOL-USDC',
        side: recommendation.action === 'increase' ? 'buy' : 'sell',
        amount: targetSize,
        type: 'limit',
        price: currentPrice * (1 + (recommendation.action === 'increase' ? defaultConfig.maxSlippage : -defaultConfig.maxSlippage))
      };

      const startTime = Date.now();
      const tradeResult = await executeTrade(orderParams);

      setResults(prev => [...prev, {
        success: tradeResult.status === 'filled',
        orders_placed: 1,
        orders_filled: tradeResult.status === 'filled' ? 1 : 0,
        average_price: tradeResult.price,
        total_size: tradeResult.amount,
        execution_time: Date.now() - startTime
      }]);

      setExecutionState(prev => ({
        ...prev,
        status: 'completed',
        current_action: null,
        completed_orders: prev.completed_orders + 1
      }));

      setError(null);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Strategy execution failed',
        code: 'EXECUTION_ERROR'
      });
      setExecutionState(prev => ({
        ...prev,
        status: 'failed',
        current_action: null,
        failed_orders: prev.failed_orders + 1
      }));
    }
  };

  const executeHedging = async () => {
    if (!strategy || !marketContext) return;

    const { hedge_ratio, recommended_instruments } = strategy.hedging;
    if (hedge_ratio > defaultConfig.hedgeThreshold) {
      for (const instrument of recommended_instruments) {
        try {
          const hedgeSize = strategy.position_sizing.current_allocation * hedge_ratio;
          await executeTrade({
            symbol: instrument,
            side: 'sell',
            amount: hedgeSize,
            type: 'limit',
            price: marketContext.price.current * (1 - defaultConfig.maxSlippage)
          });
        } catch (err) {
          setError({
            message: `Hedging failed for ${instrument}`,
            code: 'HEDGE_ERROR'
          });
        }
      }
    }
  };

  const executeRebalancing = async () => {
    if (!strategy || !marketContext) return;

    const { current_score, optimal_weights, rebalance_threshold } = strategy.diversification;
    if (Math.abs(1 - current_score) > rebalance_threshold) {
      for (const [instrument, weight] of Object.entries(optimal_weights)) {
        try {
          const targetSize = weight * defaultConfig.maxPositionSize;
          const currentSize = strategy.position_sizing.current_allocation;
          const diffSize = targetSize - currentSize;

          if (Math.abs(diffSize) > defaultConfig.minTradeSize) {
            await executeTrade({
              symbol: instrument,
              side: diffSize > 0 ? 'buy' : 'sell',
              amount: Math.abs(diffSize),
              type: 'limit',
              price: marketContext.price.current * (1 + (diffSize > 0 ? defaultConfig.maxSlippage : -defaultConfig.maxSlippage))
            });
          }
        } catch (err) {
          setError({
            message: `Rebalancing failed for ${instrument}`,
            code: 'REBALANCE_ERROR'
          });
        }
      }
    }
  };

  return {
    executionState,
    results,
    error,
    executeRecommendation,
    executeHedging,
    executeRebalancing
  };
};
