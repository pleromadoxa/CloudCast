import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera, Compass, GitBranch, Layers, LogOut, MonitorPlay, Radio, Sparkles, Video, Box, Smartphone, Type, LayoutGrid,
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
import type { PrismSceneRecord } from '../../types/prismFeed';
import { sceneExtendedState, sceneToKeySettings } from '../../lib/prism/prismSceneService';
import { setNodeEnabled } from '../../lib/prism/nodeGraph';
import { productionShellClass } from '../../lib/productionShell';
import { cn } from '../../lib/utils';

const VirtualScene = lazy(() => import('./VirtualScene').then((m) => ({ default: m.VirtualScene })));

function SceneLoadingFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <Sparkles className="h-8 w-8 animate-pulse text-amber-500/60" />
    </div>
  );
}

type SidePanel = 'keyer' | 'sets' | 'camera' | 'mobile' | 'tracking' | 'output' | 'scenes' | 'models' | 'graphics' | 'nodes' | 'multicam';

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

  const { state, studio, isLive, goLive, stopLive, patchStudio, attachGlCanvas, patchState, refreshCapture, programStream, getPipOverlaysRef, setLowerThird } = prismFeed;
  const camera = usePrismVideoSource(state.cameraSourceId);
  const recorder = usePrismRecorder();
  const secondary = usePrismSecondaryCameras(studio.secondarySlots, studio.keySettings, maxSecondary);

  const canUseMixerAudio = canFeedMixer || (profile?.entitlements?.universal ?? isUniversalPlan(profile?.plan_id));
  const programAudio = usePrismProgramAudio(camera.videoRef, {
    includeMic: state.programAudioMic,
    includeMixer: state.programAudioMixer && canUseMixerAudio,
  });
  const keyerEnabled = studio.nodeGraph.nodes.keyer.enabled;
  const virtualSetEnabled = studio.nodeGraph.nodes.virtual_set.enabled;

  const [panel, setPanel] = useState<SidePanel>('keyer');
  const keyCanvasRef = useRef<HTMLCanvasElement>(null);
  const [keyedCanvas, setKeyedCanvas] = useState<HTMLCanvasElement | null>(null);
  const processorRef = useRef<ChromaKeyProcessor | null>(null);
  const [recordingClip, setRecordingClip] = useState(false);

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
      patchStudio({
        virtualSetId: scene.virtual_set_id,
        mode: scene.mode,
        keySettings: sceneToKeySettings(scene),
        cameraYaw: scene.camera_settings.yaw ?? 0,
        cameraPitch: scene.camera_settings.pitch ?? 0.15,
        cameraZoom: scene.camera_settings.zoom ?? 1,
        showShadows: scene.lighting.shadows ?? true,
        showReflections: scene.lighting.reflections ?? true,
        ...(ext.nodeGraph ? { nodeGraph: ext.nodeGraph } : {}),
        ...(ext.secondarySlots ? { secondarySlots: ext.secondarySlots } : {}),
        ...(ext.sceneObjects ? { sceneObjects: ext.sceneObjects } : { sceneObjects: [] }),
      });
      prismFeed.setKeySettings(sceneToKeySettings(scene));
      if (ext.lowerThird) setLowerThird(ext.lowerThird);
    },
    [patchStudio, prismFeed, setLowerThird],
  );

  const panels: { id: SidePanel; label: string; icon: typeof Camera }[] = [
    { id: 'keyer', label: 'Keyer', icon: Sparkles },
    { id: 'sets', label: 'Virtual Sets', icon: Layers },
    { id: 'camera', label: 'Camera', icon: Camera },
    { id: 'mobile', label: 'Mobile', icon: Smartphone },
    { id: 'tracking', label: 'Tracking', icon: Compass },
    { id: 'multicam', label: 'Multi-Cam', icon: LayoutGrid },
    { id: 'nodes', label: 'Pipeline', icon: GitBranch },
    { id: 'graphics', label: 'Graphics', icon: Type },
    { id: 'models', label: '3D Models', icon: Box },
    { id: 'scenes', label: 'Scenes', icon: Layers },
    { id: 'output', label: 'Output', icon: MonitorPlay },
  ];

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
          <aside className="flex w-12 shrink-0 flex-col border-r border-white/10 bg-black/50">
            {panels.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                title={label}
                onClick={() => setPanel(id)}
                className={cn(
                  'flex flex-col items-center gap-1 py-3 text-[9px] font-bold tracking-wider',
                  panel === id ? 'bg-amber-500/15 text-amber-400' : 'text-mixer-muted hover:text-white',
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </aside>
        )}

        {!hidden && (
          <aside className="hidden w-72 shrink-0 overflow-y-auto border-r border-white/10 bg-[#0a0a0f] p-4 md:block">
            {panel === 'keyer' && (
              <>
                <h2 className="mb-3 text-xs font-bold tracking-wider">Chroma Keyer</h2>
                <ChromaKeyPanel settings={studio.keySettings} onChange={handleKeyChange} disabled={!camera.active} />
              </>
            )}
            {panel === 'sets' && (
              <>
                <h2 className="mb-3 text-xs font-bold tracking-wider">Virtual Sets</h2>
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
                  onSelect={(id) => patchStudio({ virtualSetId: id })}
                  lockedIds={lockedSetIds}
                />
              </>
            )}
            {panel === 'camera' && (
              <>
                <h2 className="mb-3 text-xs font-bold tracking-wider">Camera Input</h2>
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
                  <label className="mt-4 block">
                    <span className="text-[10px] font-bold tracking-wider text-mixer-muted">USB / WEBCAM</span>
                    <select
                      className="mt-1 w-full rounded border border-white/10 bg-black px-2 py-1.5 text-xs"
                      onChange={(e) => void camera.start(e.target.value || null)}
                      disabled={!camera.devices.length}
                    >
                      {camera.devices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera'}</option>
                      ))}
                    </select>
                  </label>
                )}
                <p className="mt-3 text-[10px] text-mixer-muted">
                  Source: {state.cameraSourceId === 'local' ? 'Local webcam' : 'Mobile device'} · up to {maxCameras} input{maxCameras > 1 ? 's' : ''} on plan
                </p>
              </>
            )}
            {panel === 'mobile' && (
              <>
                <h2 className="mb-3 text-xs font-bold tracking-wider">Regal Prism Eye</h2>
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
                <h2 className="mb-3 text-xs font-bold tracking-wider">Virtual Camera</h2>
                <PrismTrackingPanel canUseWebXR={canUseWebXR} />
              </>
            )}
            {panel === 'multicam' && (
              <>
                <h2 className="mb-3 text-xs font-bold tracking-wider">Multi-Camera PiP</h2>
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
                <h2 className="mb-3 text-xs font-bold tracking-wider">Compositor Pipeline</h2>
                <PrismNodeEditor />
              </>
            )}
            {panel === 'graphics' && (
              <>
                <h2 className="mb-3 text-xs font-bold tracking-wider">Broadcast Graphics</h2>
                <PrismGraphicsPanel />
              </>
            )}
            {panel === 'models' && (
              <>
                <h2 className="mb-3 text-xs font-bold tracking-wider">3D Studio · Backgrounds · Sets · Objects</h2>
                <ModelLibraryPanel
                  planId={planId}
                  virtualSets={ALL_SETS}
                  selectedVirtualSetId={studio.virtualSetId}
                  lockedVirtualSetIds={lockedSetIds}
                  productionMode={studio.mode}
                  canUseAr={canUseAr}
                  onSelectVirtualSet={(id) => patchStudio({ virtualSetId: id })}
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
                <h2 className="mb-3 text-xs font-bold tracking-wider">Cloud Scenes</h2>
                <SceneManagerPanel
                  planId={planId}
                  virtualSetId={studio.virtualSetId}
                  mode={studio.mode}
                  keySettings={studio.keySettings}
                  cameraYaw={studio.cameraYaw}
                  cameraPitch={studio.cameraPitch}
                  cameraZoom={studio.cameraZoom}
                  showShadows={studio.showShadows}
                  showReflections={studio.showReflections}
                  nodeGraph={studio.nodeGraph}
                  secondarySlots={studio.secondarySlots}
                  lowerThird={state.lowerThird}
                  sceneObjects={studio.sceneObjects}
                  onLoad={handleLoadScene}
                />
              </>
            )}
            {panel === 'output' && (
              <>
                <h2 className="mb-3 text-xs font-bold tracking-wider">Program Output</h2>
                <p className="text-xs text-mixer-muted">Quality: {outputQuality}</p>
                {showWatermark && (
                  <p className="mt-2 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] text-amber-200">
                    Free tier includes a Regal Prism watermark on output.
                  </p>
                )}
                {canFeedMixer ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-mixer-muted">
                      Press Route to Mixer, then switch to Video Mixer — Regal Prism appears as a virtual video source.
                    </p>
                    {isLive && (
                      <p className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-[10px] text-emerald-200">
                        Feed active — select Regal Prism on the mixer PST/PGM bus.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-mixer-muted">Video Mixer feed output unlocks on Pro Master.</p>
                )}
                <div className="mt-4 border-t border-white/10 pt-4">
                  <h3 className="mb-2 text-[10px] font-bold tracking-wider text-amber-400">RTMP STREAM</h3>
                  <PrismStreamPanel
                    canStream={canStream}
                    buildProgramStream={programAudio.buildProgramStream}
                    hasAudio={programAudio.hasAudio}
                  />
                </div>
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
                    className="mt-4 w-full rounded border border-white/20 py-2 text-[10px] font-bold tracking-wider hover:border-white/40 disabled:opacity-40"
                  >
                    {recordingClip ? 'RECORDING 5s CLIP…' : 'RECORD 5s PROGRAM CLIP'}
                  </button>
                )}
              </>
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
                  <VirtualScene
                    virtualSet={virtualSet}
                    keyedCanvas={keyedCanvas}
                    rawVideo={camera.videoRef.current}
                    mode={studio.mode}
                    cameraYaw={studio.cameraYaw}
                    cameraPitch={studio.cameraPitch}
                    cameraZoom={studio.cameraZoom}
                    showShadows={studio.showShadows}
                    showReflections={studio.showReflections}
                    importedModels={studio.importedModels}
                    sceneObjects={studio.sceneObjects}
                    onGlReady={attachGlCanvas}
                    keyerEnabled={keyerEnabled}
                    virtualSetEnabled={virtualSetEnabled}
                    orbitEnabled={!state.orientationTracking && !state.webxrTracking}
                    onCameraChange={(patch) =>
                      patchStudio({
                        ...(patch.yaw !== undefined ? { cameraYaw: patch.yaw } : {}),
                        ...(patch.pitch !== undefined ? { cameraPitch: patch.pitch } : {}),
                        ...(patch.zoom !== undefined ? { cameraZoom: patch.zoom } : {}),
                      })
                    }
                  />
                </Suspense>
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
        </main>
      </div>
    </div>
  );
}
