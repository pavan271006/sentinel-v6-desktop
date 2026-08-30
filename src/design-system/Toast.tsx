import React from 'react';
import { cn } from './utils';
import { useToastStore, ToastMessage } from '../stores/toastStore';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-severity-low flex-shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-severity-critical flex-shrink-0" />,
    danger: <AlertCircle className="w-4 h-4 text-severity-critical flex-shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-severity-medium flex-shrink-0" />,
    info: <Info className="w-4 h-4 text-severity-info flex-shrink-0" />,
  };

  const borderStyles = {
    success: 'border-l-4 border-l-severity-low',
    error: 'border-l-4 border-l-severity-critical',
    danger: 'border-l-4 border-l-severity-critical',
    warning: 'border-l-4 border-l-severity-medium',
    info: 'border-l-4 border-l-severity-info',
  };

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 p-3 min-w-[280px] max-w-md bg-bg-panel border border-border-strong rounded shadow-modal select-none pointer-events-auto transition-all',
        borderStyles[toast.type]
      )}
    >
      <div className="mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-semibold text-text-primary">{toast.title}</h4>
        {toast.description && (
          <p className="text-xs text-text-secondary mt-0.5 whitespace-pre-wrap break-words">
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-text-muted hover:text-text-primary rounded p-0.5"
        aria-label="Close"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export const ToastProvider: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-8 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </div>
  );
};
