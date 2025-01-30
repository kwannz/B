import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMarketDataStream } from './useMarketDataStream';
import { useMarketMaker } from './useMarketMaker';
import { useOrderBook } from './useOrderBook';

interface MarketMakerMetrics {
  spread: {
    current: number;
    average: number;
    min: number;
    max: number;
    trend: 'widening' | 'tightening' | 'stable';
  };
  depth: {
    bid_depth: number;
    ask_depth: number;
    total_depth: number;
    imbalance_ratio: number;
  };
  flow: {
    buy_volume: number;
    sell_volume: number;
    net_flow: number;
    flow_trend: 'accumulation' | 'distribution' | 'neutral';
  };
  activity: {
    quote_updates: number;
    trade_count: number;
    average_trade_size: number;
    large_orders: number;
  };
}

interface OrderFlowSignal {
  id: string;
  type: 'absorption' | 'pressure' | 'manipulation';
  side: 'buy' | 'sell';
  strength: number;
  price_level: number;
  volume: number;
  timestamp: string;
}

export const useMarketMakerAnalysis = (botId: string | null) => {
  const [metrics, setMetrics] = useState<MarketMakerMetrics | null>(null);
  const [signals, setSignals] = useState<OrderFlowSignal[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: marketData } = useMarketDataStream({
    symbol: 'SOL/USD',
    channels: ['orderbook', 'trades'],
    interval: 1000
  });
  const { metrics: makerMetrics } = useMarketMaker(botId);
  const { orderBook } = useOrderBook('SOL/USD');

  useEffect(() => {
    if (!marketData || !orderBook) return;

    const analysisInterval = setInterval(() => {
      try {
        setIsAnalyzing(true);

        const calculateSpreadMetrics = () => {
          const currentSpread = marketData.orderbook.spread;
          const historicalSpreads = makerMetrics?.spread_history || [];
          
          return {
            current: currentSpread,
            average: historicalSpreads.reduce((sum, s) => sum + s, 0) / 
                    Math.max(1, historicalSpreads.length),
            min: Math.min(...historicalSpreads, currentSpread),
            max: Math.max(...historicalSpreads, currentSpread),
            trend: currentSpread > historicalSpreads[0] ? 'widening' :
                  currentSpread < historicalSpreads[0] ? 'tightening' : 'stable'
          };
        };

        const calculateDepthMetrics = () => {
          const bidDepth = orderBook.bids.reduce((sum, [_, size]) => sum + size, 0);
          const askDepth = orderBook.asks.reduce((sum, [_, size]) => sum + size, 0);
          const totalDepth = bidDepth + askDepth;

          return {
            bid_depth: bidDepth,
            ask_depth: askDepth,
            total_depth: totalDepth,
            imbalance_ratio: totalDepth === 0 ? 0 : 
                            (bidDepth - askDepth) / totalDepth
          };
        };

        const calculateFlowMetrics = () => {
          const trades = marketData.trades || [];
          const buyVolume = trades
            .filter(t => t.side === 'buy')
            .reduce((sum, t) => sum + t.size, 0);
          const sellVolume = trades
            .filter(t => t.side === 'sell')
            .reduce((sum, t) => sum + t.size, 0);
          const netFlow = buyVolume - sellVolume;

          return {
            buy_volume: buyVolume,
            sell_volume: sellVolume,
            net_flow: netFlow,
            flow_trend: netFlow > 0 ? 'accumulation' :
                       netFlow < 0 ? 'distribution' : 'neutral'
          };
        };

        const calculateActivityMetrics = () => {
          const trades = marketData.trades || [];
          const largeOrderThreshold = 
            trades.reduce((sum, t) => sum + t.size, 0) / trades.length * 3;

          return {
            quote_updates: makerMetrics?.quote_updates || 0,
            trade_count: trades.length,
            average_trade_size: trades.length > 0 ?
              trades.reduce((sum, t) => sum + t.size, 0) / trades.length : 0,
            large_orders: trades.filter(t => t.size > largeOrderThreshold).length
          };
        };

        const generateSignals = () => {
          const newSignals: OrderFlowSignal[] = [];
          const timestamp = new Date().toISOString();

          const depth = calculateDepthMetrics();
          if (Math.abs(depth.imbalance_ratio) > 0.3) {
            newSignals.push({
              id: `flow-${Date.now()}`,
              type: 'pressure',
              side: depth.imbalance_ratio > 0 ? 'buy' : 'sell',
              strength: Math.abs(depth.imbalance_ratio),
              price_level: depth.imbalance_ratio > 0 ?
                orderBook.asks[0]?.[0] || 0 :
                orderBook.bids[0]?.[0] || 0,
              volume: depth.imbalance_ratio > 0 ?
                depth.bid_depth :
                depth.ask_depth,
              timestamp
            });
          }

          const flow = calculateFlowMetrics();
          if (Math.abs(flow.net_flow) > depth.total_depth * 0.1) {
            newSignals.push({
              id: `absorption-${Date.now()}`,
              type: 'absorption',
              side: flow.net_flow > 0 ? 'buy' : 'sell',
              strength: Math.abs(flow.net_flow) / depth.total_depth,
              price_level: marketData.price.current,
              volume: Math.abs(flow.net_flow),
              timestamp
            });
          }

          const activity = calculateActivityMetrics();
          if (activity.large_orders > activity.trade_count * 0.1) {
            newSignals.push({
              id: `manipulation-${Date.now()}`,
              type: 'manipulation',
              side: flow.net_flow > 0 ? 'buy' : 'sell',
              strength: activity.large_orders / activity.trade_count,
              price_level: marketData.price.current,
              volume: activity.average_trade_size * activity.large_orders,
              timestamp
            });
          }

          setSignals(prev => [...newSignals, ...prev].slice(0, 100));
        };

        setMetrics({
          spread: calculateSpreadMetrics(),
          depth: calculateDepthMetrics(),
          flow: calculateFlowMetrics(),
          activity: calculateActivityMetrics()
        });

        generateSignals();
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to analyze market maker data',
          code: 'ANALYSIS_ERROR'
        });
      } finally {
        setIsAnalyzing(false);
      }
    }, 1000);

    return () => clearInterval(analysisInterval);
  }, [marketData, orderBook, makerMetrics]);

  const getSpreadMetrics = () => metrics?.spread || null;

  const getDepthMetrics = () => metrics?.depth || null;

  const getFlowMetrics = () => metrics?.flow || null;

  const getActivityMetrics = () => metrics?.activity || null;

  const getSignalsByType = (type: OrderFlowSignal['type']) =>
    signals.filter(s => s.type === type);

  const getRecentSignals = (limit: number = 10) =>
    signals.slice(0, limit);

  const getMarketMakerSummary = () => {
    if (!metrics) return null;

    return {
      liquidity_state: 
        metrics.depth.total_depth > makerMetrics?.average_depth * 1.2 ? 'high' :
        metrics.depth.total_depth < makerMetrics?.average_depth * 0.8 ? 'low' :
        'normal',
      flow_state:
        Math.abs(metrics.flow.net_flow) > metrics.depth.total_depth * 0.2 ?
          metrics.flow.flow_trend :
          'balanced',
      manipulation_risk:
        metrics.activity.large_orders > metrics.activity.trade_count * 0.2 ? 'high' :
        metrics.activity.large_orders > metrics.activity.trade_count * 0.1 ? 'medium' :
        'low'
    };
  };

  return {
    metrics,
    signals,
    error,
    isAnalyzing,
    getSpreadMetrics,
    getDepthMetrics,
    getFlowMetrics,
    getActivityMetrics,
    getSignalsByType,
    getRecentSignals,
    getMarketMakerSummary
  };
};
