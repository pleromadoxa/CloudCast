import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import type { AudioSettings, LayerSettings } from '../types/mixer';
import type { LayerStackId } from '../types/graphicsStack';
import { REGAL_MEDIA_DEVICE_ID } from '../types/mediaFeed';
import {
  resolvePgmMediaFeed,
  resolvePstMediaFeed,
  resolveLivePgmMediaFeed,
  type MediaFeedRole,
} from '../lib/mediaFeedState';
import { unlockDashboardAudio } from '../lib/audioOutput';

export interface MediaPlaybackTransport {
  playing: boolean;
  currentTime: number;
  duration: number;
}

interface MediaFeedContextValue {
  pstIsMedia: boolean;
  pgmIsMedia: boolean;
  pstMedia: ReturnType<typeof resolvePstMediaFeed>;
  pgmMedia: ReturnType<typeof resolvePgmMediaFeed>;
  livePgmMedia: ReturnType<typeof resolveLivePgmMediaFeed>;
  previewStream: MediaStream | null;
  programStream: MediaStream | null;
  setPreviewStream: (stream: MediaStream | null) => void;
  setProgramStream: (stream: MediaStream | null) => void;
  transport: MediaPlaybackTransport;
  setTransport: (partial: Partial<MediaPlaybackTransport>) => void;
  registerPanelVideo: (el: HTMLVideoElement | null) => void;
  registerShotVideo: (role: MediaFeedRole, el: HTMLVideoElement | null) => void;
  panelVideoRef: MutableRefObject<HTMLVideoElement | null>;
  shotVideoRef: MutableRefObject<HTMLVideoElement | null>;
  previewAudioAllowed: boolean;
  programAudioAllowed: boolean;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  onTogglePreviewMute: () => void;
  onToggleProgramMute: () => void;
  isPreviewMuted: boolean;
  isProgramMuted: boolean;
  getActiveVideoElement: () => HTMLVideoElement | null;
}

const defaultTransport = (): MediaPlaybackTransport => ({
  playing: false,
  currentTime: 0,
  duration: 0,
});

const MediaFeedContext = createContext<MediaFeedContextValue | null>(null);

function resolveActiveVideoRef(
  panelRef: HTMLVideoElement | null,
  pgmRef: HTMLVideoElement | null,
  pstRef: HTMLVideoElement | null,
  stripRef: HTMLVideoElement | null,
  pgmIsMedia: boolean,
  pstIsMedia: boolean,
): HTMLVideoElement | null {
  if (pgmIsMedia && pgmRef) return pgmRef;
  if (pstIsMedia && pstRef) return pstRef;
  return pgmRef ?? pstRef ?? stripRef ?? panelRef;
}

// Legacy alias — consumers read the best current shot element.
function pickPrimaryShotRef(
  pgmRef: HTMLVideoElement | null,
  pstRef: HTMLVideoElement | null,
  stripRef: HTMLVideoElement | null,
): HTMLVideoElement | null {
  return pgmRef ?? pstRef ?? stripRef;
}

export function MediaFeedProvider({
  layers,
  pgmLayers,
  selectedLayerId,
  pstDeviceId,
  pgmDeviceId,
  audio,
  onToggleViewAudioMute,
  onToggleInputMute,
  children,
}: {
  layers: LayerSettings;
  pgmLayers: LayerSettings;
  selectedLayerId: LayerStackId;
  pstDeviceId: string | null;
  pgmDeviceId: string | null;
  audio: AudioSettings;
  onToggleViewAudioMute: (deviceId: string) => void;
  onToggleInputMute: (deviceId: string) => void;
  children: ReactNode;
}) {
  const pstIsMedia = pstDeviceId === REGAL_MEDIA_DEVICE_ID;
  const pgmIsMedia = pgmDeviceId === REGAL_MEDIA_DEVICE_ID;

  const pstMedia = useMemo(
    () => resolvePstMediaFeed(layers, pstIsMedia, selectedLayerId),
    [layers, pstIsMedia, selectedLayerId],
  );
  const pgmMedia = useMemo(
    () => resolvePgmMediaFeed(layers, pgmLayers, pgmIsMedia, selectedLayerId),
    [layers, pgmLayers, pgmIsMedia, selectedLayerId],
  );
  const livePgmMedia = useMemo(
    () => resolveLivePgmMediaFeed(layers, pgmLayers),
    [layers, pgmLayers],
  );

  const [previewStream, setPreviewStreamState] = useState<MediaStream | null>(null);
  const [programStream, setProgramStreamState] = useState<MediaStream | null>(null);
  const [transport, setTransportState] = useState<MediaPlaybackTransport>(defaultTransport);
  const panelVideoRef = useRef<HTMLVideoElement | null>(null);
  const pgmShotVideoRef = useRef<HTMLVideoElement | null>(null);
  const pstShotVideoRef = useRef<HTMLVideoElement | null>(null);
  const stripShotVideoRef = useRef<HTMLVideoElement | null>(null);

  const resolveShotVideo = useCallback((): HTMLVideoElement | null => {
    if (pgmIsMedia && pgmShotVideoRef.current) return pgmShotVideoRef.current;
    if (pstIsMedia && pstShotVideoRef.current) return pstShotVideoRef.current;
    return (
      pgmShotVideoRef.current ??
      pstShotVideoRef.current ??
      stripShotVideoRef.current ??
      panelVideoRef.current
    );
  }, [pgmIsMedia, pstIsMedia]);

  const isPreviewMuted = audio.viewAudioMuted[REGAL_MEDIA_DEVICE_ID] ?? false;
  const isProgramMuted = audio.inputMuted[REGAL_MEDIA_DEVICE_ID] ?? false;

  const previewAudioAllowed = useMemo(
    () =>
      pstIsMedia &&
      pstMedia?.kind === 'video' &&
      transport.playing &&
      !isPreviewMuted &&
      !audio.monitorMasterMuted,
    [pstIsMedia, pstMedia?.kind, transport.playing, isPreviewMuted, audio.monitorMasterMuted],
  );

  const liveOverlayMuted = useMemo(() => {
    const overlay = pgmLayers.videoOverlays.find((o) => o.liveOnPgm && o.visible);
    return overlay?.muted ?? false;
  }, [pgmLayers.videoOverlays]);

  const programAudioAllowed = useMemo(() => {
    if (audio.masterMuted || isProgramMuted) return false;
    // Full Media source on PGM — use resolved PGM media (live overlay or staged).
    if (pgmIsMedia) {
      return Boolean(pgmMedia?.kind === 'video' && transport.playing);
    }
    // Overlay media riding on another PGM source.
    if (!livePgmMedia || livePgmMedia.kind !== 'video') return false;
    return livePgmMedia.liveOnPgm && !liveOverlayMuted && transport.playing;
  }, [
    audio.masterMuted,
    isProgramMuted,
    livePgmMedia,
    pgmIsMedia,
    pgmMedia?.kind,
    transport.playing,
    liveOverlayMuted,
  ]);

  const setPreviewStream = useCallback((stream: MediaStream | null) => {
    setPreviewStreamState((prev) => (prev === stream ? prev : stream));
  }, []);

  const setProgramStream = useCallback((stream: MediaStream | null) => {
    setProgramStreamState((prev) => (prev === stream ? prev : stream));
  }, []);

  const setTransport = useCallback((partial: Partial<MediaPlaybackTransport>) => {
    setTransportState((prev) => ({ ...prev, ...partial }));
  }, []);

  const registerPanelVideo = useCallback((el: HTMLVideoElement | null) => {
    panelVideoRef.current = el;
  }, []);

  const registerShotVideo = useCallback((role: MediaFeedRole, el: HTMLVideoElement | null) => {
    if (role === 'pgm') pgmShotVideoRef.current = el;
    else if (role === 'pst') pstShotVideoRef.current = el;
    else stripShotVideoRef.current = el;
  }, []);

  const syncVideos = useCallback(
    (playing: boolean) => {
      const seen = new Set<HTMLVideoElement>();
      for (const video of [
        pgmShotVideoRef.current,
        pstShotVideoRef.current,
        stripShotVideoRef.current,
        panelVideoRef.current,
      ]) {
        if (!video || seen.has(video)) continue;
        seen.add(video);
        if (playing) void video.play().catch(() => undefined);
        else video.pause();
      }
    },
    [],
  );

  const play = useCallback(() => {
    void unlockDashboardAudio();
    setTransportState((prev) => ({ ...prev, playing: true }));
    syncVideos(true);
    // Shot monitors may mount on the next frame after a bus cut / Go Live.
    requestAnimationFrame(() => syncVideos(true));
  }, [syncVideos]);

  const pause = useCallback(() => {
    syncVideos(false);
    setTransportState((prev) => ({ ...prev, playing: false }));
  }, [syncVideos]);

  // Toggle from the shared transport state — NOT from a queried <video> element.
  // Many MediaFeedPlayer instances (PST monitor, PGM monitor, hidden broadcast
  // render, grid tiles) all register into the single shotVideoRef and null it on
  // unmount, so reading an element here was racy and usually bailed. Every player
  // and the panel preview follow transport.playing via their own effects, so
  // flipping the transport is the authoritative, reliable control.
  const togglePlay = useCallback(() => {
    setTransportState((prev) => {
      const playing = !prev.playing;
      if (playing) void unlockDashboardAudio();
      syncVideos(playing);
      return { ...prev, playing };
    });
  }, [syncVideos]);

  const seek = useCallback(
    (time: number) => {
      if (!Number.isFinite(time)) return;
      const seen = new Set<HTMLVideoElement>();
      for (const video of [
        pgmShotVideoRef.current,
        pstShotVideoRef.current,
        stripShotVideoRef.current,
        panelVideoRef.current,
      ]) {
        if (!video || seen.has(video)) continue;
        seen.add(video);
        video.currentTime = Math.max(0, Math.min(time, video.duration || time));
      }
      const active = resolveActiveVideoRef(
        panelVideoRef.current,
        pgmShotVideoRef.current,
        pstShotVideoRef.current,
        stripShotVideoRef.current,
        pgmIsMedia,
        pstIsMedia,
      );
      if (active) {
        setTransportState((prev) => ({ ...prev, currentTime: active.currentTime }));
      }
    },
    [pgmIsMedia, pstIsMedia],
  );

  const value = useMemo(
    () => ({
      pstIsMedia,
      pgmIsMedia,
      pstMedia,
      pgmMedia,
      livePgmMedia,
      previewStream,
      programStream,
      setPreviewStream,
      setProgramStream,
      transport,
      setTransport,
      registerPanelVideo,
      registerShotVideo,
      panelVideoRef,
      shotVideoRef: {
        get current() {
          return pickPrimaryShotRef(
            pgmShotVideoRef.current,
            pstShotVideoRef.current,
            stripShotVideoRef.current,
          );
        },
        set current(_el: HTMLVideoElement | null) {
          /* shotVideoRef is read-only — use registerShotVideo(role, el) */
        },
      },
      previewAudioAllowed,
      programAudioAllowed,
      play,
      pause,
      togglePlay,
      seek,
      onTogglePreviewMute: () => {
        void unlockDashboardAudio();
        onToggleViewAudioMute(REGAL_MEDIA_DEVICE_ID);
      },
      onToggleProgramMute: () => {
        void unlockDashboardAudio();
        onToggleInputMute(REGAL_MEDIA_DEVICE_ID);
      },
      isPreviewMuted,
      isProgramMuted,
      getActiveVideoElement: resolveShotVideo,
    }),
    [
      pstIsMedia,
      pgmIsMedia,
      pstMedia,
      pgmMedia,
      livePgmMedia,
      previewStream,
      programStream,
      setPreviewStream,
      setProgramStream,
      transport,
      setTransport,
      registerPanelVideo,
      registerShotVideo,
      previewAudioAllowed,
      programAudioAllowed,
      play,
      pause,
      togglePlay,
      seek,
      onToggleViewAudioMute,
      onToggleInputMute,
      isPreviewMuted,
      isProgramMuted,
      resolveShotVideo,
    ],
  );

  return <MediaFeedContext.Provider value={value}>{children}</MediaFeedContext.Provider>;
}

export function useMediaFeedOptional(): MediaFeedContextValue | null {
  return useContext(MediaFeedContext);
}
