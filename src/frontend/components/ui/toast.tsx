import React from 'react';

export interface ToastProps {
  id: string;
  title?: string;
  description: string;
  type?: 'default' | 'success' | 'error' | 'warning';
  onClose?: () => void;
}

export function Toast({ title, description, type = 'default', onClose }: ToastProps) {
  return (
    <div className={`toast toast-${type}`}>
      <div className="flex justify-between items-start">
        <div>
          {title && <div className="toast-title">{title}</div>}
          <div className="toast-description">{description}</div>
        </div>
        {onClose && (
          <button onClick={onClose} className="ml-4 text-sm opacity-70 hover:opacity-100">
            ×
          </button>
        )}
      </div>
    </div>
  );
}
