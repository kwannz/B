// 性能指标类型
interface PerformanceMetrics {
  requestTime: number;
  responseTime: number;
  totalTime: number;
  status: number;
  endpoint: string;
  method: string;
}

// 存储指标的队列
const metricsQueue: PerformanceMetrics[] = [];
const MAX_QUEUE_SIZE = 100;

// 收集API请求指标
export const collectApiMetrics = async <T>(
  method: string,
  endpoint: string,
  requestFn: () => Promise<T>
): Promise<T> => {
  const startTime = performance.now();
  let requestEndTime = startTime;
  let status = 200;

  try {
    const response = await requestFn();
    requestEndTime = performance.now();
    status = (response as any).status || 200;
    return response;
  } catch (error) {
    requestEndTime = performance.now();
    status = (error as any).status || 500;
    throw error;
  } finally {
    const metrics: PerformanceMetrics = {
      requestTime: startTime,
      responseTime: requestEndTime,
      totalTime: requestEndTime - startTime,
      status,
      endpoint,
      method,
    };
    
    addMetricsToQueue(metrics);
    reportMetricsIfNeeded();
  }
};

// 添加指标到队列
const addMetricsToQueue = (metrics: PerformanceMetrics) => {
  metricsQueue.push(metrics);
  if (metricsQueue.length > MAX_QUEUE_SIZE) {
    metricsQueue.shift();
  }
};

// 上报指标
const reportMetricsIfNeeded = () => {
  if (metricsQueue.length >= MAX_QUEUE_SIZE / 2) {
    const metrics = [...metricsQueue];
    metricsQueue.length = 0;
    
    // 计算聚合指标
    const aggregatedMetrics = aggregateMetrics(metrics);
    
    // 上报到监控系统
    reportToMonitoring(aggregatedMetrics);
  }
};

// 聚合指标
const aggregateMetrics = (metrics: PerformanceMetrics[]) => {
  const endpointMetrics = new Map<string, {
    count: number;
    totalTime: number;
    errorCount: number;
    slowCount: number;
  }>();

  const SLOW_THRESHOLD = 1000; // 1秒

  metrics.forEach(metric => {
    const key = `${metric.method} ${metric.endpoint}`;
    const current = endpointMetrics.get(key) || {
      count: 0,
      totalTime: 0,
      errorCount: 0,
      slowCount: 0,
    };

    current.count++;
    current.totalTime += metric.totalTime;
    
    if (metric.status >= 400) {
      current.errorCount++;
    }
    
    if (metric.totalTime > SLOW_THRESHOLD) {
      current.slowCount++;
    }

    endpointMetrics.set(key, current);
  });

  return Array.from(endpointMetrics.entries()).map(([endpoint, stats]) => ({
    endpoint,
    averageTime: stats.totalTime / stats.count,
    requestCount: stats.count,
    errorRate: stats.errorCount / stats.count,
    slowRate: stats.slowCount / stats.count,
  }));
};

// 上报到监控系统
const reportToMonitoring = async (metrics: any) => {
  try {
    // 这里可以替换为实际的监控系统API
    if (process.env.NODE_ENV === 'development') {
      console.log('Performance Metrics:', metrics);
    } else {
      await fetch('/monitoring/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metrics),
      });
    }
  } catch (error) {
    console.error('Failed to report metrics:', error);
  }
};

// 性能监控
export const monitorComponentPerformance = (componentName: string) => {
  const startTime = performance.now();
  
  return {
    end: () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`Component ${componentName} render time: ${renderTime}ms`);
      }
      
      // 如果渲染时间过长，记录警告
      if (renderTime > 100) {
        console.warn(`Slow render detected in ${componentName}: ${renderTime}ms`);
      }
      
      return renderTime;
    }
  };
};

// 内存使用监控
export const monitorMemoryUsage = () => {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
    };
  }
  return null;
};

// 网络状态监控
export const monitorNetworkStatus = () => {
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    return {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
    };
  }
  return null;
};

// 导出监控工具
export const monitoring = {
  collectApiMetrics,
  monitorComponentPerformance,
  monitorMemoryUsage,
  monitorNetworkStatus,
}; 