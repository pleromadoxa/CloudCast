import { createPortal } from 'react-dom';
import { AlertTriangle, Power, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ConfirmServiceToggleModalProps {
  open: boolean;
  productName: string;
  enabling: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmServiceToggleModal({
  open,
  productName,
  enabling,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmServiceToggleModalProps) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4">
      <div
        className="w-full max-w-md rounded border border-mixer-border bg-mixer-panel shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-toggle-title"
      >
        <div className="flex items-start justify-between border-b border-mixer-border px-4 py-3">
          <div className="flex items-center gap-2">
            {enabling ? (
              <Power className="h-5 w-5 shrink-0 text-mixer-green" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0 text-mixer-red" />
            )}
            <h2 id="service-toggle-title" className="text-sm font-bold tracking-wide text-white">
              {enabling ? 'Enable service?' : 'Disable service?'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="mixer-btn p-1"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="px-4 py-4 text-sm leading-relaxed text-mixer-muted">
          {enabling ? (
            <>
              Enable <strong className="text-white">{productName}</strong> for all users? The dashboard
              will become available again to entitled accounts.
            </>
          ) : (
            <>
              Disable <strong className="text-white">{productName}</strong> for all users? Anyone
              currently using this dashboard will lose access until it is enabled again.
            </>
          )}
        </p>

        <div className="flex gap-2 border-t border-mixer-border px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="mixer-btn flex-1 py-2.5 text-xs font-bold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              'mixer-btn flex-1 py-2.5 text-xs font-bold',
              enabling ? 'bg-mixer-green/20 text-mixer-green ring-1 ring-mixer-green/40' : 'atem-toggle-on',
            )}
          >
            {busy ? 'Saving…' : enabling ? 'Enable' : 'Disable'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
