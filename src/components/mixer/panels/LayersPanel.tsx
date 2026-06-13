import { useCallback, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Layers, Lock, Upload } from 'lucide-react';
import type { PlanTier } from '../../../types/plans';
import type { OverlayPosition, TransitionGraphicType } from '../../../types/overlays';
import type { KeySettings, LayerSettings, OutputMode, PipSettings } from '../../../types/mixer';
import { normalizeLayerSettings } from '../../../lib/layerSettings';
import { resizeImageForOverlay } from '../../../lib/imageResize';
import { planAllowsAdvancedGraphics, planAllowsChromaKey } from '../../../lib/planFeatures';
import { loadSavedLowerThirdPresets } from '../../../lib/savedPresetsStorage';
import type { SavedLowerThirdPreset } from '../../../types/overlays';
import { buildLayerStack } from './layers/buildLayerStack';
import { LayerStackGrid } from './layers/LayerStackGrid';
import { LayerQuickNav } from './layers/LayerQuickNav';
import { LayerTextEntry } from './layers/LayerTextEntry';
import { BreakingBannerEditor } from './layers/BreakingBannerEditor';
import { ChromaBackgroundPicker } from './layers/ChromaBackgroundPicker';
import type { ChromaBackgroundId } from '../../../types/chromaBackgrounds';
import { TransitionStingerEditor } from './layers/TransitionStingerEditor';
import { LowerThirdProduction } from './layers/LowerThirdProduction';
import type { LayerStackId } from './layers/layerStackTypes';
import { reorderStackOrder } from '../../../lib/graphicsStackOrder';
import { PRESET_PLACEMENT } from '../../../lib/overlayPlacement';
import { MIXER_QUICK_TERMS } from '../../../config/mixerGuide';
import { FeatureHint } from '../FeatureHint';
import { cn } from '../../../lib/utils';

interface GraphicsActions {
  patchLayers: (p: Partial<LayerSettings>) => void;
  applyLowerThirdAndLive: (id: LayerSettings['lowerThirdTemplate'], withSample?: boolean) => void;
  applySavedPreset: (preset: SavedLowerThirdPreset, goLive: boolean) => void;
  toggleLowerThirdLive: (live: boolean) => void;
  toggleLogoLive: (live: boolean) => void;
  toggleCrawlerLive: (live: boolean) => void;
  toggleBreakingLive: (live: boolean) => void;
  toggleLiveButtonLive: (live: boolean) => void;
  toggleImageLive: (id: string, live: boolean) => void;
  clearAllPgmGraphics: () => void;
  removeStackLayer: (id: LayerStackId) => void;
  fireTransition: (type: TransitionGraphicType, title: string, headline: string) => void;
}

interface LayersPanelProps {
  layers: LayerSettings;
  pgmLayers: LayerSettings;
  planId: PlanTier;
  pip: PipSettings;
  keySettings: KeySettings;
  outputMode: OutputMode;
  selectedLayerId: LayerStackId;
  onSelectLayer: (id: LayerStackId) => void;
  onPatchLayers: (p: Partial<LayerSettings>) => void;
  onPatchPip: (p: Partial<PipSettings>) => void;
  onPatchKey: (p: Partial<KeySettings>) => void;
  onSetOutputMode: (mode: OutputMode) => void;
  graphics: GraphicsActions;
  compact?: boolean;
  /** Side-by-side with other mixer panels — stack + editor use full column width. */
  multiPanel?: boolean;
}

const POSITIONS: OverlayPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'];

export function LayersPanel({
  layers: rawLayers,
  pgmLayers: rawPgmLayers,
  planId,
  keySettings,
  outputMode,
  onPatchKey,
  onSetOutputMode,
  selectedLayerId,
  onSelectLayer,
  graphics,
  compact = false,
  multiPanel = false,
}: LayersPanelProps) {
  const layers = normalizeLayerSettings(rawLayers);
  const pgmLayers = normalizeLayerSettings(rawPgmLayers);
  const selectedId = selectedLayerId;
  const [savedPresets, setSavedPresets] = useState<SavedLowerThirdPreset[]>(() => loadSavedLowerThirdPresets());
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const chromaAllowed = planAllowsChromaKey(planId);
  const advancedGraphics = planAllowsAdvancedGraphics(planId);

  const stack = useMemo(() => buildLayerStack(layers, pgmLayers), [layers, pgmLayers]);
  const selectedItem = stack.find((s) => s.id === selectedId);
  const selectedImageId = selectedId.startsWith('image:') ? selectedId.slice(6) : null;
  const selectedImage = selectedImageId ? layers.imageOverlays.find((o) => o.id === selectedImageId) : null;

  const isAdvancedLayer = (id: LayerStackId) =>
    id === 'breaking' || id === 'crawler' || id === 'transition' || id.startsWith('image:');

  const toggleLayerPreview = useCallback((id: LayerStackId, on: boolean) => {
    if (!advancedGraphics && isAdvancedLayer(id)) return;
    if (id === 'lower-third') graphics.patchLayers({ showLowerThird: on });
    else if (id === 'logo') graphics.patchLayers({ showLogo: on });
    else if (id === 'crawler') graphics.patchLayers({ showCrawler: on });
    else if (id === 'breaking') graphics.patchLayers({ showBreakingNews: on });
    else if (id === 'live-button') graphics.patchLayers({ showLiveButton: on });
    else if (id.startsWith('image:')) {
      const imgId = id.slice(6);
      graphics.patchLayers({
        imageOverlays: layers.imageOverlays.map((o) => (o.id === imgId ? { ...o, visible: on } : o)),
      });
    }
  }, [graphics, layers.imageOverlays, advancedGraphics]);

  const selectLayer = useCallback((id: LayerStackId) => {
    if (!advancedGraphics && isAdvancedLayer(id)) return;
    onSelectLayer(id);
    const item = stack.find((s) => s.id === id);
    if (item?.canPreview && !item.isPreview) toggleLayerPreview(id, true);
  }, [onSelectLayer, stack, toggleLayerPreview, advancedGraphics]);

  const toggleLayerLive = (id: LayerStackId, live: boolean) => {
    if (live) toggleLayerPreview(id, true);
    if (id === 'lower-third') graphics.toggleLowerThirdLive(live);
    else if (id === 'logo') graphics.toggleLogoLive(live);
    else if (id === 'crawler') graphics.toggleCrawlerLive(live);
    else if (id === 'breaking') graphics.toggleBreakingLive(live);
    else if (id === 'live-button') graphics.toggleLiveButtonLive(live);
    else if (id.startsWith('image:')) graphics.toggleImageLive(id.slice(6), live);
  };

  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    graphics.patchLayers({
      graphicsStackOrder: reorderStackOrder(layers.graphicsStackOrder, fromIndex, toIndex),
    });
  }, [graphics, layers.graphicsStackOrder]);

  const deleteLayer = (id: LayerStackId) => {
    if (!stack.find((item) => item.id === id)?.canDelete) return;
    graphics.removeStackLayer(id);
    if (selectedId === id) {
      const remaining = stack.filter((item) => item.id !== id);
      const fallback = remaining.find((item) => item.canPreview)?.id ?? remaining[0]?.id ?? 'chroma';
      onSelectLayer(fallback);
    }
  };

  const handleGraphicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const { dataUrl, width, height } = await resizeImageForOverlay(file);
      const overlay = {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^.]+$/, '').slice(0, 20) || 'Graphic',
        dataUrl,
        naturalWidth: width,
        naturalHeight: height,
        scale: 35,
        opacity: 100,
        position: 'top-left' as OverlayPosition,
        visible: true,
        liveOnPgm: false,
      };
      const imageStackId = `image:${overlay.id}` as LayerStackId;
      const nextOrder = [...layers.graphicsStackOrder];
      const logoIdx = nextOrder.indexOf('logo');
      if (logoIdx >= 0) nextOrder.splice(logoIdx, 0, imageStackId);
      else nextOrder.push(imageStackId);
      graphics.patchLayers({
        imageOverlays: [...layers.imageOverlays, overlay],
        graphicsStackOrder: nextOrder,
      });
      selectLayer(imageStackId);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { dataUrl, width, height } = await resizeImageForOverlay(file, 480, 480);
      graphics.patchLayers({
        programLogo: {
          ...layers.programLogo,
          mode: 'image',
          imageDataUrl: dataUrl,
          naturalWidth: width,
          naturalHeight: height,
        },
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Logo upload failed');
    }
  };

  return (
    <div
      className={cn(
        'layers-split min-h-0 h-full',
        multiPanel && 'layers-split--multi-panel',
        compact && !multiPanel && 'layers-split--compact',
      )}
    >
      <div className="layers-split-left min-h-0 overflow-hidden">
        <section className="mixer-panel-section mixer-panel-section--stack min-h-0 overflow-hidden">
          <div className="mixer-panel-section-head">
            <div className="mixer-panel-section-title">
              <Layers className="h-3.5 w-3.5 text-mixer-red" />
              Layer stack
            </div>
            <button
              type="button"
              onClick={graphics.clearAllPgmGraphics}
              className="mixer-panel-section-action"
            >
              Clear PGM
            </button>
          </div>

          <LayerQuickNav
            selectedId={selectedId}
            onSelect={selectLayer}
            chromaLocked={!chromaAllowed}
            advancedLocked={!advancedGraphics}
          />

          <LayerStackGrid
            items={stack}
            selectedId={selectedId}
            chromaLocked={!chromaAllowed}
            advancedLocked={!advancedGraphics}
            compact={compact || multiPanel}
            dense={multiPanel}
            onSelect={selectLayer}
            onTogglePreview={toggleLayerPreview}
            onToggleLive={toggleLayerLive}
            onDelete={deleteLayer}
            onReorder={handleReorder}
          />

          <FeatureHint className={cn('mixer-panel-tip', multiPanel && 'hidden')}>
            Eye = PST preview · Radio = PGM live · Drag grip to reorder (top = front)
          </FeatureHint>
        </section>

        <section className="mixer-panel-section mixer-panel-section--footer">
          <button
            type="button"
            onClick={() => advancedGraphics && fileRef.current?.click()}
            disabled={uploading || !advancedGraphics}
            className="mixer-btn flex w-full items-center justify-center gap-1.5 py-2 text-[10px]"
            title={!advancedGraphics ? 'Pro plan required' : undefined}
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? 'Uploading…' : 'Add image layer'}
          </button>
          {!advancedGraphics && (
            <p className="mixer-panel-notice mixer-panel-notice--warn">
              Breaking, crawler, stinger &amp; image layers need Pro or Pro Master.
            </p>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleGraphicUpload} />
          {uploadError && <p className="mixer-panel-notice mixer-panel-notice--error">{uploadError}</p>}
        </section>
      </div>

      <div className="layers-split-right">
        <header className="layer-editor-header">
          <div className="layer-editor-header-row">
            <span className="layer-editor-header-kicker">Properties</span>
            <strong>{selectedItem?.label ?? 'Layer'}</strong>
          </div>
          {selectedItem && (selectedItem.isPreview || selectedItem.isLive) && (
            <div className="layer-editor-header-badges">
              {selectedItem.isPreview && <span className="layer-stack-badge-pst">PST</span>}
              {selectedItem.isLive && <span className="layer-stack-badge-air">AIR</span>}
            </div>
          )}
        </header>

        <div className="layer-editor-body">
          {selectedId === 'transition' && (
            <TransitionStingerEditor
              layers={layers}
              onPatch={graphics.patchLayers}
              onFire={graphics.fireTransition}
            />
          )}

          {selectedId === 'breaking' && (
            <BreakingBannerEditor layers={layers} onPatch={graphics.patchLayers} />
          )}

          {selectedId === 'live-button' && (
            <div className="layer-editor-card flex flex-col gap-2">
              <LayerTextEntry layerId={selectedId} layers={layers} onPatch={graphics.patchLayers} />
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1 text-[8px] text-mixer-muted">
                  Opacity
                  <input
                    type="range"
                    min={20}
                    max={100}
                    value={layers.liveButton.opacity}
                    onChange={(e) =>
                      graphics.patchLayers({
                        liveButton: { ...layers.liveButton, opacity: Number(e.target.value) },
                      })
                    }
                    className="w-20 accent-mixer-green"
                  />
                </label>
                <label className="flex items-center gap-1 text-[8px] text-mixer-muted">
                  <input
                    type="checkbox"
                    checked={layers.liveButton.pulse}
                    onChange={(e) =>
                      graphics.patchLayers({
                        liveButton: { ...layers.liveButton, pulse: e.target.checked },
                      })
                    }
                  />
                  Pulse
                </label>
              </div>
              <p className="text-[8px] text-mixer-green">
                Use PST (eye) to preview and PGM (radio) to take live. Drag on PST preview to reposition.
              </p>
              <div className="flex flex-wrap gap-0.5">
                {POSITIONS.map((p) => {
                  const pl = PRESET_PLACEMENT[p];
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() =>
                        graphics.patchLayers({
                          liveButton: {
                            ...layers.liveButton,
                            position: p,
                            xPercent: pl.xPercent,
                            yPercent: pl.yPercent,
                          },
                        })
                      }
                      className={cn(
                        'mixer-btn px-2 py-0.5 text-[8px]',
                        layers.liveButton.position === p && 'mixer-btn-active',
                      )}
                    >
                      {p.replace('-', ' ')}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedId === 'lower-third' && (
            <>
            <div className="layer-editor-card mb-2">
              <LayerTextEntry layerId={selectedId} layers={layers} onPatch={graphics.patchLayers} />
              <p className="mt-2 text-[8px] text-mixer-green">Drag the lower third on PST preview to move it horizontally.</p>
            </div>
            <LowerThirdProduction
              layers={layers}
              pgmLayers={pgmLayers}
              presets={savedPresets}
              onPresetsChange={setSavedPresets}
              graphics={graphics}
            />
            </>
          )}

          {selectedId === 'logo' && (
            <div className="layer-editor-card flex flex-col gap-2">
              {layers.programLogo.mode === 'text' && (
                <LayerTextEntry layerId={selectedId} layers={layers} onPatch={graphics.patchLayers} />
              )}
              <div className="flex gap-1">
                <button type="button" onClick={() => graphics.patchLayers({ programLogo: { ...layers.programLogo, mode: 'text' } })} className={cn('mixer-btn flex-1 py-1 text-[9px]', layers.programLogo.mode === 'text' && 'mixer-btn-active')}>Text Logo</button>
                <button type="button" onClick={() => logoRef.current?.click()} className={cn('mixer-btn flex-1 py-1 text-[9px]', layers.programLogo.mode === 'image' && 'mixer-btn-active')}>PNG Logo</button>
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>
              {layers.programLogo.mode === 'image' && layers.programLogo.imageDataUrl && (
                <img src={layers.programLogo.imageDataUrl} alt="Logo" className="mx-auto h-14 object-contain" />
              )}
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1 text-[8px] text-mixer-muted">Size
                  <input type="range" min={10} max={80} value={layers.programLogo.scale} onChange={(e) => graphics.patchLayers({ programLogo: { ...layers.programLogo, scale: Number(e.target.value) } })} className="w-20 accent-mixer-red" />
                </label>
                <label className="flex items-center gap-1 text-[8px] text-mixer-muted">Opacity
                  <input type="range" min={20} max={100} value={layers.programLogo.opacity} onChange={(e) => graphics.patchLayers({ programLogo: { ...layers.programLogo, opacity: Number(e.target.value) } })} className="w-20 accent-mixer-green" />
                </label>
              </div>
              <p className="text-[8px] text-mixer-green">Drag the graphic on the PST preview to position it.</p>
              <div className="flex flex-wrap gap-0.5">
                {POSITIONS.map((p) => {
                  const pl = PRESET_PLACEMENT[p];
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => graphics.patchLayers({ programLogo: { ...layers.programLogo, position: p, xPercent: pl.xPercent, yPercent: pl.yPercent } })}
                      className={cn('mixer-btn px-2 py-0.5 text-[8px]', layers.programLogo.position === p && 'mixer-btn-active')}
                    >
                      {p.replace('-', ' ')}
                    </button>
                  );
                })}
              </div>
              <label className="flex items-center gap-2 text-[9px]">
                <input type="checkbox" checked={layers.programLogo.showBackground} onChange={(e) => graphics.patchLayers({ programLogo: { ...layers.programLogo, showBackground: e.target.checked } })} />
                Text background
              </label>
            </div>
          )}

          {selectedId === 'crawler' && (
            <div className="layer-editor-card flex flex-col gap-2">
              <LayerTextEntry layerId={selectedId} layers={layers} onPatch={graphics.patchLayers} />
              <div className="flex flex-wrap gap-1">
              {(['news-red', 'sport-black', 'minimal'] as const).map((s) => (
                <button key={s} type="button" onClick={() => graphics.patchLayers({ crawler: { ...layers.crawler, style: s } })} className={cn('mixer-btn px-2 py-1 text-[8px]', layers.crawler.style === s && 'mixer-btn-active')}>{s.replace('-', ' ')}</button>
              ))}
              <label className="ml-auto flex items-center gap-1 text-[8px] text-mixer-muted">Speed
                <input type="range" min={1} max={3} step={1} value={layers.crawler.speed} onChange={(e) => graphics.patchLayers({ crawler: { ...layers.crawler, speed: Number(e.target.value) as 1 | 2 | 3 } })} className="w-16" />
              </label>
              </div>
            </div>
          )}

          {selectedImage && selectedId.startsWith('image:') && (
            <div className="layer-editor-card flex flex-col gap-2">
              <div className="flex items-center gap-2 rounded border border-mixer-border bg-black/30 p-2">
                <img src={selectedImage.dataUrl} alt="" className="h-12 w-12 object-contain" />
                <span className="flex-1 truncate text-[10px] font-semibold">{selectedImage.name}</span>
                <button type="button" onClick={() => graphics.patchLayers({ imageOverlays: layers.imageOverlays.map((x) => x.id === selectedImage.id ? { ...x, visible: !x.visible } : x) })} className="text-mixer-muted">
                  {selectedImage.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              </div>
              <label className="text-[8px] text-mixer-muted">Size {selectedImage.scale}%
                <input type="range" min={5} max={100} value={selectedImage.scale} onChange={(e) => graphics.patchLayers({ imageOverlays: layers.imageOverlays.map((x) => x.id === selectedImage.id ? { ...x, scale: Number(e.target.value) } : x) })} className="w-full accent-mixer-red" />
              </label>
              <label className="text-[8px] text-mixer-muted">Opacity {selectedImage.opacity}%
                <input type="range" min={20} max={100} value={selectedImage.opacity} onChange={(e) => graphics.patchLayers({ imageOverlays: layers.imageOverlays.map((x) => x.id === selectedImage.id ? { ...x, opacity: Number(e.target.value) } : x) })} className="w-full accent-mixer-green" />
              </label>
              <p className="text-[8px] text-mixer-green">Drag on PST preview to position this image.</p>
              <div className="flex flex-wrap gap-0.5">
                {POSITIONS.map((p) => {
                  const pl = PRESET_PLACEMENT[p];
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => graphics.patchLayers({
                        imageOverlays: layers.imageOverlays.map((x) =>
                          x.id === selectedImage.id ? { ...x, position: p, xPercent: pl.xPercent, yPercent: pl.yPercent } : x,
                        ),
                      })}
                      className={cn('mixer-btn px-2 py-0.5 text-[8px]', selectedImage.position === p && 'mixer-btn-active')}
                    >
                      {p.replace('-', ' ')}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedId === 'chroma' && (
            <div className="layer-editor-card flex flex-col gap-2">
              {!chromaAllowed ? (
                <div className="flex flex-col items-center gap-2 rounded border border-dashed border-mixer-border py-6 text-center">
                  <Lock className="h-6 w-6 text-mixer-muted" />
                  <p className="text-[10px] text-mixer-muted">Chroma Key — Pro &amp; Pro Master</p>
                </div>
              ) : (
                <>
                  <label className="flex items-center gap-2 text-[10px]">
                    <input type="checkbox" checked={keySettings.enabled && outputMode === 'key'} onChange={(e) => { onSetOutputMode(e.target.checked ? 'key' : 'main'); onPatchKey({ enabled: e.target.checked }); }} />
                    Enable KEY on PGM
                  </label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => onPatchKey({ keyType: 'chroma', enabled: true })}
                      className={cn('mixer-btn flex-1 py-1 text-[9px]', keySettings.keyType !== 'luma' && 'mixer-btn-active')}
                    >
                      Chroma
                    </button>
                    <button
                      type="button"
                      onClick={() => onPatchKey({ keyType: 'luma', enabled: true })}
                      className={cn('mixer-btn flex-1 py-1 text-[9px]', keySettings.keyType === 'luma' && 'mixer-btn-active')}
                    >
                      Luma
                    </button>
                  </div>
                  {keySettings.keyType === 'luma' ? (
                    <label className="text-[8px] text-mixer-muted">
                      Black threshold {keySettings.lumaThreshold}%
                      <input
                        type="range"
                        min={5}
                        max={60}
                        value={keySettings.lumaThreshold}
                        onChange={(e) => onPatchKey({ lumaThreshold: Number(e.target.value) })}
                        className="w-full accent-mixer-green"
                      />
                      <span className="mt-1 block text-amber-400/90">
                        Luma keys dark pixels — use Chroma for green-screen overlays from Regal Display.
                      </span>
                    </label>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input type="color" value={keySettings.color} onChange={(e) => onPatchKey({ color: e.target.value, enabled: true })} className="h-9 w-12 cursor-pointer" />
                      <input type="range" min={5} max={80} value={keySettings.tolerance} onChange={(e) => onPatchKey({ tolerance: Number(e.target.value) })} className="flex-1 accent-mixer-green" />
                      <span className="text-[10px]">{keySettings.tolerance}%</span>
                    </div>
                  )}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => onPatchKey({ fillSource: 'preset', enabled: true })}
                      className={cn('mixer-btn flex-1 py-1 text-[9px]', keySettings.fillSource !== 'camera' && 'mixer-btn-active')}
                    >
                      Preset BG
                    </button>
                    <button
                      type="button"
                      onClick={() => onPatchKey({ fillSource: 'camera', enabled: true })}
                      className={cn('mixer-btn flex-1 py-1 text-[9px]', keySettings.fillSource === 'camera' && 'mixer-btn-active')}
                    >
                      Aux (Sub) camera
                    </button>
                  </div>
                  {keySettings.fillSource !== 'camera' ? (
                    <ChromaBackgroundPicker
                      selectedId={(keySettings.backgroundId || 'gradient-broadcast') as ChromaBackgroundId}
                      onSelect={(id) => onPatchKey({ backgroundId: id, fillSource: 'preset', enabled: true })}
                    />
                  ) : (
                    <FeatureHint>{MIXER_QUICK_TERMS.auxSub}</FeatureHint>
                  )}
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
