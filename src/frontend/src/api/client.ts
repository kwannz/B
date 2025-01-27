import axios, { AxiosInstance, AxiosError } from 'axios';

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface SignupData {
  email: string;
  username: string;
  password: string;
}

export interface LoginData {
  username: string;
  password: string;
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

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/v1`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include JWT token
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
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
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth Management
  async signup(data: SignupData): Promise<ApiResponse<AuthResponse>> {
    try {
      const formData = new FormData();
      formData.append('email', data.email);
      formData.append('username', data.username);
      formData.append('password', data.password);
      
      const response = await this.client.post('/auth/signup', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      
      if (response.data.access_token) {
        localStorage.setItem('access_token', response.data.access_token);
      }
      return { data: response.data, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  async login(data: LoginData): Promise<ApiResponse<AuthResponse>> {
    try {
      // Create URLSearchParams for x-www-form-urlencoded format
      const formData = new URLSearchParams();
      formData.append('username', data.username);
      formData.append('password', data.password);
      formData.append('grant_type', 'password');
      
      const response = await this.client.post('/auth/login', formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      
      if (response.data.access_token) {
        localStorage.setItem('access_token', response.data.access_token);
      }
      return { data: response.data, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  async logout(): Promise<void> {
    localStorage.removeItem('access_token');
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
  }): Promise<ApiResponse<StrategyResponse>> {
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
