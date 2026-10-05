import React from 'react';
import { ToastNotification } from '../../types';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

interface ToastContainerProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const getIcon = () => {
          switch (toast.type) {
            case 'success':
              return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />;
            case 'warning':
              return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />;
            case 'error':
              return <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />;
            default:
              return <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />;
          }
        };

        const getBorder = () => {
          switch (toast.type) {
            case 'success':
              return 'border-emerald-500/30 bg-emerald-950/40';
            case 'warning':
              return 'border-amber-500/30 bg-amber-950/40';
            case 'error':
              return 'border-rose-500/30 bg-rose-950/40';
            default:
              return 'border-cyan-500/30 bg-[#0e1422]/90';
          }
        };

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3 rounded-lg border backdrop-blur-md shadow-xl transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 ${getBorder()}`}
          >
            {getIcon()}
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold text-neutral-200 truncate">{toast.title}</h4>
              <p className="text-xs text-neutral-400 mt-0.5 break-words">{toast.message}</p>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-neutral-500 hover:text-neutral-300 transition-colors p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
