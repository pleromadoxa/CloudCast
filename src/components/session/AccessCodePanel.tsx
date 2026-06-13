import { Copy, Check, RefreshCw, Smartphone } from 'lucide-react';
import { useState } from 'react';
import type { MixerSession } from '../../types/session';
import { PLAN_LABELS } from '../../types/plans';
import { connectionModeShort, resolveDeviceLimit } from '../../lib/branding';
import { audioChannelsForPlan } from '../../config/products';
import type { SessionProduct } from '../../lib/sessionStorage';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import { copyToClipboard } from '../../lib/sessionStorage';

interface AccessCodePanelProps {
  session: MixerSession | null;
  isLoading: boolean;
  onRegenerate: () => void;
  isRegenerating: boolean;
  product?: SessionProduct;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

export function AccessCodePanel({
  session,
  isLoading,
  onRegenerate,
  isRegenerating,
  product = 'video',
  error = null,
  onRetry,
  className,
}: AccessCodePanelProps) {
  const { profile } = useAuth();
  const [copied, setCopied] = useState(false);
  const deviceLimit =
    product === 'audio' && session
      ? audioChannelsForPlan(session.planId)
      : resolveDeviceLimit(session, profile);

  const handleCopy = async () => {
    if (!session?.accessCode) return;
    const ok = await copyToClipboard(session.accessCode);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-[10px] text-mixer-muted">
        <RefreshCw className="h-3 w-3 animate-spin" />
        Initializing session…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-[10px]">
        <span className="text-mixer-red">{error ?? 'Session unavailable'}</span>
        {onRetry && (
          <button type="button" onClick={onRetry} className="mixer-btn px-2 py-0.5 text-[10px]">
            RETRY
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2 lg:gap-3', className)}>
      <div className="flex items-center gap-2">
        <Smartphone className="h-3.5 w-3.5 text-mixer-muted" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-mixer-muted">
          Access Code
        </span>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          'group flex items-center gap-2 border px-3 py-1 transition-all',
          'border-mixer-red/50 bg-mixer-red/10 hover:bg-mixer-red/20',
        )}
        title="Copy access code for mobile app"
      >
        <span className="font-mono text-lg font-bold tracking-[0.3em] text-mixer-red">
          {session.accessCode}
        </span>
        {copied ? (
          <Check className="h-3.5 w-3.5 text-mixer-green" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-mixer-muted group-hover:text-mixer-text" />
        )}
      </button>

      <span className="access-code-meta hidden text-[10px] text-mixer-muted lg:inline">
        <span className="font-bold text-mixer-text">{session.deviceCount}</span>
        /{deviceLimit} paired · {PLAN_LABELS[session.planId]} ·{' '}
        {product === 'audio' ? 'MESH' : connectionModeShort(session.connectionMode)}
        {product === 'audio' && (
          <span className="ml-1 text-sky-300/80">· shared w/ Video</span>
        )}
      </span>

      <button
        type="button"
        onClick={onRegenerate}
        disabled={isRegenerating}
        className="access-code-regen mixer-btn hidden items-center gap-1 px-2 py-1 text-[10px] md:flex"
        title="Generate new access code — revokes the old code and disconnects paired devices"
      >
        <RefreshCw className={cn('h-3 w-3', isRegenerating && 'animate-spin')} />
        NEW CODE
      </button>
    </div>
  );
}
