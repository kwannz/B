import { createContext, useContext, ReactNode } from 'react';
import { useMetricsConfiguration } from '../hooks/useMetricsConfiguration';
import { debugService } from '../services/DebugService';
import { DebugPanel } from '../components/DebugPanel';
import { DebugToolbar } from '../components/DebugToolbar';
import { DebugMetrics } from '../components/DebugMetrics';
import { DebugErrorBoundary } from '../components/DebugErrorBoundary';
import { DebugProvider } from '../contexts/DebugContext';

interface DebugConfigProviderProps {
  children: ReactNode;
}

export const DebugConfigProvider = ({ children }: DebugConfigProviderProps) => {
  const config = useMetricsConfiguration();

  return (
    <DebugProvider>
      <DebugErrorBoundary>
        {process.env.NODE_ENV !== 'production' && (
          <>
            <DebugPanel />
            <DebugToolbar />
            <DebugMetrics />
          </>
        )}
        {children}
      </DebugErrorBoundary>
    </DebugProvider>
  );
};

export const withDebugConfig = (Component: React.ComponentType<any>) => {
  return function WrappedComponent(props: any) {
    return (
      <DebugConfigProvider>
        <Component {...props} />
      </DebugConfigProvider>
    );
  };
};

export const useDebugConfig = () => {
  const context = useContext(DebugProvider);
  if (!context) {
    throw new Error('useDebugConfig must be used within a DebugConfigProvider');
  }
  return context;
};
