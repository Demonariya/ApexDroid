import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#0f1422] border border-neutral-800 rounded-xl shadow-2xl p-5 overflow-hidden">
        <div className="flex items-start gap-3.5">
          <div
            className={`p-2.5 rounded-lg shrink-0 ${
              isDestructive ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-neutral-100">{title}</h3>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">{message}</p>
          </div>
          <button
            onClick={onCancel}
            className="text-neutral-500 hover:text-neutral-300 p-1 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2.5 pt-4 border-t border-neutral-800/80">
          <button
            onClick={onCancel}
            className="px-3.5 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800/60 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-950'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm shadow-cyan-950'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
