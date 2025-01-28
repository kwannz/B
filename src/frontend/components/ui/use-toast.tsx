import { useState, useCallback } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastState {
  message: string
  type: ToastType
  duration?: number
}

interface ToastOptions {
  type?: ToastType
  duration?: number
}

const DEFAULT_DURATION = 3000

export function useToast() {
  const [toasts, setToasts] = useState<ToastState[]>([])

  const addToast = useCallback((message: string, options: ToastOptions = {}) => {
    const { type = 'info', duration = DEFAULT_DURATION } = options
    setToasts((prev) => [...prev, { message, type, duration }])
  }, [])

  const removeToast = useCallback((index: number) => {
    setToasts((prev) => prev.filter((_, i) => i !== index))
  }, [])

  return { toasts, addToast, removeToast }
}

export const toast = {
  success: (message: string, options?: Omit<ToastOptions, 'type'>) => {
    const { addToast } = useToast()
    addToast(message, { ...options, type: 'success' })
  },
  error: (message: string, options?: Omit<ToastOptions, 'type'>) => {
    const { addToast } = useToast()
    addToast(message, { ...options, type: 'error' })
  },
  info: (message: string, options?: Omit<ToastOptions, 'type'>) => {
    const { addToast } = useToast()
    addToast(message, { ...options, type: 'info' })
  },
  warning: (message: string, options?: Omit<ToastOptions, 'type'>) => {
    const { addToast } = useToast()
    addToast(message, { ...options, type: 'warning' })
  }
}
