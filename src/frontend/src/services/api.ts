import axios, { AxiosError, AxiosResponse } from 'axios';
import { collectApiMetrics } from '../utils/metrics';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// 创建axios实例
const axiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 重试配置
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// 请求拦截器
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    if (!originalRequest) {
      return Promise.reject(error);
    }

    // 添加重试计数
    const retryCount = (originalRequest as any)._retryCount || 0;

    // 如果是网络错误或超时，且未超过最大重试次数，则重试
    if ((error.code === 'ECONNABORTED' || !error.response) && retryCount < MAX_RETRIES) {
      (originalRequest as any)._retryCount = retryCount + 1;
      
      return new Promise((resolve) => {
        setTimeout(() => {
          console.log(`Retrying request (${retryCount + 1}/${MAX_RETRIES})`);
          resolve(axiosInstance(originalRequest));
        }, RETRY_DELAY * (retryCount + 1));
      });
    }

    // 如果是401错误，尝试刷新token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axiosInstance.post('/auth/refresh', { refreshToken });
        const { token } = response.data;
        localStorage.setItem('token', token);
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // token刷新失败，清除登录状态
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// API错误处理
class APIError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// 请求包装函数
const request = async <T>(
  method: string,
  url: string,
  data?: any,
  config?: any
): Promise<AxiosResponse<T>> => {
  try {
    const response = await axiosInstance({
      method,
      url,
      data,
      ...config,
    });
    return response;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new APIError(
        error.response.status,
        error.response.data.code || 'UNKNOWN_ERROR',
        error.response.data.message || '请求失败',
        error.response.data
      );
    }
    throw error;
  }
};

// API方法
export const api = {
  // 账户相关
  async getAccountBalance() {
    return request<any>('GET', '/account/balance');
  },

  async getPositions() {
    return request<any>('GET', '/account/positions');
  },

  async getRecentOrders() {
    return request<any>('GET', '/account/orders');
  },

  async getPerformance() {
    return request<any>('GET', '/account/performance');
  },

  async closePosition(symbol: string) {
    return request<any>('POST', '/trading/close-position', { symbol });
  },

  async cancelOrder(orderId: string) {
    return request<any>('POST', '/trading/cancel-order', { orderId });
  },

  // 设置相关
  async updateAdvancedSettings(settings: any) {
    return request<any>('POST', '/settings/advanced', settings);
  },

  async updateTradingStrategy(strategy: any) {
    return request<any>('POST', '/settings/strategy', strategy);
  },

  async updateRiskLimits(limits: any) {
    return request<any>('POST', '/settings/risk-limits', limits);
  },

  // 健康检查
  async checkHealth() {
    return request<any>('GET', '/health');
  },
};

// 导出类型
export type { APIError };
export default api; 