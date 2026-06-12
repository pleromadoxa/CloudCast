import { Link, useLocation } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { useProduction } from '../../context/ProductionContext';

/** Shown on non-dashboard routes while the user is still ON AIR. */
export function OnAirBanner() {
  const { isOnAir } = useProduction();
  const { pathname } = useLocation();

  if (!isOnAir || pathname === '/dashboard') return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded border border-mixer-red/50 bg-[#1a0a0a]/95 px-4 py-2.5 shadow-lg backdrop-blur-sm">
      <span className="flex items-center gap-1.5 text-xs font-bold text-mixer-red">
        <Radio className="h-3.5 w-3.5 animate-pulse" />
        ON AIR
      </span>
      <span className="text-[10px] text-mixer-muted">Production is still running</span>
      <Link
        to="/dashboard"
        className="rounded bg-mixer-red px-3 py-1 text-[10px] font-bold tracking-wide text-white hover:bg-mixer-red-dim"
      >
        RETURN TO MIXER
      </Link>
    </div>
  );
}
