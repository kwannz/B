import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { Box, Typography, IconButton, Theme } from '@mui/material';
import { SxProps } from '@mui/system';
import CloseIcon from '@mui/icons-material/Close';
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
        {isDebugMode && (
          <Box 
            sx={{
              position: 'fixed',
              bottom: 16,
              right: 16,
              zIndex: 1000,
              maxWidth: '400px',
              maxHeight: '80vh',
              overflow: 'auto',
              backgroundColor: 'background.paper',
              borderRadius: 1,
              boxShadow: 3,
              p: 2
            } as SxProps<Theme>}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Debug Metrics</Typography>
              <IconButton size="small" onClick={() => window.__DEBUG_METRICS__.debug.clearMetrics()}>
                <CloseIcon />
              </IconButton>
            </Box>
            <DebugMetricsVisualizer />
          </Box>
        )}
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
