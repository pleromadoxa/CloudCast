import { Activity, AudioWaveform, Filter, Sparkles, Volume2 } from 'lucide-react';
import type { Track, TrackFx } from '../../types/symphony';
import { normalizeTrackFx } from '../../types/symphony';
import { trackLanes } from '../../lib/symphony/automationSchedule';
import { HardwareKnob } from './hardware/HardwareKnob';
import { ToggleSwitch } from './hardware/LcdPanel';

export interface FxRackPanelProps {
  track: Track | null;
  onTrackChange: (id: string, patch: Partial<Track>) => void;
  onClearAutomation: (trackId: string) => void;
}

const dB = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`;

export function FxRackPanel({ track, onTrackChange, onClearAutomation }: FxRackPanelProps) {
  if (!track) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-[11px] text-white/35">
        Select a channel strip to edit its insert processing chain.
      </div>
    );
  }

  const fx = normalizeTrackFx(track.fx);
  const patchFx = (patch: Partial<TrackFx>) =>
    onTrackChange(track.id, { fx: { ...fx, ...patch } });
  const lanes = trackLanes(track);

  return (
    <div className="sym-settings sym-grain relative h-full">
      {/* ── EQ ── */}
      <section className="sym-settings__group">
        <h3 className="sym-settings__title">
          <AudioWaveform className="h-3.5 w-3.5 text-emerald-300/80" /> EQ — {track.name}
        </h3>
        <div className="sym-settings__grid">
          <HardwareKnob
            value={fx.eq.low} min={-15} max={15} bipolar
            label="Low Shelf" displayValue={dB}
            accent="#4be07c"
            onChange={(low) => patchFx({ eq: { ...fx.eq, low } })}
          />
          <HardwareKnob
            value={fx.eq.mid} min={-15} max={15} bipolar
            label="Mid Bell" displayValue={dB}
            accent="#ffcf4a"
            onChange={(mid) => patchFx({ eq: { ...fx.eq, mid } })}
          />
          <HardwareKnob
            value={fx.eq.high} min={-15} max={15} bipolar
            label="High Shelf" displayValue={dB}
            accent="#38bdf8"
            onChange={(high) => patchFx({ eq: { ...fx.eq, high } })}
          />
          <HardwareKnob
            value={fx.eq.midFreq} min={200} max={5000}
            label="Mid Freq" displayValue={(v) => `${Math.round(v)} Hz`}
            defaultValue={1000}
            accent="#ffcf4a"
            onChange={(midFreq) => patchFx({ eq: { ...fx.eq, midFreq } })}
          />
        </div>
      </section>

      {/* ── Compressor ── */}
      <section className="sym-settings__group">
        <h3 className="sym-settings__title">
          <Activity className="h-3.5 w-3.5 text-sky-300/80" /> Compressor
          <span className="ml-auto flex items-center gap-2">
            <span className="text-[8px] tracking-widest text-white/45">{fx.comp.enabled ? 'ENGAGED' : 'BYPASS'}</span>
            <ToggleSwitch
              label="Compressor"
              checked={fx.comp.enabled}
              onChange={(enabled) => patchFx({ comp: { ...fx.comp, enabled } })}
            />
          </span>
        </h3>
        <div className="sym-settings__grid">
          <HardwareKnob
            value={fx.comp.thresholdDb} min={-60} max={0}
            label="Threshold" displayValue={(v) => `${v.toFixed(0)} dB`}
            defaultValue={-18}
            accent="#38bdf8"
            onChange={(thresholdDb) => patchFx({ comp: { ...fx.comp, thresholdDb } })}
          />
          <HardwareKnob
            value={fx.comp.ratio} min={1} max={20}
            label="Ratio" displayValue={(v) => `${v.toFixed(1)}:1`}
            defaultValue={3}
            accent="#38bdf8"
            onChange={(ratio) => patchFx({ comp: { ...fx.comp, ratio } })}
          />
          <HardwareKnob
            value={fx.comp.attackMs} min={0} max={200}
            label="Attack" displayValue={(v) => `${v.toFixed(0)} ms`}
            defaultValue={10}
            accent="#38bdf8"
            onChange={(attackMs) => patchFx({ comp: { ...fx.comp, attackMs } })}
          />
          <HardwareKnob
            value={fx.comp.releaseMs} min={10} max={1000}
            label="Release" displayValue={(v) => `${Math.round(v)} ms`}
            defaultValue={180}
            accent="#38bdf8"
            onChange={(releaseMs) => patchFx({ comp: { ...fx.comp, releaseMs } })}
          />
        </div>
      </section>

      {/* ── Filter ── */}
      <section className="sym-settings__group">
        <h3 className="sym-settings__title">
          <Filter className="h-3.5 w-3.5 text-violet-300/80" /> Filter
          <span className="ml-auto flex items-center gap-2">
            <span className="text-[8px] tracking-widest text-white/45">{fx.filter.enabled ? 'ENGAGED' : 'BYPASS'}</span>
            <ToggleSwitch
              label="Filter"
              checked={fx.filter.enabled}
              onChange={(enabled) => patchFx({ filter: { ...fx.filter, enabled } })}
            />
          </span>
        </h3>
        <div className="flex items-end gap-5">
          <div className="sym-settings__grid flex-1">
            <HardwareKnob
              value={fx.filter.freq} min={40} max={18000}
              label="Cutoff" displayValue={(v) => `${Math.round(v)} Hz`}
              defaultValue={8000}
              accent="#a78bfa"
              onChange={(freq) => patchFx({ filter: { ...fx.filter, freq } })}
            />
            <HardwareKnob
              value={fx.filter.q} min={0.2} max={18}
              label="Resonance" displayValue={(v) => v.toFixed(2)}
              defaultValue={0.9}
              accent="#a78bfa"
              onChange={(q) => patchFx({ filter: { ...fx.filter, q } })}
            />
          </div>
          <label className="flex flex-col gap-1 pb-4 text-[9px] uppercase tracking-widest text-white/50">
            Mode
            <select
              className="sym-settings__select"
              value={fx.filter.type}
              onChange={(e) => patchFx({ filter: { ...fx.filter, type: e.target.value as 'lowpass' | 'highpass' | 'bandpass' } })}
            >
              <option value="lowpass">Low-pass</option>
              <option value="highpass">High-pass</option>
              <option value="bandpass">Band-pass</option>
            </select>
          </label>
        </div>
      </section>

      {/* ── Chorus + Drive ── */}
      <section className="sym-settings__group">
        <h3 className="sym-settings__title">
          <Sparkles className="h-3.5 w-3.5 text-fuchsia-300/80" /> Modulation & Saturation
          <span className="ml-auto flex items-center gap-2">
            <span className="text-[8px] tracking-widest text-white/45">{fx.chorus.enabled ? 'CHORUS ON' : 'CHORUS OFF'}</span>
            <ToggleSwitch
              label="Chorus"
              checked={fx.chorus.enabled}
              onChange={(enabled) => patchFx({ chorus: { ...fx.chorus, enabled } })}
            />
          </span>
        </h3>
        <div className="sym-settings__grid">
          <HardwareKnob
            value={fx.chorus.rateHz} min={0.05} max={5}
            label="Rate" displayValue={(v) => `${v.toFixed(2)} Hz`}
            defaultValue={0.8}
            accent="#e879f9"
            onChange={(rateHz) => patchFx({ chorus: { ...fx.chorus, rateHz } })}
          />
          <HardwareKnob
            value={fx.chorus.depthMs} min={0.5} max={12}
            label="Depth" displayValue={(v) => `${v.toFixed(1)} ms`}
            defaultValue={4}
            accent="#e879f9"
            onChange={(depthMs) => patchFx({ chorus: { ...fx.chorus, depthMs } })}
          />
          <HardwareKnob
            value={fx.chorus.mix} min={0} max={100}
            label="Chorus Mix" displayValue={(v) => `${Math.round(v)}%`}
            defaultValue={40}
            accent="#e879f9"
            onChange={(mix) => patchFx({ chorus: { ...fx.chorus, mix } })}
          />
          <HardwareKnob
            value={fx.drive} min={0} max={100}
            label="Drive" displayValue={(v) => `${Math.round(v)}%`}
            accent="#fb923c"
            onChange={(drive) => patchFx({ drive })}
          />
        </div>
      </section>

      {/* ── Sends + automation ── */}
      <section className="sym-settings__group">
        <h3 className="sym-settings__title">
          <Volume2 className="h-3.5 w-3.5 text-amber-300/80" /> Sends & Automation
        </h3>
        <div className="sym-settings__grid">
          <HardwareKnob
            value={track.reverbSend ?? 0} min={0} max={100}
            label="Reverb Send" displayValue={(v) => `${Math.round(v)}%`}
            accent="#a78bfa"
            onChange={(reverbSend) => onTrackChange(track.id, { reverbSend })}
          />
          <HardwareKnob
            value={track.delaySend ?? 0} min={0} max={100}
            label="Delay Send" displayValue={(v) => `${Math.round(v)}%`}
            accent="#22d3ee"
            onChange={(delaySend) => onTrackChange(track.id, { delaySend })}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {lanes.length === 0 ? (
            <p className="text-[10px] text-white/40">
              No automation lanes yet — draw points with the automation tool on the timeline.
            </p>
          ) : (
            lanes.map((lane) => (
              <span key={lane.param} className="sym-pro-chip sym-pro-chip--gold">
                {lane.param.toUpperCase()} · {lane.points.length} PTS
              </span>
            ))
          )}
          {lanes.length > 0 && (
            <button
              type="button"
              className="sym-msr sym-msr--mute"
              onClick={() => onClearAutomation(track.id)}
            >
              CLEAR
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
