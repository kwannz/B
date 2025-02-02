import React, { useState, useEffect } from 'react';
import { diagnostics } from '../../utils/diagnostics';
import { monitoring } from '../../utils/metrics';
import './styles.css';

interface DebugPanelProps {
  visible: boolean;
  onClose: () => void;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ visible, onClose }) => {
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [diagnosticResults, setDiagnosticResults] = useState<any[]>([]);
  const [perfIssues, setPerfIssues] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'health' | 'diagnostics' | 'performance'>('health');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      refreshData();
    }
  }, [visible]);

  const refreshData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [health, diagnostics, perf] = await Promise.all([
        diagnostics.checkSystemHealth(),
        diagnostics.runDiagnostics(),
        diagnostics.analyzePerfIssues()
      ]);

      setHealthStatus(health);
      setDiagnosticResults(diagnostics);
      setPerfIssues(perf);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载调试信息失败');
    } finally {
      setIsLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="debug-panel">
      <div className="debug-panel-header">
        <h2>调试面板</h2>
        <div className="debug-panel-actions">
          <button onClick={refreshData} disabled={isLoading}>
            刷新
          </button>
          <button onClick={onClose}>关闭</button>
        </div>
      </div>

      {error && (
        <div className="debug-panel-error">
          {error}
        </div>
      )}

      <div className="debug-panel-tabs">
        <button
          className={activeTab === 'health' ? 'active' : ''}
          onClick={() => setActiveTab('health')}
        >
          系统健康
        </button>
        <button
          className={activeTab === 'diagnostics' ? 'active' : ''}
          onClick={() => setActiveTab('diagnostics')}
        >
          诊断结果
        </button>
        <button
          className={activeTab === 'performance' ? 'active' : ''}
          onClick={() => setActiveTab('performance')}
        >
          性能分析
        </button>
      </div>

      <div className="debug-panel-content">
        {isLoading ? (
          <div className="debug-panel-loading">加载中...</div>
        ) : (
          <>
            {activeTab === 'health' && healthStatus && (
              <div className="health-status">
                <h3>系统状态</h3>
                <div className="status-grid">
                  <div className={`status-item ${healthStatus.api ? 'good' : 'error'}`}>
                    <span>API服务</span>
                    <span>{healthStatus.api ? '正常' : '异常'}</span>
                  </div>
                  <div className={`status-item ${healthStatus.websocket ? 'good' : 'error'}`}>
                    <span>WebSocket</span>
                    <span>{healthStatus.websocket ? '已连接' : '未连接'}</span>
                  </div>
                  <div className={`status-item ${healthStatus.memory.status}`}>
                    <span>内存使用</span>
                    <span>{(healthStatus.memory.usage * 100).toFixed(1)}%</span>
                  </div>
                  <div className={`status-item ${healthStatus.network.status}`}>
                    <span>网络延迟</span>
                    <span>{healthStatus.network.latency.toFixed(0)}ms</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'diagnostics' && (
              <div className="diagnostic-results">
                <h3>诊断结果</h3>
                {diagnosticResults.map((result, index) => (
                  <div 
                    key={index}
                    className={`diagnostic-item ${result.status}`}
                  >
                    <div className="diagnostic-header">
                      <span>{result.message}</span>
                      <span className="diagnostic-time">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {result.details && (
                      <pre className="diagnostic-details">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'performance' && (
              <div className="performance-issues">
                <h3>性能问题</h3>
                <div className="performance-metrics">
                  <h4>内存使用</h4>
                  {(() => {
                    const memoryInfo = monitoring.monitorMemoryUsage();
                    return memoryInfo ? (
                      <div className="metrics-grid">
                        <div className="metric-item">
                          <span>已用堆内存</span>
                          <span>{(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(1)} MB</span>
                        </div>
                        <div className="metric-item">
                          <span>总堆内存</span>
                          <span>{(memoryInfo.totalJSHeapSize / 1024 / 1024).toFixed(1)} MB</span>
                        </div>
                        <div className="metric-item">
                          <span>堆内存限制</span>
                          <span>{(memoryInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(1)} MB</span>
                        </div>
                      </div>
                    ) : (
                      <p>无法获取内存信息</p>
                    );
                  })()}

                  <h4>网络状态</h4>
                  {(() => {
                    const networkInfo = monitoring.monitorNetworkStatus();
                    return networkInfo ? (
                      <div className="metrics-grid">
                        <div className="metric-item">
                          <span>连接类型</span>
                          <span>{networkInfo.effectiveType}</span>
                        </div>
                        <div className="metric-item">
                          <span>下行速度</span>
                          <span>{networkInfo.downlink} Mbps</span>
                        </div>
                        <div className="metric-item">
                          <span>往返时延</span>
                          <span>{networkInfo.rtt} ms</span>
                        </div>
                      </div>
                    ) : (
                      <p>无法获取网络信息</p>
                    );
                  })()}

                  <h4>性能问题</h4>
                  {perfIssues.length > 0 ? (
                    <div className="perf-issues-list">
                      {perfIssues.map((issue, index) => (
                        <div key={index} className={`perf-issue ${issue.status}`}>
                          <span>{issue.message}</span>
                          {issue.details && (
                            <pre className="issue-details">
                              {JSON.stringify(issue.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-issues">未发现性能问题</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DebugPanel; 