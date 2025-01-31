'use client';

import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Box, Typography, Button, CircularProgress, Paper } from '@mui/material';
import { useRouter } from 'next/navigation';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isRetrying: boolean;
}

class ErrorBoundaryBase extends Component<Props & { router: ReturnType<typeof useRouter> }, State> {
  constructor(props: Props & { router: ReturnType<typeof useRouter> }) {
    super(props);
    this.state = { hasError: false, error: null, isRetrying: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, isRetrying: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, info);
  }

  handleRetry = async (): Promise<void> => {
    this.setState({ isRetrying: true });
    try {
      await new Promise<void>(resolve => setTimeout(resolve, 2000));
      this.props.router.refresh();
      this.setState({ hasError: false, error: null, isRetrying: false });
    } catch (error) {
      this.setState({
        isRetrying: false,
        error: error instanceof Error ? error : new Error(String(error))
      });
    }
  };

  handleHome = async (): Promise<void> => {
    try {
      await this.props.router.push('/');
    } catch (error) {
      console.error('Navigation error:', error);
      window.location.href = '/';
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, isRetrying } = this.state;
    const errorMessage = error?.name === 'NetworkError' 
      ? 'Network error occurred'
      : error?.message || 'An unexpected error occurred';

    return (
      <Paper sx={{ p: 4, m: 2, bgcolor: '#1e1e1e' }} data-testid="error-boundary">
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" color="error" gutterBottom>
            Something went wrong
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }} data-testid="error-message">
            {errorMessage}
          </Typography>
          {error?.stack && (
            <Typography 
              variant="body2" 
              sx={{ mb: 3, color: 'text.secondary', textAlign: 'left', whiteSpace: 'pre-wrap' }}
              data-testid="error-stack"
            >
              {error.stack}
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              variant="contained"
              onClick={this.handleRetry}
              sx={{ mr: 2 }}
              data-testid="error-boundary-retry"
              disabled={isRetrying}
            >
              {isRetrying ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Try Again'
              )}
            </Button>
            <Button
              variant="outlined"
              onClick={this.handleHome}
              data-testid="error-boundary-home"
            >
              Return Home
            </Button>
          </Box>
        </Box>
      </Paper>
    );
  }
}

const ErrorBoundary = (props: Props) => {
  const router = useRouter();
  return <ErrorBoundaryBase {...props} router={router} />;
};

export default ErrorBoundary;
