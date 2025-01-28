import { useCallback } from 'react';
import { toast } from '../components/ui/use-toast';

interface ErrorOptions {
  title?: string;
  fallbackMessage?: string;
  shouldRethrow?: boolean;
}

export const useErrorHandler = () => {
  const handleError = useCallback((error: unknown, options: ErrorOptions = {}) => {
    const {
      title = 'Error',
      fallbackMessage = 'An unexpected error occurred',
      shouldRethrow = false,
    } = options;

    const errorMessage = error instanceof Error ? error.message : fallbackMessage;

    // Log error for debugging
    console.error('[Error Handler]:', {
      error,
      title,
      message: errorMessage,
    });

    // Show toast notification
    toast({
      variant: 'destructive',
      title,
      description: errorMessage,
    });

    // Optionally rethrow the error for the caller to handle
    if (shouldRethrow) {
      throw error;
    }
  }, []);

  return {
    handleError,
  };
};

export const withErrorHandler = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: ErrorOptions = {}
) => {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args);
    } catch (error) {
      const {
        title = 'Error',
        fallbackMessage = 'An unexpected error occurred',
        shouldRethrow = false,
      } = options;

      const errorMessage = error instanceof Error ? error.message : fallbackMessage;

      console.error('[Error Handler]:', {
        error,
        title,
        message: errorMessage,
      });

      toast({
        variant: 'destructive',
        title,
        description: errorMessage,
      });

      if (shouldRethrow) {
        throw error;
      }

      return Promise.reject(error);
    }
  };
};
