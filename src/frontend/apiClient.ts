import axios, { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

interface ApiError {
  status?: number;
  message: string;
}

interface ErrorResponseData {
  message?: string;
}

const apiClient = axios.create({
  baseURL: process.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add auth token if available
    const token = localStorage.getItem('authToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: unknown) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response.data,
  (error: AxiosError) => {
    if (error.response) {
      // Handle different error statuses
      const { status, data } = error.response;
      const responseData = data as ErrorResponseData;
      const errorMessage = responseData?.message || 'An error occurred';

      if (status === 401) {
        // Handle unauthorized
        localStorage.removeItem('authToken');
        window.location.href = '/login';
      }

      return Promise.reject({
        status,
        message: errorMessage,
      });
    }
    return Promise.reject(error);
  }
);

export default apiClient;
