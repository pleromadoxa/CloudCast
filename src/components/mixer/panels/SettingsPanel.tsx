import { Maximize2, MonitorUp } from 'lucide-react';
import type { VideoAspectRatio } from '../../../types/mixer';
import type { OverlayType, StreamQuality } from '../../../types/device';
import type { LayerSettings } from '../../../types/mixer';
import type { ViewMode } from '../../../types/controls';
import type { KeyboardShortcutBindings } from '../../../types/keyboardShortcuts';
import { ASPECT_RATIO_LABELS } from '../../../lib/aspectRatio';
import { cn } from '../../../lib/utils';
import { PlatformGuide } from '../PlatformGuide';
import { FeatureHint } from '../FeatureHint';
import { KeyboardShortcutsEditor } from './KeyboardShortcutsEditor';

interface SettingsPanelProps {
  aspectRatio: VideoAspectRatio;
  viewMode: ViewMode;
  showMultiview: boolean;
  fullscreenPgm: boolean;
  externalDisplayOpen: boolean;
  keyboardShortcuts: KeyboardShortcutBindings;
  onSetAspectRatio: (ratio: VideoAspectRatio) => void;
  onSetViewMode: (mode: ViewMode) => void;
  onToggleMultiview: () => void;
  onToggleFullscreen: () => void;
  onToggleExternalDisplay: () => void;
  onSetQuality: (q: StreamQuality) => void;
  onSetKeyboardShortcuts: (bindings: KeyboardShortcutBindings) => void;
  onShortcutAssigningChange?: (assigning: boolean) => void;
  defaultQuality: StreamQuality;
  globalOverlay: OverlayType;
  layers: LayerSettings;
  onSetGlobalOverlay: (overlay: OverlayType) => void;
  onPatchLayers: (partial: Partial<LayerSettings>) => void;
}

const ratios: VideoAspectRatio[] = ['16:9', '9:16', '4:3', '1:1'];
const qualities: StreamQuality[] = ['auto', 'high', 'medium', 'low'];
const previewModes: { id: ViewMode; label: string }[] = [
  { id: 'grid', label: 'GRID' },
  { id: 'focus', label: 'FOCUS' },
  { id: 'single', label: 'SOLO' },
];
const monitorTools: { id: OverlayType; label: string }[] = [
  { id: 'none', label: 'none' },
  { id: 'timestamp', label: 'time' },
  { id: 'device-label', label: 'label' },
  { id: 'crosshair', label: 'crosshair' },
  { id: 'safe-zone', label: 'safe zone' },
];

export function SettingsPanel({
  aspectRatio,
  viewMode,
  showMultiview,
  fullscreenPgm,
  externalDisplayOpen,
  keyboardShortcuts,
  onSetAspectRatio,
  onSetViewMode,
  onToggleMultiview,
  onToggleFullscreen,
  onToggleExternalDisplay,
  onSetQuality,
  onSetKeyboardShortcuts,
  onShortcutAssigningChange,
  defaultQuality,
  globalOverlay,
  layers,
  onSetGlobalOverlay,
  onPatchLayers,
  compact = false,
}: SettingsPanelProps & { compact?: boolean }) {
  const handleMonitorTool = (overlay: OverlayType) => {
    onSetGlobalOverlay(overlay);
    if (overlay === 'crosshair') {
      onPatchLayers({ showCrosshair: true, showSafeZone: false });
    } else if (overlay === 'safe-zone') {
      onPatchLayers({ showSafeZone: true, showCrosshair: false });
    } else if (overlay === 'none') {
      onPatchLayers({ showSafeZone: false, showCrosshair: false });
    }
  };

  const handleSafeZoneToggle = (checked: boolean) => {
    onPatchLayers({ showSafeZone: checked });
    if (checked) onSetGlobalOverlay('safe-zone');
    else if (globalOverlay === 'safe-zone') onSetGlobalOverlay('none');
  };

  const handleCrosshairToggle = (checked: boolean) => {
    onPatchLayers({ showCrosshair: checked });
    if (checked) onSetGlobalOverlay('crosshair');
    else if (globalOverlay === 'crosshair') onSetGlobalOverlay('none');
  };

  return (
    <div className={cn('setup-panel min-h-0 h-full', compact && 'setup-panel--compact')}>
      <FeatureHint className="shrink-0 rounded border border-white/10 bg-black/30 px-2 py-1.5">
        Display, output, shortcuts, and the platform guide below explain every major control on the mixer.
      </FeatureHint>
      <div className="setup-panel-top">
        <section className="setup-section setup-display">
          <p className="setup-section-title">Display</p>
          <div>
            <p className="atem-group-label mb-1.5">Aspect ratio</p>
            <div className="deck-effect-grid">
              {ratios.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onSetAspectRatio(r)}
                  className={cn('deck-pad-btn deck-pad-btn-lg', aspectRatio === r && 'atem-toggle-on')}
                >
                  {ASPECT_RATIO_LABELS[r]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="atem-group-label mb-1.5">Stream quality</p>
            <div className="deck-duration-row">
              {qualities.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onSetQuality(q)}
                  className={cn('deck-pad-btn flex-1 uppercase', defaultQuality === q && 'atem-toggle-on')}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="atem-group-label mb-1.5">Preview layout</p>
            <div className="deck-duration-row">
              {previewModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onSetViewMode(mode.id)}
                  className={cn('deck-pad-btn flex-1', viewMode === mode.id && 'atem-toggle-on')}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="atem-group-label mb-1.5">Monitor tools</p>
            <div className="flex flex-wrap gap-1">
              {monitorTools.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => handleMonitorTool(tool.id)}
                  className={cn(
                    'deck-pad-btn px-2 py-1 text-[8px] uppercase',
                    globalOverlay === tool.id && 'atem-toggle-on',
                  )}
                >
                  {tool.label}
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 text-[9px] text-mixer-muted">
                <input
                  type="checkbox"
                  checked={layers.showSafeZone}
                  onChange={(e) => handleSafeZoneToggle(e.target.checked)}
                />
                Safe zone
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-[9px] text-mixer-muted">
                <input
                  type="checkbox"
                  checked={layers.showCrosshair}
                  onChange={(e) => handleCrosshairToggle(e.target.checked)}
                />
                Crosshair
              </label>
            </div>
          </div>
        </section>

        <section className="setup-section setup-output">
          <p className="setup-section-title">Output</p>
          <div className="deck-transport-col">
            <button
              type="button"
              onClick={onToggleMultiview}
              className={cn('deck-pad-btn deck-pad-btn-lg w-full', showMultiview && 'atem-toggle-on')}
            >
              {showMultiview ? '● MULTIVIEW' : 'MULTIVIEW'}
            </button>
            <button
              type="button"
              onClick={onToggleFullscreen}
              className={cn(
                'deck-pad-btn deck-pad-btn-lg flex w-full items-center justify-center gap-2',
                fullscreenPgm && 'atem-toggle-on',
              )}
            >
              <Maximize2 className="h-4 w-4" /> {fullscreenPgm ? '● FULLSCREEN' : 'FULLSCREEN'}
            </button>
            <button
              type="button"
              onClick={onToggleExternalDisplay}
              className={cn(
                'deck-pad-btn deck-pad-btn-lg flex w-full items-center justify-center gap-2',
                externalDisplayOpen && 'atem-toggle-on',
              )}
            >
              <MonitorUp className="h-4 w-4" /> {externalDisplayOpen ? '● EXT OUT' : 'EXT OUTPUT'}
            </button>
            <FeatureHint>
              Recording is on the Video Out column (right). Cloud upload requires Pro or Pro Master.
            </FeatureHint>
          </div>
        </section>
      </div>

      <div className={cn('setup-panel-lower grid min-h-0 flex-1 gap-2.5', !compact && 'lg:grid-cols-2')}>
        <section className="setup-section setup-shortcuts min-h-0">
          <p className="setup-section-title">Keyboard shortcuts</p>
          <FeatureHint className="mb-1.5">
            Click a pad, then press a key. Shortcuts work while the dashboard is focused.
          </FeatureHint>
          <KeyboardShortcutsEditor
            bindings={keyboardShortcuts}
            onChange={onSetKeyboardShortcuts}
            onAssigningChange={onShortcutAssigningChange}
          />
        </section>

        {!compact && (
          <section className="setup-section setup-guide min-h-0 flex flex-col">
            <p className="setup-section-title">Platform guide</p>
            <PlatformGuide compact />
          </section>
        )}
      </div>
    </div>
  );
}
