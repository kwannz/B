import { apiClient } from '../api/client';

interface StrategyResponse {
  result: any;
  confidence: number;
  model_used: string;
  fallback_used?: boolean;
  error?: string;
}

interface StrategyOptions {
  preferredModel?: 'deepseek-v3' | 'deepseek-r1';
  minConfidence?: number;
  timeframe?: string;
  riskLevel?: 'low' | 'medium' | 'high';
}

export const generateTradingStrategy = async (
  prompt: string,
  options: StrategyOptions = {}
): Promise<StrategyResponse> => {
  const {
    preferredModel = 'deepseek-v3',
    minConfidence = 0.7,
    timeframe = '1h',
    riskLevel = 'medium'
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

    const { confidence = 0.7, model_used = preferredModel, fallback_used = false } = response.data;

    if (confidence < minConfidence && !fallback_used) {
      throw new Error('Strategy generation confidence below threshold');
    }

    return {
      result: response.data,
      confidence,
      model_used,
      fallback_used
    };
  } catch (error) {
    console.error('Error generating trading strategy:', error);
    throw error;
  }
};
