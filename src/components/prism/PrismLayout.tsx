import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera, Compass, Cpu, Film, GitBranch, Layers, LogOut, MonitorPlay, Radio, Sparkles, Video, Box, Smartphone, Type, LayoutGrid, Aperture,
  FolderOpen, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCloudCastOptional } from '../../context/CloudCastContext';
import { usePrismFeed } from '../../context/PrismFeedContext';
import { CloudCastLogo } from '../brand/CloudCastLogo';
import { CLOUDCAST_NAV_LOGO } from '../../lib/branding';
import { isUniversalPlan, resolveProductPlan } from '../../lib/productEntitlements';
import {
  PRISM_CAMERAS,
  PRISM_CAPTURE_DIMENSIONS,
  PRISM_OUTPUT_QUALITY,
  PRISM_VIRTUAL_SETS,
} from '../../config/products';
import { VIRTUAL_SETS as ALL_SETS, setsForPlan } from '../../lib/prism/virtualSets';
import { usePrismVideoSource } from '../../hooks/usePrismVideoSource';
import { usePrismRecorder } from '../../hooks/usePrismRecorder';
import { ChromaKeyProcessor, type ChromaKeySettings } from '../../lib/prism/chromaKey';
import { ChromaKeyPanel } from './ChromaKeyPanel';
import { SceneSelector } from './SceneSelector';
import { SceneManagerPanel } from './SceneManagerPanel';
import { PhotorealStudioPanel } from './PhotorealStudioPanel';
import { StageEnginePanel } from './StageEnginePanel';
import { useStageEngine } from '../../hooks/useStageEngine';
import { ModelLibraryPanel } from './ModelLibraryPanel';
import { PrismStreamPanel } from './PrismStreamPanel';
import { PrismAudioPanel } from './PrismAudioPanel';
import { usePrismProgramAudio } from '../../hooks/usePrismProgramAudio';
import { PrismMobilePanel } from './PrismMobilePanel';
import { PrismGraphicsPanel } from './PrismGraphicsPanel';
import { PrismTrackingPanel } from './PrismTrackingPanel';
import { PrismNodeEditor } from './PrismNodeEditor';
import { PrismMultiCameraPanel, SecondaryCameraVideos } from './PrismMultiCameraPanel';
import { usePrismSecondaryCameras } from '../../hooks/usePrismSecondaryCameras';
import { usePrismTrackingSubscriber } from '../../hooks/usePrismTrackingSubscriber';
import { disposeObjectUrl } from './ImportedModelGroup';
import type { PrismProductionMode } from '../../lib/prism/virtualSets';
import { DEFAULT_STUDIO_TRANSITION } from '../../lib/virtualStudio/types';
import type { PrismSceneRecord } from '../../types/prismFeed';
import { sceneExtendedState, sceneToKeySettings } from '../../lib/prism/prismSceneService';
import { getStudioScene, studioScenesForPlan } from '../../lib/virtualStudio/sceneRegistry';
import {
  clampElementElevation,
  normalizeElementScale,
} from '../../lib/virtualStudio/elementCatalog';
import { setNodeEnabled, normalizeNodeGraph, pipelineNode } from '../../lib/prism/nodeGraph';
import { productionShellClass } from '../../lib/productionShell';
import { cn } from '../../lib/utils';
import { MotionGraphicsPanel } from './MotionGraphicsPanel';
import { MotionGraphicsStage } from './motion/MotionGraphicsStage';
import { PanelHeader, PanelNote, PanelSection } from './PanelChrome';

const VirtualScene = lazy(() => import('./VirtualScene').then((m) => ({ default: m.VirtualScene })));
const VirtualStudioStage = lazy(() =>
  import('../virtualStudio').then((m) => ({ default: m.VirtualStudioStage })),
);
const BabylonStudioStage = lazy(() =>
  import('../virtualStudio/babylon/BabylonStudioStage').then((m) => ({ default: m.BabylonStudioStage })),
);
const UnrealPixelStreamStage = lazy(() =>
  import('../virtualStudio/unreal/UnrealPixelStreamStage').then((m) => ({ default: m.UnrealPixelStreamStage })),
);

function SceneLoadingFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <Sparkles className="h-8 w-8 animate-pulse text-amber-500/60" />
    </div>
  );
}

type SidePanel =
  | 'keyer'
  | 'sets'
  | 'photoreal'
  | 'engines'
  | 'camera'
  | 'mobile'
  | 'tracking'
  | 'output'
  | 'scenes'
  | 'models'
  | 'graphics'
  | 'motion'
  | 'nodes'
  | 'multicam';

type NavItem = { id: SidePanel; label: string; icon: typeof Camera };

/** Rail groups — the console reads top to bottom: build it, shoot it, dress it, ship it. */
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Stage',
    items: [
      { id: 'photoreal', label: 'Photoreal', icon: Aperture },
      { id: 'engines', label: 'Engines', icon: Cpu },
      { id: 'sets', label: 'Virtual Sets', icon: Layers },
      { id: 'keyer', label: 'Chroma Keyer', icon: Sparkles },
      { id: 'models', label: '3D Models', icon: Box },
      { id: 'scenes', label: 'Scenes', icon: FolderOpen },
    ],
  },
  {
    label: 'Cameras',
    items: [
      { id: 'camera', label: 'Camera', icon: Camera },
      { id: 'mobile', label: 'Prism Eye', icon: Smartphone },
      { id: 'tracking', label: 'Tracking', icon: Compass },
      { id: 'multicam', label: 'Multi-Cam', icon: LayoutGrid },
    ],
  },
  {
    label: 'Graphics',
    items: [
      { id: 'motion', label: '3D Motion', icon: Film },
      { id: 'graphics', label: 'Lower Thirds', icon: Type },
      { id: 'nodes', label: 'Pipeline', icon: GitBranch },
    ],
  },
  {
    label: 'Output',
    items: [{ id: 'output', label: 'Program', icon: MonitorPlay }],
  },
];

/** Masthead copy for every side panel. */
const PANEL_META: Record<SidePanel, { icon: typeof Camera; title: string; subtitle: string }> = {
  photoreal: { icon: Aperture, title: 'Photoreal Studio', subtitle: 'Newsroom, arena & lifestyle sets with live screens' },
  engines: { icon: Cpu, title: 'Render Engines', subtitle: 'three.js · Babylon.js · Unreal Pixel Streaming · WGSL' },
  sets: { icon: Layers, title: 'Virtual Sets', subtitle: 'Classic key pipeline — VS · AR · XR production modes' },
  keyer: { icon: Sparkles, title: 'Chroma Keyer', subtitle: 'GPU key, spill suppression and light wrap' },
  models: { icon: Box, title: '3D Studio Library', subtitle: 'Backgrounds, props, furniture and imported GLTFs' },
  scenes: { icon: FolderOpen, title: 'Cloud Scenes', subtitle: 'Save and recall full production states' },
  camera: { icon: Camera, title: 'Camera Input', subtitle: 'Webcam, HDMI capture or paired mobile feed' },
  mobile: { icon: Smartphone, title: 'Regal Prism Eye', subtitle: 'Wireless phone camera and gyro virtual camera' },
  tracking: { icon: Compass, title: 'Virtual Camera', subtitle: 'Orientation tracking, WebXR and device control' },
  multicam: { icon: LayoutGrid, title: 'Multi-Camera PiP', subtitle: 'Secondary angles as picture-in-picture overlays' },
  motion: { icon: Film, title: '3D Motion Graphics', subtitle: 'Cinematic titles, stings and logo outros' },
  graphics: { icon: Type, title: 'Broadcast Graphics', subtitle: 'Lower thirds and on-screen text' },
  nodes: { icon: GitBranch, title: 'Compositor Pipeline', subtitle: 'Toggle processing stages like Aximetry compounds' },
  output: { icon: MonitorPlay, title: 'Program Output', subtitle: 'Mixer feed, RTMP stream, audio and recording' },
};

const NAV_COLLAPSE_KEY = 'regal-prism.nav.compact';

interface PrismLayoutProps {
  /** Off-screen render while feeding Video Mixer from another route */
  hidden?: boolean;
}

export function PrismLayout({ hidden = false }: PrismLayoutProps) {
  const { profile, signOut } = useAuth();
  const cloudcast = useCloudCastOptional();
  const prismFeed = usePrismFeed();
  const planId = resolveProductPlan(profile, 'regal_prism');
  const maxCameras = PRISM_CAMERAS[planId];
  const maxSets = PRISM_VIRTUAL_SETS[planId];
  const outputQuality = PRISM_OUTPUT_QUALITY[planId];
  const showWatermark = planId === 'free';
  const canUseAr = planId === 'pro_master' || planId === 'pro';
  const canFeedMixer = planId === 'pro_master';
  const canImportModels = planId === 'pro_master';
  const canStream = planId !== 'free';
  const canUseMobile = planId !== 'free';

  const canUseWebXR = planId === 'pro_master';
  const maxSecondary = Math.max(0, maxCameras - 1);

  const { state, studio, isLive, goLive, stopLive, patchStudio, attachGlCanvas, patchState, refreshCapture, programStream, getPipOverlaysRef, setLowerThird, getMotionOverlayRef, getMotionBackdropRef } = prismFeed;
  const motion = state.motion;
  const camera = usePrismVideoSource(state.cameraSourceId);
  const recorder = usePrismRecorder();
  const secondary = usePrismSecondaryCameras(studio.secondarySlots, studio.keySettings, maxSecondary);

  const canUseMixerAudio = canFeedMixer || (profile?.entitlements?.universal ?? isUniversalPlan(profile?.plan_id));
  const programAudio = usePrismProgramAudio(camera.videoRef, {
    includeMic: state.programAudioMic,
    includeMixer: state.programAudioMixer && canUseMixerAudio,
  });
  const keyerEnabled = pipelineNode(studio.nodeGraph, 'keyer').enabled;
  const virtualSetEnabled = pipelineNode(studio.nodeGraph, 'virtual_set').enabled;

  const [panel, setPanel] = useState<SidePanel>('keyer');
  /** Collapsed rail = icons only; expanded = grouped, labelled navigation. */
  const [navCompact, setNavCompact] = useState<boolean>(() => {
    try {
      return localStorage.getItem(NAV_COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggleNav = useCallback(() => {
    setNavCompact((v) => {
      const next = !v;
      try {
        localStorage.setItem(NAV_COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* private mode — session-only preference */
      }
      return next;
    });
  }, []);
  /** Backing canvas of the 3D motion overlay, composited into program output. */
  const motionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleMotionCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    motionCanvasRef.current = canvas;
  }, []);
  /** Backing canvas of the WebGPU backdrop plate (composited under the scene). */
  const motionBackdropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleMotionBackdropCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    motionBackdropCanvasRef.current = canvas;
  }, []);
  /** One-shot production switch animation played over the stage. */
  const [switchFx, setSwitchFx] = useState<{ id: number; cls: string } | null>(null);
  const triggerSwitchFx = useCallback(() => {
    const style = studio.photoreal.transition?.style ?? DEFAULT_STUDIO_TRANSITION.style;
    if (style === 'cut') return;
    const cls =
      style === 'whip' || style === 'crane'
        ? 'studio-fx-wipe'
        : style === 'zoom'
          ? 'studio-fx-punch'
          : 'studio-fx-fade';
    setSwitchFx({ id: Date.now(), cls });
  }, [studio.photoreal.transition]);
  const keyCanvasRef = useRef<HTMLCanvasElement>(null);
  const [keyedCanvas, setKeyedCanvas] = useState<HTMLCanvasElement | null>(null);
  const processorRef = useRef<ChromaKeyProcessor | null>(null);
  const [recordingClip, setRecordingClip] = useState(false);
  // Shared read of the live camera element for the 3D talent plate (both engines).
  const rawVideo = camera.videoRef.current ?? null;

  useEffect(() => {
    patchState({ showWatermark });
  }, [showWatermark, patchState]);

  useEffect(() => {
    const dims = PRISM_CAPTURE_DIMENSIONS[planId];
    patchState({ captureWidth: dims.width, captureHeight: dims.height });
  }, [planId, patchState]);

  const { connected: prismEyeConnected } = usePrismTrackingSubscriber(
    cloudcast?.session?.sessionId,
    cloudcast?.session?.realtimeChannel,
    Boolean(cloudcast?.session?.sessionId),
    (yaw, pitch) => patchStudio({ cameraYaw: yaw, cameraPitch: pitch }),
  );

  useEffect(() => {
    patchStudio({ cameraActive: camera.active });
  }, [camera.active, patchStudio]);

  const availableSets = useMemo(() => setsForPlan(planId, maxSets), [planId, maxSets]);
  const virtualSet = useMemo(
    () => ALL_SETS.find((s) => s.id === studio.virtualSetId) ?? ALL_SETS[0],
    [studio.virtualSetId],
  );

  const lockedSetIds = useMemo(() => {
    const available = new Set(availableSets.map((s) => s.id));
    return new Set(ALL_SETS.filter((s) => !available.has(s.id)).map((s) => s.id));
  }, [availableSets]);

  // The production engine now serves VS, AR and XR alike — mode only changes
  // how the stage composites (set / live plate / LED volume), not which engine runs.
  const usePhotoreal = studio.renderEngine === 'photoreal';
  /** Which renderer draws the stage: three.js, Babylon.js or a live Unreal stream. */
  const stageEngine = useStageEngine();
  const stageEngineId = stageEngine.activeEngine;
  const photorealScenes = useMemo(() => studioScenesForPlan(planId), [planId]);
  const photorealDef = useMemo(() => {
    const unlocked = new Set(photorealScenes.map((s) => s.id));
    const stored = getStudioScene(studio.photoreal.sceneId);
    // Enforce entitlements: a downgraded plan falls back to the first free scene.
    if (stored && unlocked.has(stored.id)) return stored;
    return photorealScenes[0];
  }, [photorealScenes, studio.photoreal.sceneId]);

  const handleSelectPhotorealScene = useCallback(
    (sceneId: string) => {
      // Selecting a photoreal set implies the virtual-studio mode — otherwise
      // the stage would stay hidden behind the classic pipeline modes.
      triggerSwitchFx();
      patchStudio({
        renderEngine: 'photoreal',
        mode: 'virtual_studio',
        photoreal: { ...studio.photoreal, sceneId },
      });
      setPanel('photoreal');
    },
    [patchStudio, studio.photoreal, triggerSwitchFx],
  );

  const handleStageCameraChange = useCallback(
    (patch: { yaw?: number; pitch?: number; zoom?: number; fov?: number; target?: [number, number, number] }) =>
      patchStudio({
        ...(patch.yaw !== undefined ? { cameraYaw: patch.yaw } : {}),
        ...(patch.pitch !== undefined ? { cameraPitch: patch.pitch } : {}),
        ...(patch.zoom !== undefined ? { cameraZoom: patch.zoom } : {}),
        ...(patch.fov !== undefined ? { cameraFov: patch.fov } : {}),
        ...(patch.target !== undefined ? { cameraTarget: patch.target } : {}),
      }),
    [patchStudio],
  );

  /** Element drag/inspect plumbing for the photoreal set. */
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const handleMoveElement = useCallback(
    (id: string, position: [number, number]) =>
      patchStudio({
        photoreal: {
          ...studio.photoreal,
          elements: (studio.photoreal.elements ?? []).map((e) => (e.id === id ? { ...e, position } : e)),
        },
      }),
    [patchStudio, studio.photoreal],
  );
  const handleRotateElement = useCallback(
    (id: string, rotation: number) =>
      patchStudio({
        photoreal: {
          ...studio.photoreal,
          elements: (studio.photoreal.elements ?? []).map((e) => (e.id === id ? { ...e, rotation } : e)),
        },
      }),
    [patchStudio, studio.photoreal],
  );
  const handleScaleElement = useCallback(
    (id: string, scale: [number, number, number]) =>
      patchStudio({
        photoreal: {
          ...studio.photoreal,
          elements: (studio.photoreal.elements ?? []).map((e) =>
            e.id === id ? { ...e, scale: normalizeElementScale(scale) } : e,
          ),
        },
      }),
    [patchStudio, studio.photoreal],
  );
  const handleElevateElement = useCallback(
    (id: string, elevation: number) =>
      patchStudio({
        photoreal: {
          ...studio.photoreal,
          elements: (studio.photoreal.elements ?? []).map((e) =>
            e.id === id ? { ...e, elevation: clampElementElevation(elevation) } : e,
          ),
        },
      }),
    [patchStudio, studio.photoreal],
  );

  const handleKeyChange = useCallback(
    (patch: Partial<ChromaKeySettings>) => {
      prismFeed.setKeySettings({ ...studio.keySettings, ...patch });
    },
    [prismFeed, studio.keySettings],
  );

  useEffect(() => {
    if (!camera.active || !camera.videoRef.current || !keyCanvasRef.current || !keyerEnabled) {
      processorRef.current?.dispose();
      processorRef.current = null;
      setKeyedCanvas(keyerEnabled ? null : keyCanvasRef.current);
      return;
    }
    const processor = new ChromaKeyProcessor(camera.videoRef.current, keyCanvasRef.current);
    processor.updateSettings(studio.keySettings);
    processor.start();
    processorRef.current = processor;
    setKeyedCanvas(keyCanvasRef.current);
    return () => {
      processor.dispose();
      processorRef.current = null;
      setKeyedCanvas(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- restart when camera activates
  }, [camera.active, keyerEnabled]);

  useEffect(() => {
    getPipOverlaysRef.current = secondary.getPipOverlays;
  }, [getPipOverlaysRef, secondary.getPipOverlays]);

  // 3D motion graphics feed the program capture while the console is visible.
  const motionNodeEnabled = pipelineNode(studio.nodeGraph, 'motion').enabled;
  const motionOnProgram = motion.active && motion.onProgram && motionNodeEnabled && !hidden;
  useEffect(() => {
    getMotionOverlayRef.current = () => {
      const canvas = motionCanvasRef.current;
      return motionOnProgram && canvas ? { canvas, letterbox: motion.letterbox } : null;
    };
    getMotionBackdropRef.current = () => {
      const canvas = motionBackdropCanvasRef.current;
      return motionOnProgram && canvas ? { canvas } : null;
    };
  }, [getMotionOverlayRef, getMotionBackdropRef, motionOnProgram, motion.letterbox]);

  useEffect(() => {
    processorRef.current?.updateSettings(studio.keySettings);
  }, [studio.keySettings]);

  useEffect(() => {
    if (isLive) refreshCapture();
  }, [state.lowerThird, state.captureWidth, state.captureHeight, isLive, refreshCapture]);

  useEffect(() => {
    if (state.cameraSourceId !== 'local' && !camera.active) {
      void camera.start();
    }
  }, [state.cameraSourceId, camera.active, camera.start]);

  const handleGoLive = () => {
    if (!canFeedMixer) return;
    goLive();
  };

  const handleLoadScene = useCallback(
    (scene: PrismSceneRecord) => {
      const ext = sceneExtendedState(scene);
      triggerSwitchFx();
      patchStudio({
        virtualSetId: scene.virtual_set_id,
        mode: scene.mode,
        keySettings: sceneToKeySettings(scene),
        cameraYaw: scene.camera_settings.yaw ?? 0,
        cameraPitch: scene.camera_settings.pitch ?? 0.15,
        cameraZoom: scene.camera_settings.zoom ?? 1,
        cameraFov: scene.camera_settings.fov,
        cameraTarget: scene.camera_settings.target,
        showShadows: scene.lighting.shadows ?? true,
        showReflections: scene.lighting.reflections ?? true,
        ...(ext.nodeGraph ? { nodeGraph: normalizeNodeGraph(ext.nodeGraph) } : {}),
        ...(ext.secondarySlots ? { secondarySlots: ext.secondarySlots } : {}),
        ...(ext.sceneObjects ? { sceneObjects: ext.sceneObjects } : { sceneObjects: [] }),
        ...(ext.photoreal
          ? {
              renderEngine: ext.photoreal.renderEngine ?? 'classic',
              photoreal: {
                ...studio.photoreal,
                // Scene-owned state replaces wholesale so stale bindings,
                // backdrops and settings never bleed across loads.
                sceneId: ext.photoreal.sceneId ?? studio.photoreal.sceneId,
                bindings: ext.photoreal.bindings ?? {},
                backdrop: ext.photoreal.backdrop,
                ...(ext.photoreal.lighting !== undefined ? { lighting: ext.photoreal.lighting } : {}),
                ...(ext.photoreal.tickerSpeed !== undefined
                  ? { tickerSpeed: ext.photoreal.tickerSpeed }
                  : {}),
                ...(ext.photoreal.shots !== undefined ? { shots: ext.photoreal.shots } : {}),
                ...(ext.photoreal.temperature !== undefined
                  ? { temperature: ext.photoreal.temperature }
                  : {}),
                ...(ext.photoreal.exposure !== undefined ? { exposure: ext.photoreal.exposure } : {}),
                ...(ext.photoreal.accent !== undefined ? { accent: ext.photoreal.accent } : {}),
                ...(ext.photoreal.effects !== undefined ? { effects: ext.photoreal.effects } : {}),
                ...(ext.photoreal.elements !== undefined ? { elements: ext.photoreal.elements } : {}),
                ...(ext.photoreal.rundown !== undefined ? { rundown: ext.photoreal.rundown } : {}),
                ...(ext.photoreal.snapToGrid !== undefined
                  ? { snapToGrid: ext.photoreal.snapToGrid }
                  : {}),
                ...(ext.photoreal.talentPlacement !== undefined
                  ? { talentPlacement: ext.photoreal.talentPlacement }
                  : {}),
                ...(ext.photoreal.transition !== undefined
                  ? { transition: ext.photoreal.transition }
                  : {}),
              },
            }
          : {}),
      });
      prismFeed.setKeySettings(sceneToKeySettings(scene));
      if (ext.lowerThird) setLowerThird(ext.lowerThird);
      if (ext.motion) {
        prismFeed.setMotion({
          ...(ext.motion.brand ? { brand: ext.motion.brand } : {}),
          ...(ext.motion.overrides ? { overrides: ext.motion.overrides } : {}),
        });
      }
    },
    [patchStudio, prismFeed, setLowerThird, studio.photoreal, triggerSwitchFx],
  );

  const shellClass = productionShellClass(
    hidden,
    'flex h-[100dvh] flex-col bg-[#050508] text-white',
  );

  return (
    <div className={shellClass} aria-hidden={hidden}>
      {!hidden && (
        <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-2">
          <div className="flex items-center gap-4">
            <Link to="/hub">
              <CloudCastLogo {...CLOUDCAST_NAV_LOGO} />
            </Link>
            <div className="hidden sm:block">
              <p className="text-xs font-bold tracking-[0.2em] text-amber-400">REGAL PRISM</p>
              <p className="text-[10px] text-mixer-muted">Virtual Production Studio</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-300 sm:inline">
              {planId.replace('_', ' ').toUpperCase()} · {outputQuality}
            </span>
            <button
              type="button"
              onClick={() => (isLive ? stopLive() : handleGoLive())}
              disabled={!camera.active || (!canFeedMixer && !isLive)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[10px] font-bold tracking-wider disabled:opacity-40',
                isLive ? 'bg-red-600 text-white' : 'border border-white/20 text-mixer-muted hover:border-white/40',
              )}
            >
              <Radio className="h-3 w-3" />
              {isLive ? 'ON AIR · MIXER' : canFeedMixer ? 'ROUTE TO MIXER' : 'STANDBY'}
            </button>
            <Link to="/dashboard" className="rounded border border-white/10 p-1.5 text-mixer-muted hover:text-white">
              <Video className="h-4 w-4" />
            </Link>
            <button type="button" onClick={() => void signOut()} className="rounded border border-white/10 p-1.5 text-mixer-muted hover:text-white">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
      )}

      {prismEyeConnected && (
        <div className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-[10px] font-bold tracking-wider text-amber-200">
          PRISM EYE CONNECTED — PHONE GYRO DRIVING VIRTUAL CAMERA
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {!hidden && (
          <nav
            aria-label="Regal Prism panels"
            className={cn(
              'flex shrink-0 flex-col border-r border-white/10 bg-black/50',
              navCompact ? 'w-14' : 'w-48',
            )}
          >
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {NAV_GROUPS.map((group, gi) => (
                <div key={group.label} className={cn(gi > 0 && 'mt-1 border-t border-white/10 pt-1')}>
                  {navCompact ? (
                    <div className="mx-auto my-1.5 h-px w-6 bg-white/10" />
                  ) : (
                    <p className="px-3 pb-1 pt-2 text-[8px] font-bold uppercase tracking-[0.18em] text-white/35">
                      {group.label}
                    </p>
                  )}
                  {group.items.map(({ id, label, icon: Icon }) => {
                    const active = panel === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        title={label}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => setPanel(id)}
                        className={cn(
                          'relative flex w-full items-center gap-2 px-3 py-2 text-left transition-colors',
                          navCompact && 'flex-col justify-center gap-1 px-1 py-2',
                          active
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'text-mixer-muted hover:bg-white/5 hover:text-white',
                        )}
                      >
                        {active && <span className="absolute left-0 top-0 h-full w-0.5 bg-amber-500" />}
                        <Icon className="h-4 w-4 shrink-0" />
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate text-[10px] font-bold tracking-wider',
                            navCompact && 'w-full flex-none text-center text-[7px] leading-tight tracking-normal',
                          )}
                        >
                          {label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={toggleNav}
              title={navCompact ? 'Expand navigation' : 'Collapse navigation'}
              className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5 text-mixer-muted transition-colors hover:bg-white/5 hover:text-white"
            >
              {navCompact ? (
                <PanelLeftOpen className="h-4 w-4 shrink-0" />
              ) : (
                <>
                  <PanelLeftClose className="h-4 w-4 shrink-0" />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Collapse</span>
                </>
              )}
            </button>
          </nav>
        )}

        {!hidden && (
          <aside className="hidden w-72 shrink-0 overflow-y-auto border-r border-white/10 bg-[#0a0a0f] p-4 md:block">
            <PanelHeader
              icon={PANEL_META[panel].icon}
              title={PANEL_META[panel].title}
              subtitle={PANEL_META[panel].subtitle}
            />
            {panel === 'keyer' && (
              <>
                <ChromaKeyPanel settings={studio.keySettings} onChange={handleKeyChange} disabled={!camera.active} />
              </>
            )}
            {panel === 'sets' && (
              <>
                <div className="mb-3 flex gap-1">
                  {(['virtual_studio', 'augmented_reality', 'xr_extension'] as PrismProductionMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      disabled={m !== 'virtual_studio' && !canUseAr}
                      onClick={() => patchStudio({ mode: m })}
                      className={cn(
                        'flex-1 rounded px-1 py-1 text-[9px] font-bold tracking-wider',
                        studio.mode === m ? 'bg-amber-500/20 text-amber-300' : 'text-mixer-muted hover:text-white',
                        m !== 'virtual_studio' && !canUseAr && 'opacity-40',
                      )}
                    >
                      {m === 'virtual_studio' ? 'VS' : m === 'augmented_reality' ? 'AR' : 'XR'}
                    </button>
                  ))}
                </div>
                <SceneSelector
                  sets={ALL_SETS}
                  selectedId={studio.virtualSetId}
                  onSelect={(id) => patchStudio({ virtualSetId: id, renderEngine: 'classic' })}
                  lockedIds={lockedSetIds}
                />
                <button
                  type="button"
                  onClick={() => setPanel('photoreal')}
                  className="mt-3 flex w-full items-center justify-between rounded border border-amber-500/30 bg-amber-500/10 px-2 py-2 text-left hover:border-amber-500/60"
                >
                  <span>
                    <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-amber-300">
                      <Aperture className="h-3 w-3" />
                      PHOTOREAL SETS
                    </span>
                    <span className="mt-0.5 block text-[9px] text-mixer-muted">
                      Newsroom, arena, living room &amp; more — live LED screens
                    </span>
                  </span>
                  <span className="text-mixer-muted">→</span>
                </button>
              </>
            )}
            {panel === 'photoreal' && (
              <PhotorealStudioPanel
                planId={planId}
                photoreal={studio.photoreal}
                cameraActive={camera.active}
                getCameraVideo={() => camera.videoRef.current}
                cameraPose={{
                  yaw: studio.cameraYaw,
                  pitch: studio.cameraPitch,
                  zoom: studio.cameraZoom,
                  fov: studio.cameraFov,
                  target: studio.cameraTarget,
                }}
                onRecallShot={handleStageCameraChange}
                selectedElementId={selectedElementId}
                onSelectElement={setSelectedElementId}
                onSelectScene={handleSelectPhotorealScene}
                onUseClassic={() => {
                  triggerSwitchFx();
                  patchStudio({ renderEngine: 'classic' });
                  setPanel('sets');
                }}
                onOpenKeyer={() => setPanel('keyer')}
                onPatch={(patch) => patchStudio({ photoreal: { ...studio.photoreal, ...patch } })}
                mode={studio.mode}
                canUseAr={canUseAr}
                onSelectMode={(m) => patchStudio({ mode: m, renderEngine: 'photoreal' })}
              />
            )}
            {panel === 'engines' && <StageEnginePanel />}
            {panel === 'camera' && (
              <>
                {!camera.active ? (
                  <button
                    type="button"
                    onClick={() => void camera.start()}
                    className="w-full rounded bg-amber-500 py-2 text-xs font-bold tracking-wider text-black hover:bg-amber-400"
                  >
                    START CAMERA
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={camera.stop}
                    className="w-full rounded border border-white/20 py-2 text-xs font-bold tracking-wider hover:border-white/40"
                  >
                    STOP CAMERA
                  </button>
                )}
                {camera.error && <p className="mt-2 text-xs text-mixer-red">{camera.error}</p>}
                {state.cameraSourceId === 'local' && (
                  <>
                    <label className="mt-4 block">
                      <span className="text-[10px] font-bold tracking-wider text-mixer-muted">USB / HDMI CAPTURE · VIDEO</span>
                      <select
                        className="mt-1 w-full rounded border border-white/10 bg-black px-2 py-1.5 text-xs"
                        value={camera.deviceIds.video ?? ''}
                        onChange={(e) => void camera.start(e.target.value || null)}
                        disabled={!camera.devices.length}
                      >
                        {camera.devices.length === 0 ? (
                          <option value="">No video devices found</option>
                        ) : (
                          <option value="">System default camera</option>
                        )}
                        {camera.devices.map((d) => (
                          <option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera'}</option>
                        ))}
                      </select>
                    </label>
                    <label className="mt-3 block">
                      <span className="text-[10px] font-bold tracking-wider text-mixer-muted">USB AUDIO INTERFACE · INPUT</span>
                      <select
                        className="mt-1 w-full rounded border border-white/10 bg-black px-2 py-1.5 text-xs"
                        value={camera.deviceIds.audio ?? ''}
                        onChange={(e) => void camera.start(null, e.target.value || null)}
                        disabled={!camera.audioDevices.length}
                      >
                        {camera.audioDevices.length === 0 ? (
                          <option value="">No audio devices found</option>
                        ) : (
                          <option value="">System default input</option>
                        )}
                        {camera.audioDevices.map((d) => (
                          <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => void camera.refreshDevices()}
                      className="mt-3 w-full rounded border border-white/10 py-1.5 text-[10px] font-bold tracking-wider text-mixer-muted hover:border-white/30 hover:text-white"
                    >
                      REFRESH DEVICES
                    </button>
                    <p className="mt-2 text-[9px] leading-relaxed text-mixer-muted">
                      Plug in a USB webcam, HDMI capture card (Elgato, Blackmagic, Cam Link) or USB audio
                      interface and press Refresh Devices.
                    </p>
                  </>
                )}
                <p className="mt-3 text-[10px] text-mixer-muted">
                  Source: {state.cameraSourceId === 'local' ? 'Local webcam' : 'Mobile device'} · up to {maxCameras} input{maxCameras > 1 ? 's' : ''} on plan
                </p>
              </>
            )}
            {panel === 'mobile' && (
              <>
                <PrismMobilePanel
                  cameraSourceId={state.cameraSourceId}
                  pairedDevices={camera.pairedMobileDevices.map((d) => ({
                    deviceId: d.deviceId,
                    label: d.label,
                    status: d.status,
                  }))}
                  canUseMobile={canUseMobile}
                  onSelectSource={(id) => {
                    patchState({ cameraSourceId: id });
                    if (id === 'local') camera.stop();
                    else void camera.start();
                  }}
                />
              </>
            )}
            {panel === 'tracking' && (
              <>
                <PrismTrackingPanel canUseWebXR={canUseWebXR} />
              </>
            )}
            {panel === 'multicam' && (
              <>
                <PrismMultiCameraPanel maxSecondary={maxSecondary} canUseMultiCam={maxSecondary > 0} />
                {secondary.errors.size > 0 && (
                  <div className="mt-2 space-y-1">
                    {[...secondary.errors.entries()].map(([id, msg]) => (
                      <p key={id} className="text-[10px] text-mixer-red">{msg}</p>
                    ))}
                  </div>
                )}
              </>
            )}
            {panel === 'nodes' && (
              <>
                <PrismNodeEditor />
              </>
            )}
            {panel === 'motion' && <MotionGraphicsPanel />}
            {panel === 'graphics' && (
              <>
                <PrismGraphicsPanel />
              </>
            )}
            {panel === 'models' && (
              <>
                <ModelLibraryPanel
                  planId={planId}
                  virtualSets={ALL_SETS}
                  selectedVirtualSetId={studio.virtualSetId}
                  lockedVirtualSetIds={lockedSetIds}
                  productionMode={studio.mode}
                  canUseAr={canUseAr}
                  onSelectVirtualSet={(id) => {
                    triggerSwitchFx();
                    patchStudio({ virtualSetId: id });
                  }}
                  onSelectProductionMode={(m) => patchStudio({ mode: m })}
                  sceneObjects={studio.sceneObjects}
                  importedModels={studio.importedModels}
                  canImportGltf={canImportModels}
                  onAddObject={(obj) => patchStudio({ sceneObjects: [...studio.sceneObjects, obj] })}
                  onUpdateObject={(id, patch) =>
                    patchStudio({
                      sceneObjects: studio.sceneObjects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
                    })
                  }
                  onRemoveObject={(id) =>
                    patchStudio({ sceneObjects: studio.sceneObjects.filter((o) => o.id !== id) })
                  }
                  onSetObjects={(objects) => patchStudio({ sceneObjects: objects })}
                  onLoadBundle={(bundle, objects) => {
                    patchStudio({
                      virtualSetId: bundle.virtualSetId,
                      sceneObjects: objects,
                      cameraYaw: bundle.camera.yaw,
                      cameraPitch: bundle.camera.pitch,
                      cameraZoom: bundle.camera.zoom,
                      cameraFov: bundle.camera.fov,
                      cameraTarget: bundle.camera.target,
                      mode: 'virtual_studio',
                      nodeGraph: studio.nodeGraph.nodes.virtual_set.enabled
                        ? studio.nodeGraph
                        : setNodeEnabled(studio.nodeGraph, 'virtual_set', true),
                    });
                  }}
                  onAddImport={(entry) => patchStudio({ importedModels: [...studio.importedModels, entry] })}
                  onUpdateImport={(id, patch) =>
                    patchStudio({
                      importedModels: studio.importedModels.map((m) => (m.id === id ? { ...m, ...patch } : m)),
                    })
                  }
                  onRemoveImport={(id) => {
                    const removed = studio.importedModels.find((m) => m.id === id);
                    if (removed) disposeObjectUrl(removed.url);
                    patchStudio({ importedModels: studio.importedModels.filter((m) => m.id !== id) });
                  }}
                />
              </>
            )}
            {panel === 'scenes' && (
              <>
                <SceneManagerPanel
                  planId={planId}
                  virtualSetId={studio.virtualSetId}
                  mode={studio.mode}
                  keySettings={studio.keySettings}
                  cameraYaw={studio.cameraYaw}
                  cameraPitch={studio.cameraPitch}
                  cameraZoom={studio.cameraZoom}
                  cameraFov={studio.cameraFov}
                  cameraTarget={studio.cameraTarget}
                  showShadows={studio.showShadows}
                  showReflections={studio.showReflections}
                  nodeGraph={studio.nodeGraph}
                  secondarySlots={studio.secondarySlots}
                  lowerThird={state.lowerThird}
                  sceneObjects={studio.sceneObjects}
                  motion={{ brand: state.motion.brand, overrides: state.motion.overrides }}
                  renderEngine={studio.renderEngine}
                  photoreal={studio.photoreal}
                  onLoad={handleLoadScene}
                />
              </>
            )}
            {panel === 'output' && (
              <div className="space-y-3">
                <PanelSection title="Delivery" hint={`Output quality: ${outputQuality}`} accent>
                  {showWatermark && (
                    <PanelNote tone="amber">Free tier includes a Regal Prism watermark on output.</PanelNote>
                  )}
                  {canFeedMixer ? (
                    <div className="space-y-2">
                      <p className="text-xs text-mixer-muted">
                        Press Route to Mixer, then switch to Video Mixer — Regal Prism appears as a virtual video
                        source.
                      </p>
                      {isLive && <PanelNote tone="green">Feed active — select Regal Prism on the mixer PST/PGM bus.</PanelNote>}
                    </div>
                  ) : (
                    <PanelNote>Video Mixer feed output unlocks on Pro Master.</PanelNote>
                  )}
                </PanelSection>

                <PanelSection title="RTMP stream">
                  <PrismStreamPanel
                    canStream={canStream}
                    buildProgramStream={programAudio.buildProgramStream}
                    hasAudio={programAudio.hasAudio}
                  />
                </PanelSection>

                <PanelSection title="Audio & clip recording">
                  <PrismAudioPanel hasAudio={programAudio.hasAudio} canUseMixerAudio={canUseMixerAudio} />
                  {programStream && (
                    <button
                      type="button"
                      disabled={recordingClip}
                      onClick={() => {
                        setRecordingClip(true);
                        const withAudio = programAudio.buildProgramStream(programStream);
                        void recorder.downloadRecording(withAudio).finally(() => setRecordingClip(false));
                      }}
                      className="w-full rounded border border-white/20 py-2 text-[10px] font-bold tracking-wider hover:border-white/40 disabled:opacity-40"
                    >
                      {recordingClip ? 'RECORDING 5s CLIP…' : 'RECORD 5s PROGRAM CLIP'}
                    </button>
                  )}
                </PanelSection>
              </div>
            )}
          </aside>
        )}

        <main className="relative min-w-0 flex-1">
          <video ref={camera.videoRef} className="hidden" playsInline muted autoPlay />
          <canvas ref={keyCanvasRef} className="hidden" />
          <SecondaryCameraVideos slots={studio.secondarySlots} setVideoRef={secondary.setVideoRef} />

          <div className="relative h-full w-full min-h-[360px]">
            {!camera.active ? (
              !hidden && (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <Sparkles className="h-12 w-12 text-amber-500/50" />
                  <div>
                    <p className="text-lg font-bold">Regal Prism Studio</p>
                    <p className="mt-1 max-w-md text-sm text-mixer-muted">
                      Start your camera to begin virtual production.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void camera.start()}
                    className="rounded bg-amber-500 px-6 py-2.5 text-xs font-bold tracking-wider text-black hover:bg-amber-400"
                  >
                    ENABLE CAMERA
                  </button>
                </div>
              )
            ) : (
              <>
                <Suspense fallback={!hidden ? <SceneLoadingFallback /> : null}>
                  {stageEngineId === 'prism-babylon' ? (
                    <BabylonStudioStage
                      sceneId={photorealDef?.id ?? 'cyclorama'}
                      camera={{
                        yaw: studio.cameraYaw,
                        pitch: studio.cameraPitch,
                        zoom: studio.cameraZoom,
                        fov: studio.cameraFov,
                        target: studio.cameraTarget,
                      }}
                      onCameraChange={handleStageCameraChange}
                      bindings={studio.photoreal.bindings}
                      lighting={studio.photoreal.lighting}
                      temperature={studio.photoreal.temperature}
                      exposure={studio.photoreal.exposure}
                      accent={studio.photoreal.accent ?? '#38bdf8'}
                      shadows={studio.showShadows}
                      visible={virtualSetEnabled}
                      interactive={!state.orientationTracking && !state.webxrTracking}
                      settings={stageEngine.settings.babylon}
                      onCanvasReady={attachGlCanvas}
                      talent={{
                        keyedCanvas,
                        rawVideo,
                        keyerEnabled,
                        showReflections: studio.showReflections,
                        placement: studio.photoreal.talentPlacement,
                      }}
                    />
                  ) : stageEngineId === 'unreal-pixelstream' ? (
                    <UnrealPixelStreamStage
                      settings={stageEngine.settings.unreal}
                      visible={virtualSetEnabled}
                      interactive={!state.orientationTracking && !state.webxrTracking}
                      onStageSource={attachGlCanvas}
                    />
                  ) : usePhotoreal && photorealDef ? (
                    <VirtualStudioStage
                      sceneId={photorealDef.id}
                      mode={studio.mode}
                      importedModels={studio.importedModels}
                      sceneObjects={studio.sceneObjects}
                      camera={{
                        yaw: studio.cameraYaw,
                        pitch: studio.cameraPitch,
                        zoom: studio.cameraZoom,
                        fov: studio.cameraFov,
                        target: studio.cameraTarget,
                      }}
                      onCameraChange={handleStageCameraChange}
                      transition={studio.photoreal.transition ?? DEFAULT_STUDIO_TRANSITION}
                      bindings={studio.photoreal.bindings}
                      backdrop={studio.photoreal.backdrop}
                      tickerSpeed={studio.photoreal.tickerSpeed}
                      lighting={studio.photoreal.lighting}
                      temperature={studio.photoreal.temperature}
                      exposure={studio.photoreal.exposure}
                      accent={studio.photoreal.accent}
                      effects={studio.photoreal.effects}
                      elements={studio.photoreal.elements}
                      selectedElementId={selectedElementId}
                      snapToGrid={studio.photoreal.snapToGrid}
                      onSelectElement={setSelectedElementId}
                      onMoveElement={handleMoveElement}
                      onRotateElement={handleRotateElement}
                      onScaleElement={handleScaleElement}
                      onElevateElement={handleElevateElement}
                      quality={studio.photoreal.quality}
                      shadows={studio.showShadows}
                      visible={virtualSetEnabled}
                      interactive={!state.orientationTracking && !state.webxrTracking}
                      onCanvasReady={attachGlCanvas}
                      talent={{
                        keyedCanvas,
                        rawVideo,
                        keyerEnabled,
                        showReflections: studio.showReflections,
                        placement: studio.photoreal.talentPlacement,
                      }}
                    />
                  ) : (
                    <VirtualScene
                      virtualSet={virtualSet}
                      keyedCanvas={keyedCanvas}
                      rawVideo={rawVideo}
                      mode={studio.mode}
                      cameraYaw={studio.cameraYaw}
                      cameraPitch={studio.cameraPitch}
                      cameraZoom={studio.cameraZoom}
                      cameraTarget={studio.cameraTarget}
                      showShadows={studio.showShadows}
                      showReflections={studio.showReflections}
                      importedModels={studio.importedModels}
                      sceneObjects={studio.sceneObjects}
                      onGlReady={attachGlCanvas}
                      keyerEnabled={keyerEnabled}
                      virtualSetEnabled={virtualSetEnabled}
                      orbitEnabled={!state.orientationTracking && !state.webxrTracking}
                      onCameraChange={handleStageCameraChange}
                    />
                  )}
                </Suspense>
                {switchFx && (
                  <div
                    key={switchFx.id}
                    className={cn('pointer-events-none absolute inset-0 z-10', switchFx.cls)}
                    onAnimationEnd={() => setSwitchFx(null)}
                  />
                )}
                {showWatermark && !hidden && (
                  <div className="pointer-events-none absolute bottom-4 right-4 rounded bg-black/60 px-3 py-1 text-[10px] font-bold tracking-[0.3em] text-amber-400/80">
                    REGAL PRISM
                  </div>
                )}
                {!hidden && camera.active && !state.orientationTracking && !state.webxrTracking && (
                  <div className="pointer-events-none absolute bottom-4 left-4 rounded bg-black/55 px-2.5 py-1 text-[9px] tracking-wider text-mixer-muted">
                    DRAG TO ORBIT · SCROLL TO ZOOM
                  </div>
                )}
                {isLive && !hidden && (
                  <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded bg-red-600/90 px-2 py-1 text-[10px] font-bold tracking-wider">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                    LIVE · MIXER
                  </div>
                )}
              </>
            )}
          </div>

          {/* 3D motion graphics overlay — previewed over the stage and captured into program output. */}
          {motion.active && (!hidden || motion.onProgram) && (
            <div className="pointer-events-none absolute inset-0 z-20">
              <MotionGraphicsStage
                motion={motion}
                className="h-full w-full"
                onCanvasReady={handleMotionCanvas}
                onBackdropReady={handleMotionBackdropCanvas}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
