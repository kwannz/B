'use client';

import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { useDebug } from '../contexts/DebugContext';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export default class DebugErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // 获取DebugContext并记录错误
    const debugContext = (window as any).__DEBUG_CONTEXT__;
    if (debugContext?.log) {
      debugContext.log('error', 'System', '组件错误', {
        error: error.toString(),
        stack: error.stack,
        componentStack: errorInfo.componentStack
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Paper 
          elevation={3}
          sx={{
            p: 3,
            m: 2,
            backgroundColor: 'error.light',
            color: 'error.contrastText'
          }}
        >
          <Typography variant="h6" gutterBottom>
            组件错误
          </Typography>
          <Typography variant="body1" gutterBottom>
            {this.state.error?.message}
          </Typography>
          {this.state.errorInfo && (
            <Box 
              component="pre"
              sx={{
                mt: 2,
                p: 2,
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                borderRadius: 1,
                overflow: 'auto',
                maxHeight: '200px',
                fontSize: '0.875rem'
              }}
            >
              {this.state.errorInfo.componentStack}
            </Box>
          )}
          <Button
            variant="contained"
            color="inherit"
            sx={{ mt: 2 }}
            onClick={() => window.location.reload()}
          >
            刷新页面
          </Button>
        </Paper>
      );
    }

    return this.props.children;
  }
}

// 包装器组件以访问DebugContext
export function DebugErrorBoundaryWrapper({ children }: { children: React.ReactNode }) {
  const debug = useDebug();

  // 将debug context存储在window对象中供ErrorBoundary使用
  React.useEffect(() => {
    (window as any).__DEBUG_CONTEXT__ = debug;
    return () => {
      delete (window as any).__DEBUG_CONTEXT__;
    };
  }, [debug]);

  return <DebugErrorBoundary>{children}</DebugErrorBoundary>;
}
