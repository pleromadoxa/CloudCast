import { Link, useLocation } from 'react-router-dom';
import {
  Clapperboard,
  LayoutGrid,
  MonitorPlay,
  SlidersHorizontal,
  Sparkles,
  Video,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { canAccessProduct } from '../../lib/productEntitlements';
import { useAuth } from '../../context/AuthContext';

const ITEMS = [
  { path: '/dashboard', label: 'Video', icon: Video, product: 'video_mixer' as const },
  { path: '/audio', label: 'Audio', icon: SlidersHorizontal, product: 'audio_mixer' as const },
  { path: '/replay', label: 'Replay', icon: Clapperboard, product: 'instant_replay' as const },
  { path: '/display', label: 'Display', icon: MonitorPlay, product: 'regal_display' as const },
  { path: '/prism', label: 'Prism', icon: Sparkles, product: 'regal_prism' as const },
] as const;

/** Always-clickable product switcher rendered above kept-alive consoles. */
export function ProductionShellNav({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const current = pathname.replace(/\/+$/, '') || '/';

  return (
    <nav
      className={cn(
        'relative z-20 flex shrink-0 flex-wrap items-center gap-1 border-b border-white/10 bg-[#060606]/95 px-2 py-1.5 backdrop-blur-sm',
        className,
      )}
      aria-label="Production products"
    >
      {ITEMS.map(({ path, label, icon: Icon, product }) => {
        if (!canAccessProduct(profile, product)) return null;
        const active = current === path;
        return (
          <Link
            key={path}
            to={path}
            className={cn(
              'inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-bold tracking-wider transition-colors',
              active
                ? 'bg-mixer-red/20 text-white ring-1 ring-mixer-red/40'
                : 'text-mixer-muted hover:bg-white/5 hover:text-white',
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {label}
          </Link>
        );
      })}
      <Link
        to="/hub"
        className={cn(
          'ml-auto inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-bold tracking-wider transition-colors',
          current === '/hub'
            ? 'bg-white/10 text-white'
            : 'text-mixer-muted hover:bg-white/5 hover:text-white',
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
        Hub
      </Link>
    </nav>
  );
}
