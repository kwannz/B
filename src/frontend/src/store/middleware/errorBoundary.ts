import { StateCreator, StoreMutatorIdentifier } from 'zustand';
import { toast } from '@/components/ui/use-toast';

type ErrorBoundary = <
  T extends unknown,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  f: StateCreator<T, Mps, Mcs>,
  options?: {
    name?: string;
    onError?: (error: unknown) => void;
  }
) => StateCreator<T, Mps, Mcs>;

type ErrorBoundaryImpl = <T extends unknown>(
  f: StateCreator<T, [], []>,
  options?: {
    name?: string;
    onError?: (error: unknown) => void;
  }
) => StateCreator<T, [], []>;

const errorBoundaryImpl: ErrorBoundaryImpl = (f, options = {}) => (set, get, store) => {
  const { name = 'store', onError } = options;
  
  const boundSet: typeof set = (...args) => {
    try {
      const result = set(...args);
      return result;
    } catch (error) {
      console.error(`Error in ${name}:`, error);
      
      // Show toast notification
      toast({
        variant: 'destructive',
        title: 'Operation Failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      });

      // Call custom error handler if provided
      if (onError) {
        onError(error);
      }

      // Re-throw the error to be caught by React Error Boundary
      throw error;
    }
  };

  store.setState = boundSet;

  return f(boundSet, get, store);
};

export const errorBoundary = errorBoundaryImpl as unknown as ErrorBoundary;
