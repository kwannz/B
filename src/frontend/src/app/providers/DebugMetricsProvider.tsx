import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useDebug } from '../contexts/DebugContext';
import { useMetricsStore } from '../hooks/useMetricsStore';
import { debugService } from '../services/DebugService';
import { DebugMetricsVisualizer } from '../components/DebugMetricsVisualizer';
import { DebugErrorBoundary } from '../components/DebugErrorBoundary';

interface DebugMetricsContextValue {
  exportMetrics: () => void;
  clearMetrics: () => void;
  getMetricsSnapshot: () => any;
}

const DebugMetricsContext = createContext<DebugMetricsContextValue | null>(null);

export const DebugMetricsProvider = ({ children }: { children: ReactNode }) => {
  const { isDebugMode } = useDebug();
  const metrics = useMetricsStore();

  useEffect(() => {
    if (isDebugMode) {
      window.__DEBUG_METRICS__.debug.importMetrics();
      debugService.enableRealTimeDebugging();
    }
    return () => {
      if (isDebugMode) {
        debugService.disableRealTimeDebugging();
      }
    };
  }, [isDebugMode]);

  const value = {
    exportMetrics: () => window.__DEBUG_METRICS__.debug.exportMetrics(),
    clearMetrics: () => window.__DEBUG_METRICS__.debug.clearMetrics(),
    getMetricsSnapshot: () => window.__DEBUG_METRICS__.debug.getMetricsSnapshot()
  };

  return (
    <DebugMetricsContext.Provider value={value}>
      <DebugErrorBoundary>
        {children}
        {isDebugMode && <DebugMetricsVisualizer />}
      </DebugErrorBoundary>
    </DebugMetricsContext.Provider>
  );
};

export const useDebugMetrics = () => {
  const context = useContext(DebugMetricsContext);
  if (!context) {
    throw new Error('useDebugMetrics must be used within a DebugMetricsProvider');
  }
  return context;
};
