import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useToast } from './ui/use-toast';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    
    const { toast } = useToast(); toast({
      variant: 'destructive',
      title: 'Application Error',
      description: 'An unexpected error occurred. Please try refreshing the page.',
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-4 text-center">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-muted-foreground">
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <button
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
