import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMarketAggregator } from './useMarketAggregator';
import { useRiskController } from './useRiskController';
import { useOrderManagement } from './useOrderManagement';

interface StrategyConfig {
  name: string;
  type: 'trading' | 'defi';
  parameters: {
    entry_conditions: {
      price_threshold?: number;
      volume_threshold?: number;
      sentiment_threshold?: number;
      technical_indicators?: string[];
    };
    exit_conditions: {
      take_profit?: number;
      stop_loss?: number;
      trailing_stop?: number;
      time_limit?: number;
    };
    position_sizing: {
      initial_size: number;
      max_size: number;
      increment_size: number;
    };
    risk_management: {
      max_drawdown: number;
      max_position_size: number;
      max_leverage: number;
    };
  };
}

interface StrategyState {
  status: 'active' | 'paused' | 'stopped';
  current_position: {
    size: number;
    entry_price: number;
    current_price: number;
    pnl: number;
    duration: number;
  };
  performance: {
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    total_pnl: number;
    max_drawdown: number;
    sharpe_ratio: number;
  };
  signals: {
    entry: boolean;
    exit: boolean;
    risk_warning: boolean;
    timestamp: string;
  };
}

export const useStrategyManager = (botId: string | null, config: Partial<StrategyConfig> = {}) => {
  const [strategy, setStrategy] = useState<StrategyConfig | null>(null);
  const [state, setState] = useState<StrategyState | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const { data: marketData } = useMarketAggregator(botId);
  const { state: riskState } = useRiskController(botId);
  const { placeOrder, getActiveOrders } = useOrderManagement(botId);

  useEffect(() => {
    if (!marketData || !strategy) return;

    const executionInterval = setInterval(async () => {
      try {
        setIsExecuting(true);

        const checkEntryConditions = () => {
          const { entry_conditions } = strategy.parameters;
          if (!entry_conditions) return false;

          const priceCondition = !entry_conditions.price_threshold || 
            marketData.market_data.price.current <= entry_conditions.price_threshold;

          const volumeCondition = !entry_conditions.volume_threshold ||
            marketData.market_data.price.volume_24h >= entry_conditions.volume_threshold;

          const sentimentCondition = !entry_conditions.sentiment_threshold ||
            marketData.sentiment.overall >= entry_conditions.sentiment_threshold;

          return priceCondition && volumeCondition && sentimentCondition;
        };

        const checkExitConditions = (position: StrategyState['current_position']) => {
          const { exit_conditions } = strategy.parameters;
          if (!exit_conditions) return false;

          const takeProfitHit = exit_conditions.take_profit &&
            position.pnl >= position.size * exit_conditions.take_profit;

          const stopLossHit = exit_conditions.stop_loss &&
            position.pnl <= -position.size * exit_conditions.stop_loss;

          const timeLimitReached = exit_conditions.time_limit &&
            position.duration >= exit_conditions.time_limit;

          return takeProfitHit || stopLossHit || timeLimitReached;
        };

        const calculatePositionSize = () => {
          const { position_sizing } = strategy.parameters;
          const currentPosition = state?.current_position.size || 0;

          if (currentPosition >= position_sizing.max_size) return 0;

          const incrementSize = Math.min(
            position_sizing.increment_size,
            position_sizing.max_size - currentPosition
          );

          return Math.max(position_sizing.initial_size, incrementSize);
        };

        const executeStrategy = async () => {
          const activeOrders = getActiveOrders();
          if (activeOrders.length > 0) return;

          const entrySignal = checkEntryConditions();
          const exitSignal = state?.current_position && 
            checkExitConditions(state.current_position);

          if (entrySignal && !state?.current_position) {
            const positionSize = calculatePositionSize();
            if (positionSize > 0) {
              await placeOrder({
                symbol: 'SOL/USD',
                side: 'buy',
                type: 'market',
                quantity: positionSize
              });
            }
          } else if (exitSignal && state?.current_position) {
            await placeOrder({
              symbol: 'SOL/USD',
              side: 'sell',
              type: 'market',
              quantity: state.current_position.size
            });
          }
        };

        await executeStrategy();

        setState(prev => {
          if (!prev) return null;
          return {
            ...prev,
            signals: {
              entry: checkEntryConditions(),
              exit: prev.current_position ? 
                checkExitConditions(prev.current_position) : false,
              risk_warning: riskState?.status === 'warning',
              timestamp: new Date().toISOString()
            }
          };
        });

        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to execute strategy',
          code: 'STRATEGY_ERROR'
        });
      } finally {
        setIsExecuting(false);
      }
    }, 5000);

    return () => clearInterval(executionInterval);
  }, [marketData, strategy, state, riskState, placeOrder, getActiveOrders]);

  const updateStrategy = (newConfig: Partial<StrategyConfig>) => {
    setStrategy(prev => ({
      ...prev,
      ...newConfig,
      parameters: {
        ...prev?.parameters,
        ...newConfig.parameters
      }
    }));
  };

  const pauseStrategy = () => {
    setState(prev => prev ? { ...prev, status: 'paused' } : null);
  };

  const resumeStrategy = () => {
    setState(prev => prev ? { ...prev, status: 'active' } : null);
  };

  const stopStrategy = () => {
    setState(prev => prev ? { ...prev, status: 'stopped' } : null);
  };

  return {
    strategy,
    state,
    error,
    isExecuting,
    updateStrategy,
    pauseStrategy,
    resumeStrategy,
    stopStrategy
  };
};
