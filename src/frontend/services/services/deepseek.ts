import { apiClient } from '../api/client';
import type { ApiResponse, StrategyResponse } from '../api/client';

interface StrategyOptions {
  preferredModel?: 'deepseek-v3' | 'deepseek-r1';
  minConfidence?: number;
  timeframe?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  allowFallback?: boolean;
}

type ExtendedStrategyResponse = StrategyResponse & {
  confidence?: number;
  model_used?: string;
  fallback_used?: boolean;
};

export const generateTradingStrategy = async (
  prompt: string,
  options: StrategyOptions = {}
): Promise<ExtendedStrategyResponse> => {
  const {
    preferredModel = 'deepseek-v3',
    minConfidence = 0.7,
    timeframe = '1h',
    riskLevel = 'medium',
    allowFallback = true
  } = options;

  try {
    const response = await apiClient.createStrategy({
      name: `${preferredModel} Strategy`,
      promotion_words: prompt,
      timeframe,
      risk_level: riskLevel,
      description: `AI-generated trading strategy using ${preferredModel}`,
      preferred_model: preferredModel,
      min_confidence: minConfidence
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to generate strategy');
    }

    const { 
      confidence = 0.7, 
      model_used = preferredModel, 
      fallback_used = false
    } = response.data as ExtendedStrategyResponse;

    if (confidence < minConfidence && !fallback_used && !allowFallback) {
      throw new Error('Strategy generation confidence below threshold and fallback disabled');
    }

    return {
      ...response.data,
      confidence,
      model_used,
      fallback_used
    } as ExtendedStrategyResponse;
  } catch (error) {
    console.error('Error generating trading strategy:', error);
    throw error;
  }
};

export const validateStrategyWithModel = async (
  strategy: StrategyResponse,
  options: StrategyOptions = {}
): Promise<ExtendedStrategyResponse> => {
  const {
    preferredModel = 'deepseek-v3',
    minConfidence = 0.7,
    allowFallback = true
  } = options;

  try {
    const response = await apiClient.createStrategy({
      name: 'Strategy Validation',
      promotion_words: JSON.stringify(strategy),
      timeframe: '1h',
      risk_level: 'medium',
      description: 'Validate existing strategy',
      preferred_model: preferredModel,
      min_confidence: minConfidence
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to validate strategy');
    }

    const { 
      confidence = 0.7, 
      model_used = preferredModel, 
      fallback_used = false
    } = response.data as ExtendedStrategyResponse;

    if (confidence < minConfidence && !fallback_used && !allowFallback) {
      throw new Error('Strategy validation confidence below threshold and fallback disabled');
    }

    return {
      ...response.data,
      confidence,
      model_used,
      fallback_used
    } as ExtendedStrategyResponse;
  } catch (error) {
    console.error('Error validating trading strategy:', error);
    throw error;
  }
};
