import type { ReactNode } from 'react';
import type { OverlayType } from '../../types/device';
import type { LayerSettings } from '../../types/mixer';
import type { ImageOverlay } from '../../types/overlays';
import { zIndexForStackId } from '../../lib/graphicsStackOrder';
import { normalizeLayerSettings } from '../../lib/layerSettings';
import { cn } from '../../lib/utils';
import type { LayerStackId } from '../../types/graphicsStack';
import { LowerThirdOverlay } from './LowerThirdOverlay';
import { ImageOverlayLayer } from './ImageOverlayLayer';
import { LogoOverlay } from './LogoOverlay';
import { NewsCrawler } from './NewsCrawler';
import { BreakingBanner } from './BreakingBanner';
import { TransitionStinger } from './TransitionStinger';
import { LiveButtonOverlay } from './LiveButtonOverlay';
import { LayerHighlight } from './LayerHighlight';
import { GraphicsDragLayer } from './GraphicsDragLayer';
import { isDraggableLayer } from '../../lib/overlayPlacement';

interface VideoOverlayProps {
  type: OverlayType;
  deviceLabel: string;
  layers?: LayerSettings;
  showSafeZone?: boolean;
  showCrosshair?: boolean;
  stagingPreview?: boolean;
  highlightLayerId?: LayerStackId | null;
  highlightLayerLabel?: string;
  graphicsDragEnabled?: boolean;
  onPatchLayers?: (partial: Partial<LayerSettings>) => void;
}

function ZLayer({ zIndex, children }: { zIndex: number; children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex }}>
      {children}
    </div>
  );
}

function renderStackLayer(
  id: LayerStackId,
  gfx: LayerSettings,
  stagingPreview: boolean,
  imageOverlays: ImageOverlay[],
): ReactNode | null {
  if (id === 'breaking') {
    const show =
      stagingPreview ? gfx.showBreakingNews : gfx.showBreakingNews && gfx.breakingNews.headline.trim();
    if (!show) return null;
    return <BreakingBanner headline={gfx.breakingNews.headline || (stagingPreview ? 'BREAKING NEWS' : '')} />;
  }

  if (id === 'live-button') {
    if (!gfx.showLiveButton) return null;
    return <LiveButtonOverlay settings={gfx.liveButton} />;
  }

  if (id === 'lower-third') {
    const show =
      stagingPreview ? gfx.showLowerThird : gfx.showLowerThird && Boolean(gfx.lowerThirdText);
    if (!show) return null;
    return (
      <LowerThirdOverlay
        template={gfx.lowerThirdTemplate}
        customization={gfx.lowerThirdCustomization}
        headline={gfx.lowerThirdText || (stagingPreview ? 'Your Headline' : '')}
        subline={gfx.lowerThirdSubtext || (stagingPreview ? 'Subtitle line' : '')}
        preview={stagingPreview && !gfx.lowerThirdText}
      />
    );
  }

  if (id.startsWith('image:')) {
    const imgId = id.slice(6);
    const overlay = imageOverlays.find((o) => o.id === imgId);
    if (!overlay) return null;
    return <ImageOverlayLayer overlays={[overlay]} />;
  }

  if (id === 'logo') {
    const show =
      gfx.showLogo &&
      (gfx.programLogo.mode === 'image'
        ? Boolean(gfx.programLogo.imageDataUrl)
        : Boolean(gfx.programLogo.text) || stagingPreview);
    if (!show) return null;
    return <LogoOverlay logo={gfx.programLogo} />;
  }

  if (id === 'crawler') {
    const show = stagingPreview ? gfx.showCrawler : gfx.showCrawler && gfx.crawler.text.trim();
    if (!show) return null;
    return <NewsCrawler crawler={gfx.crawler} />;
  }

  if (id === 'transition' && gfx.transitionGraphic.firing) {
    return (
      <TransitionStinger
        type={gfx.transitionGraphic.type}
        title={gfx.transitionGraphic.title}
        headline={gfx.transitionGraphic.headline}
      />
    );
  }

  return null;
}

export function VideoOverlay({
  type,
  deviceLabel,
  layers,
  showSafeZone,
  showCrosshair,
  stagingPreview = false,
  highlightLayerId = null,
  highlightLayerLabel = '',
  graphicsDragEnabled = false,
  onPatchLayers,
}: VideoOverlayProps) {
  const gfx = layers ? normalizeLayerSettings(layers) : null;

  const imageOverlays = stagingPreview
    ? (gfx?.imageOverlays.filter((o) => o.visible) ?? [])
    : (gfx?.imageOverlays ?? []);

  const stackLayers: { id: LayerStackId; zIndex: number; content: ReactNode }[] = [];
  if (gfx) {
    for (const id of gfx.graphicsStackOrder) {
      const content = renderStackLayer(id, gfx, stagingPreview, imageOverlays);
      if (!content) continue;
      const zIndex =
        id === 'transition' && gfx.transitionGraphic.firing
          ? 100
          : zIndexForStackId(id, gfx.graphicsStackOrder);
      stackLayers.push({ id, zIndex, content });
    }
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10" data-pgm-graphics>
      {type === 'timestamp' && (
        <div className="absolute top-2 right-2 z-[5] rounded bg-black/60 px-2 py-1 font-mono text-xs text-white">
          {new Date().toLocaleTimeString()}
        </div>
      )}

      {type === 'device-label' && (
        <div className="absolute bottom-2 left-2 z-[5] rounded bg-black/60 px-2 py-1 text-xs font-medium text-white">
          {deviceLabel}
        </div>
      )}

      {(type === 'crosshair' || showCrosshair) && (
        <div className="absolute inset-0 z-[4] flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border border-white/40" />
          <div className="absolute h-px w-full bg-white/20" />
          <div className="absolute h-full w-px bg-white/20" />
        </div>
      )}

      {(type === 'safe-zone' || showSafeZone) && (
        <div className={cn('absolute inset-[10%] z-[4] border-2 border-dashed border-yellow-400/50')} />
      )}

      {stackLayers.map((layer) => (
        <ZLayer key={layer.id} zIndex={layer.zIndex}>
          {layer.content}
        </ZLayer>
      ))}

      {stagingPreview && highlightLayerId && gfx && (
        <LayerHighlight
          layerId={highlightLayerId}
          layers={gfx}
          label={highlightLayerLabel || 'Selected'}
          hideWhenDraggable={graphicsDragEnabled && isDraggableLayer(highlightLayerId)}
        />
      )}

      {stagingPreview && graphicsDragEnabled && gfx && onPatchLayers && (
        <GraphicsDragLayer
          layers={gfx}
          selectedLayerId={highlightLayerId}
          enabled={graphicsDragEnabled}
          onPatch={onPatchLayers}
        />
      )}
    </div>
  );
}
