import { useToast } from '../components/ui/use-toast';

interface ErrorOptions {
  title?: string;
  fallbackMessage?: string;
  onRetry?: () => void;
}

export const useErrorHandler = () => {
  const { toast } = useToast();

  const handleError = (error: Error | string, options?: ErrorOptions) => {
    const message = error instanceof Error ? error.message : error;
    toast.error(message);
    
    if (options?.onRetry) {
      setTimeout(options.onRetry, 3000);
    }
  };

  return { handleError };
};
