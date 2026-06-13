import { Camera, Globe, Headphones, Radio, Trash2, Usb, Video, Wifi } from 'lucide-react';
import { IpCameraPanel } from './IpCameraPanel';
import { InputLiveMeter } from '../InputLiveMeter';
import type { IpCameraConfig } from '../../../types/ipCamera';
import { isIpCameraDevice } from '../../../lib/ipCameraDevice';
import type { Device, StreamQuality } from '../../../types/device';
import type { AudioInputSource } from '../../../types/audio';
import { AUDIO_SOURCE_LABELS } from '../../../types/audio';
import { isAudioOnlyDevice, isRealDevice, isVideoDevice } from '../../../types/device';
import { isDeviceLinkedOnSession } from '../../../lib/deviceConnection';
import { cn, formatRelativeTime } from '../../../lib/utils';

interface DevicesPanelProps {
  devices: Device[];
  pstDeviceId: string | null;
  pgmDeviceId: string | null;
  defaultQuality: StreamQuality;
  accessCode?: string;
  onSetQuality: (q: StreamQuality) => void;
  onUnpair: (deviceId: string) => void;
  onReconnect: (deviceId: string) => void;
  getAudioSourceForDevice: (deviceId: string) => AudioInputSource;
  onSetInputAudioSource: (deviceId: string, source: AudioInputSource) => void;
  onPersistAudioSettings: (deviceId: string, source: AudioInputSource, linkedId: string | null) => void;
  linkedUsbAudio: Record<string, string | null>;
  ipCameraAllowed: boolean;
  ipCameraConfig: IpCameraConfig | null;
  ipCameraSlot: number;
  onSaveIpCamera: (input: { label: string; url: string; enabled: boolean }) => { ok: boolean; message: string };
  onRemoveIpCamera: () => void;
}

const AUDIO_SOURCES: AudioInputSource[] = ['camera', 'capture_card', 'usb_audio'];
const QUALITIES: StreamQuality[] = ['auto', 'high', 'medium', 'low'];

function statusLabel(device: Device): string {
  if (device.status === 'live') return 'live';
  if (isDeviceLinkedOnSession(device)) return 'linked';
  if (device.status === 'connecting') return 'connecting';
  return device.status;
}

function StatusDot({ device }: { device: Device }) {
  const linked = isDeviceLinkedOnSession(device);
  return (
    <span
      className={cn(
        'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
        (device.status === 'live' || linked) && 'bg-mixer-green',
        device.status === 'live' && 'animate-pulse',
        device.status === 'connecting' && !linked && 'bg-mixer-yellow',
        device.status === 'offline' && 'bg-mixer-muted',
        device.status === 'error' && 'bg-mixer-red',
      )}
    />
  );
}

export function DevicesPanel({
  devices,
  pstDeviceId,
  pgmDeviceId,
  defaultQuality,
  accessCode,
  onSetQuality,
  onUnpair,
  onReconnect,
  getAudioSourceForDevice,
  onSetInputAudioSource,
  onPersistAudioSettings,
  linkedUsbAudio,
  ipCameraAllowed,
  ipCameraConfig,
  ipCameraSlot,
  onSaveIpCamera,
  onRemoveIpCamera,
}: DevicesPanelProps) {
  const real = devices.filter(isRealDevice);
  const videoDevices = real.filter(isVideoDevice);
  const audioDevices = real.filter(isAudioOnlyDevice);

  const handleAudioSource = (deviceId: string, source: AudioInputSource) => {
    onSetInputAudioSource(deviceId, source);
    if (accessCode) {
      onPersistAudioSettings(deviceId, source, linkedUsbAudio?.[deviceId] ?? null);
    }
  };

  return (
    <div className="audio-mixer-grid min-h-0 h-full w-full">
      {/* ── PANEL 1: Video inputs ── */}
      <section className="audio-mixer-panel audio-mixer-panel--devices-video">
        <header className="audio-mixer-panel-header">
          <div>
            <p className="atem-group-label flex items-center gap-1 text-mixer-red">
              <Video className="h-3.5 w-3.5" />
              Video Inputs
            </p>
            <p className="text-[8px] leading-tight text-mixer-muted">
              Paired cameras · live levels · bus assignment
            </p>
          </div>
          <span className="text-[9px] font-mono text-mixer-muted">{videoDevices.length} up</span>
        </header>

        <div className="audio-mixer-input-list">
          {videoDevices.length === 0 ? (
            <p className="text-[10px] text-mixer-muted">
              No cameras paired. Share your access code with the mobile app.
            </p>
          ) : (
            videoDevices.map((d) => {
              const source = getAudioSourceForDevice(d.deviceId);
              const isPgm = d.deviceId === pgmDeviceId;
              const isPst = d.deviceId === pstDeviceId;

              return (
                <article
                  key={d.deviceId}
                  className={cn(
                    'audio-mixer-input-card',
                    isPgm && 'audio-mixer-input-card--on-air',
                    isPst && !isPgm && 'border-mixer-green/40',
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-bold text-mixer-muted">#{d.slotNumber}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <StatusDot device={d} />
                        {d.platform === 'usb' ? <Usb className="h-3 w-3 text-mixer-muted" /> : null}
                        {isIpCameraDevice(d) ? <Camera className="h-3 w-3 text-mixer-green" /> : null}
                        <p className="truncate text-[11px] font-bold" title={d.label}>
                          {d.label}
                        </p>
                      </div>
                      <p className="text-[8px] text-mixer-muted">
                        {d.platform} · {statusLabel(d)} · {formatRelativeTime(d.lastSeenAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      {isPgm && (
                        <span className="rounded bg-mixer-red/20 px-1.5 py-0.5 text-[7px] font-bold text-mixer-red">
                          PGM
                        </span>
                      )}
                      {isPst && (
                        <span className="rounded bg-mixer-green/20 px-1.5 py-0.5 text-[7px] font-bold text-mixer-green">
                          PST
                        </span>
                      )}
                    </div>
                  </div>

                  <InputLiveMeter
                    deviceId={d.deviceId}
                    getAudioSourceForDevice={getAudioSourceForDevice}
                    linkedUsbAudio={linkedUsbAudio}
                    accent={isPgm ? 'red' : isPst ? 'green' : 'neutral'}
                    enabled={isDeviceLinkedOnSession(d) || d.status === 'live'}
                    size="md"
                    className="w-full"
                  />

                  <div className="flex flex-wrap gap-1">
                    {AUDIO_SOURCES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleAudioSource(d.deviceId, s)}
                        className={cn(
                          'deck-pad-btn px-1.5 py-0.5 text-[8px]',
                          source === s && 'atem-toggle-on',
                        )}
                      >
                        {s === 'camera' ? 'Phone mic' : s === 'capture_card' ? 'Capture card' : 'USB audio'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[8px] text-mixer-muted">{AUDIO_SOURCE_LABELS[source]}</p>

                  <div className="flex justify-end gap-1 border-t border-mixer-border/40 pt-1">
                    <button
                      type="button"
                      onClick={() => onReconnect(d.deviceId)}
                      className="mixer-btn px-2 py-0.5 text-[8px]"
                      title="Reconnect stream"
                    >
                      <Wifi className="mr-0.5 inline h-2.5 w-2.5" />
                      Reconnect
                    </button>
                    {isIpCameraDevice(d) ? (
                      <button
                        type="button"
                        onClick={onRemoveIpCamera}
                        className="mixer-btn px-2 py-0.5 text-[8px] text-mixer-red"
                      >
                        <Trash2 className="mr-0.5 inline h-2.5 w-2.5" />
                        Remove
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onUnpair(d.deviceId)}
                        className="mixer-btn px-2 py-0.5 text-[8px] text-mixer-red"
                      >
                        <Trash2 className="mr-0.5 inline h-2.5 w-2.5" />
                        Unpair
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      {/* ── PANEL 2: USB & audio inputs ── */}
      <section className="audio-mixer-panel audio-mixer-panel--devices-audio">
        <header className="audio-mixer-panel-header">
          <div>
            <p className="atem-group-label flex items-center gap-1 text-mixer-green">
              <Headphones className="h-3.5 w-3.5" />
              Audio Inputs
            </p>
            <p className="text-[8px] leading-tight text-mixer-muted">USB mics · link in Audio panel</p>
          </div>
        </header>

        <div className="mb-2 rounded border border-dashed border-mixer-green/30 bg-black/30 px-2 py-1.5">
          <p className="text-[9px] font-bold text-mixer-green">Add USB audio device</p>
          <p className="mt-1 text-[8px] leading-relaxed text-mixer-muted">
            Pair from the mobile app with access code
            {accessCode ? (
              <span className="font-mono text-mixer-text"> {accessCode}</span>
            ) : null}{' '}
            and device type <strong>USB Audio</strong>. Assign it to a camera in the Audio tab.
          </p>
        </div>

        <div className="audio-mixer-input-list">
          {audioDevices.length === 0 ? (
            <p className="text-[10px] text-mixer-muted">No USB audio devices paired yet.</p>
          ) : (
            audioDevices.map((d) => (
              <article
                key={d.deviceId}
                className="audio-mixer-input-card border-mixer-green/30"
              >
                <div className="flex items-center gap-2">
                  <Headphones className="h-3.5 w-3.5 shrink-0 text-mixer-green" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-bold" title={d.label}>
                      {d.label}
                    </p>
                    <p className="flex items-center gap-1 text-[8px] text-mixer-muted">
                      <StatusDot device={d} />
                      USB audio · {statusLabel(d)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUnpair(d.deviceId)}
                    className="mixer-btn p-1 text-mixer-red"
                    title="Unpair"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

                <InputLiveMeter
                  deviceId={d.deviceId}
                  getAudioSourceForDevice={getAudioSourceForDevice}
                  linkedUsbAudio={linkedUsbAudio}
                  accent="green"
                  enabled={d.status !== 'offline'}
                  size="md"
                  className="w-full"
                />
              </article>
            ))
          )}
        </div>
      </section>

      {/* ── PANEL 3: Network & quality ── */}
      <section className="audio-mixer-panel audio-mixer-panel--devices-network">
        <header className="audio-mixer-panel-header">
          <div>
            <p className="atem-group-label flex items-center gap-1">
              <Globe className="h-3.5 w-3.5" />
              Network & Quality
            </p>
            <p className="text-[8px] leading-tight text-mixer-muted">IP cameras · stream quality</p>
          </div>
        </header>

        <div className="audio-mixer-input-list">
          <div className="audio-mixer-input-card">
            <p className="mb-1.5 flex items-center gap-1 text-[9px] font-bold">
              <Radio className="h-3 w-3" />
              Stream quality
            </p>
            <div className="flex flex-wrap gap-1">
              {QUALITIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onSetQuality(q)}
                  className={cn(
                    'deck-pad-btn flex-1 py-1 text-[9px] uppercase',
                    defaultQuality === q && 'atem-toggle-on',
                  )}
                >
                  {q}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[8px] text-mixer-muted">
              Applies to Regal Cloud streams. Regal Mesh uses device bitrate.
            </p>
          </div>

          <IpCameraPanel
            allowed={ipCameraAllowed}
            config={ipCameraConfig}
            slotNumber={ipCameraSlot}
            onSave={onSaveIpCamera}
            onRemove={onRemoveIpCamera}
          />
        </div>
      </section>
    </div>
  );
}
