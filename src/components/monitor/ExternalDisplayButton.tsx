import { MonitorUp } from 'lucide-react';
import type { DetectedScreen } from '../../lib/externalDisplay/detectScreens';
import { cn } from '../../lib/utils';

interface ExternalDisplayButtonProps {
  isOpen: boolean;
  isDetecting: boolean;
  externalAvailable: boolean;
  targetScreen: DetectedScreen | null;
  onClick: () => void;
}

export function ExternalDisplayButton({
  isOpen,
  isDetecting,
  externalAvailable,
  targetScreen,
  onClick,
}: ExternalDisplayButtonProps) {
  const label = isOpen
    ? 'Close external output'
    : externalAvailable
      ? `Push PGM to ${targetScreen?.label ?? 'external display'}`
      : 'No external display detected';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDetecting}
      title={label}
      className={cn(
        'mixer-btn flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold tracking-wide',
        isOpen && 'atem-toggle-on',
        !externalAvailable && !isOpen && 'opacity-60',
      )}
    >
      <MonitorUp className="h-3.5 w-3.5" />
      <span>{isOpen ? 'EXT OUT' : 'EXT OUTPUT'}</span>
      {isDetecting && <span className="text-mixer-muted">…</span>}
    </button>
  );
}
