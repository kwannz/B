import { create } from 'zustand';

export interface Toast {
  id: string;
  title?: string;
  description: string;
  type?: 'default' | 'success' | 'error' | 'warning';
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: Math.random().toString() }],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  action?: React.ReactNode;
  duration?: number;
}

export function toast(options: ToastOptions) {
  const { addToast } = useToastStore.getState();
  addToast({
    title: options.title,
    description: options.description || '',
    type: options.variant === 'destructive' ? 'error' : 'default',
    duration: options.duration || 5000,
  });
}

export type ToastFunction = {
  (options: ToastOptions): void;
  success: (message: string, options?: Omit<ToastOptions, 'variant'>) => void;
  error: (message: string, options?: Omit<ToastOptions, 'variant'>) => void;
  info: (message: string, options?: Omit<ToastOptions, 'variant'>) => void;
  warning: (message: string, options?: Omit<ToastOptions, 'variant'>) => void;
};

export const useToast = () => {
  const { addToast } = useToastStore();
  
  const toastFn = ((options: ToastOptions) => {
    addToast({
      title: options.title,
      description: options.description || '',
      type: options.variant === 'destructive' ? 'error' : 'default',
      duration: options.duration || 5000,
    });
  }) as ToastFunction;

  toastFn.success = (message: string, options?: Omit<ToastOptions, 'variant'>) => 
    addToast({ description: message, type: 'success', ...options });
  toastFn.error = (message: string, options?: Omit<ToastOptions, 'variant'>) => 
    addToast({ description: message, type: 'error', ...options });
  toastFn.info = (message: string, options?: Omit<ToastOptions, 'variant'>) => 
    addToast({ description: message, type: 'default', ...options });
  toastFn.warning = (message: string, options?: Omit<ToastOptions, 'variant'>) => 
    addToast({ description: message, type: 'warning', ...options });

  return {
    toast: toastFn,
    toasts: useToastStore((state) => state.toasts)
  };
}
