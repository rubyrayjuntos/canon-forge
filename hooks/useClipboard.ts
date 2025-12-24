import { useState, useCallback } from 'react';
import { copyToClipboard } from '../utils/helpers';
import { ToastType } from '../types';

interface ToastState {
  message: string;
  type: ToastType;
  visible: boolean;
}

/**
 * Custom hook for handling clipboard operations with toast notifications
 * @returns Object with handleCopyToClipboard function and toast state
 */
export function useClipboard() {
  const [toastState, setToastState] = useState<ToastState>({
    message: '',
    type: 'success',
    visible: false,
  });

  const handleCopyToClipboard = useCallback(async (text: string) => {
    try {
      await copyToClipboard(text);
      setToastState({ message: 'Copied to clipboard', type: 'success', visible: true });
    } catch {
      setToastState({ message: 'Failed to copy to clipboard', type: 'error', visible: true });
    }
  }, []);

  const hideToast = useCallback(() => {
    setToastState((prev) => ({ ...prev, visible: false }));
  }, []);

  return {
    handleCopyToClipboard,
    toastState,
    hideToast,
  };
}
