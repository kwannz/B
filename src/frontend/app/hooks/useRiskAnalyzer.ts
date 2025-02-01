import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useRiskController } from './useRiskController';
import { useRiskMetrics } from './useRiskMetrics';
import { useMarketDataProvider } from './useMarketDataProvider';

interface RiskAnalysis {
  market_risk: {
    volatility_impact: number;
    liquidity_risk: number;
    correlation_risk: number;
    momentum_risk: number;
  };
  position_risk: {
    size_risk: number;
    concentration_risk: number;
    leverage_risk: number;
    margin_risk: number;
  };
  execution_risk: {
    slippage_risk: number;
    timing_risk: number;
    counterparty_risk: number;
    settlement_risk: number;
  };
  systemic_risk: {
    market_stress: number;
    network_congestion: number;
    protocol_risk: number;
    regulatory_risk: number;
  };
}

interface RiskScore {
  total_score: number;
  component_scores: {
    market: number;
    position: number;
    execution: number;
    systemic: number;
  };
  risk_level: 'low' | 'moderate' | 'high' | 'extreme';
  confidence: number;
}

export const useRiskAnalyzer = (botId: string | null) => {
  const [analysis, setAnalysis] = useState<RiskAnalysis | null>(null);
  const [score, setScore] = useState<RiskScore | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { state: controlState } = useRiskController(botId);
  const { assessment: riskMetrics } = useRiskMetrics(botId);
  const { marketContext } = useMarketDataProvider(null, botId);

  useEffect(() => {
    if (!controlState || !riskMetrics || !marketContext) return;

    try {
      setIsAnalyzing(true);

      const calculateMarketRisk = () => ({
        volatility_impact: marketContext.volatility || 0,
        liquidity_risk: 1 / (marketContext.volume.current_24h || 1),
        correlation_risk: Math.abs(marketContext.technical.correlation || 0),
        momentum_risk: Math.abs(marketContext.technical.momentum || 0)
      });

      const calculatePositionRisk = () => ({
        size_risk: controlState.metrics.exposure_level,
        concentration_risk: riskMetrics.metrics.exposure.current / riskMetrics.metrics.exposure.threshold,
        leverage_risk: riskMetrics.metrics.volatility.current / riskMetrics.metrics.volatility.threshold,
        margin_risk: 1 - riskMetrics.metrics.liquidity.current / riskMetrics.metrics.liquidity.threshold
      });

      const calculateExecutionRisk = () => ({
        slippage_risk: marketContext.price.spread / marketContext.price.current,
        timing_risk: Math.abs(marketContext.technical.momentum || 0) * controlState.metrics.exposure_level,
        counterparty_risk: 1 - marketContext.volume.current_24h / marketContext.volume.max_24h,
        settlement_risk: marketContext.network.congestion || 0
      });

      const calculateSystemicRisk = () => ({
        market_stress: marketContext.sentiment.fear_index || 0,
        network_congestion: marketContext.network.congestion || 0,
        protocol_risk: marketContext.network.incidents_24h ? 0.5 : 0,
        regulatory_risk: marketContext.sentiment.regulatory_score || 0
      });

      const newAnalysis: RiskAnalysis = {
        market_risk: calculateMarketRisk(),
        position_risk: calculatePositionRisk(),
        execution_risk: calculateExecutionRisk(),
        systemic_risk: calculateSystemicRisk()
      };

      const calculateComponentScore = (risks: Record<string, number>) => {
        return Object.values(risks).reduce((sum, risk) => sum + risk, 0) / Object.keys(risks).length;
      };

      const componentScores = {
        market: calculateComponentScore(newAnalysis.market_risk),
        position: calculateComponentScore(newAnalysis.position_risk),
        execution: calculateComponentScore(newAnalysis.execution_risk),
        systemic: calculateComponentScore(newAnalysis.systemic_risk)
      };

      const totalScore = Object.values(componentScores).reduce((sum, score) => sum + score, 0) / 4;

      const determineRiskLevel = (score: number): RiskScore['risk_level'] => {
        if (score > 0.75) return 'extreme';
        if (score > 0.5) return 'high';
        if (score > 0.25) return 'moderate';
        return 'low';
      };

      const calculateConfidence = () => {
        const dataQuality = marketContext.data_quality || 0.8;
        const marketCoverage = marketContext.coverage || 0.9;
        return (dataQuality + marketCoverage) / 2;
      };

      setAnalysis(newAnalysis);
      setScore({
        total_score: totalScore,
        component_scores: componentScores,
        risk_level: determineRiskLevel(totalScore),
        confidence: calculateConfidence()
      });

      setError(null);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to analyze risk',
        code: 'ANALYSIS_ERROR'
      });
      setAnalysis(null);
      setScore(null);
    } finally {
      setIsAnalyzing(false);
    }
  }, [controlState, riskMetrics, marketContext]);

  return {
    analysis,
    score,
    error,
    isAnalyzing
  };
};
