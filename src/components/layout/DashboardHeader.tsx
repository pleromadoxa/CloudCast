import { Activity, Cloud } from 'lucide-react';
import type { SignalingEvent } from '../../types/signaling';
import { cn } from '../../lib/utils';

interface SignalingPanelProps {
  events: SignalingEvent[];
  isConnected: boolean;
  collapsed?: boolean;
}

export function SignalingPanel({ events, isConnected, collapsed = true }: SignalingPanelProps) {
  if (collapsed && events.length === 0) return null;

  return (
    <div className="border-t border-surface-700 bg-surface-900">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
          <Activity className="h-3.5 w-3.5" />
          Signaling Log
          <span className={cn('h-1.5 w-1.5 rounded-full', isConnected ? 'bg-live' : 'bg-slate-600')} />
        </div>
        <span className="text-[10px] text-slate-500">{events.length} events</span>
      </div>

      {!collapsed && (
        <div className="max-h-32 overflow-y-auto px-4 pb-3 font-mono text-[10px] text-slate-500">
          {events.slice(0, 20).map((ev, i) => (
            <div key={i} className="border-b border-surface-800 py-1">
              <span className="text-accent">{ev.event}</span>
              {' '}
              from={ev.payload.from.slice(0, 8)}
              {ev.payload.deviceId && ` device=${ev.payload.deviceId.slice(0, 8)}`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface DashboardHeaderProps {
  deviceCount: number;
  liveCount: number;
}

export function DashboardHeader({ deviceCount, liveCount }: DashboardHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-surface-700 bg-surface-900 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20">
          <Cloud className="h-4 w-4 text-accent" />
        </div>
        <div>
          <h1 className="text-base font-semibold tracking-tight">CloudCast Dashboard</h1>
          <p className="text-[11px] text-slate-500">
            Realtime presence · Regal Cloud playback · Direct signaling
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span>
          <span className="font-semibold text-live">{liveCount}</span> live
        </span>
        <span>
          <span className="font-semibold text-slate-300">{deviceCount}</span> devices
        </span>
      </div>
    </header>
  );
}
