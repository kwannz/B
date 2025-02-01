'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, Button, Card, Typography, Box } from '@mui/material';
import { ErrorOutline, Refresh } from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';
import { useDebug } from '../contexts/DebugContext';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundaryClass extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // 调用错误处理回调
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });

    // 调用重置回调
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // 如果提供了自定义fallback,则使用它
      if (fallback) {
        return fallback;
      }

      // 默认错误UI
      return (
        <ErrorDisplay
          error={error}
          errorInfo={errorInfo}
          onReset={this.handleReset}
        />
      );
    }

    return children;
  }
}

interface ErrorDisplayProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onReset: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  errorInfo,
  onReset
}) => {
  const { language } = useLanguage();
  const { isDebugMode, log } = useDebug();

  // 记录错误到调试日志
  React.useEffect(() => {
    if (error && isDebugMode) {
      log('error', 'ErrorBoundary', error.message, {
        error,
        errorInfo
      });
    }
  }, [error, errorInfo, isDebugMode, log]);

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        p: 3,
        bgcolor: 'background.default'
      }}
    >
      <Card
        sx={{
          maxWidth: 600,
          width: '100%',
          p: 4,
          textAlign: 'center'
        }}
      >
        <ErrorOutline
          color="error"
          sx={{ fontSize: 64, mb: 2 }}
        />

        <Typography variant="h5" gutterBottom color="error">
          {language === 'zh' ? '出错了!' : 'Something went wrong!'}
        </Typography>

        <Alert severity="error" sx={{ mb: 3 }}>
          {error?.message || (language === 'zh' ? '发生未知错误' : 'An unknown error occurred')}
        </Alert>

        {isDebugMode && errorInfo && (
          <Box
            sx={{
              mt: 2,
              mb: 3,
              p: 2,
              bgcolor: 'grey.100',
              borderRadius: 1,
              overflow: 'auto',
              maxHeight: 200
            }}
          >
            <Typography
              variant="body2"
              component="pre"
              sx={{
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                m: 0
              }}
            >
              {errorInfo.componentStack}
            </Typography>
          </Box>
        )}

        <Button
          variant="contained"
          startIcon={<Refresh />}
          onClick={onReset}
          sx={{ mt: 2 }}
        >
          {language === 'zh' ? '重试' : 'Try Again'}
        </Button>

        {isDebugMode && (
          <Typography
            variant="caption"
            display="block"
            sx={{ mt: 2, color: 'text.secondary' }}
          >
            {language === 'zh'
              ? '错误已记录到调试日志'
              : 'Error has been logged to debug console'}
          </Typography>
        )}
      </Card>
    </Box>
  );
};

// 高阶组件用于包装类组件
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundaryClass {...errorBoundaryProps}>
        <WrappedComponent {...props} />
      </ErrorBoundaryClass>
    );
  };
}

// 用于函数组件的Hook
export function useErrorBoundary() {
  const [hasError, setHasError] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const handleError = (error: Error) => {
    setError(error);
    setHasError(true);
  };

  const reset = () => {
    setError(null);
    setHasError(false);
  };

  return {
    hasError,
    error,
    handleError,
    reset
  };
}

export default ErrorBoundaryClass;
