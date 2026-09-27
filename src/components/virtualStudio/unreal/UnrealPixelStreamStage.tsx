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
    message: 'Enter a Pixel Streaming signalling URL to connect',
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

    if (settings.signallingUrl && settings.autoConnect) client.connect();

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
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#05070c] px-8 text-center">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-300">
            <span
              className={`h-2 w-2 rounded-full ${
                stats.state === 'failed'
                  ? 'bg-rose-400'
                  : stats.state === 'reconnecting'
                    ? 'bg-amber-400'
                    : 'animate-pulse bg-sky-400'
              }`}
            />
            Unreal Engine · Pixel Streaming
          </div>
          <p className="max-w-md text-sm text-slate-300">{stats.message ?? 'Standing by.'}</p>
          <p className="max-w-lg text-xs leading-relaxed text-slate-500">
            CloudCast renders this stage from a live Unreal Engine instance over WebRTC. Add a Pixel
            Streaming signalling URL in Engine Settings, then connect — mouse, keyboard and touch are
            forwarded to the Unreal render so the set stays fully interactive.
          </p>
          {settings.signallingUrl ? (
            <code className="rounded bg-slate-900/80 px-3 py-1.5 text-[11px] text-slate-400">
              {settings.signallingUrl}
            </code>
          ) : null}
        </div>
      )}

      {connected && (
        <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-2 rounded bg-black/55 px-2.5 py-1 text-[10px] font-medium text-white/85 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          UE LIVE
          {stats.resolution ? (
            <span className="text-white/60">
              {stats.resolution.width}×{stats.resolution.height}
            </span>
          ) : null}
          {stats.latencyMs !== null ? (
            <span className="text-white/60">{Math.round(stats.latencyMs)} ms</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default UnrealPixelStreamStage;
