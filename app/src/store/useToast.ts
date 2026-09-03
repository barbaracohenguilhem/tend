import { useCallback, useEffect, useRef, useState } from 'react';

export interface ToastState { text: string; canUndo: boolean }

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((text: string, canUndo = false) => {
    window.clearTimeout(timer.current);
    setToast({ text, canUndo });
    timer.current = window.setTimeout(() => setToast(null), 3400);
  }, []);
  const hide = useCallback(() => { window.clearTimeout(timer.current); setToast(null); }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { toast, show, hide };
}
