import { modelConfig, debugConfig } from '../config/modelConfig';

interface ModelResponse {
  text: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  metadata: {
    model: string;
    timestamp: number;
    latency: number;
  };
}

interface ModelError {
  code: string;
  message: string;
  details?: any;
}

class ModelService {
  private baseUrl: string;
  private debugMode: boolean;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_OLLAMA_API_URL || 'http://localhost:11434';
    this.debugMode = false;
  }

  setDebugMode(enabled: boolean) {
    this.debugMode = enabled;
  }

  private getParameters() {
    return this.debugMode ? debugConfig.debugParameters : modelConfig.parameters;
  }

  private async handleResponse(response: Response): Promise<ModelResponse> {
    if (!response.ok) {
      const error = await response.json();
      throw {
        code: 'MODEL_API_ERROR',
        message: error.message || '模型API调用失败',
        details: error
      } as ModelError;
    }

    const startTime = Date.now();
    const data = await response.json();
    const latency = Date.now() - startTime;

    return {
      text: data.response,
      usage: {
        prompt_tokens: data.prompt_eval_count || 0,
        completion_tokens: data.eval_count || 0,
        total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
      },
      metadata: {
        model: `${modelConfig.modelId}:${modelConfig.version}`,
        timestamp: Date.now(),
        latency
      }
    };
  }

  async generateText(prompt: string): Promise<ModelResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: `${modelConfig.modelId}:${modelConfig.version}`,
          prompt,
          ...this.getParameters()
        })
      });

      return await this.handleResponse(response);
    } catch (error) {
      if (error instanceof Error) {
        throw {
          code: 'MODEL_REQUEST_ERROR',
          message: error.message,
          details: error
        } as ModelError;
      }
      throw error;
    }
  }

  async getModelInfo(): Promise<{
    name: string;
    version: string;
    parameters: number;
    quantization: string;
    size: number;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/show`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `${modelConfig.modelId}:${modelConfig.version}`
        })
      });

      if (!response.ok) {
        throw new Error('获取模型信息失败');
      }

      const data = await response.json();
      return {
        name: data.model,
        version: data.version || modelConfig.version,
        parameters: data.parameters || 0,
        quantization: data.quantization || 'unknown',
        size: data.size || 0
      };
    } catch (error) {
      throw {
        code: 'MODEL_INFO_ERROR',
        message: error instanceof Error ? error.message : '获取模型信息失败',
        details: error
      } as ModelError;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const modelService = new ModelService();
