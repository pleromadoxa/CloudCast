import { useCallback, useEffect, useRef, useState } from 'react';
import { Cable, Check, Copy, Link2, Unlink, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { canLinkAudioVideoMixers } from '../../lib/productEntitlements';
import {
  createBridgePublisher,
  generateBridgeCode,
  persistBridgeLink,
  readLocalBridgeLink,
  resolveBridgeByCode,
  writeLocalBridgeLink,
} from '../../lib/audioBridgeService';
import { copyToClipboard } from '../../lib/sessionStorage';
import { linkVideoToAudioBridge } from '../../lib/sessionService';
import type { MixerBridgeLink } from '../../types/audioBridge';
import { cn } from '../../lib/utils';

interface VideoBridgePanelProps {
  mode: 'audio' | 'video';
  sessionId?: string;
  accessCode?: string;
  realtimeChannel?: string;
  sessionLoading?: boolean;
  onBridgeCodeChange?: (code: string | null) => void;
  onLinkChange?: (link: MixerBridgeLink | null) => void;
  className?: string;
}

export function VideoBridgePanel({
  mode,
  sessionId,
  accessCode,
  realtimeChannel,
  sessionLoading = false,
  onBridgeCodeChange,
  onLinkChange,
  className,
}: VideoBridgePanelProps) {
  const { profile } = useAuth();
  const canLink = canLinkAudioVideoMixers(profile);
  const [bridgeCode, setBridgeCode] = useState<string | null>(() => readLocalBridgeLink()?.bridgeCode ?? null);
  const [link, setLink] = useState<MixerBridgeLink | null>(() => readLocalBridgeLink());
  const [inputCode, setInputCode] = useState('');
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const publisherRef = useRef<{ stop: () => Promise<void> } | null>(null);

  const displayCode = bridgeCode ?? link?.bridgeCode ?? null;
  const sessionReady = Boolean(sessionId && accessCode);

  const startAudioBridge = useCallback(async () => {
    if (!sessionId || !accessCode || !canLink) return;
    const code = generateBridgeCode();
    setBridgeCode(code);
    onBridgeCodeChange?.(code);
    setError(null);

    const payload: Omit<MixerBridgeLink, 'linkedAt'> = {
      bridgeCode: code,
      audioSessionId: sessionId,
      audioAccessCode: accessCode,
      audioRealtimeChannel: realtimeChannel ?? '',
      ownerId: profile?.id ?? '',
    };

    await persistBridgeLink({ ...payload, linkedAt: new Date().toISOString() });
    writeLocalBridgeLink({ ...payload, linkedAt: new Date().toISOString() });

    await publisherRef.current?.stop();
    publisherRef.current = createBridgePublisher(payload);
  }, [sessionId, accessCode, realtimeChannel, canLink, profile?.id, onBridgeCodeChange]);

  useEffect(() => {
    if (mode !== 'audio' || !canLink || !sessionReady) return;
    void startAudioBridge();
    return () => {
      void publisherRef.current?.stop();
      publisherRef.current = null;
    };
  }, [mode, canLink, sessionReady, startAudioBridge]);

  const handleCopy = async () => {
    if (!displayCode) return;
    setCopyError(null);
    const ok = await copyToClipboard(displayCode);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } else {
      setCopyError('Copy blocked — select the code and copy manually');
    }
  };

  const handleVideoConnect = async () => {
    if (!sessionId || !canLink) return;
    setLinking(true);
    setError(null);
    try {
      const resolved = await resolveBridgeByCode(inputCode);
      if (!resolved) {
        setError('Bridge code not found. Open the audio mixer and try again.');
        return;
      }
      await linkVideoToAudioBridge(sessionId, resolved.bridgeCode);
      await persistBridgeLink(resolved);
      setLink(resolved);
      onLinkChange?.(resolved);
      setInputCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link mixers');
    } finally {
      setLinking(false);
    }
  };

  const handleDisconnect = () => {
    writeLocalBridgeLink(null);
    setLink(null);
    onLinkChange?.(null);
    if (mode === 'audio') void startAudioBridge();
  };

  if (!canLink) {
    return (
      <div className={cn('bridge-panel bridge-panel--locked', className)}>
        <Cable className="h-3.5 w-3.5 shrink-0 text-sky-400/70" />
        <span className="bridge-panel__text">
          Universal plan links audio + video mixers
        </span>
        <a href="/pricing?product=universal" className="bridge-panel__upgrade">
          Upgrade
        </a>
      </div>
    );
  }

  if (mode === 'audio') {
    return (
      <div className={cn('bridge-panel bridge-panel--audio', className)}>
        <div className="bridge-panel__icon-wrap">
          <Zap className="h-3.5 w-3.5 text-cyan-300" />
        </div>
        <div className="bridge-panel__body">
          <span className="bridge-panel__label">Video bridge plug</span>
          {displayCode ? (
            <button
              type="button"
              onClick={() => { void handleCopy(); }}
              className="bridge-panel__code bridge-panel__code--copyable"
              title="Click to copy bridge code"
            >
              {displayCode}
            </button>
          ) : (
            <span className="bridge-panel__code bridge-panel__code--pending">
              {sessionLoading || !sessionReady ? 'Generating…' : '······'}
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={!displayCode}
          onClick={() => { void handleCopy(); }}
          className="bridge-panel__btn"
          title="Copy bridge code"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? 'OK' : 'COPY'}
        </button>
        <button
          type="button"
          disabled={!sessionReady || sessionLoading}
          onClick={() => { void startAudioBridge(); }}
          className="bridge-panel__btn"
          title="New code"
        >
          NEW
        </button>
        {copyError && <span className="bridge-panel__error">{copyError}</span>}
      </div>
    );
  }

  return (
    <div className={cn('bridge-panel bridge-panel--video', className)}>
      <Link2 className="h-3.5 w-3.5 shrink-0 text-sky-400" />
      {link ? (
        <>
          <span className="bridge-panel__text bridge-panel__text--linked">
            Audio linked · {link.bridgeCode}
          </span>
          <button type="button" onClick={handleDisconnect} className="bridge-panel__btn">
            <Unlink className="h-3 w-3" /> UNLINK
          </button>
        </>
      ) : (
        <>
          <input
            type="text"
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.toUpperCase())}
            placeholder="Bridge code"
            maxLength={8}
            className="bridge-panel__input"
          />
          <button
            type="button"
            disabled={linking || inputCode.trim().length < 4}
            onClick={() => { void handleVideoConnect(); }}
            className="bridge-panel__btn bridge-panel__btn--primary"
          >
            {linking ? '…' : 'LINK'}
          </button>
        </>
      )}
      {error && <span className="bridge-panel__error">{error}</span>}
    </div>
  );
}
