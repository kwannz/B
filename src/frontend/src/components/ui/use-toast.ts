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

export const useToast = () => {
  const { toasts, addToast, removeToast } = useToastStore();
  
  const toast = (options: Omit<Toast, 'id'>) => {
    addToast(options);
  };

  toast.success = (message: string, options?: Partial<Omit<Toast, 'id' | 'type'>>) => 
    addToast({ description: message, type: 'success', ...options });
  toast.error = (message: string, options?: Partial<Omit<Toast, 'id' | 'type'>>) => 
    addToast({ description: message, type: 'error', ...options });
  toast.warning = (message: string, options?: Partial<Omit<Toast, 'id' | 'type'>>) => 
    addToast({ description: message, type: 'warning', ...options });

  return { toast, toasts, removeToast };
};
