import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useStrategyBacktesting } from './useStrategyBacktesting';
import { useMarketDataAggregation } from './useMarketDataAggregation';
import { useRiskMetrics } from './useRiskMetrics';

interface PerformanceMetrics {
  returns: {
    total_return: number;
    daily_return: number;
    monthly_return: number;
    annualized_return: number;
    risk_adjusted_return: number;
  };
  risk: {
    volatility: number;
    max_drawdown: number;
    var_95: number;
    expected_shortfall: number;
    beta: number;
  };
  ratios: {
    sharpe_ratio: number;
    sortino_ratio: number;
    information_ratio: number;
    calmar_ratio: number;
    profit_factor: number;
  };
  trades: {
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    win_rate: number;
    average_win: number;
    average_loss: number;
    largest_win: number;
    largest_loss: number;
  };
}

interface PerformanceAnalysis {
  metrics: PerformanceMetrics;
  trends: {
    return_trend: 'improving' | 'stable' | 'deteriorating';
    risk_trend: 'increasing' | 'stable' | 'decreasing';
    efficiency_trend: 'improving' | 'stable' | 'deteriorating';
  };
  recommendations: Array<{
    type: 'risk' | 'execution' | 'strategy';
    priority: 'high' | 'medium' | 'low';
    message: string;
    action: string;
  }>;
}

export const useStrategyPerformance = (botId: string | null) => {
  const [analysis, setAnalysis] = useState<PerformanceAnalysis | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { results: backtestResults } = useStrategyBacktesting(botId);
  const { snapshot: marketData } = useMarketDataAggregation({
    symbol: 'SOL/USD',
    update_interval: 5000,
    data_window: 100
  });
  const { metrics: riskMetrics } = useRiskMetrics(botId);

  useEffect(() => {
    if (!botId || !backtestResults || !marketData || !riskMetrics) return;

    const analysisInterval = setInterval(() => {
      try {
        setIsAnalyzing(true);

        const calculateReturns = () => {
          const trades = backtestResults.trades;
          const equityCurve = backtestResults.equity_curve;

          const dailyReturns = equityCurve.map((point, i, arr) => 
            i === 0 ? 0 : (point.equity - arr[i-1].equity) / arr[i-1].equity
          );

          const monthlyReturns = dailyReturns.reduce((acc, ret, i) => {
            const month = Math.floor(i / 30);
            acc[month] = (acc[month] || 1) * (1 + ret);
            return acc;
          }, [] as number[]).map(r => r - 1);

          return {
            total_return: backtestResults.metrics.total_return,
            daily_return: dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length,
            monthly_return: monthlyReturns.reduce((sum, r) => sum + r, 0) / monthlyReturns.length,
            annualized_return: Math.pow(1 + backtestResults.metrics.total_return, 252 / trades.length) - 1,
            risk_adjusted_return: backtestResults.metrics.sharpe_ratio * Math.sqrt(252)
          };
        };

        const calculateRiskMetrics = () => ({
          volatility: riskMetrics.volatility,
          max_drawdown: backtestResults.metrics.max_drawdown,
          var_95: backtestResults.risk_metrics.var_95,
          expected_shortfall: backtestResults.risk_metrics.expected_shortfall,
          beta: backtestResults.risk_metrics.beta
        });

        const calculateRatios = () => ({
          sharpe_ratio: backtestResults.metrics.sharpe_ratio,
          sortino_ratio: riskMetrics.sortino_ratio,
          information_ratio: riskMetrics.information_ratio,
          calmar_ratio: Math.abs(
            backtestResults.metrics.total_return / backtestResults.metrics.max_drawdown
          ),
          profit_factor: backtestResults.metrics.profit_factor
        });

        const calculateTradeMetrics = () => {
          const trades = backtestResults.trades;
          const winningTrades = trades.filter(t => t.pnl > 0);
          const losingTrades = trades.filter(t => t.pnl < 0);

          return {
            total_trades: trades.length,
            winning_trades: winningTrades.length,
            losing_trades: losingTrades.length,
            win_rate: winningTrades.length / trades.length,
            average_win: winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length,
            average_loss: losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length,
            largest_win: Math.max(...trades.map(t => t.pnl)),
            largest_loss: Math.min(...trades.map(t => t.pnl))
          };
        };

        const analyzeTrends = () => {
          const metrics = analysis?.metrics;
          if (!metrics) return null;

          return {
            return_trend: 
              metrics.returns.daily_return > metrics.returns.monthly_return ? 'improving' :
              metrics.returns.daily_return < metrics.returns.monthly_return ? 'deteriorating' :
              'stable',
            risk_trend:
              metrics.risk.volatility > riskMetrics.historical_volatility ? 'increasing' :
              metrics.risk.volatility < riskMetrics.historical_volatility ? 'decreasing' :
              'stable',
            efficiency_trend:
              metrics.ratios.sharpe_ratio > metrics.ratios.information_ratio ? 'improving' :
              metrics.ratios.sharpe_ratio < metrics.ratios.information_ratio ? 'deteriorating' :
              'stable'
          };
        };

        const generateRecommendations = () => {
          const recommendations = [];
          const metrics = analysis?.metrics;
          if (!metrics) return [];

          if (metrics.risk.max_drawdown < -0.2) {
            recommendations.push({
              type: 'risk',
              priority: 'high',
              message: 'High maximum drawdown detected',
              action: 'Consider reducing position sizes or implementing stricter stop-loss rules'
            });
          }

          if (metrics.trades.win_rate < 0.4) {
            recommendations.push({
              type: 'strategy',
              priority: 'high',
              message: 'Low win rate indicates potential strategy issues',
              action: 'Review entry/exit criteria and consider adjusting signal thresholds'
            });
          }

          if (metrics.ratios.sharpe_ratio < 1) {
            recommendations.push({
              type: 'execution',
              priority: 'medium',
              message: 'Poor risk-adjusted returns',
              action: 'Optimize trade execution timing and reduce trading costs'
            });
          }

          return recommendations;
        };

        const newAnalysis: PerformanceAnalysis = {
          metrics: {
            returns: calculateReturns(),
            risk: calculateRiskMetrics(),
            ratios: calculateRatios(),
            trades: calculateTradeMetrics()
          },
          trends: analyzeTrends() || {
            return_trend: 'stable',
            risk_trend: 'stable',
            efficiency_trend: 'stable'
          },
          recommendations: generateRecommendations()
        };

        setAnalysis(newAnalysis);
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to analyze strategy performance',
          code: 'ANALYSIS_ERROR'
        });
      } finally {
        setIsAnalyzing(false);
      }
    }, 60000);

    return () => clearInterval(analysisInterval);
  }, [botId, backtestResults, marketData, riskMetrics, analysis]);

  const getReturnsMetrics = () => analysis?.metrics.returns || null;

  const getRiskMetrics = () => analysis?.metrics.risk || null;

  const getRatioMetrics = () => analysis?.metrics.ratios || null;

  const getTradeMetrics = () => analysis?.metrics.trades || null;

  const getTrends = () => analysis?.trends || null;

  const getRecommendations = () => analysis?.recommendations || [];

  const getPerformanceSummary = () => {
    if (!analysis) return null;

    return {
      overall_performance: 
        analysis.metrics.returns.risk_adjusted_return > 2 ? 'excellent' :
        analysis.metrics.returns.risk_adjusted_return > 1 ? 'good' :
        analysis.metrics.returns.risk_adjusted_return > 0 ? 'fair' : 'poor',
      risk_profile:
        analysis.metrics.risk.volatility < 0.1 ? 'conservative' :
        analysis.metrics.risk.volatility < 0.2 ? 'moderate' : 'aggressive',
      efficiency:
        analysis.metrics.ratios.sharpe_ratio > 2 ? 'highly efficient' :
        analysis.metrics.ratios.sharpe_ratio > 1 ? 'efficient' : 'inefficient'
    };
  };

  return {
    analysis,
    error,
    isAnalyzing,
    getReturnsMetrics,
    getRiskMetrics,
    getRatioMetrics,
    getTradeMetrics,
    getTrends,
    getRecommendations,
    getPerformanceSummary
  };
};
