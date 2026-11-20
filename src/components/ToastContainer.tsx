import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  detail?: string;
}

const TOAST_STYLES = {
  success: { icon: CheckCircle2, border: 'border-emerald-300', iconColor: 'text-emerald-600' },
  error: { icon: AlertCircle, border: 'border-red-300', iconColor: 'text-red-600' },
  info: { icon: Info, border: 'border-teal-200', iconColor: 'text-accent' },
} as const satisfies Record<ToastMessage['type'], object>;

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const { icon: Icon, border, iconColor } = TOAST_STYLES[toast.type];

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 rounded-[3px] border ${border} bg-surface/95 backdrop-blur px-3.5 py-3 shadow-lg`}
          >
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColor}`} aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink">{toast.title}</p>
              {toast.detail && (
                <p className="text-xs text-muted mt-0.5 break-words">{toast.detail}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="通知を閉じる"
              className="text-subtle hover:text-ink p-0.5 rounded-[2px]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
