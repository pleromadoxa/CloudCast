import { Mic, MicOff, Radio, KeyRound } from 'lucide-react';
import { MIXER_PANELS } from '../../config/mixerPanels';
import type { DashboardControls } from '../../types/controls';
import type { MixerPanel } from '../../types/mixer';
import type { Device } from '../../types/device';
import type { IpCameraConfig } from '../../types/ipCamera';
import type { AudioInputSource } from '../../types/audio';
import type { PlanTier } from '../../types/plans';
import type { VideoAspectRatio } from '../../types/mixer';
import type { LayerStackId } from './panels/layers/layerStackTypes';
import { isRealDevice } from '../../types/device';
import { planAllowsChromaKey } from '../../lib/planFeatures';
import { resolveChassisPanelClass, resolveMultiPanelGridColumns } from '../../lib/mixerPanelLayout';
import { cn } from '../../lib/utils';
import { AudioMeters } from './AudioMeters';
import { SourcesPanel } from './panels/SourcesPanel';
import { LayersPanel } from './panels/LayersPanel';
import { AudioMixerPanel } from './panels/AudioMixerPanel';
import { TransitionPanel } from './panels/TransitionPanel';
import { DevicesPanel } from './panels/DevicesPanel';
import { SettingsPanel } from './panels/SettingsPanel';
import { StreamSettingsPanel } from './panels/StreamSettingsPanel';
import { MixerPanelHeader } from './MixerPanelHeader';
import { MixerTabGuide } from './MixerTabGuide';

interface MixerControlDeckProps {
  controls: DashboardControls;
  devices: Device[];
  pstDeviceId: string | null;
  pgmDeviceId: string | null;
  onSetPanel: (panel: DashboardControls['activePanel']) => void;
  onToggleOpenPanel: (panel: MixerPanel) => void;
  onFocusPst: (id: string) => void;
  onAssignSub: (id: string) => void;
  onAssignPgm: (id: string) => void;
  onSetOutputMode: (mode: DashboardControls['outputMode']) => void;
  onSwapPstPgm: () => void;
  onExchange: () => void;
  onToggleAutoTrans: () => void;
  onCut: () => void;
  onTake: () => void;
  onFadeBlack: () => void;
  onSetTransitionType: (t: DashboardControls['transition']['type']) => void;
  onSetTransitionDuration: (ms: number) => void;
  onSetTransitionProgress: (v: number) => void;
  onCommitTbar: (v: number) => void;
  onGoLive: () => void;
  isStreamValidating?: boolean;
  streamNotice?: { type: 'error' | 'success' | 'info'; message: string } | null;
  onTestStreamConnection: (input: {
    name: string;
    streamUrl: string;
    streamKey: string;
    platform: import('../../types/streaming').StreamPlatform;
  }) => Promise<{ ok: boolean; message: string }>;
  onToggleRecording: () => void;
  onToggleMultiview: () => void;
  onToggleFullscreen: () => void;
  onToggleExternalDisplay: () => void;
  onShortcutAssigningChange?: (assigning: boolean) => void;
  externalDisplayOpen: boolean;
  onPatchPip: (p: Partial<DashboardControls['pip']>) => void;
  onPatchKey: (p: Partial<DashboardControls['key']>) => void;
  onPatchLayers: (p: Partial<DashboardControls['layers']>) => void;
  pgmLayers: DashboardControls['pgmLayers'];
  graphics: ReturnType<typeof import('../../hooks/useGraphicsLive').useGraphicsLive>;
  selectedGraphicsLayerId: LayerStackId;
  onSelectGraphicsLayer: (id: LayerStackId) => void;
  planId: PlanTier;
  onPatchAudio: (p: Partial<DashboardControls['audio']>) => void;
  onSetInputVolume: (id: string, v: number) => void;
  onToggleInputMute: (id: string) => void;
  onToggleInputSolo: (id: string) => void;
  onToggleViewAudioMute: (id: string) => void;
  onSetViewMonitorVolume: (id: string, v: number) => void;
  onToggleMonitorMasterMute: () => void;
  onSetQuality: (q: DashboardControls['defaultQuality']) => void;
  onSetAspectRatio: (ratio: VideoAspectRatio) => void;
  onSetViewMode: (mode: DashboardControls['viewMode']) => void;
  onSetKeyboardShortcuts: (bindings: DashboardControls['keyboardShortcuts']) => void;
  onSetGlobalOverlay: (overlay: import('../../types/device').OverlayType) => void;
  onUnpair: (id: string) => void;
  onReconnect: (id: string) => void;
  accessCode?: string;
  onSetInputAudioSource: (id: string, source: AudioInputSource) => void;
  onSetLinkedUsbAudio: (id: string, audioDeviceId: string | null) => void;
  onPersistAudioSettings: (deviceId: string, source: AudioInputSource, linkedId: string | null) => void;
  getAudioSourceForDevice: (id: string) => AudioInputSource;
  ipCameraAllowed: boolean;
  ipCameraConfig: IpCameraConfig | null;
  ipCameraSlot: number;
  onSaveIpCamera: (input: { label: string; url: string; enabled: boolean }) => { ok: boolean; message: string };
  onRemoveIpCamera: () => void;
}

function panelMeta(panel: MixerPanel) {
  return MIXER_PANELS.find((entry) => entry.id === panel);
}

export function MixerControlDeck(props: MixerControlDeckProps) {
  const { controls, devices, pstDeviceId, pgmDeviceId, onSetPanel, onToggleOpenPanel } = props;
  const slots = devices;
  const visiblePanels = controls.openPanels.length > 0 ? controls.openPanels : [controls.activePanel];
  const isMultiPanel = visiblePanels.length > 1;
  const showGlobalTransport = visiblePanels.some((panel) =>
    ['layers', 'devices', 'stream', 'settings', 'audio'].includes(panel),
  );
  const chassisClass = resolveChassisPanelClass(visiblePanels, controls.activePanel);
  const narrowOutputCol = visiblePanels.some((panel) => panel === 'audio' || panel === 'devices');
  const canTake = Boolean(pstDeviceId && pgmDeviceId && pstDeviceId !== pgmDeviceId);
  const keyAllowed = planAllowsChromaKey(props.planId);
  const keyOn = controls.outputMode === 'key' && controls.key.enabled;

  const renderPanel = (panel: MixerPanel, compact: boolean) => {
    if (panel === 'sources') {
      return (
          <SourcesPanel
            devices={devices}
            pstDeviceId={pstDeviceId}
            pgmDeviceId={pgmDeviceId}
            subDeviceId={controls.subDeviceId}
            outputMode={controls.outputMode}
            pip={controls.pip}
            keySettings={controls.key}
            planId={props.planId}
            compact={compact}
            onFocusPst={props.onFocusPst}
            onAssignSub={props.onAssignSub}
            onAssignPgm={props.onAssignPgm}
            onSetOutputMode={props.onSetOutputMode}
            onPatchPip={props.onPatchPip}
            onPatchKey={props.onPatchKey}
            onSwapPstPgm={props.onSwapPstPgm}
            onExchange={props.onExchange}
          />
      );
    }
    if (panel === 'layers') {
      return (
          <LayersPanel
            compact={compact}
            multiPanel={isMultiPanel}
            layers={controls.layers}
            pgmLayers={props.pgmLayers}
            planId={props.planId}
            pip={controls.pip}
            keySettings={controls.key}
            outputMode={controls.outputMode}
            onPatchLayers={props.onPatchLayers}
            onPatchPip={props.onPatchPip}
            onPatchKey={props.onPatchKey}
            onSetOutputMode={props.onSetOutputMode}
            graphics={props.graphics}
            selectedLayerId={props.selectedGraphicsLayerId}
            onSelectLayer={props.onSelectGraphicsLayer}
          />
      );
    }
    if (panel === 'audio') {
      return (
          <AudioMixerPanel
            devices={devices}
            audio={controls.audio}
            pgmDeviceId={pgmDeviceId}
            onPatchAudio={props.onPatchAudio}
            onSetInputVolume={props.onSetInputVolume}
            onToggleInputMute={props.onToggleInputMute}
            onToggleInputSolo={props.onToggleInputSolo}
            onToggleViewAudioMute={props.onToggleViewAudioMute}
            onSetViewMonitorVolume={props.onSetViewMonitorVolume}
            onToggleMonitorMasterMute={props.onToggleMonitorMasterMute}
            onSetInputAudioSource={props.onSetInputAudioSource}
            onSetLinkedUsbAudio={props.onSetLinkedUsbAudio}
            getAudioSourceForDevice={props.getAudioSourceForDevice}
          />
      );
    }
    if (panel === 'transitions') {
      return (
          <TransitionPanel
            transition={controls.transition}
            compact={compact}
            onSetType={props.onSetTransitionType}
            onSetDuration={props.onSetTransitionDuration}
            onSetProgress={props.onSetTransitionProgress}
            onCommitTbar={props.onCommitTbar}
            onCut={props.onCut}
            onTake={props.onTake}
            onFadeBlack={props.onFadeBlack}
            onToggleAutoTrans={props.onToggleAutoTrans}
            canTake={canTake}
          />
      );
    }
    if (panel === 'devices') {
      return (
          <DevicesPanel
            devices={devices}
            pstDeviceId={pstDeviceId}
            pgmDeviceId={pgmDeviceId}
            defaultQuality={controls.defaultQuality}
            accessCode={props.accessCode}
            onSetQuality={props.onSetQuality}
            onUnpair={props.onUnpair}
            onReconnect={props.onReconnect}
            getAudioSourceForDevice={props.getAudioSourceForDevice}
            onSetInputAudioSource={props.onSetInputAudioSource}
            onPersistAudioSettings={props.onPersistAudioSettings}
            linkedUsbAudio={controls.audio.linkedUsbAudio}
            ipCameraAllowed={props.ipCameraAllowed}
            ipCameraConfig={props.ipCameraConfig}
            ipCameraSlot={props.ipCameraSlot}
            onSaveIpCamera={props.onSaveIpCamera}
            onRemoveIpCamera={props.onRemoveIpCamera}
          />
      );
    }
    if (panel === 'stream') {
      return (
          <StreamSettingsPanel
            planId={props.planId}
            isOnAir={controls.isOnAir}
            isValidating={props.isStreamValidating}
            onGoLive={props.onGoLive}
            onTestConnection={props.onTestStreamConnection}
            externalNotice={props.streamNotice}
          />
      );
    }
    return (
          <SettingsPanel
            compact={compact}
            aspectRatio={controls.display.aspectRatio}
            viewMode={controls.viewMode}
            showMultiview={controls.showMultiview}
            fullscreenPgm={controls.fullscreenPgm}
            externalDisplayOpen={props.externalDisplayOpen}
            defaultQuality={controls.defaultQuality}
            keyboardShortcuts={controls.keyboardShortcuts}
            onSetAspectRatio={props.onSetAspectRatio}
            onSetViewMode={props.onSetViewMode}
            onToggleMultiview={props.onToggleMultiview}
            onToggleFullscreen={props.onToggleFullscreen}
            onToggleExternalDisplay={props.onToggleExternalDisplay}
            onSetQuality={props.onSetQuality}
            onSetKeyboardShortcuts={props.onSetKeyboardShortcuts}
            onShortcutAssigningChange={props.onShortcutAssigningChange}
            globalOverlay={controls.globalOverlay}
            layers={controls.layers}
            onSetGlobalOverlay={props.onSetGlobalOverlay}
            onPatchLayers={props.onPatchLayers}
            accessCode={props.accessCode}
          />
    );
  };

  return (
    <div
      className={cn(
        'atem-chassis flex shrink-0 border-t-2 border-[#1a1a1a] bg-[#0d0d0d]',
        chassisClass,
        isMultiPanel && 'atem-chassis--multi',
      )}
    >
      <div className="atem-chassis-panel-body relative z-0 flex min-h-0 min-w-0 flex-1 flex-col">
        <MixerTabGuide
          className="shrink-0 border-b border-mixer-border/60 px-2 py-1.5"
          activePanel={controls.activePanel}
          openPanels={visiblePanels}
          onSelectPanel={onSetPanel}
          onToggleOpenPanel={onToggleOpenPanel}
        />
        {!isMultiPanel && panelMeta(controls.activePanel) && (
          <MixerPanelHeader
            icon={panelMeta(controls.activePanel)!.icon}
            title={panelMeta(controls.activePanel)!.label}
            description={panelMeta(controls.activePanel)!.description}
            onClose={() => onToggleOpenPanel(controls.activePanel)}
          />
        )}
        <div
          className={cn(
            'atem-chassis-panel-scroll min-h-0',
            isMultiPanel && 'atem-multi-panel-grid',
            isMultiPanel && `atem-multi-panel-grid--count-${visiblePanels.length}`,
          )}
          style={isMultiPanel ? { gridTemplateColumns: resolveMultiPanelGridColumns(visiblePanels) } : undefined}
        >
          {visiblePanels.map((panel) => {
            const meta = panelMeta(panel);
            return (
              <div
                key={panel}
                className={cn(
                  'atem-multi-panel-column min-h-0 min-w-0',
                  panel === 'layers' && isMultiPanel && 'atem-multi-panel-column--layers',
                  panel === controls.activePanel && isMultiPanel && 'atem-multi-panel-column-active',
                )}
              >
                {isMultiPanel && meta && (
                  <MixerPanelHeader
                    icon={meta.icon}
                    title={meta.label}
                    description={meta.description}
                    className="mixer-panel-header--compact"
                    onClose={() => onToggleOpenPanel(panel)}
                    actions={
                      panel !== controls.activePanel ? (
                        <button
                          type="button"
                          onClick={() => onSetPanel(panel)}
                          className="mixer-panel-focus-btn"
                        >
                          Focus
                        </button>
                      ) : undefined
                    }
                  />
                )}
                <div className="atem-multi-panel-content min-h-0">
                  {renderPanel(panel, false)}
                </div>
              </div>
            );
          })}
        </div>

        {showGlobalTransport && (
          <div className="mt-auto flex items-center justify-between border-t border-mixer-border px-2.5 py-2">
            <div className="flex gap-1.5">
              {slots.map((device, i) => (
                <button
                  key={`q-${i}`}
                  type="button"
                  disabled={!device || !isRealDevice(device)}
                  onClick={() => device && props.onFocusPst(device.deviceId)}
                  onDoubleClick={() => device && isRealDevice(device) && props.onAssignPgm(device.deviceId)}
                  className={cn(
                    'atem-input-btn !h-12 !min-w-[48px]',
                    device?.deviceId === pgmDeviceId && 'atem-input-pgm',
                    device?.deviceId === pstDeviceId && device?.deviceId !== pgmDeviceId && 'atem-input-pst',
                  )}
                  title={device ? `${device.label} — preview · dbl-click cut` : 'Empty'}
                >
                  <span className="atem-input-num text-lg">{i + 1}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {keyAllowed && (
                <button
                  type="button"
                  onClick={() => {
                    if (keyOn) {
                      props.onSetOutputMode('main');
                      props.onPatchKey({ enabled: false });
                    } else {
                      props.onSetOutputMode('key');
                      props.onPatchKey({ enabled: true });
                    }
                  }}
                  className={cn(
                    'atem-auto-btn !h-11 !min-w-[56px] !text-xs',
                    keyOn && 'bg-emerald-600/40 text-emerald-200 ring-1 ring-emerald-500/50',
                  )}
                  title="Toggle chroma/luma KEY on PGM"
                >
                  <KeyRound className="mx-auto h-3.5 w-3.5" />
                  KEY
                </button>
              )}
              <button type="button" onClick={props.onCut} className="atem-cut-btn !h-11 !min-w-[64px] !text-xs">CUT</button>
              <button type="button" onClick={props.onTake} disabled={!canTake} className="atem-auto-btn !h-11 !min-w-[64px] !text-xs">TAKE</button>
              <button
                type="button"
                onClick={props.onGoLive}
                disabled={props.isStreamValidating}
                className={cn('atem-stream-btn !h-11 !min-w-[72px] !text-xs', controls.isOnAir && 'atem-stream-live')}
              >
                {props.isStreamValidating ? '…' : controls.isOnAir ? 'ON AIR' : 'STREAM'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={cn('atem-output-col shrink-0', narrowOutputCol && 'atem-output-col--narrow')}>
          <p className="atem-group-label mb-1">Video Out</p>
          <button
            type="button"
            onClick={props.onGoLive}
            disabled={props.isStreamValidating}
            className={cn('atem-output-air', controls.isOnAir && 'atem-output-air-live')}
          >
            <Radio className="mx-auto mb-1 h-5 w-5" />
            {controls.isOnAir ? 'ON AIR' : 'STREAM'}
          </button>
          <button
            type="button"
            onClick={props.onToggleRecording}
            className={cn('atem-output-rec', controls.isRecording && 'atem-output-rec-live')}
          >
            ● REC
          </button>
          <button
            type="button"
            onClick={() => props.onPatchAudio({ masterMuted: !controls.audio.masterMuted })}
            className={cn(
              'atem-output-mute',
              controls.audio.masterMuted ? 'atem-toggle-glow' : 'atem-toggle-on',
            )}
            title="Master mute"
          >
            {controls.audio.masterMuted ? <MicOff className="mx-auto h-4 w-4" /> : <Mic className="mx-auto h-4 w-4" />}
          </button>
          <AudioMeters active={Boolean(pgmDeviceId)} muted={controls.audio.masterMuted} />
          <span className="atem-group-label mt-1">PGM OUT</span>
        </div>
    </div>
  );
}
