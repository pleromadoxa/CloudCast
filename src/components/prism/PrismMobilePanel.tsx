import { useMemo, useState } from 'react';
import { Copy, ExternalLink, Smartphone, Check } from 'lucide-react';
import { useCloudCastOptional } from '../../context/CloudCastContext';
import { AccessCodePanel } from '../session/AccessCodePanel';
import { buildPrismEyeUrl } from '../../lib/prismTrackingSync';
import { cn } from '../../lib/utils';

interface PrismMobilePanelProps {
  cameraSourceId: string;
  pairedDevices: Array<{ deviceId: string; label: string; status: string }>;
  onSelectSource: (sourceId: string) => void;
  canUseMobile: boolean;
}

export function PrismMobilePanel({
  cameraSourceId,
  pairedDevices,
  onSelectSource,
  canUseMobile,
}: PrismMobilePanelProps) {
  const cloudcast = useCloudCastOptional();
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);

  const accessCode = cloudcast?.session?.accessCode ?? '';
  const trackingUrl = useMemo(
    () => (accessCode ? buildPrismEyeUrl(accessCode) : ''),
    [accessCode],
  );

  const copyText = async (text: string, kind: 'link' | 'code') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  };

  if (!canUseMobile) {
    return (
      <p className="text-xs text-mixer-muted">
        Mobile camera input unlocks on Pro. Use CloudCast Mobile as a wireless VP camera — like Aximetry Eye.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-mixer-muted">
        Pair CloudCast Mobile with your access code for wireless camera input, or open Regal Prism Eye on a phone for gyro tracking.
      </p>
      {cloudcast && (
        <AccessCodePanel
          session={cloudcast.session}
          isLoading={cloudcast.sessionLoading}
          onRegenerate={cloudcast.regenerateCode}
          isRegenerating={cloudcast.isRegenerating}
          product="video"
          error={cloudcast.error}
          onRetry={cloudcast.reconnect}
        />
      )}

      <div className="rounded border border-amber-500/25 bg-amber-500/5 p-2">
        <p className="text-[10px] font-bold tracking-wider text-amber-300">REGAL PRISM EYE · PHONE TRACKING</p>
        <p className="mt-1 text-[10px] leading-snug text-mixer-muted">
          Open this link on your phone — no login required. Gyro drives the virtual camera on this studio. The link rotates when you regenerate the access code after each production.
        </p>
        {trackingUrl ? (
          <div className="mt-2 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => void copyText(trackingUrl, 'link')}
              className="inline-flex items-center gap-1 rounded border border-white/15 px-2 py-1 text-[10px] hover:border-amber-500/40"
            >
              {copied === 'link' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              Copy tracking link
            </button>
            <a
              href={trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded border border-white/15 px-2 py-1 text-[10px] hover:border-amber-500/40"
            >
              <ExternalLink className="h-3 w-3" />
              Open on phone
            </a>
          </div>
        ) : (
          <p className="mt-2 text-[10px] text-mixer-muted">Waiting for session access code…</p>
        )}
      </div>

      <div className="space-y-1">
        <button
          type="button"
          onClick={() => onSelectSource('local')}
          className={cn(
            'w-full rounded border px-2 py-1.5 text-left text-xs',
            cameraSourceId === 'local' ? 'border-amber-500/50 bg-amber-500/10' : 'border-white/10 hover:border-white/25',
          )}
        >
          Local webcam
        </button>
        {pairedDevices.length === 0 ? (
          <p className="py-2 text-[10px] text-mixer-muted">No paired mobile cameras yet.</p>
        ) : (
          pairedDevices.map((d) => (
            <button
              key={d.deviceId}
              type="button"
              onClick={() => onSelectSource(d.deviceId)}
              className={cn(
                'flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left text-xs',
                cameraSourceId === d.deviceId ? 'border-amber-500/50 bg-amber-500/10' : 'border-white/10 hover:border-white/25',
              )}
            >
              <Smartphone className="h-3 w-3 shrink-0 text-amber-400" />
              <span className="truncate">{d.label}</span>
              <span className="ml-auto text-[9px] uppercase text-mixer-muted">{d.status}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
