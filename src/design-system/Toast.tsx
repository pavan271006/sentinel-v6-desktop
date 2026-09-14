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
    success: 'border-l-4 border-l-accent-green shadow-[0_0_15px_rgba(16,185,129,0.2)]',
    error: 'border-l-4 border-l-severity-critical shadow-[0_0_15px_rgba(244,63,94,0.2)]',
    danger: 'border-l-4 border-l-severity-critical shadow-[0_0_15px_rgba(244,63,94,0.2)]',
    warning: 'border-l-4 border-l-severity-medium shadow-[0_0_15px_rgba(234,179,8,0.2)]',
    info: 'border-l-4 border-l-accent-cyan shadow-[0_0_15px_rgba(0,240,255,0.2)]',
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3.5 min-w-[300px] max-w-md glass-panel bg-bg-panel-elevated/90 border border-border-strong rounded-lg shadow-modal select-none pointer-events-auto transition-all animate-slide-up',
        borderStyles[toast.type]
      )}
    >
      <div className="mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-semibold text-text-primary">{toast.title}</h4>
        {toast.description && (
          <p className="text-xs text-text-secondary mt-0.5 whitespace-pre-wrap break-words leading-relaxed">
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-text-muted hover:text-text-primary hover:bg-bg-panel-hover rounded p-1 transition-colors"
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
