import React from 'react';
import { Toast } from '../hooks/useToast';

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const TOAST_STYLES: Record<Toast['type'], string> = {
  success: 'bg-slate-900 border-green-500/50 text-green-300',
  error: 'bg-slate-900 border-red-500/50 text-red-300',
  info: 'bg-slate-900 border-indigo-500/50 text-slate-200',
};

const TOAST_ICONS: Record<Toast['type'], string> = {
  success: 'fa-circle-check text-green-500',
  error: 'fa-circle-exclamation text-red-500',
  info: 'fa-circle-info text-indigo-400',
};

/**
 * Renders a stack of toast notifications anchored to the bottom-right corner.
 */
const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-10 right-6 z-[200] flex flex-col gap-2"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          role="alert"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium animate-in slide-in-from-right-4 ${TOAST_STYLES[toast.type]}`}
        >
          <i className={`fas ${TOAST_ICONS[toast.type]}`} aria-hidden="true"></i>
          <span>{toast.message}</span>
          <button
            onClick={() => onRemove(toast.id)}
            className="ml-2 opacity-50 hover:opacity-100 transition-opacity"
            aria-label="Dismiss notification"
          >
            <i className="fas fa-times" aria-hidden="true"></i>
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
