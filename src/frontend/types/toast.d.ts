import { ToastActionElement } from "@/components/ui/toast"

export interface ToastProps {
  id: string;
  title?: string;
  description?: string;
  action?: ToastActionElement;
  type?: 'default' | 'success' | 'error' | 'warning';
}

export interface ToastState extends ToastProps {
  open: boolean;
}
