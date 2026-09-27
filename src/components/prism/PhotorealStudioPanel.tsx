import { useEffect, useMemo, useState } from 'react';
import {
  Aperture,
  ArrowRightLeft,
  Boxes,
  Camera,
  ChevronDown,
  ChevronUp,
  Copy,
  Image as ImageIcon,
  MonitorPlay,
  Move3d,
  Palette,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Save,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { PlanTier } from '../../types/plans';
import type {
  PhotorealStudioState,
  StudioCameraPreset,
  StudioEffectOverrides,
  StudioGraphicContent,
  StudioPlacedElement,
  StudioProductionMode,
  StudioRundownStep,
  StudioScreenSource,
  StudioTalentPlacement,
  StudioTransitionStyle,
} from '../../lib/virtualStudio/types';
import { DEFAULT_STUDIO_TRANSITION, seatedTalentPlacement, standingTalentPlacement } from '../../lib/virtualStudio/types';
import { getStudioScene, STUDIO_SCENES, studioScenesForPlan } from '../../lib/virtualStudio/sceneRegistry';
import {
  clampBloomIntensity,
  clampCameraPreset,
  clampExposure,
  clampEffectOverrides,
  clampLighting,
  clampRundown,
  clampTemperature,
  clampTickerSpeed,
  MIN_ZOOM,
  MAX_ZOOM,
  MOOD_PRESETS,
  normalizeShotMemories,
  resolveShot,
  saveShotMemory,
  SHOT_LABELS,
  SHOT_ORDER,
  temperatureColor,
} from '../../lib/virtualStudio/productionDesk';
import { studioQualityPreset } from '../../lib/virtualStudio/quality';
import {
  clampElementElevation,
  clampElementPosition,
  createPlacedElement,
  getStudioElement,
  normalizeElementScale,
  STUDIO_ELEMENT_CATEGORIES,
  studioElementsForPlan,
  type StudioElementCategory,
} from '../../lib/virtualStudio/elementCatalog';
import { importMediaFileToWorkspace, resolveWorkspaceMediaUrl } from '../../lib/mediaUpload';
import { mergeCloudMediaLibrary } from '../../lib/mixerMediaService';
import type { MediaLibraryItem } from '../../types/overlays';
import { NewsGraphicsPanel } from './NewsGraphicsPanel';

/** Camera transition styles offered on the production desk. */
const TRANSITION_STYLES: { id: StudioTransitionStyle; label: string; hint: string }[] = [
  { id: 'cut', label: 'CUT', hint: 'Instant hard cut between shots' },
  { id: 'dissolve', label: 'DISSOLVE', hint: 'Slow, soft cross-move' },
  { id: 'jib', label: 'JIB', hint: 'Crane sweep with a lifted arc' },
  { id: 'whip', label: 'WHIP', hint: 'Fast dart with a zoom punch' },
  { id: 'crane', label: 'CRANE', hint: 'Tall arc crane with lens breathing' },
  { id: 'zoom', label: 'PUNCH', hint: 'Dolly punch — pushes in mid-move' },
];

/**
 * Operator panel for the photoreal virtual studio: pick a finished scene,
 * bind every screen (LED wall, TV, ribbon, banner) to a live feed, image,
 * video or generated broadcast graphic, and replace the whole backdrop.
 * The production desk adds camera shots & memories, colour temperature,
 * exposure, accent colour and per-effect render overrides, plus the drag &
 * drop element library (plants, furniture, screens, lighting, decor).
 */

export interface PhotorealStudioPanelProps {
  planId: PlanTier;
  photoreal: PhotorealStudioState;
  cameraActive: boolean;
  getCameraVideo: () => HTMLVideoElement | null;
  /** Current studio camera pose — the shot desk reads and recalls through it. */
  cameraPose: StudioCameraPreset;
  onRecallShot: (pose: StudioCameraPreset) => void;
  /** Element selection shared with the 3D stage (drag layer highlights it). */
  selectedElementId?: string | null;
  onSelectElement: (id: string | null) => void;
  onSelectScene: (sceneId: string) => void;
  onUseClassic: () => void;
  /** Jump to the chroma key desk (USB capture keying controls). */
  onOpenKeyer?: () => void;
  onPatch: (patch: Partial<PhotorealStudioState>) => void;
  /** Current production mode (VS / AR / XR) shown on the stage switcher. */
  mode?: StudioProductionMode;
  /** Switch production mode without leaving the production engine. */
  onSelectMode?: (mode: StudioProductionMode) => void;
  /** Whether the current plan unlocks AR / XR. */
  canUseAr?: boolean;
}

type SourceChoice = 'default' | 'off' | 'camera' | 'image' | 'video' | 'graphic';

const GRAPHIC_STYLES: {
  id: 'slate' | 'lower-third' | 'scorebug' | 'logo' | 'breaking' | 'crawler' | 'headline' | 'strap';
  label: string;
}[] = [
  { id: 'slate', label: 'Slate' },
  { id: 'lower-third', label: 'Lower third' },
  { id: 'scorebug', label: 'Scorebug' },
  { id: 'logo', label: 'Logo card' },
  { id: 'breaking', label: 'Breaking banner' },
  { id: 'crawler', label: 'News crawl' },
  { id: 'headline', label: 'Headline stack' },
  { id: 'strap', label: 'Name strap' },
];

const GRAPHIC_PRESETS: { label: string; content: StudioGraphicContent }[] = [
  { label: 'BREAKING', content: { style: 'breaking', text: 'BREAKING STORY UNFOLDING', subtext: 'Stay with Regal News for live updates', name: 'LIVE COVERAGE', role: 'DEVELOPING', background: '#070a12', accent: '#c8102e', animated: true } },
  { label: 'CRAWL', content: { style: 'crawler', text: 'WORLD NEWS ROUNDUP', subtext: 'The stories shaping the day', source: 'REGAL NEWS', role: 'BREAKING', items: ['Markets rally as central banks signal rate pause', 'Summit opens with landmark climate accord', 'Space telescope reveals new distant galaxies'], background: '#0a1226', accent: '#c8102e', animated: true } },
  { label: 'TOP STORIES', content: { style: 'headline', text: 'TOP STORIES', source: 'REGAL NEWS', items: ['Global leaders gather for emergency summit', 'Markets steady after inflation report', 'Tech giants unveil new AI standards', 'Championship finals set for weekend'], background: '#0c1526', accent: '#c8102e' } },
  { label: 'STRAP', content: { style: 'strap', name: 'JANE DOE', role: 'Senior Correspondent', source: 'LIVE', footer: 'Reporting from the newsroom', background: '#0b1020', accent: '#e11d48' } },
  { label: 'LIVE', content: { style: 'slate', text: 'LIVE', subtext: 'ON AIR NOW', background: '#0b1020', accent: '#e11d48' } },
  { label: 'UP NEXT', content: { style: 'slate', text: 'UP NEXT', subtext: 'STAY TUNED', background: '#0c2a4a', accent: '#38bdf8' } },
  { label: 'SCORE', content: { style: 'scorebug', text: 'HOME 24', subtext: 'AWAY 21', detail: 'Q4 · 02:31', background: '#0b1020', accent: '#f59e0b' } },
  { label: 'THANKS', content: { style: 'logo', text: 'THANK YOU', subtext: 'FOR WATCHING', background: '#111827', accent: '#a78bfa' } },
];

const DEFAULT_GRAPHIC: StudioGraphicContent = {
  style: 'slate',
  text: 'ON AIR',
  background: '#0b1020',
  accent: '#e11d48',
  foreground: '#ffffff',
};

function choiceFor(source: StudioScreenSource | undefined, hasDefault: boolean): SourceChoice {
  if (!source) return hasDefault ? 'default' : 'off';
  switch (source.kind) {
    case 'live-video':
      return 'camera';
    case 'image-url':
      return 'image';
    case 'video-url':
      return 'video';
    case 'graphic':
      return 'graphic';
    case 'off':
      return 'off';
    case 'canvas':
      return 'off';
  }
}

function urlFor(source: StudioScreenSource | undefined): string {
  if (source?.kind === 'image-url' || source?.kind === 'video-url') return source.url;
  return '';
}

export function PhotorealStudioPanel({
  planId,
  photoreal,
  cameraActive,
  getCameraVideo,
  cameraPose,
  onRecallShot,
  selectedElementId,
  onSelectElement,
  onSelectScene,
  onUseClassic,
  onOpenKeyer,
  onPatch,
  mode = 'virtual_studio',
  onSelectMode,
  canUseAr = false,
}: PhotorealStudioPanelProps) {
  const unlocked = useMemo(() => studioScenesForPlan(planId), [planId]);
  const unlockedIds = useMemo(() => new Set(unlocked.map((s) => s.id)), [unlocked]);
  const scene = getStudioScene(photoreal.sceneId);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [elementCategory, setElementCategory] = useState<StudioElementCategory | 'all'>('all');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [axesUnlocked, setAxesUnlocked] = useState(false);
  const cameraVideo = cameraActive ? getCameraVideo() : null;

  const elements = photoreal.elements ?? [];
  const catalog = useMemo(() => studioElementsForPlan(planId), [planId]);
  const unlockedElementIds = useMemo(() => new Set(catalog.map((e) => e.id)), [catalog]);
  const visibleElements = useMemo(
    () => (elementCategory === 'all' ? catalog : catalog.filter((e) => e.category === elementCategory)),
    [catalog, elementCategory],
  );
  const selectedElement = elements.find((e) => e.id === selectedElementId) ?? null;
  const selectedDef = selectedElement ? getStudioElement(selectedElement.elementId) : null;

  /** Defensive clamp so bad input can never push the renderer out of range. */
  const patch = (partial: Partial<PhotorealStudioState>) => {
    const next = { ...partial };
    if (next.lighting !== undefined) next.lighting = clampLighting(next.lighting);
    if (next.tickerSpeed !== undefined) next.tickerSpeed = clampTickerSpeed(next.tickerSpeed);
    if (next.temperature !== undefined) next.temperature = clampTemperature(next.temperature);
    if (next.exposure !== undefined) next.exposure = clampExposure(next.exposure);
    if (next.effects !== undefined) next.effects = clampEffectOverrides(next.effects);
    if (next.shots !== undefined) next.shots = normalizeShotMemories(next.shots);
    if (next.rundown !== undefined) next.rundown = clampRundown(next.rundown) ?? [];
    onPatch(next);
  };

  /* ------------------------------------------------------------- autocam */

  const rundown = photoreal.rundown ?? [];
  const [camPlaying, setCamPlaying] = useState(false);
  const [camStep, setCamStep] = useState(0);
  /** Playback only rolls while a rundown exists — derived so effects stay pure. */
  const playing = camPlaying && rundown.length > 0;

  // Glides the jib to each rundown shot, holds, then moves on — looping until stopped.
  useEffect(() => {
    if (!playing) return;
    const steps = photoreal.rundown ?? [];
    const index = Math.min(camStep, steps.length - 1);
    const step = steps[index];
    if (!step) return;
    onRecallShot(clampCameraPreset(step.pose));
    const timer = window.setTimeout(
      () => setCamStep((s) => (s + 1) % steps.length),
      Math.max(1, step.duration) * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [playing, camStep, photoreal.rundown, onRecallShot]);

  const addRundownStep = () => {
    const steps: StudioRundownStep[] = [
      ...rundown,
      { label: `Shot ${rundown.length + 1}`, pose: clampCameraPreset(cameraPose), duration: 6 },
    ];
    patch({ rundown: steps });
  };

  const updateRundownStep = (index: number, partial: Partial<StudioRundownStep>) => {
    patch({ rundown: rundown.map((s, i) => (i === index ? { ...s, ...partial } : s)) });
  };

  const moveRundownStep = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= rundown.length) return;
    const steps = [...rundown];
    [steps[index], steps[target]] = [steps[target], steps[index]];
    patch({ rundown: steps });
  };

  /* ----------------------------------------------------------- elements */

  const addElement = (elementId: string) => {
    const placed = createPlacedElement(elementId, elements.length);
    if (!placed) return;
    patch({ elements: [...elements, placed] });
    onSelectElement(placed.id);
  };

  const updateElement = (id: string, update: Partial<StudioPlacedElement>) => {
    patch({ elements: elements.map((e) => (e.id === id ? { ...e, ...update } : e)) });
  };

  const duplicateElement = (element: StudioPlacedElement) => {
    const [x, z] = clampElementPosition(element.position[0] + 0.9, element.position[1] + 0.5);
    const copy: StudioPlacedElement = { ...element, id: crypto.randomUUID(), position: [x, z] };
    patch({ elements: [...elements, copy] });
    onSelectElement(copy.id);
  };

  const removeElement = (id: string) => {
    patch({ elements: elements.filter((e) => e.id !== id) });
    if (selectedElementId === id) onSelectElement(null);
  };

  /* ------------------------------------------------------------- upload */

  /**
   * Local file → live screen source. Images and videos are saved to the
   * CloudCast workspace (Regal Cloud media library) so they persist across
   * sessions and can be reused from the media library.
   */
  const pickUpload = (onChange: (source: StudioScreenSource | null) => void) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void (async () => {
        try {
          setUploadError(null);
          setUploadNotice('Uploading to workspace…');
          const { item, savedToWorkspace, storagePath } = await importMediaFileToWorkspace(file);
          setUploadNotice(
            savedToWorkspace
              ? `Saved to workspace · ${item.name}`
              : `Using local copy · sign in to save “${item.name}” to the workspace`,
          );
          const workspaceRefs = storagePath ? { mediaId: item.id, storagePath } : {};
          onChange(
            item.kind === 'image'
              ? { kind: 'image-url', url: item.playUrl, label: item.name, ...workspaceRefs }
              : { kind: 'video-url', url: item.playUrl, loop: true, label: item.name, ...workspaceRefs },
          );
        } catch (err) {
          setUploadNotice(null);
          setUploadError(err instanceof Error ? err.message : 'Upload failed.');
        }
      })();
    };
    input.click();
  };

  /** Workspace (Regal Cloud) media library picker. */
  const [libraryKey, setLibraryKey] = useState<string | null>(null);
  const [workspaceMedia, setWorkspaceMedia] = useState<MediaLibraryItem[] | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(false);

  const openLibrary = (key: string) => {
    setLibraryKey((prev) => (prev === key ? null : key));
    if (workspaceMedia !== null || libraryLoading) return;
    setLibraryLoading(true);
    void (async () => {
      try {
        const items = await mergeCloudMediaLibrary([]);
        setWorkspaceMedia(items.filter((i) => i.kind === 'image' || i.kind === 'video').slice(0, 24));
      } catch {
        setWorkspaceMedia([]);
      } finally {
        setLibraryLoading(false);
      }
    })();
  };

  /** Re-resolves expired workspace URLs for saved bindings when the panel opens. */
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const entries = Object.entries(photoreal.bindings);
      let changed = false;
      const next = { ...photoreal.bindings };
      for (const [slotId, source] of entries) {
        if ((source.kind === 'image-url' || source.kind === 'video-url') && source.storagePath) {
          const url = await resolveWorkspaceMediaUrl(source.storagePath);
          if (!cancelled && url && url !== source.url) {
            next[slotId] = { ...source, url };
            changed = true;
          }
        }
      }
      const backdrop = photoreal.backdrop;
      let nextBackdrop = backdrop;
      if (backdrop && (backdrop.kind === 'image-url' || backdrop.kind === 'video-url') && backdrop.storagePath) {
        const url = await resolveWorkspaceMediaUrl(backdrop.storagePath);
        if (!cancelled && url && url !== backdrop.url) nextBackdrop = { ...backdrop, url };
      }
      if (!cancelled && (changed || nextBackdrop !== backdrop)) {
        onPatch({ bindings: changed ? next : photoreal.bindings, backdrop: nextBackdrop });
      }
    };
    void refresh();
    return () => {
      cancelled = true;
    };
    // Only on mount — presigned URLs are refreshed when the studio opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const baseCamera = scene?.camera ?? { yaw: 0, pitch: 0.12, zoom: 1 };
  const shots = normalizeShotMemories(photoreal.shots);

  /** Default on/off for an effect when the operator has not overridden it. */
  const effectDefault = (key: 'bloom' | 'depthOfField' | 'vignette' | 'ao' | 'smaa'): boolean => {
    const override = photoreal.effects?.[key];
    if (override !== undefined) return override;
    // Follow the quality preset; `auto` reads as balanced.
    const preset = studioQualityPreset(photoreal.quality === 'auto' ? 'balanced' : photoreal.quality);
    return key === 'smaa' ? preset.antialias === 'smaa' : preset[key];
  };

  const setEffect = (key: keyof StudioEffectOverrides, value: boolean | number) => {
    patch({ effects: { ...(photoreal.effects ?? {}), [key]: value } });
  };

  const setBinding = (slotId: string, source: StudioScreenSource | null) => {
    // Keep raw bindings (including live video/canvas) in state — only the
    // cloud-save path serializes and drops session-only sources.
    const bindings = { ...photoreal.bindings };
    if (source === null) delete bindings[slotId];
    else bindings[slotId] = source;
    patch({ bindings });
  };

  const buildSource = (
    choice: SourceChoice,
    current: StudioScreenSource | undefined,
    key: string,
  ): StudioScreenSource | null => {
    switch (choice) {
      case 'default':
        return null;
      case 'off':
        return { kind: 'off' };
      case 'camera':
        return cameraVideo ? { kind: 'live-video', video: cameraVideo, label: 'Camera' } : null;
      case 'image':
        return { kind: 'image-url', url: urlFor(current) || urls[key] || '' };
      case 'video':
        return { kind: 'video-url', url: urlFor(current) || urls[key] || '', loop: true };
      case 'graphic':
        return {
          kind: 'graphic',
          content: current?.kind === 'graphic' ? current.content : { ...DEFAULT_GRAPHIC },
        };
    }
  };

  /** Select + URL field shared by slot rows and the backdrop replacement row. */
  const sourcePicker = (
    key: string,
    current: StudioScreenSource | undefined,
    hasDefault: boolean,
    onChange: (source: StudioScreenSource | null) => void,
  ) => {
    const choice = choiceFor(current, hasDefault);
    const url = urlFor(current);
    const pick = (next: SourceChoice) => {
      const source = buildSource(next, current, key);
      if (next === 'camera' && !source) return;
      onChange(source);
    };
    const graphic = current?.kind === 'graphic' ? current.content : DEFAULT_GRAPHIC;
    const setGraphic = (partial: Partial<StudioGraphicContent>) =>
      onChange({ kind: 'graphic', content: { ...graphic, ...partial } });
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <select
            value={choice}
            onChange={(e) => pick(e.target.value as SourceChoice)}
            className="min-w-0 flex-1 rounded border border-white/10 bg-black px-1.5 py-1 text-[10px] outline-none focus:border-amber-500/40"
          >
            {hasDefault && <option value="default">Scene default</option>}
            <option value="off">Off</option>
            <option value="camera" disabled={!cameraVideo}>
              {cameraVideo ? 'Live camera' : 'Camera (start camera)'}
            </option>
            <option value="image">Image URL</option>
            <option value="video">Video URL</option>
            <option value="graphic">Broadcast graphic</option>
          </select>
          <button
            type="button"
            title="Upload an image or video from this device — saves to the workspace"
            onClick={() =>
              pickUpload((source) => {
                if (source) onChange(source);
              })
            }
            className="flex shrink-0 items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-1 text-[9px] font-bold tracking-wider text-amber-300 hover:border-amber-500/60"
          >
            <Upload className="h-3 w-3" /> UPLOAD
          </button>
          <button
            type="button"
            title="Pick from the workspace media library"
            onClick={() => openLibrary(key)}
            className={cn(
              'flex shrink-0 items-center gap-1 rounded border px-1.5 py-1 text-[9px] font-bold tracking-wider hover:border-amber-500/60',
              libraryKey === key
                ? 'border-amber-500/60 bg-amber-500/15 text-amber-200'
                : 'border-white/10 text-mixer-muted hover:text-white',
            )}
          >
            <ImageIcon className="h-3 w-3" /> LIBRARY
          </button>
        </div>
        {libraryKey === key && (
          <div className="rounded border border-white/10 bg-black/60 p-1.5">
            {libraryLoading && <p className="text-[9px] text-mixer-muted">Loading workspace media…</p>}
            {!libraryLoading && workspaceMedia?.length === 0 && (
              <p className="text-[9px] leading-snug text-mixer-muted">
                No saved workspace media yet — UPLOAD saves images and videos here automatically.
              </p>
            )}
            <div className="max-h-28 space-y-0.5 overflow-y-auto">
              {(workspaceMedia ?? []).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    const refs = m.storagePath ? { mediaId: m.id, storagePath: m.storagePath } : {};
                    onChange(
                      m.kind === 'image'
                        ? { kind: 'image-url', url: m.playUrl, label: m.name, ...refs }
                        : { kind: 'video-url', url: m.playUrl, loop: true, label: m.name, ...refs },
                    );
                    setLibraryKey(null);
                  }}
                  className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-[9px] hover:bg-white/10"
                >
                  <span
                    className={cn(
                      'shrink-0 rounded px-1 py-0.5 text-[7px] font-bold',
                      m.kind === 'image' ? 'bg-sky-500/20 text-sky-300' : 'bg-purple-500/20 text-purple-300',
                    )}
                  >
                    {m.kind === 'image' ? 'IMG' : 'VID'}
                  </span>
                  <span className="truncate">{m.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {(choice === 'image' || choice === 'video') && (
          <div className="flex items-center gap-1">
            <input
              type="url"
              value={url}
              placeholder={choice === 'image' ? 'https://…/image.jpg' : 'https://…/feed.mp4'}
              onChange={(e) => {
                const value = e.target.value;
                setUrls((prev) => ({ ...prev, [key]: value }));
                onChange({
                  kind: choice === 'image' ? 'image-url' : 'video-url',
                  url: value,
                  ...(choice === 'video' ? { loop: true } : {}),
                });
              }}
              className="min-w-0 flex-1 rounded border border-white/10 bg-black px-1.5 py-1 text-[10px] outline-none focus:border-amber-500/40"
            />
            {url && (
              <button
                type="button"
                title="Clear"
                onClick={() => onChange(hasDefault ? null : { kind: 'off' })}
                className="rounded border border-white/10 p-1 text-mixer-muted hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
        {choice === 'graphic' && (
          <div className="space-y-1 rounded border border-white/10 bg-black/30 p-1.5">
            <div className="flex flex-wrap gap-1">
              {GRAPHIC_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => onChange({ kind: 'graphic', content: { ...preset.content } })}
                  className="rounded border border-white/10 px-1 py-0.5 text-[8px] font-bold tracking-wider text-mixer-muted hover:border-amber-500/40 hover:text-amber-300"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <select
              value={graphic.style}
              onChange={(e) => setGraphic({ style: e.target.value as StudioGraphicContent['style'] })}
              className="w-full rounded border border-white/10 bg-black px-1.5 py-1 text-[10px] outline-none focus:border-amber-500/40"
            >
              {GRAPHIC_STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={graphic.text ?? ''}
              placeholder="Headline"
              onChange={(e) => setGraphic({ text: e.target.value })}
              className="w-full rounded border border-white/10 bg-black px-1.5 py-1 text-[10px] outline-none focus:border-amber-500/40"
            />
            <input
              type="text"
              value={graphic.subtext ?? ''}
              placeholder="Sub-headline"
              onChange={(e) => setGraphic({ subtext: e.target.value })}
              className="w-full rounded border border-white/10 bg-black px-1.5 py-1 text-[10px] outline-none focus:border-amber-500/40"
            />
            <input
              type="text"
              value={graphic.detail ?? ''}
              placeholder="Detail / clock (scorebug)"
              onChange={(e) => setGraphic({ detail: e.target.value })}
              className="w-full rounded border border-white/10 bg-black px-1.5 py-1 text-[10px] outline-none focus:border-amber-500/40"
            />
            {(graphic.style === 'breaking' ||
              graphic.style === 'crawler' ||
              graphic.style === 'headline' ||
              graphic.style === 'strap') && (
              <>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={graphic.name ?? ''}
                    placeholder={graphic.style === 'strap' ? 'Name ident' : 'Strap label'}
                    onChange={(e) => setGraphic({ name: e.target.value })}
                    className="min-w-0 flex-1 rounded border border-white/10 bg-black px-1.5 py-1 text-[10px] outline-none focus:border-amber-500/40"
                  />
                  <input
                    type="text"
                    value={graphic.role ?? ''}
                    placeholder="Role / tag"
                    onChange={(e) => setGraphic({ role: e.target.value })}
                    className="min-w-0 flex-1 rounded border border-white/10 bg-black px-1.5 py-1 text-[10px] outline-none focus:border-amber-500/40"
                  />
                </div>
                <input
                  type="text"
                  value={graphic.source ?? ''}
                  placeholder="Channel bug / source (e.g. REGAL NEWS)"
                  onChange={(e) => setGraphic({ source: e.target.value })}
                  className="w-full rounded border border-white/10 bg-black px-1.5 py-1 text-[10px] outline-none focus:border-amber-500/40"
                />
                {(graphic.style === 'crawler' || graphic.style === 'headline') && (
                  <textarea
                    value={(graphic.items ?? []).join('\n')}
                    placeholder={'Headline lines — one per line\ncrawl items scroll; headline rows stack'}
                    onChange={(e) =>
                      setGraphic({
                        items: e.target.value
                          .split('\n')
                          .map((line) => line.trim())
                          .filter(Boolean),
                      })
                    }
                    rows={3}
                    className="w-full resize-y rounded border border-white/10 bg-black px-1.5 py-1 text-[10px] outline-none focus:border-amber-500/40"
                  />
                )}
                {(graphic.style === 'breaking' || graphic.style === 'crawler') && (
                  <label className="flex items-center gap-1.5 text-[9px] text-mixer-muted">
                    <input
                      type="checkbox"
                      checked={Boolean(graphic.animated)}
                      onChange={(e) => setGraphic({ animated: e.target.checked })}
                    />
                    Live animation (crawl scroll, pulsing dot)
                  </label>
                )}
              </>
            )}
            <div className="flex items-center gap-2">
              {(
                [
                  { key: 'background' as const, label: 'BG', fallback: '#0b1020' },
                  { key: 'accent' as const, label: 'ACCENT', fallback: '#e11d48' },
                  { key: 'foreground' as const, label: 'TEXT', fallback: '#ffffff' },
                ]
              ).map((swatch) => (
                <label key={swatch.key} className="flex items-center gap-1 text-[8px] font-bold tracking-wider text-mixer-muted">
                  {swatch.label}
                  <input
                    type="color"
                    value={graphic[swatch.key] ?? swatch.fallback}
                    onChange={(e) => setGraphic({ [swatch.key]: e.target.value })}
                    className="h-5 w-7 cursor-pointer rounded border border-white/10 bg-black"
                  />
                </label>
              ))}
            </div>
            <p className="text-[8px] leading-snug text-mixer-muted">
              Graphics render live onto the screen in 3D — great for tickers, slates and scorebugs.
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-xs font-bold tracking-wider">
          <Aperture className="h-3.5 w-3.5 text-amber-400" />
          PHOTOREAL STUDIO
        </h2>
        <button
          type="button"
          onClick={onUseClassic}
          className="rounded border border-white/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-mixer-muted hover:border-white/40 hover:text-white"
        >
          CLASSIC SETS
        </button>
      </div>

      <section>
        <p className="mb-1.5 text-[10px] font-bold tracking-wider text-amber-400/90">STAGE MODE</p>
        <div className="grid grid-cols-3 gap-1">
          {([
            { id: 'virtual_studio', label: 'VS', name: 'Virtual Studio — full 3D set' },
            { id: 'augmented_reality', label: 'AR', name: 'Augmented Reality — live plate + 3D' },
            { id: 'xr_extension', label: 'XR', name: 'XR — LED volume + set extension' },
          ] as const).map((m) => {
            const locked = m.id !== 'virtual_studio' && !canUseAr;
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                disabled={locked || !onSelectMode}
                title={locked ? 'Unlocks on Pro and above' : m.name}
                onClick={() => onSelectMode?.(m.id)}
                className={cn(
                  'rounded border px-1 py-1.5 text-[9px] font-bold tracking-wider transition-colors',
                  active
                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                    : 'border-white/10 bg-black/40 text-mixer-muted hover:border-white/25 hover:text-white',
                  locked && 'cursor-not-allowed opacity-40',
                )}
              >
                {m.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[9px] leading-snug text-mixer-muted">
          {mode === 'augmented_reality'
            ? 'AR locks your live feed as the back plate and composites 3D graphics over it.'
            : mode === 'xr_extension'
              ? 'XR opens an LED volume with set extension and a wide establishing lens.'
              : 'VS renders the full 3D set behind your keyed talent.'}
        </p>
      </section>

      <section>
        <p className="mb-1.5 text-[10px] font-bold tracking-wider text-amber-400/90">READY-TO-AIR SCENES</p>
        <div className="space-y-1.5">
          {STUDIO_SCENES.map((s) => {
            const locked = !unlockedIds.has(s.id);
            const active = photoreal.sceneId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                disabled={locked}
                title={locked ? `Unlocks on the ${s.tier.replace('_', ' ')} plan` : s.description}
                onClick={() => onSelectScene(s.id)}
                className={cn(
                  'block w-full rounded border px-2 py-1.5 text-left transition-colors',
                  active
                    ? 'border-amber-500/50 bg-amber-500/10'
                    : locked
                      ? 'cursor-not-allowed border-white/5 bg-black/20 opacity-50'
                      : 'border-white/10 bg-black/40 hover:border-white/25',
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">{s.name}</span>
                  <span className="shrink-0 rounded bg-white/10 px-1 text-[8px] font-bold uppercase tracking-wider text-mixer-muted">
                    {locked ? `LOCKED · ${s.tier.replace('_', ' ')}` : s.category}
                  </span>
                </span>
                <span className="mt-0.5 block text-[10px] leading-snug text-mixer-muted">{s.description}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[9px] text-mixer-muted">
          {unlocked.length}/{STUDIO_SCENES.length} scenes unlocked on your plan.
        </p>
      </section>

      <section>
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-amber-400/90">
          <Camera className="h-3 w-3" /> CAMERA DESK
        </p>
        <div className="grid grid-cols-4 gap-1">
          {SHOT_ORDER.map((shot) => (
            <button
              key={shot}
              type="button"
              title={`Glide to the ${SHOT_LABELS[shot].toLowerCase()} framing`}
              onClick={() => onRecallShot(clampCameraPreset(resolveShot(baseCamera, shot)))}
              className="rounded border border-white/10 bg-black/40 px-1 py-1.5 text-[9px] font-bold tracking-wider text-mixer-muted hover:border-amber-500/40 hover:text-amber-300"
            >
              {SHOT_LABELS[shot]}
            </button>
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-4 gap-1">
          {shots.map((shot, i) => (
            <div
              key={i}
              className={cn(
                'rounded border px-1 py-1 text-center',
                shot ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10 bg-black/40',
              )}
            >
              <p className="text-[9px] font-bold tracking-wider text-mixer-muted">M{i + 1}</p>
              <div className="mt-0.5 flex items-center justify-center gap-0.5">
                <button
                  type="button"
                  title="Save the current framing"
                  onClick={() => patch({ shots: saveShotMemory(shots, i, cameraPose) })}
                  className="rounded border border-white/10 p-0.5 text-mixer-muted hover:border-amber-500/40 hover:text-amber-300"
                >
                  <Save className="h-2.5 w-2.5" />
                </button>
                <button
                  type="button"
                  title="Recall this shot"
                  disabled={!shot}
                  onClick={() => shot && onRecallShot(shot)}
                  className={cn(
                    'rounded border border-white/10 p-0.5',
                    shot ? 'text-amber-300 hover:border-amber-500/40' : 'cursor-not-allowed text-white/20',
                  )}
                >
                  <Camera className="h-2.5 w-2.5" />
                </button>
                {shot && (
                  <button
                    type="button"
                    title="Clear this memory"
                    onClick={() => patch({ shots: shots.map((s, j) => (j === i ? null : s)) })}
                    className="rounded border border-white/10 p-0.5 text-mixer-muted hover:text-mixer-red"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onRecallShot(clampCameraPreset(baseCamera))}
          className="mt-1.5 flex w-full items-center justify-center gap-1 rounded border border-white/10 bg-black/40 py-1 text-[9px] font-bold tracking-wider text-mixer-muted hover:border-white/25 hover:text-white"
        >
          <RotateCcw className="h-3 w-3" /> SCENE FRAMING
        </button>

        {/* ---- virtual set zoom + lens ---- */}
        <div className="mt-2 space-y-1.5 rounded border border-white/10 bg-black/40 p-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold tracking-wider text-amber-400/90">VIRTUAL SET ZOOM</p>
            <span className="text-[9px] text-mixer-muted">{cameraPose.zoom.toFixed(2)}×</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Zoom out"
              onClick={() => onRecallShot(clampCameraPreset({ ...cameraPose, zoom: cameraPose.zoom - 0.15 }))}
              className="w-6 rounded border border-white/10 py-0.5 text-[10px] font-bold text-mixer-muted hover:border-amber-500/40 hover:text-amber-300"
            >
              −
            </button>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.05}
              value={cameraPose.zoom}
              onChange={(e) =>
                onRecallShot(clampCameraPreset({ ...cameraPose, zoom: Number(e.target.value) }))
              }
              className="min-w-0 flex-1 accent-amber-500"
            />
            <button
              type="button"
              title="Zoom in"
              onClick={() => onRecallShot(clampCameraPreset({ ...cameraPose, zoom: cameraPose.zoom + 0.15 }))}
              className="w-6 rounded border border-white/10 py-0.5 text-[10px] font-bold text-mixer-muted hover:border-amber-500/40 hover:text-amber-300"
            >
              +
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {(
              [
                { label: 'WIDE', zoom: 0.7 },
                { label: 'FULL', zoom: 1 },
                { label: 'MID', zoom: 1.5 },
                { label: 'CLOSE', zoom: 2.2 },
                { label: 'TIGHT', zoom: 3.2 },
              ] as const
            ).map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => onRecallShot(clampCameraPreset({ ...cameraPose, zoom: preset.zoom }))}
                className={cn(
                  'rounded border px-1.5 py-0.5 text-[8px] font-bold tracking-wider',
                  Math.abs(cameraPose.zoom - preset.zoom) < 0.08
                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                    : 'border-white/10 text-mixer-muted hover:text-white',
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[8px] font-bold tracking-wider text-mixer-muted">LENS</span>
            {(
              [
                { label: '24° TEL', fov: 24 },
                { label: '38° STD', fov: 38 },
                { label: '50° WIDE', fov: 50 },
              ] as const
            ).map((lens) => (
              <button
                key={lens.label}
                type="button"
                title={`Switch to the ${lens.label} lens`}
                onClick={() => onRecallShot(clampCameraPreset({ ...cameraPose, fov: lens.fov }))}
                className={cn(
                  'rounded border px-1.5 py-0.5 text-[8px] font-bold tracking-wider',
                  Math.abs((cameraPose.fov ?? 38) - lens.fov) < 1
                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                    : 'border-white/10 text-mixer-muted hover:text-white',
                )}
              >
                {lens.label}
              </button>
            ))}
          </div>
          <p className="text-[8px] leading-snug text-mixer-muted">
            Zoom glides like a jib · switch lenses for telephoto compression or a wide establishing look.
          </p>
        </div>
        <div className="mt-2 space-y-1.5 rounded border border-white/10 bg-black/40 p-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold tracking-wider text-amber-400/90">AUTOCAM RUNDOWN</p>
            {playing && (
              <span className="flex items-center gap-1 text-[8px] font-bold tracking-wider text-mixer-red">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mixer-red" /> ON AIR
              </span>
            )}
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              title="Add the current framing as a rundown shot"
              onClick={addRundownStep}
              className="flex flex-1 items-center justify-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 py-1 text-[9px] font-bold tracking-wider text-amber-300 hover:border-amber-500/60"
            >
              <Plus className="h-2.5 w-2.5" /> ADD SHOT
            </button>
            <button
              type="button"
              title={camPlaying ? 'Pause the rundown' : 'Play the rundown'}
              disabled={rundown.length === 0}
              onClick={() => setCamPlaying((p) => !p)}
              className={cn(
                'flex items-center justify-center gap-1 rounded border px-2 py-1 text-[9px] font-bold tracking-wider',
                rundown.length === 0
                  ? 'cursor-not-allowed border-white/5 text-white/20'
                  : camPlaying
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                    : 'border-white/10 text-mixer-muted hover:border-amber-500/40 hover:text-amber-300',
              )}
            >
              {camPlaying ? <Pause className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5" />}
            </button>
            <button
              type="button"
              title="Stop and rewind"
              onClick={() => {
                setCamPlaying(false);
                setCamStep(0);
              }}
              className="rounded border border-white/10 px-2 py-1 text-mixer-muted hover:text-white"
            >
              <Square className="h-2.5 w-2.5" />
            </button>
            <button
              type="button"
              title="Clear the rundown"
              onClick={() => {
                setCamPlaying(false);
                setCamStep(0);
                patch({ rundown: [] });
              }}
              className="rounded border border-white/10 px-2 py-1 text-mixer-muted hover:text-mixer-red"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </div>

          {rundown.map((step, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center gap-1 rounded border px-1.5 py-1',
                playing && camStep === i ? 'border-mixer-red/50 bg-mixer-red/10' : 'border-white/10 bg-black/30',
              )}
            >
              <button
                type="button"
                title="Jump to this shot"
                onClick={() => setCamStep(i)}
                className="min-w-0 flex-1 truncate text-left text-[9px] font-semibold"
              >
                {i + 1}. {step.label}
              </button>
              <input
                type="number"
                min={1}
                max={60}
                value={step.duration}
                title="Hold duration in seconds"
                onChange={(e) => updateRundownStep(i, { duration: Number(e.target.value) })}
                className="w-10 rounded border border-white/10 bg-black px-1 py-0.5 text-[9px] outline-none focus:border-amber-500/40"
              />
              <span className="text-[8px] text-mixer-muted">s</span>
              <button
                type="button"
                title="Move up"
                onClick={() => moveRundownStep(i, -1)}
                className="rounded border border-white/10 p-0.5 text-mixer-muted hover:text-amber-300"
              >
                <ChevronUp className="h-2.5 w-2.5" />
              </button>
              <button
                type="button"
                title="Move down"
                onClick={() => moveRundownStep(i, 1)}
                className="rounded border border-white/10 p-0.5 text-mixer-muted hover:text-amber-300"
              >
                <ChevronDown className="h-2.5 w-2.5" />
              </button>
              <button
                type="button"
                title="Remove shot"
                onClick={() => patch({ rundown: rundown.filter((_, j) => j !== i) })}
                className="rounded border border-white/10 p-0.5 text-mixer-muted hover:text-mixer-red"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
          <p className="text-[8px] leading-snug text-mixer-muted">
            Capture the live framing as shots, set hold times, then roll — the jib glides between
            shots and loops until you stop it.
          </p>
        </div>

        <p className="mt-1 text-[9px] leading-snug text-mixer-muted">
          Drag to orbit · right/shift-drag to pan anywhere · scroll to zoom · WASD/QE flies the
          camera · recalled shots glide with the selected transition.
        </p>
      </section>

      {/* ---- camera transitions ---- */}
      <section className="mt-2 space-y-1.5 rounded border border-white/10 bg-black/40 p-2">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-amber-400/90">
            <ArrowRightLeft className="h-3 w-3" /> CAMERA TRANSITIONS
          </p>
          <span className="text-[8px] uppercase tracking-wider text-mixer-muted">
            {(photoreal.transition ?? DEFAULT_STUDIO_TRANSITION).style}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {TRANSITION_STYLES.map((style) => {
            const active = (photoreal.transition ?? DEFAULT_STUDIO_TRANSITION).style === style.id;
            return (
              <button
                key={style.id}
                type="button"
                title={style.hint}
                onClick={() =>
                  patch({
                    transition: {
                      style: style.id,
                      duration: (photoreal.transition ?? DEFAULT_STUDIO_TRANSITION).duration,
                    },
                  })
                }
                className={cn(
                  'rounded border px-1 py-1 text-[8px] font-bold tracking-wider',
                  active
                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                    : 'border-white/10 text-mixer-muted hover:border-amber-500/40 hover:text-amber-300',
                )}
              >
                {style.label}
              </button>
            );
          })}
        </div>
        {(photoreal.transition ?? DEFAULT_STUDIO_TRANSITION).style !== 'cut' && (
          <div className="flex items-center gap-1.5">
            <span className="w-12 text-[8px] font-bold tracking-wider text-mixer-muted">SPEED</span>
            <input
              type="range"
              min={0.2}
              max={4}
              step={0.1}
              value={(photoreal.transition ?? DEFAULT_STUDIO_TRANSITION).duration}
              onChange={(e) =>
                patch({
                  transition: {
                    style: (photoreal.transition ?? DEFAULT_STUDIO_TRANSITION).style,
                    duration: Number(e.target.value),
                  },
                })
              }
              className="min-w-0 flex-1 accent-amber-500"
            />
            <span className="w-8 text-right text-[8px] text-mixer-muted">
              {(photoreal.transition ?? DEFAULT_STUDIO_TRANSITION).duration.toFixed(1)}s
            </span>
          </div>
        )}
        <p className="text-[8px] leading-snug text-mixer-muted">
          Style the move between recalled shots, rundown plays and scene switches — from broadcast
          hard cuts to cinematic crane sweeps.
        </p>
      </section>

      {/* ---- talent placement (keyed USB capture) ---- */}
      <section className="mt-2 space-y-1.5 rounded border border-white/10 bg-black/40 p-2">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-amber-400/90">
            <Move3d className="h-3 w-3" /> TALENT PLACEMENT
          </p>
          <div className="flex items-center gap-1">
            {onOpenKeyer && (
              <button
                type="button"
                title="Open the chroma key desk for the USB capture"
                onClick={onOpenKeyer}
                className="rounded border border-white/10 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-mixer-muted hover:border-amber-500/40 hover:text-amber-300"
              >
                CHROMA KEY
              </button>
            )}
            <button
              type="button"
              title="Reset the talent plate to the set default"
              onClick={() => patch({ talentPlacement: undefined })}
              className="rounded border border-white/10 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-mixer-muted hover:border-amber-500/40 hover:text-amber-300"
            >
              RESET
            </button>
          </div>
        </div>
        <p className="text-[9px] leading-snug text-mixer-muted">
          Place the keyed live capture anywhere on the stage — position, size and angle it from any
          view. Seat the talent on set furniture (chairs, sofas, stools) or keep them standing.
        </p>
        {(() => {
          const d: StudioTalentPlacement = photoreal.talentPlacement ??
            scene?.talent ?? { position: [0, 0.95, 0.55], width: 2.4, yaw: 0 };
          const set = (u: Partial<StudioTalentPlacement>) =>
            patch({ talentPlacement: { ...d, ...u } });
          const rows: {
            label: string;
            value: number;
            min: number;
            max: number;
            step: number;
            fmt: (v: number) => string;
            on: (v: number) => void;
          }[] = [
            {
              label: 'X',
              value: d.position[0],
              min: -5,
              max: 5,
              step: 0.05,
              fmt: (v) => `${v.toFixed(2)}m`,
              on: (v) => set({ position: [v, d.position[1], d.position[2]] }),
            },
            {
              label: 'Y',
              value: d.position[1],
              min: 0,
              max: 3.5,
              step: 0.05,
              fmt: (v) => `${v.toFixed(2)}m`,
              on: (v) => set({ position: [d.position[0], v, d.position[2]] }),
            },
            {
              label: 'Z',
              value: d.position[2],
              min: -5,
              max: 6,
              step: 0.05,
              fmt: (v) => `${v.toFixed(2)}m`,
              on: (v) => set({ position: [d.position[0], d.position[1], v] }),
            },
            {
              label: 'SIZE',
              value: d.width ?? 2.4,
              min: 0.5,
              max: 8,
              step: 0.1,
              fmt: (v) => `${v.toFixed(1)}m`,
              on: (v) => set({ width: v }),
            },
            {
              label: 'YAW',
              value: d.yaw ?? 0,
              min: -180,
              max: 180,
              step: 1,
              fmt: (v) => `${Math.round(v)}°`,
              on: (v) => set({ yaw: (v * Math.PI) / 180 }),
            },
            {
              label: 'PITCH',
              value: ((d.pitch ?? 0) * 180) / Math.PI,
              min: -90,
              max: 90,
              step: 1,
              fmt: (v) => `${Math.round(v)}°`,
              on: (v) => set({ pitch: (v * Math.PI) / 180 }),
            },
            {
              label: 'ROLL',
              value: ((d.roll ?? 0) * 180) / Math.PI,
              min: -45,
              max: 45,
              step: 1,
              fmt: (v) => `${Math.round(v)}°`,
              on: (v) => set({ roll: (v * Math.PI) / 180 }),
            },
          ];
          return (
            <div className="space-y-1">
              {/* standing / seated pose — seats the talent on the set furniture */}
              <div className="grid grid-cols-2 gap-1">
                {([
                  {
                    key: 'standing' as const,
                    label: 'STANDING',
                    title: 'Frame the talent standing on the floor',
                    apply: standingTalentPlacement,
                  },
                  {
                    key: 'seated' as const,
                    label: 'SEATED',
                    title: 'Seat the talent on a chair or sofa — tighter framing resting at the seat line',
                    apply: seatedTalentPlacement,
                  },
                ]).map((opt) => {
                  const active = (d.pose ?? 'standing') === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      title={opt.title}
                      onClick={() => patch({ talentPlacement: opt.apply(d) })}
                      className={
                        active
                          ? 'rounded border border-amber-500/60 bg-amber-500/15 py-1 text-[8px] font-bold tracking-wider text-amber-300'
                          : 'rounded border border-white/10 py-1 text-[8px] font-bold tracking-wider text-mixer-muted hover:border-amber-500/40 hover:text-amber-300'
                      }
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {rows.map((row) => (
                <div key={row.label} className="flex items-center gap-1.5">
                  <span className="w-9 text-[8px] font-bold tracking-wider text-mixer-muted">
                    {row.label}
                  </span>
                  <input
                    type="range"
                    min={row.min}
                    max={row.max}
                    step={row.step}
                    value={row.value}
                    onChange={(e) => row.on(Number(e.target.value))}
                    className="min-w-0 flex-1 accent-amber-500"
                  />
                  <span className="w-10 text-right text-[8px] text-mixer-muted">{row.fmt(row.value)}</span>
                </div>
              ))}
              <button
                type="button"
                title="Square the talent plate up to camera"
                onClick={() => set({ yaw: 0, pitch: 0, roll: 0 })}
                className="w-full rounded border border-white/10 py-1 text-[8px] font-bold tracking-wider text-mixer-muted hover:border-amber-500/40 hover:text-amber-300"
              >
                FACE CAMERA
              </button>
            </div>
          );
        })()}
      </section>

      {scene && (
        <section>
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-amber-400/90">
            <MonitorPlay className="h-3 w-3" /> SCREENS
          </p>
          <div className="space-y-2.5">
            {scene.screens
              .filter((slot) => slot.id !== scene.backdropSlotId)
              .map((slot) => (
                <div key={slot.id} className="rounded border border-white/10 bg-black/40 p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-semibold">{slot.label}</span>
                    <span className="rounded bg-white/10 px-1 text-[8px] uppercase tracking-wider text-mixer-muted">
                      {slot.form}
                    </span>
                  </div>
                  {sourcePicker(
                    slot.id,
                    photoreal.bindings[slot.id],
                    Boolean(slot.defaultSource),
                    (source) => setBinding(slot.id, source),
                  )}
                  {slot.defaultSource && photoreal.bindings[slot.id] && (
                    <button
                      type="button"
                      onClick={() => setBinding(slot.id, null)}
                      className="mt-1 text-[9px] text-mixer-muted underline hover:text-amber-300"
                    >
                      restore scene default
                    </button>
                  )}
                </div>
              ))}
          </div>
        </section>
      )}

      {scene && (
        <NewsGraphicsPanel
          screens={scene.screens.filter((slot) => slot.id !== scene.backdropSlotId)}
          bindings={photoreal.bindings}
          onApplyGraphic={(slotId, content) => setBinding(slotId, { kind: 'graphic', content })}
          onClearGraphic={(slotId) => setBinding(slotId, { kind: 'off' })}
        />
      )}

      {scene?.backdropSlotId && (
        <section className="rounded border border-white/10 bg-black/40 p-2">
          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-amber-400/90">
            <ImageIcon className="h-3 w-3" /> BACKDROP REPLACEMENT
          </p>
          <p className="mb-1.5 text-[9px] leading-snug text-mixer-muted">
            Replace the entire environment behind the set with an image, a video or the live camera feed.
          </p>
          {sourcePicker('backdrop', photoreal.backdrop, false, (source) =>
            patch({ backdrop: source ?? undefined }),
          )}
        </section>
      )}

      <section className="space-y-2">
        <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-amber-400/90">
          <Boxes className="h-3 w-3" /> SET ELEMENTS
        </p>
        <div className="flex items-start justify-between gap-2">
          <p className="text-[9px] leading-snug text-mixer-muted">
            Drag elements anywhere on the stage · shift-drag to spin · fine-tune every axis below.
          </p>
          <button
            type="button"
            onClick={() => patch({ snapToGrid: !photoreal.snapToGrid })}
            className={cn(
              'shrink-0 rounded border px-1.5 py-0.5 text-[8px] font-bold tracking-wider',
              photoreal.snapToGrid
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                : 'border-white/10 bg-black/40 text-mixer-muted hover:border-white/25',
            )}
          >
            GRID SNAP {photoreal.snapToGrid ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="flex flex-wrap gap-1">
          {(['all', ...STUDIO_ELEMENT_CATEGORIES.map((c) => c.id)] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setElementCategory(cat as StudioElementCategory | 'all')}
              className={cn(
                'rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider',
                elementCategory === cat
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                  : 'border-white/10 bg-black/40 text-mixer-muted hover:border-white/25',
              )}
            >
              {cat === 'all' ? 'All' : STUDIO_ELEMENT_CATEGORIES.find((c) => c.id === cat)?.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-1">
          {visibleElements.map((def) => {
            const locked = !unlockedElementIds.has(def.id);
            return (
              <button
                key={def.id}
                type="button"
                disabled={locked}
                title={locked ? `Unlocks on the ${def.tier.replace('_', ' ')} plan` : `Add ${def.name}`}
                onClick={() => addElement(def.id)}
                className={cn(
                  'flex items-center justify-between gap-1 rounded border px-1.5 py-1 text-left text-[9px]',
                  locked
                    ? 'cursor-not-allowed border-white/5 bg-black/20 opacity-50'
                    : 'border-white/10 bg-black/40 hover:border-amber-500/40 hover:text-amber-300',
                )}
              >
                <span className="truncate font-semibold">{def.name}</span>
                <Plus className="h-2.5 w-2.5 shrink-0" />
              </button>
            );
          })}
        </div>

        {elements.length > 0 && (
          <div className="space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-wider text-mixer-muted">
              In the set · {elements.length}
            </p>
            {elements.map((element) => {
              const def = getStudioElement(element.elementId);
              const active = element.id === selectedElementId;
              return (
                <div
                  key={element.id}
                  className={cn(
                    'flex items-center gap-1 rounded border px-1.5 py-1',
                    active ? 'border-amber-500/50 bg-amber-500/10' : 'border-white/10 bg-black/40',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectElement(active ? null : element.id)}
                    className="min-w-0 flex-1 truncate text-left text-[10px] font-semibold"
                  >
                    {def?.name ?? element.elementId}
                  </button>
                  <button
                    type="button"
                    title="Duplicate"
                    onClick={() => duplicateElement(element)}
                    className="rounded border border-white/10 p-0.5 text-mixer-muted hover:text-amber-300"
                  >
                    <Copy className="h-2.5 w-2.5" />
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    onClick={() => removeElement(element.id)}
                    className="rounded border border-white/10 p-0.5 text-mixer-muted hover:text-mixer-red"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {selectedElement && (
          <div className="space-y-2 rounded border border-amber-500/30 bg-amber-500/5 p-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold">{selectedDef?.name ?? selectedElement.elementId}</p>
              <button
                type="button"
                title="Deselect"
                onClick={() => onSelectElement(null)}
                className="rounded border border-white/10 p-0.5 text-mixer-muted hover:text-white"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>

            <label className="block">
              <span className="flex items-center justify-between text-[10px] text-mixer-muted">
                <span>Position X</span>
                <span>{selectedElement.position[0].toFixed(2)} m</span>
              </span>
              <input
                type="range"
                min={-6}
                max={6}
                step={0.05}
                value={selectedElement.position[0]}
                onChange={(e) =>
                  updateElement(selectedElement.id, {
                    position: clampElementPosition(Number(e.target.value), selectedElement.position[1]),
                  })
                }
                className="mt-1 w-full accent-amber-500"
              />
            </label>

            <label className="block">
              <span className="flex items-center justify-between text-[10px] text-mixer-muted">
                <span>Position Z</span>
                <span>{selectedElement.position[1].toFixed(2)} m</span>
              </span>
              <input
                type="range"
                min={-4.5}
                max={5.5}
                step={0.05}
                value={selectedElement.position[1]}
                onChange={(e) =>
                  updateElement(selectedElement.id, {
                    position: clampElementPosition(selectedElement.position[0], Number(e.target.value)),
                  })
                }
                className="mt-1 w-full accent-amber-500"
              />
            </label>

            <label className="block">
              <span className="flex items-center justify-between text-[10px] text-mixer-muted">
                <span>Rotation</span>
                <span>{Math.round((selectedElement.rotation * 180) / Math.PI)}°</span>
              </span>
              <input
                type="range"
                min={0}
                max={360}
                step={1}
                value={Math.round((selectedElement.rotation * 180) / Math.PI)}
                onChange={(e) =>
                  updateElement(selectedElement.id, {
                    rotation: (Number(e.target.value) * Math.PI) / 180,
                  })
                }
                className="mt-1 w-full accent-amber-500"
              />
            </label>

            <label className="block">
              <span className="flex items-center justify-between text-[10px] text-mixer-muted">
                <span>Size</span>
                <span className="flex items-center gap-1.5">
                  <span>{normalizeElementScale(selectedElement.scale)[0].toFixed(2)}×</span>
                  <button
                    type="button"
                    title="Toggle per-axis sizing"
                    onClick={() =>
                      setAxesUnlocked((prev) => {
                        const next = !prev;
                        if (!next) {
                          const [x] = normalizeElementScale(selectedElement.scale);
                          updateElement(selectedElement.id, { scale: x });
                        }
                        return next;
                      })
                    }
                    className={cn(
                      'rounded border px-1 py-0.5 text-[7px] font-bold tracking-wider',
                      axesUnlocked
                        ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                        : 'border-white/10 text-mixer-muted hover:text-white',
                    )}
                  >
                    XYZ
                  </button>
                </span>
              </span>
              <input
                type="range"
                min={0.2}
                max={4}
                step={0.05}
                value={normalizeElementScale(selectedElement.scale)[0]}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  const [, y, z] = normalizeElementScale(selectedElement.scale);
                  updateElement(selectedElement.id, {
                    scale: axesUnlocked ? [v, y, z] : v,
                  });
                }}
                className="mt-1 w-full accent-amber-500"
              />
            </label>

            {axesUnlocked && (
              <div className="space-y-1 rounded border border-white/10 bg-black/30 p-1.5">
                {(
                  [
                    { axis: 0, label: 'Width (X)' },
                    { axis: 1, label: 'Height (Y)' },
                    { axis: 2, label: 'Depth (Z)' },
                  ] as const
                ).map(({ axis, label }) => {
                  const vec = normalizeElementScale(selectedElement.scale);
                  return (
                    <label key={axis} className="block">
                      <span className="flex items-center justify-between text-[9px] text-mixer-muted">
                        <span>{label}</span>
                        <span>{vec[axis].toFixed(2)}×</span>
                      </span>
                      <input
                        type="range"
                        min={0.2}
                        max={4}
                        step={0.05}
                        value={vec[axis]}
                        onChange={(e) => {
                          const next: [number, number, number] = [...vec];
                          next[axis] = Number(e.target.value);
                          updateElement(selectedElement.id, { scale: next });
                        }}
                        className="mt-0.5 w-full accent-amber-500"
                      />
                    </label>
                  );
                })}
              </div>
            )}

            <label className="block">
              <span className="flex items-center justify-between text-[10px] text-mixer-muted">
                <span>Elevation</span>
                <span>{(selectedElement.elevation ?? 0).toFixed(2)} m</span>
              </span>
              <input
                type="range"
                min={0}
                max={3}
                step={0.05}
                value={selectedElement.elevation ?? 0}
                onChange={(e) =>
                  updateElement(selectedElement.id, { elevation: clampElementElevation(Number(e.target.value)) })
                }
                className="mt-1 w-full accent-amber-500"
              />
            </label>

            <div className="flex flex-wrap gap-1">
              {[0.5, 1, 1.5, 2].map((factor) => (
                <button
                  key={factor}
                  type="button"
                  title={`Set size to ${factor}×`}
                  onClick={() => updateElement(selectedElement.id, { scale: factor })}
                  className="rounded border border-white/10 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-mixer-muted hover:border-amber-500/40 hover:text-amber-300"
                >
                  {factor}×
                </button>
              ))}
              <button
                type="button"
                title="Flip 180 degrees"
                onClick={() =>
                  updateElement(selectedElement.id, {
                    rotation: ((selectedElement.rotation + Math.PI) % (Math.PI * 2)) as number,
                  })
                }
                className="rounded border border-white/10 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-mixer-muted hover:border-amber-500/40 hover:text-amber-300"
              >
                FLIP 180°
              </button>
              <button
                type="button"
                title="Reset elevation"
                onClick={() => updateElement(selectedElement.id, { elevation: 0 })}
                className="rounded border border-white/10 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-mixer-muted hover:border-amber-500/40 hover:text-amber-300"
              >
                GROUND
              </button>
            </div>

            {selectedDef?.screen && (
              <div>
                <p className="mb-1 text-[10px] font-semibold">Screen source</p>
                {sourcePicker(`el-${selectedElement.id}`, selectedElement.source, false, (source) =>
                  updateElement(selectedElement.id, { source: source ?? undefined }),
                )}
              </div>
            )}

            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => duplicateElement(selectedElement)}
                className="flex flex-1 items-center justify-center gap-1 rounded border border-white/10 bg-black/40 py-1 text-[9px] font-bold tracking-wider text-mixer-muted hover:border-amber-500/40 hover:text-amber-300"
              >
                <Copy className="h-2.5 w-2.5" /> DUPLICATE
              </button>
              <button
                type="button"
                onClick={() => removeElement(selectedElement.id)}
                className="flex flex-1 items-center justify-center gap-1 rounded border border-white/10 bg-black/40 py-1 text-[9px] font-bold tracking-wider text-mixer-muted hover:border-mixer-red/50 hover:text-mixer-red"
              >
                <Trash2 className="h-2.5 w-2.5" /> DELETE
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-2.5">
        <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-amber-400/90">
          <Sun className="h-3 w-3" /> LIGHT &amp; LOOK
        </p>

        <div className="grid grid-cols-4 gap-1">
          {MOOD_PRESETS.map((mood) => (
            <button
              key={mood.id}
              type="button"
              title={`Apply the ${mood.label.toLowerCase()} look`}
              onClick={() =>
                patch({ lighting: mood.lighting, temperature: mood.temperature, exposure: mood.exposure })
              }
              className="rounded border border-white/10 bg-black/40 px-1 py-1.5 text-[9px] font-bold tracking-wider text-mixer-muted hover:border-amber-500/40 hover:text-amber-300"
            >
              {mood.label}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="flex items-center justify-between text-[10px] text-mixer-muted">
            <span className="flex items-center gap-1"><Wand2 className="h-3 w-3" /> Light rig</span>
            <span>{photoreal.lighting.toFixed(2)}×</span>
          </span>
          <input
            type="range"
            min={0.6}
            max={1.6}
            step={0.05}
            value={photoreal.lighting}
            onChange={(e) => patch({ lighting: Number(e.target.value) })}
            className="mt-1 w-full accent-amber-500"
          />
        </label>

        <label className="block">
          <span className="flex items-center justify-between text-[10px] text-mixer-muted">
            <span>Colour temperature</span>
            <span
              className="inline-flex items-center gap-1"
              style={{ color: temperatureColor(photoreal.temperature ?? 0.5) }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: temperatureColor(photoreal.temperature ?? 0.5) }}
              />
              {(photoreal.temperature ?? 0.5) < 0.4 ? 'COOL' : (photoreal.temperature ?? 0.5) > 0.6 ? 'WARM' : 'BALANCED'}
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={photoreal.temperature ?? 0.5}
            onChange={(e) => patch({ temperature: Number(e.target.value) })}
            className="mt-1 w-full accent-amber-500"
          />
        </label>

        <label className="block">
          <span className="flex items-center justify-between text-[10px] text-mixer-muted">
            <span>Exposure</span>
            <span>{(photoreal.exposure ?? 1).toFixed(2)}×</span>
          </span>
          <input
            type="range"
            min={0.6}
            max={1.6}
            step={0.02}
            value={photoreal.exposure ?? 1}
            onChange={(e) => patch({ exposure: Number(e.target.value) })}
            className="mt-1 w-full accent-amber-500"
          />
        </label>

        <div>
          <span className="flex items-center justify-between text-[10px] text-mixer-muted">
            <span className="flex items-center gap-1"><Palette className="h-3 w-3" /> Set accent</span>
            {photoreal.accent && (
              <button
                type="button"
                onClick={() => patch({ accent: undefined })}
                className="text-[9px] underline hover:text-amber-300"
              >
                use scene colour
              </button>
            )}
          </span>
          <input
            type="color"
            value={photoreal.accent ?? scene?.accent ?? '#38bdf8'}
            onChange={(e) => patch({ accent: e.target.value })}
            className="mt-1 h-7 w-full cursor-pointer rounded border border-white/10 bg-black"
          />
        </div>

        <label className="block">
          <span className="flex items-center justify-between text-[10px] text-mixer-muted">
            <span>Ticker speed</span>
            <span>{photoreal.tickerSpeed} px/s</span>
          </span>
          <input
            type="range"
            min={0}
            max={400}
            step={10}
            value={photoreal.tickerSpeed}
            onChange={(e) => patch({ tickerSpeed: Number(e.target.value) })}
            className="mt-1 w-full accent-amber-500"
          />
        </label>

        <label className="block">
          <span className="text-[10px] text-mixer-muted">Render quality</span>
          <select
            value={photoreal.quality}
            onChange={(e) => patch({ quality: e.target.value as PhotorealStudioState['quality'] })}
            className="mt-1 w-full rounded border border-white/10 bg-black px-1.5 py-1 text-[10px] outline-none focus:border-amber-500/40"
          >
            <option value="auto">Auto (adaptive)</option>
            <option value="low">Low</option>
            <option value="balanced">Balanced</option>
            <option value="high">High</option>
            <option value="ultra">Ultra (DoF + AO)</option>
          </select>
        </label>
      </section>

      <section className="space-y-1.5">
        <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-amber-400/90">
          <Sparkles className="h-3 w-3" /> EFFECTS
        </p>
        {(
          [
            { key: 'bloom' as const, label: 'Bloom · screen glow' },
            { key: 'depthOfField' as const, label: 'Depth of field' },
            { key: 'vignette' as const, label: 'Vignette' },
            { key: 'ao' as const, label: 'Ambient occlusion' },
            { key: 'smaa' as const, label: 'SMAA antialiasing' },
          ]
        ).map((row) => (
          <label
            key={row.key}
            className="flex cursor-pointer items-center justify-between gap-2 rounded border border-white/10 bg-black/30 px-2 py-1.5"
          >
            <span className="text-[10px] font-semibold">{row.label}</span>
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-amber-500"
              checked={effectDefault(row.key)}
              onChange={(e) => setEffect(row.key, e.target.checked)}
            />
          </label>
        ))}
        {effectDefault('bloom') && (
          <label className="block">
            <span className="flex items-center justify-between text-[10px] text-mixer-muted">
              <span>Bloom strength</span>
              <span>{(photoreal.effects?.bloomIntensity ?? 0.55).toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={0.15}
              max={1.2}
              step={0.05}
              value={clampBloomIntensity(photoreal.effects?.bloomIntensity ?? 0.55)}
              onChange={(e) => setEffect('bloomIntensity', Number(e.target.value))}
              className="mt-1 w-full accent-amber-500"
            />
          </label>
        )}
        <p className="text-[9px] leading-snug text-mixer-muted">
          Overrides apply on top of the render quality preset.
        </p>
      </section>

      {!cameraVideo && (
        <p className="flex items-center gap-1.5 rounded border border-white/10 bg-black/40 p-2 text-[9px] text-mixer-muted">
          <Radio className="h-3 w-3 shrink-0" />
          Start the camera to bind your live feed to screens or the backdrop.
        </p>
      )}
      {uploadNotice && (
        <p className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-[9px] text-emerald-300">
          {uploadNotice}
        </p>
      )}
      {uploadError && (
        <p className="rounded border border-mixer-red/40 bg-mixer-red/10 p-2 text-[9px] text-mixer-red">
          {uploadError}
        </p>
      )}
    </div>
  );
}
