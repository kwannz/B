import { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { useDebugMetrics } from '../hooks/useDebugMetrics';
import { DEBUG_CONFIG } from '../config/debug.config';

export const createDebugMetricsMiddleware = (client: AxiosInstance) => {
  const { addPerformanceMetric } = useDebugMetrics();
  const requestTimes = new Map<string, number>();

  client.interceptors.request.use(
    (config: AxiosRequestConfig) => {
      const requestId = Math.random().toString(36).substring(7);
      requestTimes.set(requestId, performance.now());
      config.headers = {
        ...config.headers,
        'X-Request-ID': requestId,
        'X-Debug-Mode': process.env.NODE_ENV !== 'production' ? 'true' : 'false'
      };
      return config;
    },
    (error: AxiosError) => {
      addPerformanceMetric({
        apiLatency: 0,
        errorRate: 1,
        systemHealth: 0
      });
      return Promise.reject(error);
    }
  );

  client.interceptors.response.use(
    (response: AxiosResponse) => {
      const requestId = response.config.headers?.['X-Request-ID'] as string;
      const startTime = requestTimes.get(requestId);
      if (startTime) {
        const duration = performance.now() - startTime;
        requestTimes.delete(requestId);

        addPerformanceMetric({
          apiLatency: duration,
          errorRate: 0,
          systemHealth: duration < DEBUG_CONFIG.thresholds.system.latency ? 1 : 0.5,
          memoryUsage: performance?.memory?.usedJSHeapSize / performance?.memory?.jsHeapSizeLimit || 0
        });

        if (window.__DEBUG_METRICS__) {
          window.__DEBUG_METRICS__.debug.addApiMetric({
            endpoint: response.config.url,
            method: response.config.method,
            duration,
            status: response.status,
            timestamp: Date.now(),
            headers: {
              'x-response-time': response.headers['x-response-time'],
              'x-cache': response.headers['x-cache'],
              'server-timing': response.headers['server-timing']
            }
          });
        }
      }
      return response;
    },
    (error: AxiosError) => {
      const requestId = error.config?.headers?.['X-Request-ID'] as string;
      const startTime = requestTimes.get(requestId);
      if (startTime) {
        const duration = performance.now() - startTime;
        requestTimes.delete(requestId);

        addPerformanceMetric({
          apiLatency: duration,
          errorRate: 1,
          systemHealth: 0,
          memoryUsage: performance?.memory?.usedJSHeapSize / performance?.memory?.jsHeapSizeLimit || 0
        });

        if (window.__DEBUG_METRICS__) {
          window.__DEBUG_METRICS__.debug.addApiMetric({
            endpoint: error.config?.url,
            method: error.config?.method,
            duration,
            status: error.response?.status || 0,
            error: error.message,
            timestamp: Date.now(),
            stack: error.stack
          });
        }
      }
      return Promise.reject(error);
    }
  );

  return client;
};

export const applyDebugMetricsMiddleware = (client: AxiosInstance) => {
  if (process.env.NODE_ENV !== 'production') {
    return createDebugMetricsMiddleware(client);
  }
  return client;
};
