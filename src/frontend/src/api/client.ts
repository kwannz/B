import axios, { AxiosInstance, AxiosError } from 'axios';
import { PublicKey } from '@solana/web3.js';

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

export interface AuthResponse {
  token: string;
  walletAddress: string;
}

export interface WalletAuthData {
  walletAddress: string;
  signature: string;
  message: string;
}

export interface AgentResponse {
  id: string;
  type: 'trading' | 'defi';
  status: 'running' | 'stopped' | 'error';
  lastUpdated: string;
}

export interface StrategyResponse {
  id: string;
  name: string;
  type: string;
  parameters: Record<string, any>;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface WalletResponse {
  address: string;
  publicKey: string;
  balance: string;
  transactions: Array<{
    hash: string;
    type: string;
    amount: string;
    status: string;
    timestamp: string;
  }>;
}

const WALLET_ADDRESS_KEY = 'wallet_address';
const AUTH_TOKEN_KEY = 'auth_token';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${process.env.VITE_API_URL || 'http://localhost:8000'}/api/v1`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Handle unauthorized access
          localStorage.removeItem(AUTH_TOKEN_KEY);
          localStorage.removeItem(WALLET_ADDRESS_KEY);
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Wallet Authentication
  async getAuthMessage(publicKey: PublicKey): Promise<ApiResponse<string>> {
    try {
      const response = await this.client.post('/auth/message', {
        wallet_address: publicKey.toString(),
      });
      return { data: response.data.message, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  async verifyWallet(data: WalletAuthData): Promise<ApiResponse<AuthResponse>> {
    try {
      const response = await this.client.post('/auth/verify', {
        wallet_address: data.walletAddress,
        signature: data.signature,
        message: data.message,
      });
      
      if (response.data.token) {
        localStorage.setItem(AUTH_TOKEN_KEY, response.data.token);
        localStorage.setItem(WALLET_ADDRESS_KEY, data.walletAddress);
      }
      return { data: response.data, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  async disconnectWallet(): Promise<void> {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(WALLET_ADDRESS_KEY);
    await this.client.post('/auth/disconnect');
  }

  // Agent Management
  async getAgentStatus(agentType: string): Promise<ApiResponse<AgentResponse>> {
    try {
      const response = await this.client.get(`/agents/${agentType}/status`);
      return { data: response.data, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  async startAgent(agentType: string): Promise<ApiResponse<void>> {
    try {
      await this.client.post(`/agents/${agentType}/start`);
      return { success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  async stopAgent(agentType: string): Promise<ApiResponse<void>> {
    try {
      await this.client.post(`/agents/${agentType}/stop`);
      return { success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  // Strategy Management
  async createStrategy(strategy: {
    name: string;
    promotion_words: string;
    timeframe: string;
    risk_level: string;
    description: string;
    preferred_model?: 'deepseek-v3' | 'deepseek-r1';
    min_confidence?: number;
  }): Promise<ApiResponse<StrategyResponse & {
    confidence?: number;
    model_used?: string;
    fallback_used?: boolean;
  }>> {
    try {
      const response = await this.client.post('/strategies/trading/create', strategy);
      return { data: response.data, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  async getStrategies(): Promise<ApiResponse<StrategyResponse[]>> {
    try {
      const response = await this.client.get('/strategies');
      return { data: response.data, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  // Wallet Management
  async createWallet(name: string): Promise<ApiResponse<WalletResponse>> {
    try {
      const response = await this.client.post('/wallet/create', { name });
      return { data: response.data, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  async confirmWallet(walletAddress: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.client.post('/wallet/confirm', { 
        wallet_address: walletAddress, 
        confirmed: true 
      });
      if (response.data?.success === false) {
        return { error: response.data.error || 'Confirmation failed', success: false };
      }
      return { success: true };
    } catch (error) {
      const errorMessage = this.handleError(error);
      return { error: typeof errorMessage === 'string' ? errorMessage : 'Confirmation failed', success: false };
    }
  }

  async getWalletBalance(walletAddress: string): Promise<ApiResponse<string>> {
    try {
      const response = await this.client.get(`/wallet/balance/${walletAddress}`);
      return { data: response.data.balance, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  async getWalletTransactions(walletAddress: string): Promise<ApiResponse<WalletResponse['transactions']>> {
    try {
      const response = await this.client.get(`/wallet/transactions/${walletAddress}`);
      return { data: response.data, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  private handleError(error: any): string {
    if (error.response?.data?.detail) {
      return error.response.data.detail;
    }
    if (error.message) {
      return error.message;
    }
    return 'An unexpected error occurred';
  }
}

export const apiClient = new ApiClient();
export default apiClient;
