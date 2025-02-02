import { api } from '../services/api';
import { monitoring } from './metrics';

// 系统健康状态类型
interface SystemHealth {
  api: boolean;
  websocket: boolean;
  database: boolean;
  cache: boolean;
  memory: {
    status: 'good' | 'warning' | 'critical';
    usage: number;
  };
  network: {
    status: 'good' | 'warning' | 'critical';
    latency: number;
  };
}

// 诊断结果类型
interface DiagnosticResult {
  timestamp: number;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: any;
}

// 系统健康检查
export const checkSystemHealth = async (): Promise<SystemHealth> => {
  const results: SystemHealth = {
    api: false,
    websocket: false,
    database: false,
    cache: false,
    memory: {
      status: 'good',
      usage: 0
    },
    network: {
      status: 'good',
      latency: 0
    }
  };

  try {
    // 检查API健康状态
    const apiStart = performance.now();
    await api.checkHealth();
    const apiLatency = performance.now() - apiStart;
    results.api = true;
    results.network.latency = apiLatency;
    
    // 评估网络状态
    results.network.status = apiLatency < 300 
      ? 'good' 
      : apiLatency < 1000 
        ? 'warning' 
        : 'critical';

    // 检查WebSocket连接
    results.websocket = checkWebSocketConnection();

    // 检查内存使用
    const memoryInfo = monitoring.monitorMemoryUsage();
    if (memoryInfo) {
      const memoryUsage = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;
      results.memory.usage = memoryUsage;
      results.memory.status = memoryUsage < 0.7 
        ? 'good' 
        : memoryUsage < 0.9 
          ? 'warning' 
          : 'critical';
    }

    // 检查网络状态
    const networkInfo = monitoring.monitorNetworkStatus();
    if (networkInfo) {
      results.network.status = networkInfo.effectiveType === '4g' 
        ? 'good' 
        : networkInfo.effectiveType === '3g' 
          ? 'warning' 
          : 'critical';
    }

  } catch (error) {
    console.error('Health check failed:', error);
  }

  return results;
};

// 检查WebSocket连接
const checkWebSocketConnection = (): boolean => {
  // 这里需要替换为实际的WebSocket检查逻辑
  const ws = (window as any).tradingSocket;
  return ws && ws.readyState === WebSocket.OPEN;
};

// 运行诊断
export const runDiagnostics = async (): Promise<DiagnosticResult[]> => {
  const results: DiagnosticResult[] = [];
  const timestamp = Date.now();

  try {
    // 检查系统健康状态
    const health = await checkSystemHealth();
    results.push({
      timestamp,
      status: health.api ? 'success' : 'error',
      message: health.api ? 'API服务正常' : 'API服务异常',
      details: { type: 'api', health }
    });

    // 检查内存使用
    const memoryInfo = monitoring.monitorMemoryUsage();
    if (memoryInfo) {
      const memoryUsage = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;
      results.push({
        timestamp,
        status: memoryUsage < 0.9 ? 'success' : 'warning',
        message: `内存使用率: ${(memoryUsage * 100).toFixed(1)}%`,
        details: { type: 'memory', memoryInfo }
      });
    }

    // 检查网络状态
    const networkInfo = monitoring.monitorNetworkStatus();
    if (networkInfo) {
      results.push({
        timestamp,
        status: networkInfo.effectiveType === '4g' ? 'success' : 'warning',
        message: `网络状态: ${networkInfo.effectiveType}, RTT: ${networkInfo.rtt}ms`,
        details: { type: 'network', networkInfo }
      });
    }

    // 检查浏览器兼容性
    const compatibilityIssues = checkBrowserCompatibility();
    if (compatibilityIssues.length > 0) {
      results.push({
        timestamp,
        status: 'warning',
        message: '发现浏览器兼容性问题',
        details: { type: 'compatibility', issues: compatibilityIssues }
      });
    }

  } catch (error) {
    results.push({
      timestamp,
      status: 'error',
      message: '诊断过程发生错误',
      details: { type: 'error', error }
    });
  }

  return results;
};

// 检查浏览器兼容性
const checkBrowserCompatibility = (): string[] => {
  const issues: string[] = [];

  // 检查必要的API支持
  if (!('WebSocket' in window)) {
    issues.push('浏览器不支持WebSocket');
  }

  if (!('localStorage' in window)) {
    issues.push('浏览器不支持localStorage');
  }

  if (!('Promise' in window)) {
    issues.push('浏览器不支持Promise');
  }

  if (!('fetch' in window)) {
    issues.push('浏览器不支持fetch API');
  }

  return issues;
};

// 性能诊断
export const analyzePerfIssues = () => {
  const issues: DiagnosticResult[] = [];
  const timestamp = Date.now();

  // 分析组件渲染性能
  const slowComponents = (window as any).__SLOW_COMPONENTS__ || [];
  if (slowComponents.length > 0) {
    issues.push({
      timestamp,
      status: 'warning',
      message: '检测到慢组件渲染',
      details: { type: 'performance', components: slowComponents }
    });
  }

  // 分析内存泄漏
  const memoryInfo = monitoring.monitorMemoryUsage();
  if (memoryInfo && memoryInfo.usedJSHeapSize > memoryInfo.jsHeapSizeLimit * 0.9) {
    issues.push({
      timestamp,
      status: 'warning',
      message: '可能存在内存泄漏',
      details: { type: 'memory', memoryInfo }
    });
  }

  return issues;
};

// 导出诊断工具
export const diagnostics = {
  checkSystemHealth,
  runDiagnostics,
  analyzePerfIssues,
}; 