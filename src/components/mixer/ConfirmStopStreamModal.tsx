import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmStopStreamModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmStopStreamModal({ open, onConfirm, onCancel }: ConfirmStopStreamModalProps) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4">
      <div
        className="w-full max-w-md rounded border border-mixer-border bg-mixer-panel shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stop-stream-title"
      >
        <div className="flex items-start justify-between border-b border-mixer-border px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-mixer-red" />
            <h2 id="stop-stream-title" className="text-sm font-bold tracking-wide text-white">
              Stop live stream?
            </h2>
          </div>
          <button type="button" onClick={onCancel} className="mixer-btn p-1" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="px-4 py-4 text-sm leading-relaxed text-mixer-muted">
          You are currently <strong className="text-mixer-red">ON AIR</strong>. Stopping will end the
          RTMP broadcast to all configured destinations. The production mixer stays available until you
          leave the app.
        </p>

        <div className="flex gap-2 border-t border-mixer-border px-4 py-3">
          <button type="button" onClick={onCancel} className="mixer-btn flex-1 py-2.5 text-xs font-bold">
            Keep streaming
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="mixer-btn flex-1 py-2.5 text-xs font-bold atem-toggle-on"
          >
            Stop stream
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
