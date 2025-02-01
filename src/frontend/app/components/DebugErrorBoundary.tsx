import { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { useDebug } from '../contexts/DebugContext';
import { createErrorEvent } from '../utils/debug';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class DebugErrorBoundary extends Component<Props, State> {
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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error without using hooks in class component
    console.error('Debug Error:', {
      level: 'error',
      category: 'system',
      message: `React Component Error: ${error.message}`,
      data: {
        componentStack: errorInfo.componentStack,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      }
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Paper
          elevation={3}
          sx={{
            p: 3,
            m: 2,
            bgcolor: 'error.light',
            color: 'error.contrastText'
          }}
        >
          <Typography variant="h6" component="h2" gutterBottom>
            Component Error
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
                bgcolor: 'rgba(0, 0, 0, 0.1)',
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
            onClick={this.handleReset}
            sx={{ mt: 2 }}
          >
            Try Again
          </Button>
        </Paper>
      );
    }

    return this.props.children;
  }
}
