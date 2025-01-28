import { useCallback } from 'react';
import { toast } from '../components/ui/use-toast';

interface ErrorOptions {
  title?: string;
  fallbackMessage?: string;
  shouldRetry?: boolean;
  retryCount?: number;
  onRetry?: () => Promise<void>;
  shouldRethrow?: boolean;
}

export const useErrorHandler = () => {
  const handleError = useCallback(async (error: unknown, options: ErrorOptions = {}) => {
    const {
      title = 'Error',
      fallbackMessage = 'An unexpected error occurred',
      shouldRetry = false,
      retryCount = 3,
      onRetry,
      shouldRethrow = false,
    } = options;

    const errorMessage = error instanceof Error ? error.message : fallbackMessage;

    // Log error for debugging
    console.error('[Error Handler]:', {
      error,
      title,
      message: errorMessage,
      retryCount,
    });

    // If retry is enabled and we have a retry function
    if (shouldRetry && onRetry && retryCount > 0) {
      toast({
        variant: 'destructive',
        title,
        description: `${errorMessage}. Retrying... (${retryCount} attempts left)`,
        action: {
          label: 'Cancel',
          onClick: () => {
            console.log('Retry cancelled by user');
          },
        },
      });

      try {
        await onRetry();
        toast({
          title: 'Success',
          description: 'Operation completed successfully after retry',
        });
      } catch (retryError) {
        // If we still have retries left, try again with decremented count
        if (retryCount > 1) {
          await handleError(retryError, {
            ...options,
            retryCount: retryCount - 1,
          });
        } else {
          // No more retries, show final error
          toast({
            variant: 'destructive',
            title,
            description: `${errorMessage}. All retry attempts failed.`,
          });
        }
      }
    } else {
      // No retry requested or available, just show the error
      toast({
        variant: 'destructive',
        title,
        description: errorMessage,
      });
    }

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
      const handler = useErrorHandler();
      await handler.handleError(error, options);
      return Promise.reject(error);
    }
  };
};
