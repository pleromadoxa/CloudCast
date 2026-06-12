import { useEffect, useRef } from 'react';
import { useCloudCast } from '../../context/CloudCastContext';
import { resolveAudioStreamDeviceId } from '../../lib/audioSettings';
import { useMediaStreamAnalyser } from '../../hooks/useMediaStreamAnalyser';
import { drawVisualizerFrame } from '../../lib/digitalScreenDraw';
import type { AudioInputSource } from '../../types/audio';
import type { Device } from '../../types/device';
import { isRealDevice } from '../../types/device';
import {
  CONSOLE_BANKS,
  FX_SLOTS,
  getFatChannelParams,
  isMixEnabled,
  type AudioConsoleState,
  type ConsoleBank,
  type FatChannelParams,
} from '../../hooks/useAudioConsoleState';
import { cn } from '../../lib/utils';

interface DigitalConsoleScreenProps {
  bank: ConsoleBank;
  channel: Device | null;
  channelIndex: number;
  state: AudioConsoleState;
  activeChannels: number;
  locked: boolean;
  devices: Device[];
  getAudioSourceForDevice: (id: string) => AudioInputSource;
  linkedUsbAudio: Record<string, string | null>;
  onSelectChannel?: (index: number) => void;
  onToggleFx?: (slot: 'A' | 'B' | 'C' | 'D') => void;
  onSetFxMix?: (slot: 'A' | 'B' | 'C' | 'D', value: number) => void;
  className?: string;
}

function formatPan(pan: number): string {
  if (pan < -5) return `L${Math.abs(Math.round(pan))}`;
  if (pan > 5) return `R${Math.round(pan)}`;
  return 'C';
}

function InputsOverlay({
  channel,
  channelIndex,
  fat,
  state,
  locked,
  activeChannels,
}: {
  channel: Device | null;
  channelIndex: number;
  fat: FatChannelParams;
  state: AudioConsoleState;
  locked: boolean;
  activeChannels: number;
}) {
  const deviceId = channel?.deviceId ?? '';
  const muted = state.inputMuted[deviceId];
  const solo = state.soloId === deviceId;
  const onMix = isMixEnabled(state, deviceId);
  const vol = state.inputVolumes[deviceId] ?? 75;

  return (
    <div className="studiolive-digital-screen__overlay studiolive-digital-screen__overlay--inputs">
      <div className="studiolive-digital-screen__row">
        <span className="studiolive-digital-screen__badge">CH {String(channelIndex + 1).padStart(2, '0')}</span>
        <span className="studiolive-digital-screen__badge studiolive-digital-screen__badge--dim">
          {activeChannels}/16 LIVE
        </span>
        {solo && <span className="studiolive-digital-screen__badge studiolive-digital-screen__badge--solo">SOLO</span>}
        {muted && <span className="studiolive-digital-screen__badge studiolive-digital-screen__badge--mute">MUTED</span>}
        {onMix && <span className="studiolive-digital-screen__badge studiolive-digital-screen__badge--pgm">MIX</span>}
      </div>
      <p className="studiolive-digital-screen__title">{channel?.label ?? 'Select channel'}</p>
      {locked ? (
        <p className="studiolive-digital-screen__meta">Upgrade plan to unlock this channel</p>
      ) : channel && isRealDevice(channel) && channel.status !== 'offline' ? (
        <div className="studiolive-digital-screen__params">
          <span>GAIN {fat.gain}</span>
          <span>PAN {formatPan(fat.pan)}</span>
          <span>COMP {fat.comp}%</span>
          <span>HPF {fat.hpf}%</span>
          <span>FDR {vol}</span>
        </div>
      ) : (
        <p className="studiolive-digital-screen__meta">
          Pair CloudCast Audio Mobile · USB mic · Line in
        </p>
      )}
    </div>
  );
}

function MixOverlay({
  state,
  channel,
  channelIndex,
}: {
  state: AudioConsoleState;
  channel: Device | null;
  channelIndex: number;
}) {
  const deviceId = channel?.deviceId ?? '';
  const sends = state.mixSends[deviceId] ?? {};

  return (
    <div className="studiolive-digital-screen__overlay studiolive-digital-screen__overlay--mix">
      <p className="studiolive-digital-screen__bank-title">Submix Sends</p>
      <p className="studiolive-digital-screen__meta">
        CH {String(channelIndex + 1).padStart(2, '0')} · {channel?.label ?? '—'}
      </p>
      <div className="studiolive-digital-screen__mix-grid">
        {([1, 2, 3, 4] as const).map((bus) => (
          <div key={bus} className="studiolive-digital-screen__mix-cell">
            <span className="studiolive-digital-screen__mix-label">Mix {bus}</span>
            <div className="studiolive-digital-screen__mix-bar">
              <div
                className="studiolive-digital-screen__mix-fill"
                style={{ height: `${sends[bus] ?? 0}%` }}
              />
            </div>
            <span className="studiolive-digital-screen__mix-val">{sends[bus] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FxOverlay({
  state,
  onToggleFx,
  onSetFxMix,
}: {
  state: AudioConsoleState;
  onToggleFx?: (slot: 'A' | 'B' | 'C' | 'D') => void;
  onSetFxMix?: (slot: 'A' | 'B' | 'C' | 'D', value: number) => void;
}) {
  return (
    <div className="studiolive-digital-screen__overlay studiolive-digital-screen__overlay--fx">
      <p className="studiolive-digital-screen__bank-title">FX Processors</p>
      <div className="studiolive-digital-screen__fx-list">
        {FX_SLOTS.map((fx) => {
          const on = state.fxEnabled[fx.id];
          const mix = state.fxMix[fx.id];
          return (
            <div key={fx.id} className="studiolive-digital-screen__fx-row">
              <button
                type="button"
                className={cn(
                  'studiolive-digital-screen__fx-toggle',
                  on && 'studiolive-digital-screen__fx-toggle--on',
                )}
                onClick={() => onToggleFx?.(fx.id)}
              >
                FX {fx.id}
              </button>
              <span className="studiolive-digital-screen__fx-name">{fx.name}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={mix}
                disabled={!on}
                onChange={(e) => onSetFxMix?.(fx.id, Number(e.target.value))}
                className="studiolive-digital-screen__fx-slider"
              />
              <span className="studiolive-digital-screen__fx-val">{mix}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RoutingOverlay({
  state,
  devices,
  activeChannels,
  onSelectChannel,
}: {
  state: AudioConsoleState;
  devices: Device[];
  activeChannels: number;
  onSelectChannel?: (index: number) => void;
}) {
  const rows = devices.slice(0, activeChannels);

  return (
    <div className="studiolive-digital-screen__overlay studiolive-digital-screen__overlay--routing">
      <p className="studiolive-digital-screen__bank-title">Routing Matrix</p>
      <div className="studiolive-digital-screen__route-head">
        <span>CH</span>
        <span>MIX</span>
        <span>MON</span>
        <span>SND</span>
      </div>
      <div className="studiolive-digital-screen__route-rows">
        {rows.map((device, index) => {
          const live = isRealDevice(device) && device.status !== 'offline';
          const onMix = isMixEnabled(state, device.deviceId);
          const onMon =
            state.soloId === device.deviceId ||
            (state.soloId == null && state.selectedChannel === index);
          const sendTotal = Object.values(state.mixSends[device.deviceId] ?? {}).reduce(
            (a, b) => a + (b ?? 0),
            0,
          );
          return (
            <button
              key={device.deviceId}
              type="button"
              disabled={!live}
              onClick={() => onSelectChannel?.(index)}
              className={cn(
                'studiolive-digital-screen__route-row',
                state.selectedChannel === index && 'studiolive-digital-screen__route-row--sel',
              )}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <span className={onMix ? 'studiolive-digital-screen__route-on' : ''}>
                {onMix ? '●' : '○'}
              </span>
              <span className={onMon ? 'studiolive-digital-screen__route-on' : ''}>
                {onMon ? '●' : '○'}
              </span>
              <span>{sendTotal > 0 ? sendTotal : '—'}</span>
            </button>
          );
        })}
      </div>
      <p className="studiolive-digital-screen__meta studiolive-digital-screen__meta--route">
        Master {state.masterMuted ? 'MUTED' : `${state.masterVolume}%`} · MON{' '}
        {state.monitorMuted ? 'OFF' : 'ON'}
      </p>
    </div>
  );
}

export function DigitalConsoleScreen({
  bank,
  channel,
  channelIndex,
  state,
  activeChannels,
  locked,
  devices,
  getAudioSourceForDevice,
  linkedUsbAudio,
  onSelectChannel,
  onToggleFx,
  onSetFxMix,
  className,
}: DigitalConsoleScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(0);
  const { getMeshStream } = useCloudCast();

  const streamId = channel && isRealDevice(channel)
    ? resolveAudioStreamDeviceId(channel.deviceId, getAudioSourceForDevice, linkedUsbAudio)
    : null;
  const stream = streamId ? getMeshStream(streamId) : null;
  const enabled = Boolean(
    channel &&
      isRealDevice(channel) &&
      channel.status !== 'offline' &&
      !locked &&
      !state.inputMuted[channel.deviceId],
  );

  const { frameRef, subscribe } = useMediaStreamAnalyser(stream, enabled && bank === 'inputs');
  const fat = getFatChannelParams(state, channel?.deviceId ?? '');

  useEffect(() => {
    if (bank !== 'inputs') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;
    const draw = () => {
      if (!running) return;
      phaseRef.current += 0.016;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w > 0 && h > 0) {
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
          canvas.width = w * dpr;
          canvas.height = h * dpr;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        const energy = state.masterMuted ? 0.15 : state.masterVolume / 100;
        drawVisualizerFrame(
          ctx,
          w,
          h,
          frameRef.current,
          locked ? 'neutral' : 'green',
          enabled,
          phaseRef.current,
          energy,
        );
      }
    };

    const unsub = subscribe(draw);
    return () => {
      running = false;
      unsub();
    };
  }, [bank, enabled, frameRef, locked, state.masterMuted, state.masterVolume, subscribe]);

  useEffect(() => {
    if (bank === 'inputs') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    let raf = 0;

    const drawBankBg = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w <= 0 || h <= 0) {
        raf = requestAnimationFrame(drawBankBg);
        return;
      }
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      ctx.clearRect(0, 0, w, h);
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0c1628');
      grad.addColorStop(1, '#030508');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.06)';
      for (let y = 0; y < h; y += 12) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const label = CONSOLE_BANKS.find((b) => b.id === bank)?.label ?? bank;
      ctx.fillStyle = 'rgba(125, 211, 252, 0.12)';
      ctx.font = 'bold 11px system-ui';
      ctx.fillText(label.toUpperCase(), 12, 20);

      if (bank === 'mix') {
        for (let i = 0; i < 4; i++) {
          const level = (Math.sin(frame * 0.04 + i) * 0.5 + 0.5) * (state.masterMuted ? 0.1 : 0.6);
          const barH = level * h * 0.35;
          const x = 16 + i * ((w - 32) / 4);
          ctx.fillStyle = `rgba(37, 99, 235, ${0.35 + level * 0.4})`;
          ctx.fillRect(x, h - barH - 24, (w - 32) / 4 - 8, barH);
        }
      }

      if (bank === 'fx') {
        FX_SLOTS.forEach((fx, i) => {
          if (!state.fxEnabled[fx.id]) return;
          const y = 40 + i * 18;
          ctx.fillStyle = 'rgba(34, 211, 238, 0.25)';
          ctx.fillRect(12, y, w * (state.fxMix[fx.id] / 100) - 24, 6);
        });
      }

      if (bank === 'routing') {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
        ctx.beginPath();
        ctx.moveTo(w * 0.25, 30);
        ctx.lineTo(w * 0.75, h - 30);
        ctx.stroke();
      }

      frame += 1;
      raf = requestAnimationFrame(drawBankBg);
    };

    raf = requestAnimationFrame(drawBankBg);
    return () => cancelAnimationFrame(raf);
  }, [bank, state.fxEnabled, state.fxMix, state.masterMuted]);

  return (
    <div className={cn('studiolive-digital-screen', className)}>
      <div className="studiolive-digital-screen__bezel">
        <canvas ref={canvasRef} className="studiolive-digital-screen__canvas" />
        {bank === 'inputs' && (
          <InputsOverlay
            channel={channel}
            channelIndex={channelIndex}
            fat={fat}
            state={state}
            locked={locked}
            activeChannels={activeChannels}
          />
        )}
        {bank === 'mix' && (
          <MixOverlay state={state} channel={channel} channelIndex={channelIndex} />
        )}
        {bank === 'fx' && (
          <FxOverlay state={state} onToggleFx={onToggleFx} onSetFxMix={onSetFxMix} />
        )}
        {bank === 'routing' && (
          <RoutingOverlay
            state={state}
            devices={devices}
            activeChannels={activeChannels}
            onSelectChannel={onSelectChannel}
          />
        )}
        <div className="studiolive-digital-screen__glow" aria-hidden />
      </div>
    </div>
  );
}
