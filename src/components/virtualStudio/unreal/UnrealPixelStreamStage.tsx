/**
 * Prism Unreal Stage — a live Unreal Engine render inside the CloudCast stage.
 *
 * Mounts the Pixel Streaming player: a `<video>` carrying the remote render,
 * with pointer / keyboard / touch input forwarded to the Unreal instance so the
 * set is genuinely interactive. Everything else in the Prism pipeline (keyed
 * talent, broadcast graphics, motion, program bus) composites on top exactly as
 * it does over the local engines.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { PixelStreamClient } from './pixelStreaming';
import type { PixelStreamStats } from './pixelStreaming';
import type { UnrealStreamSettings } from '../../../lib/stageEngines';
import type { FidelityTier } from '../../../lib/virtualStudio/fidelity';

export interface UnrealPixelStreamStageProps {
  settings: UnrealStreamSettings;
  /**
   * Shared fidelity tier — pushed to the Unreal instance as console commands
   * (Lumen GI/reflections, virtual shadows, volumetric fog, TSR, streaming
   * pool) so this engine matches the R3F and Babylon stages exactly.
   */
  fidelity?: FidelityTier;
  visible?: boolean;
  interactive?: boolean;
  /**
   * Receives the `<video>` carrying the remote Unreal render. Prism's program
   * capture draws video sources directly, so this hands the stream to the bus.
   */
  onStageSource?: (source: HTMLVideoElement | null) => void;
  onStats?: (stats: PixelStreamStats) => void;
  onEngineReady?: (info: { backend: 'webrtc'; renderer: string }) => void;
  className?: string;
  style?: CSSProperties;
}

export function UnrealPixelStreamStage({
  settings,
  fidelity = 'high',
  visible = true,
  interactive = true,
  onStageSource,
  onStats,
  onEngineReady,
  className,
  style,
}: UnrealPixelStreamStageProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const clientRef = useRef<PixelStreamClient | null>(null);
  const [stats, setStats] = useState<PixelStreamStats>({
    state: 'idle',
    message: null,
    latencyMs: null,
    fps: 0,
    resolution: null,
    bytesReceived: 0,
    iceConnectionState: null,
  });

  /* --- lifecycle -------------------------------------------------------- */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // The remote render is a `<video>`; Prism's program capture draws visible
    // video sources directly, so hand it to the bus as the stage source.
    onStageSource?.(video);

    const client = new PixelStreamClient(
      {
        signallingUrl: settings.signallingUrl,
        forceTURN: settings.forceTURN,
        turnUrl: settings.turnUrl,
        turnUsername: settings.turnUsername,
        turnCredential: settings.turnCredential,
        autoPause: settings.autoPause,
        fidelity,
        onStats: (next) => {
          setStats(next);
          onStats?.(next);
        },
      },
      video,
    );
    clientRef.current = client;
    onEngineReady?.({ backend: 'webrtc', renderer: 'Unreal Engine (Pixel Streaming)' });

    // Always connect when a signalling URL is present — autoConnect controls
    // reconnection after disconnect, not the initial connection.
    if (settings.signallingUrl) client.connect();

    return () => {
      client.dispose();
      clientRef.current = null;
    };
    // Rebuild only when the endpoint changes — tuning is pushed live below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.signallingUrl, settings.turnUrl, settings.forceTURN]);

  /* --- quality / resolution / fidelity ---------------------------------- */
  useEffect(() => {
    clientRef.current?.applyQuality(settings.quality);
  }, [settings.quality]);

  useEffect(() => {
    clientRef.current?.applyFidelity(fidelity);
  }, [fidelity]);

  useEffect(() => {
    clientRef.current?.applyResolution(settings.resolution);
  }, [settings.resolution]);

  /* --- input forwarding ------------------------------------------------- */
  const normalise = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }, []);

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const client = clientRef.current;
      if (!client || !settings.hoverMouse) return;
      const point = normalise(event);
      if (!point) return;
      client.mouseMove(point.x, point.y, event.movementX, event.movementY);
    },
    [normalise, settings.hoverMouse],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const client = clientRef.current;
      if (!client) return;
      const point = normalise(event);
      if (!point) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      client.mouseDown(event.button, point.x, point.y);
    },
    [normalise],
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const client = clientRef.current;
      if (!client) return;
      const point = normalise(event);
      if (!point) return;
      client.mouseUp(event.button, point.x, point.y);
    },
    [normalise],
  );

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const client = clientRef.current;
    if (!client) return;
    const rect = event.currentTarget.getBoundingClientRect();
    client.mouseWheel(
      event.deltaY,
      (event.clientX - rect.left) / rect.width,
      (event.clientY - rect.top) / rect.height,
    );
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!settings.keyboardInput) return;
      clientRef.current?.keyDown(event.key, event.keyCode);
    },
    [settings.keyboardInput],
  );

  const handleKeyUp = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!settings.keyboardInput) return;
      clientRef.current?.keyUp(event.key, event.keyCode);
    },
    [settings.keyboardInput],
  );

  const connected = stats.state === 'streaming';

  return (
    <div
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...style }}
      data-stage-engine="unreal-pixelstream"
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      tabIndex={interactive ? 0 : -1}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          background: '#05070c',
          display: visible ? 'block' : 'none',
        }}
      />

      {!connected && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#060a12] via-[#080d18] to-[#05070c] px-8">
          {/* Subtle grid pattern overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          {/* Status indicator */}
          <div className="relative mb-6 flex items-center gap-2.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-2 backdrop-blur-sm">
            <span
              className={`h-2 w-2 rounded-full shadow-lg ${
                stats.state === 'failed'
                  ? 'bg-rose-400 shadow-rose-400/40'
                  : stats.state === 'reconnecting'
                    ? 'animate-pulse bg-amber-400 shadow-amber-400/40'
                    : stats.state === 'connecting' || stats.state === 'negotiating'
                      ? 'animate-pulse bg-sky-400 shadow-sky-400/40'
                      : 'bg-sky-400/60 shadow-sky-400/20'
              }`}
            />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
              {stats.state === 'failed'
                ? 'Connection failed'
                : stats.state === 'reconnecting'
                  ? 'Reconnecting'
                  : stats.state === 'connecting'
                    ? 'Connecting'
                    : stats.state === 'negotiating'
                      ? 'Negotiating'
                      : 'Standing by'}
            </span>
          </div>

          {/* Main title */}
          <h2 className="relative mb-2 text-center text-lg font-bold tracking-tight text-white/90">
            CloudCast Relay
          </h2>
          <p className="relative mb-1 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-white/30">
            Unreal Engine · Pixel Streaming
          </p>

          {/* Status message */}
          {stats.message && (
            <p className="relative mt-3 max-w-md text-center text-xs leading-relaxed text-white/40">
              {stats.message}
            </p>
          )}

          {/* Connection info card */}
          <div className="relative mt-6 w-full max-w-sm rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/80">
                Relay Connected
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-white/35">
              Your UE5 Pixel Streaming instance is routed through CloudCast's managed relay. Once
              the streamer connects, this stage renders the live Unreal viewport with full mouse,
              keyboard and touch forwarding.
            </p>
            <div className="mt-3 flex items-center gap-3 text-[9px] text-white/25">
              <span className="flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-white/30" />
                WebRTC
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-white/30" />
                Input forwarding
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-white/30" />
                Fidelity sync
              </span>
            </div>
          </div>

          {/* Bottom attribution */}
          <div className="relative mt-6 flex items-center gap-1.5 text-[9px] text-white/20">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Powered by CloudCast Render Engine
          </div>
        </div>
      )}

      {connected && (
        <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-black/60 px-3 py-1.5 text-[10px] font-medium text-white/90 shadow-lg backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
          </span>
          <span className="font-bold tracking-wider text-emerald-300">LIVE</span>
          {stats.resolution ? (
            <span className="text-white/50">
              {stats.resolution.width}×{stats.resolution.height}
            </span>
          ) : null}
          {stats.latencyMs !== null ? (
            <span className="text-white/40">{Math.round(stats.latencyMs)} ms</span>
          ) : null}
          {stats.fps > 0 ? (
            <span className="text-white/40">{stats.fps} fps</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default UnrealPixelStreamStage;
