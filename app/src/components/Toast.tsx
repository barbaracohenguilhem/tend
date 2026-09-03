import type { ToastState } from '../store/useToast';

export function Toast({ toast, onUndo }: { toast: ToastState | null; onUndo: () => void }) {
  if (!toast) return null;
  return (
    <div className="toast">
      <span className="toast-text">{toast.text}</span>
      {toast.canUndo && <span className="toast-undo" onClick={onUndo}>Undo</span>}
    </div>
  );
}
