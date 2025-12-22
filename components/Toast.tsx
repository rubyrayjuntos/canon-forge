import React from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

/**
 * Toast notification component for user feedback
 */
const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  const bgColor = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-indigo-600';
  const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';

  React.useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, []); // onClose is intentionally excluded to prevent timer reset

  return (
    <div className={`fixed bottom-4 right-4 ${bgColor} text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-2 z-50`}>
      <i className={`fas ${icon}`}></i>
      <span className="font-medium">{message}</span>
      <button
        onClick={onClose}
        className="ml-2 hover:opacity-80 transition-opacity"
        aria-label="Close notification"
      >
        <i className="fas fa-times"></i>
      </button>
    </div>
  );
};

export default Toast;
