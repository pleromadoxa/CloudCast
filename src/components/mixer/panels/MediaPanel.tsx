import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Cloud,
  Film,
  Image as ImageIcon,
  LayoutGrid,
  List as ListIcon,
  Loader2,
  Monitor,
  Move,
  Pause,
  Play,
  Radio,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { LayerSettings } from '../../../types/mixer';
import type { MediaLibraryItem, OverlayPosition } from '../../../types/overlays';
import { resolveMediaPlayUrl } from '../../../types/overlays';
import { normalizeLayerSettings } from '../../../lib/layerSettings';
import {
  getMixerMediaPlayUrl,
  uploadMixerMediaToCloud,
  deleteMixerMediaFromCloud,
  fetchMixerMediaStorageUsage,
  syncLayersWithMediaLibrary,
} from '../../../lib/mixerMediaService';
import { importMediaFile, trimMediaLibrary } from '../../../lib/mediaUpload';
import { resolveClipPlayUrl } from '../../../lib/mediaFeedState';
import { isSupabaseConfigured } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { PRESET_PLACEMENT } from '../../../lib/overlayPlacement';
import type { LayerStackId } from './layers/layerStackTypes';
import { cn } from '../../../lib/utils';
import { InputAudioVisualizer } from '../InputAudioVisualizer';
import { useMediaFeedOptional } from '../../../context/MediaFeedContext';

interface MediaGraphicsActions {
  patchLayers: (p: Partial<LayerSettings>) => void;
  patchPgmLayers: (p: Partial<LayerSettings>) => void;
  stageMediaPreview: (item: MediaLibraryItem) => void;
  takeMediaLive: (id: string, kind: 'image' | 'video') => void;
  stageAndTakeMediaLive: (item: MediaLibraryItem) => void;
  removeStackLayer: (id: LayerStackId) => void;
}

interface MediaPanelProps {
  layers: LayerSettings;
  pgmLayers: LayerSettings;
  selectedLayerId: LayerStackId;
  onSelectLayer: (id: LayerStackId) => void;
  onPatchLayers: (p: Partial<LayerSettings>) => void;
  onPreviewMedia?: () => void;
  onTakeMedia?: () => void;
  graphics: MediaGraphicsActions;
  compact?: boolean;
}

const POSITIONS: OverlayPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'];

function stackIdForItem(item: MediaLibraryItem): LayerStackId {
  return item.kind === 'video' ? `video:${item.id}` : `image:${item.id}`;
}

function liveMediaId(pgmLayers: LayerSettings): { id: string; kind: 'image' | 'video' } | null {
  const liveImage = pgmLayers.imageOverlays.find((o) => o.liveOnPgm);
  if (liveImage) return { id: liveImage.id, kind: 'image' };
  const liveVideo = pgmLayers.videoOverlays.find((o) => o.liveOnPgm);
  if (liveVideo) return { id: liveVideo.id, kind: 'video' };
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function MediaPanel({
  layers: rawLayers,
  pgmLayers: rawPgmLayers,
  selectedLayerId,
  onSelectLayer,
  onPatchLayers,
  onPreviewMedia,
  onTakeMedia,
  graphics,
  compact = false,
}: MediaPanelProps) {
  const layers = normalizeLayerSettings(rawLayers);
  const pgmLayers = normalizeLayerSettings(rawPgmLayers);
  const fileRef = useRef<HTMLInputElement>(null);
  const panelVideoRef = useRef<HTMLVideoElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState<string | null>(null);
  const [storageHint, setStorageHint] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { user } = useAuth();

  const activeLive = liveMediaId(pgmLayers);
  const mediaFeed = useMediaFeedOptional();

  const refreshStorageHint = useCallback(() => {
    if (!user || !isSupabaseConfigured()) {
      setStorageHint(null);
      return;
    }
    void fetchMixerMediaStorageUsage()
      .then((usage) => {
        if (usage.quotaBytes <= 0) {
          setStorageHint('Regal Cloud storage requires a Pro plan.');
          return;
        }
        setStorageHint(
          `Regal Cloud · ${formatBytes(usage.usedBytes)} / ${formatBytes(usage.quotaBytes)} used`,
        );
      })
      .catch(() => setStorageHint(null));
  }, [user]);

  useEffect(() => {
    refreshStorageHint();
  }, [refreshStorageHint, layers.mediaLibrary.length]);

  // Register the panel <video> with the media feed via a callback ref so the
  // transport (play/pause/seek) always has a live element to drive. A plain
  // effect cannot do this reliably because the <video> is conditionally
  // rendered and the element is null on first mount.
  const transportPlaying = mediaFeed?.transport.playing ?? false;
  const transportPlayingRef = useRef(transportPlaying);
  useEffect(() => {
    transportPlayingRef.current = transportPlaying;
  }, [transportPlaying]);

  const setPanelVideoEl = useCallback(
    (el: HTMLVideoElement | null) => {
      panelVideoRef.current = el;
      mediaFeed?.registerPanelVideo(el);
    },
    [mediaFeed],
  );

  const selectedItem = useMemo(() => {
    if (!selectedLayerId.startsWith('image:') && !selectedLayerId.startsWith('video:')) return null;
    const id = selectedLayerId.slice(selectedLayerId.indexOf(':') + 1);
    const library = layers.mediaLibrary.find((m) => m.id === id);
    const overlay =
      selectedLayerId.startsWith('image:')
        ? layers.imageOverlays.find((o) => o.id === id)
        : layers.videoOverlays.find((o) => o.id === id);
    if (!library && !overlay) return null;
    const kind = selectedLayerId.startsWith('video:') ? 'video' as const : 'image' as const;
    return {
      kind,
      id,
      name: library?.name ?? overlay?.name ?? 'Media',
      library,
      overlay,
      stackId: selectedLayerId,
    };
  }, [selectedLayerId, layers]);

  // Selecting only cues the clip into the panel — it does NOT push it to the
  // preview monitor or start playback, and it must never touch the shared
  // transport (doing so would pause/mute a clip that is currently live on air).
  // The operator explicitly stages it with "Play in Preview" / "Go Live".
  const selectItem = useCallback(
    (item: MediaLibraryItem) => {
      onSelectLayer(stackIdForItem(item));
    },
    [onSelectLayer],
  );

  const playInPreview = useCallback(
    (item: MediaLibraryItem) => {
      onSelectLayer(stackIdForItem(item));
      graphics.stageMediaPreview(item);
      onPreviewMedia?.();
      if (item.kind === 'video') {
        requestAnimationFrame(() => mediaFeed?.play());
      }
    },
    [graphics, mediaFeed, onPreviewMedia, onSelectLayer],
  );

  const takeLive = useCallback(
    (item: MediaLibraryItem) => {
      const alreadyLive = activeLive?.id === item.id;
      onSelectLayer(stackIdForItem(item));
      graphics.stageAndTakeMediaLive(item);
      if (!alreadyLive) {
        onTakeMedia?.();
      }
      if (item.kind === 'video') {
        // Cut to PGM first (onTakeMedia), then play once the program shot mounts.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => mediaFeed?.play());
        });
      }
    },
    [activeLive?.id, graphics, mediaFeed, onSelectLayer, onTakeMedia],
  );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setCloudStatus(null);
    try {
      const { item, blob } = await importMediaFile(file);
      let libraryItem = item;
      const mediaLibrary = trimMediaLibrary([libraryItem, ...layers.mediaLibrary]);
      onPatchLayers({ mediaLibrary });
      selectItem(libraryItem);

      if (!isSupabaseConfigured()) {
        setUploadError('Regal Cloud is not configured for this environment.');
        return;
      }
      if (!user) {
        setUploadError('Sign in to save media to Regal Cloud. Preview works locally until you sign in.');
        return;
      }

      setCloudStatus('Saving to Regal Cloud…');
      const record = await uploadMixerMediaToCloud(blob, libraryItem);
      if (libraryItem.kind === 'video' && libraryItem.playUrl.startsWith('blob:')) {
        URL.revokeObjectURL(libraryItem.playUrl);
      }
      const playUrl = await getMixerMediaPlayUrl(record.storagePath, record.fileName);
      libraryItem = {
        ...libraryItem,
        storagePath: record.storagePath,
        sizeBytes: record.sizeBytes,
        playUrl,
        thumbUrl: libraryItem.kind === 'image' ? playUrl : libraryItem.thumbUrl,
      };
      const library = trimMediaLibrary([
        libraryItem,
        ...mediaLibrary.filter((m) => m.id !== libraryItem.id),
      ]);
      onPatchLayers(
        syncLayersWithMediaLibrary({ ...layers, mediaLibrary: library }, library, pgmLayers),
      );
      setCloudStatus('Saved to Regal Cloud');
      refreshStorageHint();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
      setCloudStatus(null);
    } finally {
      setUploading(false);
    }
  };

  const selectedPlayUrl = selectedItem?.library
    ? resolveClipPlayUrl(selectedItem.overlay?.dataUrl, selectedItem.library)
    : selectedItem?.overlay?.dataUrl;

  const selectedVideoLoop = useMemo(() => {
    if (!selectedItem || selectedItem.kind !== 'video') return true;
    return layers.videoOverlays.find((o) => o.id === selectedItem.id)?.loop ?? true;
  }, [selectedItem, layers.videoOverlays]);

  useEffect(() => {
    const video = panelVideoRef.current;
    if (!video || selectedItem?.kind !== 'video' || !selectedPlayUrl) {
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      if (!selectedItem || selectedItem.kind !== 'video') {
        mediaFeed?.setTransport({ currentTime: 0, duration: 0, playing: false });
      }
      return;
    }

    video.src = selectedPlayUrl;
    video.loop = selectedVideoLoop;
    video.muted = true;
    video.playsInline = true;

    const syncTime = () => {
      if (!mediaFeed || !Number.isFinite(video.duration)) return;
      mediaFeed.setTransport({
        currentTime: video.currentTime,
        duration: video.duration,
      });
    };

    // When the freshly loaded clip should already be playing (operator hit
    // "Play in Preview"/"Go Live" before the element had a source), start it as
    // soon as it is decodable instead of silently staying on the first frame.
    const onReady = () => {
      syncTime();
      if (transportPlayingRef.current) {
        void video.play().catch(() => undefined);
      }
    };

    video.addEventListener('loadedmetadata', onReady);
    video.addEventListener('canplay', onReady);
    video.addEventListener('timeupdate', syncTime);
    if (video.readyState >= 1) onReady();

    return () => {
      video.removeEventListener('loadedmetadata', onReady);
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('timeupdate', syncTime);
    };
  }, [selectedItem?.id, selectedItem?.kind, selectedPlayUrl, selectedVideoLoop, mediaFeed]);

  // Keep the panel preview element in lock-step with the shared transport so the
  // play/pause button, double-click, and "Play in Preview" all reliably drive it.
  useEffect(() => {
    const video = panelVideoRef.current;
    if (!video || selectedItem?.kind !== 'video' || !selectedPlayUrl) return;
    if (transportPlaying) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [transportPlaying, selectedItem?.id, selectedItem?.kind, selectedPlayUrl]);

  const removeFromLibrary = async (item: MediaLibraryItem) => {
    const stackId = stackIdForItem(item);
    graphics.removeStackLayer(stackId);
    onPatchLayers({
      mediaLibrary: layers.mediaLibrary.filter((m) => m.id !== item.id),
    });
    if (isSupabaseConfigured() && user) {
      try {
        await deleteMixerMediaFromCloud(item.id);
        refreshStorageHint();
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Could not delete from Regal Cloud.');
      }
    }
    if (item.kind === 'video' && item.playUrl.startsWith('blob:')) {
      URL.revokeObjectURL(item.playUrl);
    }
    if (selectedLayerId === stackId) {
      const next = layers.mediaLibrary.find((m) => m.id !== item.id);
      onSelectLayer(next ? stackIdForItem(next) : 'lower-third');
    }
  };

  const patchSelectedImage = (partial: Partial<(typeof layers.imageOverlays)[number]>) => {
    if (!selectedItem || selectedItem.kind !== 'image' || !selectedItem.overlay) return;
    onPatchLayers({
      imageOverlays: layers.imageOverlays.map((o) =>
        o.id === selectedItem.id ? { ...o, ...partial } : o,
      ),
    });
  };

  const patchSelectedVideo = (partial: Partial<(typeof layers.videoOverlays)[number]>) => {
    if (!selectedItem || selectedItem.kind !== 'video' || !selectedItem.overlay) return;
    const nextOverlays = layers.videoOverlays.map((o) =>
      o.id === selectedItem.id ? { ...o, ...partial } : o,
    );
    onPatchLayers({ videoOverlays: nextOverlays });
    if (activeLive?.id === selectedItem.id) {
      graphics.patchPgmLayers({
        videoOverlays: pgmLayers.videoOverlays.map((o) =>
          o.id === selectedItem.id ? { ...o, ...partial } : o,
        ),
      });
    }
  };

  const isSelectedLive = activeLive?.id === selectedItem?.id;
  const isSelectedStaged = Boolean(selectedItem?.overlay);
  const previewAudioStream = mediaFeed?.previewStream ?? null;
  const programAudioStream = mediaFeed?.programStream ?? null;
  const meterStream = isSelectedLive ? programAudioStream : previewAudioStream;
  const meterEnabled =
    selectedItem?.kind === 'video' &&
    (isSelectedLive ? !mediaFeed?.isProgramMuted : !mediaFeed?.isPreviewMuted) &&
    Boolean(mediaFeed?.transport.playing);

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2', compact && 'p-1.5')}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] font-bold tracking-wider text-mixer-muted">MEDIA LIBRARY</p>
        <div className="flex items-center gap-1">
          <div className="flex overflow-hidden rounded border border-mixer-border/60">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn(
                'flex items-center justify-center p-1',
                viewMode === 'grid' ? 'bg-violet-600/40 text-violet-100' : 'text-mixer-muted hover:text-white',
              )}
              title="Grid view"
              aria-pressed={viewMode === 'grid'}
            >
              <LayoutGrid className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn(
                'flex items-center justify-center p-1',
                viewMode === 'list' ? 'bg-violet-600/40 text-violet-100' : 'text-mixer-muted hover:text-white',
              )}
              title="List view"
              aria-pressed={viewMode === 'list'}
            >
              <ListIcon className="h-3 w-3" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="mixer-btn flex items-center gap-1 px-2 py-1 text-[9px] font-bold"
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            {uploading ? 'UPLOADING…' : 'UPLOAD'}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm"
          className="hidden"
          onChange={(e) => void handleUpload(e)}
        />
      </div>

      {uploadError && <p className="text-[9px] text-mixer-red">{uploadError}</p>}
      {cloudStatus && (
        <p className="flex items-center gap-1 text-[8px] text-violet-300">
          <Cloud className="h-3 w-3" />
          {cloudStatus}
        </p>
      )}

      <p className="text-[8px] leading-snug text-mixer-muted">
        Select a clip, <span className="text-violet-300">Play in Preview</span>, then{' '}
        <span className="text-mixer-red">Go Live on Program</span> — enable audio to hear it on air.
      </p>

      {storageHint && (
        <p className="flex items-center gap-1 text-[8px] text-violet-300">
          <Cloud className="h-3 w-3 shrink-0" />
          {storageHint}
        </p>
      )}

      {/* Library — primary area (grid or list) */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {layers.mediaLibrary.length === 0 ? (
          <div className="flex h-full min-h-[120px] flex-col items-center justify-center rounded border border-dashed border-mixer-border/60 py-8 text-center">
            <Film className="mb-2 h-6 w-6 text-mixer-muted/50" />
            <p className="text-[9px] text-mixer-muted">Upload images or videos</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {layers.mediaLibrary.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              const isLive = activeLive?.id === item.id;
              const thumb = resolveMediaPlayUrl(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectItem(item)}
                  onDoubleClick={() => playInPreview(item)}
                  title="Click to select · double-click to play in preview"
                  className={cn(
                    'relative flex aspect-video flex-col overflow-hidden rounded border bg-black/40 text-left transition-colors',
                    isLive
                      ? 'border-emerald-400 ring-2 ring-emerald-400/50'
                      : isSelected
                        ? 'border-violet-400 ring-1 ring-violet-400/40'
                        : 'border-mixer-border/60 hover:border-white/20',
                  )}
                >
                  {item.kind === 'image' ? (
                    <img src={thumb} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <video src={thumb} muted playsInline className="h-full w-full object-cover" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/70 px-1 py-0.5">
                    <span className="truncate text-[7px] font-bold text-white">{item.name}</span>
                    {item.kind === 'image' ? (
                      <ImageIcon className="h-2.5 w-2.5 shrink-0 text-violet-300" />
                    ) : (
                      <Film className="h-2.5 w-2.5 shrink-0 text-emerald-300" />
                    )}
                  </div>
                  {isLive && (
                    <span className="absolute right-1 top-1 flex items-center gap-0.5 rounded bg-emerald-600/90 px-1 text-[6px] font-bold text-white">
                      <Radio className="h-2 w-2" />
                      LIVE
                    </span>
                  )}
                  {isSelected && !isLive && (
                    <span className="absolute right-1 top-1 rounded bg-violet-600/90 px-1 text-[6px] font-bold text-white">
                      PST
                    </span>
                  )}
                  {item.storagePath && (
                    <Cloud className="absolute left-1 top-1 h-2.5 w-2.5 text-violet-300/80" />
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {layers.mediaLibrary.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              const isLive = activeLive?.id === item.id;
              const thumb = resolveMediaPlayUrl(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectItem(item)}
                  onDoubleClick={() => playInPreview(item)}
                  title="Click to select · double-click to play in preview"
                  className={cn(
                    'flex items-center gap-2 rounded border px-1.5 py-1 text-left transition-colors',
                    isLive
                      ? 'border-emerald-400/70 bg-emerald-500/10'
                      : isSelected
                        ? 'border-violet-400/60 bg-violet-500/10'
                        : 'border-mixer-border/50 hover:border-white/20',
                  )}
                >
                  <div className="relative h-9 w-16 shrink-0 overflow-hidden rounded bg-black">
                    {item.kind === 'image' ? (
                      <img src={thumb} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <video src={thumb} muted playsInline className="h-full w-full object-cover" />
                    )}
                    {item.storagePath && (
                      <Cloud className="absolute left-0.5 top-0.5 h-2.5 w-2.5 text-violet-300/80" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[9px] font-bold text-white">{item.name}</p>
                    <p className="flex items-center gap-1 text-[7px] uppercase tracking-wider text-mixer-muted">
                      {item.kind === 'image' ? (
                        <ImageIcon className="h-2.5 w-2.5 text-violet-300" />
                      ) : (
                        <Film className="h-2.5 w-2.5 text-emerald-300" />
                      )}
                      {item.kind}
                    </p>
                  </div>
                  {isLive ? (
                    <span className="flex shrink-0 items-center gap-0.5 rounded bg-emerald-600/90 px-1 text-[6px] font-bold text-white">
                      <Radio className="h-2 w-2" />
                      LIVE
                    </span>
                  ) : isSelected ? (
                    <span className="shrink-0 rounded bg-violet-600/90 px-1 text-[6px] font-bold text-white">
                      PST
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected clip — compact controls */}
      {selectedItem && (
        <div className="shrink-0 space-y-2 rounded border border-violet-500/30 bg-black/40 p-2">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[10px] font-bold text-white">{selectedItem.name}</p>
            {selectedItem.library && (
              <button
                type="button"
                onClick={() => void removeFromLibrary(selectedItem.library!)}
                className="text-mixer-muted hover:text-mixer-red"
                title="Delete from library and cloud"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {selectedItem.kind === 'video' && selectedPlayUrl && (
            <>
              <div className="mx-auto w-full max-w-[260px]">
                <video
                  ref={setPanelVideoEl}
                  className="aspect-video w-full rounded bg-black object-contain"
                  playsInline
                  muted
                />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => mediaFeed?.togglePlay()}
                  className="mixer-btn p-1"
                  title={mediaFeed?.transport.playing ? 'Pause' : 'Play'}
                >
                  {mediaFeed?.transport.playing ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    isSelectedLive ? mediaFeed?.onToggleProgramMute() : mediaFeed?.onTogglePreviewMute()
                  }
                  className={cn(
                    'mixer-btn p-1',
                    !(isSelectedLive ? mediaFeed?.isProgramMuted : mediaFeed?.isPreviewMuted) && 'mixer-btn-active',
                  )}
                  title={
                    (isSelectedLive ? mediaFeed?.isProgramMuted : mediaFeed?.isPreviewMuted)
                      ? isSelectedLive
                        ? 'Enable audio on program'
                        : 'Unmute preview'
                      : 'Mute'
                  }
                >
                  {(isSelectedLive ? mediaFeed?.isProgramMuted : mediaFeed?.isPreviewMuted) ? (
                    <VolumeX className="h-3.5 w-3.5" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={mediaFeed?.transport.duration || 100}
                  step={0.1}
                  value={mediaFeed?.transport.currentTime ?? 0}
                  onChange={(e) => mediaFeed?.seek(Number(e.target.value))}
                  className="min-w-0 flex-1 accent-violet-500"
                />
                <span className="shrink-0 font-mono text-[8px] text-mixer-muted">
                  {formatTime(mediaFeed?.transport.currentTime ?? 0)} / {formatTime(mediaFeed?.transport.duration ?? 0)}
                </span>
              </div>
              <div>
                <p className="mb-1 text-[8px] font-bold tracking-wider text-violet-300">
                  {isSelectedLive ? 'PROGRAM AUDIO' : 'PREVIEW AUDIO'}
                </p>
                <InputAudioVisualizer
                  stream={meterStream}
                  enabled={meterEnabled}
                  accent={isSelectedLive ? 'red' : 'green'}
                  compact
                  layout="strip"
                  size="sm"
                  className="w-full"
                />
              </div>
            </>
          )}

          {selectedItem.library && (
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => playInPreview(selectedItem.library!)}
                className={cn(
                  'flex items-center justify-center gap-1 rounded px-2 py-1.5 text-[9px] font-bold tracking-wider',
                  isSelectedStaged && !isSelectedLive
                    ? 'bg-violet-600/40 text-violet-100 ring-1 ring-violet-400/50'
                    : 'bg-white/10 text-white hover:bg-white/20',
                )}
              >
                <Monitor className="h-3 w-3" />
                {isSelectedStaged && !isSelectedLive ? 'IN PREVIEW' : 'PLAY IN PREVIEW'}
              </button>
              <button
                type="button"
                onClick={() => takeLive(selectedItem.library!)}
                className={cn(
                  'rounded px-2 py-1.5 text-[9px] font-bold tracking-wider',
                  isSelectedLive
                    ? 'bg-emerald-600/30 text-emerald-200 ring-1 ring-emerald-400/50'
                    : 'bg-mixer-red/80 text-white hover:bg-mixer-red',
                )}
              >
                {isSelectedLive ? '● LIVE — CUT OFF' : 'GO LIVE'}
              </button>
            </div>
          )}

          {selectedItem.kind === 'image' && selectedItem.overlay && (
            <>
              <label className="flex items-center gap-2 text-[8px] text-mixer-muted">
                <input
                  type="checkbox"
                  checked={selectedItem.overlay.fillScreen ?? false}
                  onChange={(e) => patchSelectedImage({ fillScreen: e.target.checked })}
                />
                Full screen
              </label>
              {!selectedItem.overlay.fillScreen && (
                <>
                  <div>
                    <label className="text-[8px] text-mixer-muted">Size {selectedItem.overlay.scale}%</label>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      value={selectedItem.overlay.scale}
                      onChange={(e) => patchSelectedImage({ scale: Number(e.target.value) })}
                      className="w-full accent-mixer-red"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {POSITIONS.map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() =>
                          patchSelectedImage({
                            position: pos,
                            xPercent: PRESET_PLACEMENT[pos].xPercent,
                            yPercent: PRESET_PLACEMENT[pos].yPercent,
                          })
                        }
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[7px] font-bold uppercase',
                          selectedItem.overlay?.position === pos
                            ? 'bg-violet-600/40 text-violet-100'
                            : 'bg-white/5 text-mixer-muted hover:text-white',
                        )}
                      >
                        {pos.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div>
                <label className="text-[8px] text-mixer-muted">Opacity {selectedItem.overlay.opacity}%</label>
                <input
                  type="range"
                  min={20}
                  max={100}
                  value={selectedItem.overlay.opacity}
                  onChange={(e) => patchSelectedImage({ opacity: Number(e.target.value) })}
                  className="w-full accent-mixer-green"
                />
              </div>
            </>
          )}

          {selectedItem.kind === 'video' && (() => {
            const videoOverlay = layers.videoOverlays.find((o) => o.id === selectedItem.id);
            if (!videoOverlay) return null;
            return (
            <>
              <label className="flex items-center gap-2 text-[8px] text-mixer-muted">
                <input
                  type="checkbox"
                  checked={videoOverlay.fillScreen}
                  onChange={(e) => patchSelectedVideo({ fillScreen: e.target.checked })}
                />
                Full screen (covers program)
              </label>
              {!videoOverlay.fillScreen && (
                <div>
                  <label className="text-[8px] text-mixer-muted">Size {videoOverlay.scale}%</label>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={videoOverlay.scale}
                    onChange={(e) => patchSelectedVideo({ scale: Number(e.target.value) })}
                    className="w-full accent-mixer-red"
                  />
                </div>
              )}
              <label className="flex items-center gap-2 text-[8px] text-mixer-muted">
                <input
                  type="checkbox"
                  checked={videoOverlay.loop}
                  onChange={(e) => patchSelectedVideo({ loop: e.target.checked })}
                />
                Loop
              </label>
              <label className="flex items-center gap-2 text-[8px] text-mixer-muted">
                <input
                  type="checkbox"
                  checked={!videoOverlay.muted}
                  onChange={(e) => patchSelectedVideo({ muted: !e.target.checked })}
                />
                Audio on program (when live)
              </label>
            </>
            );
          })()}

          {isSelectedStaged && (
            <p className="flex items-center gap-1 text-[8px] text-mixer-green">
              <Move className="h-3 w-3" />
              Drag on Preview or Program to reposition live graphics.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
