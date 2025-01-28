import * as React from 'react'
import { useToast } from './use-toast'

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toasts } = useToast()
  
  return (
    <div>
      {children}
      <div className="toast-viewport">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.title && <div className="toast-title">{toast.title}</div>}
            <div className="toast-description">{toast.description}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
