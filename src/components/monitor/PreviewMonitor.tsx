import type { Device, OverlayType, StreamQuality } from '../../types/device';
import type { ViewMode } from '../../types/controls';
import type { KeySettings, LayerSettings, OutputMode, PipSettings, VideoAspectRatio } from '../../types/mixer';
import type { LayerStackId } from '../mixer/panels/layers/layerStackTypes';
import { cn } from '../../lib/utils';
import { VideoOverlay } from '../overlays/VideoOverlay';
import { AspectRatioFrame } from './AspectRatioFrame';
import { CompositeMonitor } from './CompositeMonitor';
import { PreviewSourceGrid } from './PreviewSourceGrid';

interface PreviewMonitorProps {
  devices: Device[];
  slotCount: number;
  pstDevice: Device | null;
  subDevice: Device | null;
  pstDeviceId: string | null;
  pgmDeviceId: string | null;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  outputMode: OutputMode;
  pip: PipSettings;
  keySettings: KeySettings;
  layers: LayerSettings;
  highlightLayerId: LayerStackId | null;
  highlightLayerLabel: string;
  graphicsDragEnabled: boolean;
  onPatchLayers?: (partial: Partial<LayerSettings>) => void;
  getQuality: (id: string) => StreamQuality;
  getOverlay: (id: string) => OverlayType;
  isViewAudioMuted: (deviceId: string) => boolean;
  onToggleViewAudioMute: (deviceId: string) => void;
  getMonitorVolume: (deviceId: string) => number;
  getMonitorAudioDeviceId: (deviceId: string) => string | null;
  onSelectSource: (deviceId: string) => void;
  onCutToSource?: (deviceId: string) => void;
  aspectRatio: VideoAspectRatio;
}

const VIEW_MODE_OPTIONS: { id: ViewMode; label: string }[] = [
  { id: 'grid', label: 'GRID' },
  { id: 'focus', label: 'FOCUS' },
  { id: 'single', label: 'SOLO' },
];

export function PreviewMonitor({
  devices,
  slotCount,
  pstDevice,
  subDevice,
  pstDeviceId,
  pgmDeviceId,
  viewMode,
  onViewModeChange,
  outputMode,
  pip,
  keySettings,
  layers,
  highlightLayerId,
  highlightLayerLabel,
  graphicsDragEnabled,
  onPatchLayers,
  getQuality,
  getOverlay,
  isViewAudioMuted,
  onToggleViewAudioMute,
  getMonitorVolume,
  getMonitorAudioDeviceId,
  onSelectSource,
  onCutToSource,
  aspectRatio,
}: PreviewMonitorProps) {
  const showGrid = viewMode === 'grid' || viewMode === 'focus';
  const pstOverlay = pstDevice ? getOverlay(pstDevice.deviceId) : 'none';
  const pstMonitorVolume = pstDevice ? getMonitorVolume(pstDevice.deviceId) : 0;

  return (
    <div className="mixer-monitor flex min-h-0 flex-1 flex-col">
      <div className="mixer-label mixer-label-pst flex items-center gap-2">
        <span>PST</span>
        {showGrid && (
          <span className="text-[8px] font-normal text-mixer-green">MULTI-VIEW</span>
        )}
        <div className="ml-2 flex gap-0.5">
          {VIEW_MODE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onViewModeChange(opt.id)}
              className={cn(
                'rounded px-1.5 py-0.5 text-[8px] font-bold tracking-wider transition-colors',
                viewMode === opt.id
                  ? 'bg-mixer-green text-black'
                  : 'bg-white/10 text-mixer-muted hover:bg-white/20 hover:text-white',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {!showGrid && <span className="text-[8px] font-normal text-mixer-green">+ GRAPHICS PREVIEW</span>}
        {pstDevice && (
          <span className="ml-auto text-[10px] font-normal text-mixer-muted">{pstDevice.label}</span>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        <AspectRatioFrame ratio={aspectRatio} className="h-full">
          {showGrid ? (
            <div className="relative h-full w-full">
              <PreviewSourceGrid
                devices={devices}
                slotCount={slotCount}
                pstDeviceId={pstDeviceId}
                pgmDeviceId={pgmDeviceId}
                viewMode={viewMode}
                getQuality={getQuality}
                getOverlay={getOverlay}
                isViewAudioMuted={isViewAudioMuted}
                onToggleViewAudioMute={onToggleViewAudioMute}
                getMonitorVolume={getMonitorVolume}
                getMonitorAudioDeviceId={getMonitorAudioDeviceId}
                onSelectSource={onSelectSource}
                onCutToSource={onCutToSource}
              />
              <VideoOverlay
                type={pstOverlay}
                deviceLabel={pstDevice?.label ?? ''}
                layers={layers}
                showSafeZone={layers.showSafeZone}
                showCrosshair={layers.showCrosshair}
                stagingPreview
                highlightLayerId={highlightLayerId}
                highlightLayerLabel={highlightLayerLabel}
                graphicsDragEnabled={graphicsDragEnabled}
                onPatchLayers={onPatchLayers}
              />
            </div>
          ) : (
            <CompositeMonitor
              label="PST"
              device={pstDevice}
              subDevice={subDevice}
              outputMode={outputMode}
              pip={pip}
              keySettings={keySettings}
              layers={layers}
              stagingPreview
              highlightLayerId={highlightLayerId}
              highlightLayerLabel={highlightLayerLabel}
              graphicsDragEnabled={graphicsDragEnabled}
              onPatchLayers={onPatchLayers}
              overlay={pstOverlay}
              quality={pstDevice ? getQuality(pstDevice.deviceId) : 'auto'}
              audioMuted={pstMonitorVolume === 0}
              volume={pstMonitorVolume}
              audioDeviceId={pstDevice ? getMonitorAudioDeviceId(pstDevice.deviceId) : null}
              pgmDeviceId={pgmDeviceId}
              aspectRatio={aspectRatio}
              embedded
              showClock={false}
            />
          )}
        </AspectRatioFrame>
      </div>
    </div>
  );
}
