import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMarketDataStream } from './useMarketDataStream';
import { useOrderBook } from './useOrderBook';
import { useMarketMakerAnalysis } from './useMarketMakerAnalysis';

interface OrderFlowMetrics {
  volume: {
    buy_volume: number;
    sell_volume: number;
    net_volume: number;
    relative_volume: number;
  };
  trades: {
    buy_trades: number;
    sell_trades: number;
    average_size: number;
    large_trades: number;
  };
  imbalance: {
    volume_imbalance: number;
    trade_imbalance: number;
    price_impact: number;
    absorption_ratio: number;
  };
  momentum: {
    price_momentum: number;
    volume_momentum: number;
    trade_momentum: number;
    strength: number;
  };
}

interface OrderFlowSignal {
  id: string;
  type: 'absorption' | 'exhaustion' | 'accumulation' | 'distribution';
  side: 'buy' | 'sell';
  strength: number;
  confidence: number;
  price_level: number;
  volume: number;
  timestamp: string;
}

export const useOrderFlow = (symbol: string) => {
  const [metrics, setMetrics] = useState<OrderFlowMetrics | null>(null);
  const [signals, setSignals] = useState<OrderFlowSignal[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: marketData } = useMarketDataStream({
    symbol,
    channels: ['trades', 'orderbook'],
    interval: 1000
  });
  const { orderBook } = useOrderBook(symbol);
  const { metrics: makerMetrics } = useMarketMakerAnalysis(null);

  useEffect(() => {
    if (!marketData || !orderBook) return;

    const analysisInterval = setInterval(() => {
      try {
        setIsAnalyzing(true);

        const calculateVolumeMetrics = () => {
          const trades = marketData.trades || [];
          const buyVolume = trades
            .filter(t => t.side === 'buy')
            .reduce((sum, t) => sum + t.size, 0);
          const sellVolume = trades
            .filter(t => t.side === 'sell')
            .reduce((sum, t) => sum + t.size, 0);

          return {
            buy_volume: buyVolume,
            sell_volume: sellVolume,
            net_volume: buyVolume - sellVolume,
            relative_volume: (buyVolume + sellVolume) / 
              (makerMetrics?.average_volume || 1)
          };
        };

        const calculateTradeMetrics = () => {
          const trades = marketData.trades || [];
          const buyTrades = trades.filter(t => t.side === 'buy').length;
          const sellTrades = trades.filter(t => t.side === 'sell').length;
          const averageSize = trades.reduce((sum, t) => sum + t.size, 0) / 
            Math.max(1, trades.length);
          const largeTradeThreshold = averageSize * 3;

          return {
            buy_trades: buyTrades,
            sell_trades: sellTrades,
            average_size: averageSize,
            large_trades: trades.filter(t => t.size > largeTradeThreshold).length
          };
        };

        const calculateImbalanceMetrics = () => {
          const volume = calculateVolumeMetrics();
          const trades = calculateTradeMetrics();
          const totalVolume = volume.buy_volume + volume.sell_volume;
          const totalTrades = trades.buy_trades + trades.sell_trades;

          return {
            volume_imbalance: totalVolume === 0 ? 0 :
              (volume.buy_volume - volume.sell_volume) / totalVolume,
            trade_imbalance: totalTrades === 0 ? 0 :
              (trades.buy_trades - trades.sell_trades) / totalTrades,
            price_impact: marketData.price.change_24h / 
              Math.max(1, totalVolume),
            absorption_ratio: volume.buy_volume / 
              Math.max(1, volume.sell_volume)
          };
        };

        const calculateMomentumMetrics = () => {
          const prices = marketData.trades.map(t => t.price);
          const volumes = marketData.trades.map(t => t.size);
          const trades = marketData.trades.length;

          const momentum = (values: number[]) => {
            if (values.length < 2) return 0;
            const recent = values.slice(-10);
            const older = values.slice(-20, -10);
            return (
              recent.reduce((sum, v) => sum + v, 0) / recent.length -
              older.reduce((sum, v) => sum + v, 0) / older.length
            );
          };

          return {
            price_momentum: momentum(prices),
            volume_momentum: momentum(volumes),
            trade_momentum: trades / (makerMetrics?.trade_count || 1),
            strength: Math.abs(momentum(prices)) * 
              Math.abs(momentum(volumes))
          };
        };

        const generateSignals = () => {
          const newSignals: OrderFlowSignal[] = [];
          const timestamp = new Date().toISOString();
          const imbalance = calculateImbalanceMetrics();
          const momentum = calculateMomentumMetrics();

          if (Math.abs(imbalance.volume_imbalance) > 0.3) {
            const side = imbalance.volume_imbalance > 0 ? 'buy' : 'sell';
            newSignals.push({
              id: `flow-${Date.now()}`,
              type: imbalance.absorption_ratio > 1.5 ? 'absorption' : 'exhaustion',
              side,
              strength: Math.abs(imbalance.volume_imbalance),
              confidence: Math.min(
                1,
                Math.abs(imbalance.trade_imbalance) +
                Math.abs(momentum.strength)
              ),
              price_level: marketData.price.current,
              volume: side === 'buy' ? 
                metrics?.volume.buy_volume || 0 : 
                metrics?.volume.sell_volume || 0,
              timestamp
            });
          }

          if (Math.abs(momentum.price_momentum) > 0 && 
              Math.abs(momentum.volume_momentum) > 0) {
            const side = momentum.price_momentum > 0 ? 'buy' : 'sell';
            newSignals.push({
              id: `momentum-${Date.now()}`,
              type: side === 'buy' ? 'accumulation' : 'distribution',
              side,
              strength: Math.abs(momentum.strength),
              confidence: Math.min(
                1,
                Math.abs(momentum.price_momentum) +
                Math.abs(momentum.volume_momentum)
              ),
              price_level: marketData.price.current,
              volume: metrics?.volume.net_volume || 0,
              timestamp
            });
          }

          setSignals(prev => [...newSignals, ...prev].slice(0, 100));
        };

        setMetrics({
          volume: calculateVolumeMetrics(),
          trades: calculateTradeMetrics(),
          imbalance: calculateImbalanceMetrics(),
          momentum: calculateMomentumMetrics()
        });

        generateSignals();
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to analyze order flow',
          code: 'ANALYSIS_ERROR'
        });
      } finally {
        setIsAnalyzing(false);
      }
    }, 1000);

    return () => clearInterval(analysisInterval);
  }, [marketData, orderBook, makerMetrics]);

  const getVolumeMetrics = () => metrics?.volume || null;

  const getTradeMetrics = () => metrics?.trades || null;

  const getImbalanceMetrics = () => metrics?.imbalance || null;

  const getMomentumMetrics = () => metrics?.momentum || null;

  const getSignalsByType = (type: OrderFlowSignal['type']) =>
    signals.filter(s => s.type === type);

  const getRecentSignals = (limit: number = 10) =>
    signals.slice(0, limit);

  const getOrderFlowSummary = () => {
    if (!metrics) return null;

    return {
      flow_state: 
        Math.abs(metrics.imbalance.volume_imbalance) > 0.3 ? 
          metrics.imbalance.volume_imbalance > 0 ? 'buying_pressure' : 'selling_pressure' :
          'balanced',
      momentum_state:
        Math.abs(metrics.momentum.strength) > 0.5 ? 'strong' :
        Math.abs(metrics.momentum.strength) > 0.2 ? 'moderate' : 'weak',
      absorption_state:
        metrics.imbalance.absorption_ratio > 1.5 ? 'high' :
        metrics.imbalance.absorption_ratio > 1.2 ? 'moderate' : 'low'
    };
  };

  return {
    metrics,
    signals,
    error,
    isAnalyzing,
    getVolumeMetrics,
    getTradeMetrics,
    getImbalanceMetrics,
    getMomentumMetrics,
    getSignalsByType,
    getRecentSignals,
    getOrderFlowSummary
  };
};
