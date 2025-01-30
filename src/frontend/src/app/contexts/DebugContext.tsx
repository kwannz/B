import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useDebugger } from '../hooks/useDebugger';
import { useMetricsConfiguration } from '../hooks/useMetricsConfiguration';

interface DebugContextValue {
  isDebugMode: boolean;
  toggleDebugMode: () => void;
  debugLogs: Array<{
    timestamp: string;
    level: 'debug' | 'info' | 'warn' | 'error';
    category: 'system' | 'market' | 'trading' | 'wallet';
    message: string;
    data: Record<string, any>;
  }>;
  addDebugLog: (log: Omit<DebugContextValue['debugLogs'][0], 'timestamp'>) => void;
  clearDebugLogs: () => void;
  exportDebugLogs: (format: 'json' | 'csv') => string;
  debugSummary: {
    total_logs: number;
    error_count: number;
    warning_count: number;
    issues_by_category: Record<string, number>;
    latest_error?: DebugContextValue['debugLogs'][0];
    latest_warning?: DebugContextValue['debugLogs'][0];
  };
}

const DebugContext = createContext<DebugContextValue | null>(null);

export const DebugProvider = ({ children }: { children: ReactNode }) => {
  const [isDebugMode, setIsDebugMode] = useState(false);
  const config = useMetricsConfiguration();

  const debug = useDebugger({
    enabled: isDebugMode,
    log_level: 'debug',
    retention_period: 24 * 60 * 60 * 1000,
    update_interval: 5000,
    thresholds: config.config.thresholds
  });

  const toggleDebugMode = () => {
    setIsDebugMode(prev => {
      if (!prev) {
        debug.clearLogs();
      }
      return !prev;
    });
  };

  const contextValue: DebugContextValue = {
    isDebugMode,
    toggleDebugMode,
    debugLogs: debug.logs,
    addDebugLog: debug.addLog,
    clearDebugLogs: debug.clearLogs,
    exportDebugLogs: debug.exportLogs,
    debugSummary: debug.getSummary()
  };

  return (
    <DebugContext.Provider value={contextValue}>
      {children}
    </DebugContext.Provider>
  );
};

export const useDebug = () => {
  const context = useContext(DebugContext);
  if (!context) {
    throw new Error('useDebug must be used within a DebugProvider');
  }
  return context;
};
