import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import type { KeySettings, OutputMode, PipPosition, PipSettings, PipSize } from '../../../types/mixer';
import type { PlanTier } from '../../../types/plans';
import type { Device } from '../../../types/device';
import { isRealDevice } from '../../../types/device';
import { MIXER_QUICK_TERMS } from '../../../config/mixerGuide';
import { planAllowsChromaKey } from '../../../lib/planFeatures';
import { FeatureHint } from '../FeatureHint';
import { cn } from '../../../lib/utils';

interface SourcesPanelProps {
  devices: Device[];
  pstDeviceId: string | null;
  pgmDeviceId: string | null;
  subDeviceId: string | null;
  outputMode: OutputMode;
  pip: PipSettings;
  keySettings: KeySettings;
  planId: PlanTier;
  compact?: boolean;
  onFocusPst: (id: string) => void;
  onAssignSub: (id: string) => void;
  onAssignPgm: (id: string) => void;
  onSetOutputMode: (mode: OutputMode) => void;
  onPatchPip: (p: Partial<PipSettings>) => void;
  onPatchKey: (p: Partial<KeySettings>) => void;
  onSwapPstPgm: () => void;
  onExchange: () => void;
}

const PIP_CORNERS: PipPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

function AtemLabel({ children }: { children: ReactNode }) {
  return <p className="atem-group-label">{children}</p>;
}

function cornerGlyph(pos: PipPosition) {
  const map: Record<PipPosition, string> = {
    'top-left': '↖',
    'top-right': '↗',
    'bottom-left': '↙',
    'bottom-right': '↘',
    center: '◎',
  };
  return map[pos];
}

export function SourcesPanel({
  devices,
  pstDeviceId,
  pgmDeviceId,
  subDeviceId,
  outputMode,
  pip,
  keySettings,
  planId,
  compact = false,
  onFocusPst,
  onAssignSub,
  onAssignPgm,
  onSetOutputMode,
  onPatchPip,
  onPatchKey,
  onSwapPstPgm,
  onExchange,
}: SourcesPanelProps) {
  const slotCount = compact ? 4 : Math.max(4, devices.length);
  const slots = Array.from({ length: slotCount }, (_, i) => devices[i] ?? null);
  const pipOn = outputMode === 'pip';
  const pipReady =
    Boolean(subDeviceId && pgmDeviceId && subDeviceId !== pgmDeviceId) &&
    devices.some((d) => d.deviceId === subDeviceId && isRealDevice(d));
  const keyOn = outputMode === 'key' && keySettings.enabled;
  const chromaAllowed = planAllowsChromaKey(planId);
  const keyReady =
    keySettings.fillSource === 'preset' ||
    Boolean(subDeviceId && pgmDeviceId && subDeviceId !== pgmDeviceId);

  return (
    <div className={cn('atem-deck min-h-0', compact && 'atem-deck--compact')}>
      <div className={cn('atem-deck-inputs', compact && 'atem-deck-inputs--compact')}>
        <AtemLabel>Inputs</AtemLabel>
        <FeatureHint className="mb-1">
          Click = preview (PST). Double-click = cut to program (PGM).
        </FeatureHint>
        <div className="atem-input-grid">
          {slots.map((device, i) => {
            const ready = device && isRealDevice(device);
            const isPgm = ready && device.deviceId === pgmDeviceId;
            const isPst = ready && device.deviceId === pstDeviceId;
            return (
              <button
                key={i}
                type="button"
                disabled={!ready}
                onClick={() => device && onFocusPst(device.deviceId)}
                onDoubleClick={() => device && isRealDevice(device) && onAssignPgm(device.deviceId)}
                className={cn(
                  'atem-input-btn',
                  isPgm && 'atem-input-pgm',
                  isPst && !isPgm && 'atem-input-pst',
                  !ready && 'atem-input-empty',
                )}
                title={device ? `${device.label} — preview · dbl-click cut` : 'Empty'}
              >
                <span className="atem-input-num">{i + 1}</span>
                {ready && !compact && (
                  <span className="atem-input-name" title={device.label}>
                    {device.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <AtemLabel>Auxiliary (Sub)</AtemLabel>
        <FeatureHint className="mb-1" title="What is Sub?">
          {MIXER_QUICK_TERMS.auxSub}
        </FeatureHint>
        <div className="atem-aux-row">
          {slots.slice(0, 4).map((device, i) => {
            const ready = device && isRealDevice(device);
            const active = ready && device.deviceId === subDeviceId;
            return (
              <button
                key={`sub-${i}`}
                type="button"
                disabled={!ready}
                onClick={() => device && onAssignSub(device.deviceId)}
                className={cn('atem-aux-btn', active && 'atem-toggle-on')}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        <div className="atem-utility-row">
          <button type="button" onClick={onSwapPstPgm} disabled={!pstDeviceId || !pgmDeviceId} className="atem-utility-btn" title={MIXER_QUICK_TERMS.swap}>
            SWAP
          </button>
          <button type="button" onClick={onExchange} disabled={!pstDeviceId || !subDeviceId} className="atem-utility-btn" title={MIXER_QUICK_TERMS.exch}>
            EXCH
          </button>
        </div>
      </div>

      <div className="atem-deck-controls">
        <FeatureHint className="mb-1">
          CUT, TAKE, and stream controls live in Transitions and the Video Out column — not here.
        </FeatureHint>
        <div className={cn('atem-overlay-row', compact && 'flex-col')}>
          <div className="atem-control-block">
            <AtemLabel>Picture In Picture</AtemLabel>
            <FeatureHint className="mb-1">{MIXER_QUICK_TERMS.pip}</FeatureHint>
            <div className="atem-pip-grid">
              {PIP_CORNERS.map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => {
                    onPatchPip({ position: pos });
                    onSetOutputMode('pip');
                  }}
                  className={cn('atem-small-btn', pipOn && pip.position === pos && 'atem-toggle-on')}
                  title={pos.replace('-', ' ')}
                >
                  {cornerGlyph(pos)}
                </button>
              ))}
            </div>
            <div className="atem-onoff-row">
              <button type="button" onClick={() => onSetOutputMode('pip')} className={cn('atem-onoff-btn', pipOn && 'atem-toggle-on')}>
                ON
              </button>
              <button type="button" onClick={() => onSetOutputMode('main')} className={cn('atem-onoff-btn', !pipOn && outputMode === 'main' && 'atem-toggle-glow')}>
                OFF
              </button>
            </div>
            {pipOn && !pipReady && (
              <p className="mt-1 text-[8px] leading-snug text-amber-400">
                Assign Aux/Sub to a source other than PGM, or add a second camera.
              </p>
            )}
            {!compact && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {(['small', 'medium', 'large'] as PipSize[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onPatchPip({ size: s })}
                    className={cn('atem-small-btn text-[8px] uppercase', pip.size === s && 'atem-toggle-on')}
                  >
                    {s[0]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="atem-control-block">
            <AtemLabel>KEY</AtemLabel>
            {!chromaAllowed ? (
              <div className="flex items-center gap-2 rounded border border-dashed border-mixer-border px-2 py-2 text-[8px] text-mixer-muted">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                Pro or Pro Master required. Tune key settings in Layers → Chroma.
              </div>
            ) : (
              <>
                <FeatureHint className="mb-1">{MIXER_QUICK_TERMS.chromaKey}</FeatureHint>
                <div className="mb-1 flex gap-1">
                  <button
                    type="button"
                    onClick={() => onPatchKey({ keyType: 'chroma', enabled: true })}
                    className={cn('atem-small-btn flex-1 text-[8px] uppercase', keySettings.keyType !== 'luma' && 'atem-toggle-on')}
                  >
                    Chroma
                  </button>
                  <button
                    type="button"
                    onClick={() => onPatchKey({ keyType: 'luma', enabled: true })}
                    className={cn('atem-small-btn flex-1 text-[8px] uppercase', keySettings.keyType === 'luma' && 'atem-toggle-on')}
                    title={MIXER_QUICK_TERMS.lumaKey}
                  >
                    Luma
                  </button>
                </div>
                <div className="atem-onoff-row">
                  <button
                    type="button"
                    onClick={() => {
                      onSetOutputMode('key');
                      onPatchKey({ enabled: true });
                    }}
                    className={cn('atem-onoff-btn', keyOn && 'atem-toggle-on')}
                  >
                    ON
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSetOutputMode('main');
                      onPatchKey({ enabled: false });
                    }}
                    className={cn('atem-onoff-btn', !keyOn && outputMode === 'main' && 'atem-toggle-glow')}
                  >
                    OFF
                  </button>
                </div>
                {keyOn && !keyReady && (
                  <p className="mt-1 text-[8px] leading-snug text-amber-400">
                    Assign Aux/Sub to a source other than PGM, or use Preset BG in Layers → Chroma.
                  </p>
                )}
                {keyOn && keySettings.keyType === 'luma' && (
                  <p className="mt-1 text-[8px] leading-snug text-mixer-muted">
                    Luma keys dark/blacks from PGM. Raise threshold in Layers → Chroma if too much is keyed.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
