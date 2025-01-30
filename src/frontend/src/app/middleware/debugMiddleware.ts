import { ApiError } from '../api/client';
import { useDebugStore } from '../stores/debugStore';

export const debugMiddleware = () => {
  const debugStore = useDebugStore.getState();

  return async (config: any) => {
    if (!debugStore.isEnabled) return config;

    const requestData = {
      url: config.url,
      method: config.method,
      headers: config.headers,
      data: config.data
    };

    debugStore.addLog({
      level: 'debug',
      category: 'system',
      message: `API Request: ${config.method} ${config.url}`,
      data: requestData
    });

    const handleResponse = (response: any) => {
      debugStore.addLog({
        level: 'debug',
        category: 'system',
        message: `API Response: ${response.status} ${config.method} ${config.url}`,
        data: {
          status: response.status,
          statusText: response.statusText,
          data: response.data,
          headers: response.headers
        }
      });
      return response;
    };

    const handleError = (error: any) => {
      const apiError: ApiError = {
        message: error.message,
        code: error.response?.status?.toString() || 'UNKNOWN_ERROR',
        details: error.response?.data
      };

      debugStore.addLog({
        level: 'error',
        category: 'system',
        message: `API Error: ${error.message}`,
        data: {
          error: apiError,
          request: requestData,
          response: error.response?.data
        }
      });

      throw error;
    };

    try {
      const response = await config;
      return handleResponse(response);
    } catch (error) {
      return handleError(error);
    }
  };
};

export const setupDebugMiddleware = (axiosInstance: any) => {
  axiosInstance.interceptors.request.use(debugMiddleware());
  axiosInstance.interceptors.response.use(
    (response: any) => response,
    (error: any) => Promise.reject(error)
  );
};
