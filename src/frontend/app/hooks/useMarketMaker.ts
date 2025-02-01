import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMarketAggregator } from './useMarketAggregator';
import { useOrderManagement } from './useOrderManagement';
import { useRiskController } from './useRiskController';

interface MarketMakerConfig {
  spread: {
    min: number;
    max: number;
    dynamic: boolean;
  };
  depth: {
    levels: number;
    size_increment: number;
    price_increment: number;
  };
  risk_limits: {
    max_position: number;
    max_order_size: number;
    max_leverage: number;
  };
  execution: {
    rebalance_threshold: number;
    update_interval: number;
    min_trade_size: number;
  };
}

interface LiquidityMetrics {
  spread: number;
  depth: number;
  volume: number;
  volatility: number;
  imbalance: number;
}

interface MarketMakerState {
  status: 'active' | 'paused' | 'stopped';
  current_spread: number;
  position_size: number;
  order_count: number;
  filled_orders: number;
  pnl: number;
}

export const useMarketMaker = (botId: string | null) => {
  const [config, setConfig] = useState<MarketMakerConfig | null>(null);
  const [state, setState] = useState<MarketMakerState | null>(null);
  const [metrics, setMetrics] = useState<LiquidityMetrics | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isActive, setIsActive] = useState(false);

  const { data: marketData } = useMarketAggregator(botId);
  const { placeOrder, cancelOrder, getActiveOrders } = useOrderManagement(botId);
  const { state: riskState } = useRiskController(botId);

  useEffect(() => {
    if (!marketData || !config || !isActive) return;

    const marketMakingInterval = setInterval(async () => {
      try {
        const calculateSpread = () => {
          const baseSpread = (config.spread.max + config.spread.min) / 2;
          if (!config.spread.dynamic) return baseSpread;

          const volatilityAdjustment = marketData.volatility.current * 2;
          const volumeAdjustment = 1 - Math.min(1, marketData.market_data.price.volume_24h / 1000000);
          
          return Math.min(
            config.spread.max,
            Math.max(config.spread.min, baseSpread * (1 + volatilityAdjustment + volumeAdjustment))
          );
        };

        const calculateOrderSize = (level: number) => {
          const baseSize = config.depth.size_increment;
          const sizeMultiplier = Math.pow(1.2, level);
          return Math.min(
            config.risk_limits.max_order_size,
            baseSize * sizeMultiplier
          );
        };

        const generateOrders = async () => {
          const currentPrice = marketData.market_data.price.current;
          const spread = calculateSpread();
          const halfSpread = spread / 2;

          const activeOrders = await getActiveOrders();
          for (const order of activeOrders) {
            await cancelOrder(order.id);
          }

          for (let i = 0; i < config.depth.levels; i++) {
            const priceIncrement = config.depth.price_increment * (i + 1);
            const orderSize = calculateOrderSize(i);

            await placeOrder({
              symbol: 'SOL/USD',
              side: 'buy',
              type: 'limit',
              quantity: orderSize,
              price: currentPrice * (1 - halfSpread - priceIncrement)
            });

            await placeOrder({
              symbol: 'SOL/USD',
              side: 'sell',
              type: 'limit',
              quantity: orderSize,
              price: currentPrice * (1 + halfSpread + priceIncrement)
            });
          }
        };

        const updateMetrics = () => {
          const orderBook = marketData.market_data.orderbook;
          const totalBidSize = orderBook.bids.reduce((sum, [_, size]) => sum + size, 0);
          const totalAskSize = orderBook.asks.reduce((sum, [_, size]) => sum + size, 0);

          setMetrics({
            spread: orderBook.spread,
            depth: orderBook.depth,
            volume: marketData.market_data.price.volume_24h,
            volatility: marketData.volatility.current,
            imbalance: Math.abs(totalBidSize - totalAskSize) / (totalBidSize + totalAskSize)
          });
        };

        await generateOrders();
        updateMetrics();

        setState(prev => {
          if (!prev) return null;
          return {
            ...prev,
            current_spread: calculateSpread(),
            order_count: config.depth.levels * 2
          };
        });

        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to execute market making strategy',
          code: 'MARKET_MAKER_ERROR'
        });
      }
    }, config.execution.update_interval);

    return () => clearInterval(marketMakingInterval);
  }, [marketData, config, isActive, placeOrder, cancelOrder, getActiveOrders]);

  const updateConfig = (newConfig: Partial<MarketMakerConfig>) => {
    setConfig(prev => ({
      ...prev,
      ...newConfig,
      spread: { ...prev?.spread, ...newConfig.spread },
      depth: { ...prev?.depth, ...newConfig.depth },
      risk_limits: { ...prev?.risk_limits, ...newConfig.risk_limits },
      execution: { ...prev?.execution, ...newConfig.execution }
    }));
  };

  const start = () => {
    if (!config) return;
    setIsActive(true);
    setState({
      status: 'active',
      current_spread: (config.spread.max + config.spread.min) / 2,
      position_size: 0,
      order_count: 0,
      filled_orders: 0,
      pnl: 0
    });
  };

  const stop = () => {
    setIsActive(false);
    setState(prev => prev ? { ...prev, status: 'stopped' } : null);
  };

  const pause = () => {
    setIsActive(false);
    setState(prev => prev ? { ...prev, status: 'paused' } : null);
  };

  return {
    config,
    state,
    metrics,
    error,
    isActive,
    updateConfig,
    start,
    stop,
    pause
  };
};
