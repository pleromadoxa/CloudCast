import { Gauge, SlidersHorizontal, Timer, Waves, Zap } from 'lucide-react';
import type { ExportSettings, SymphonyPrefs, SymphonyProject } from '../../types/symphony';
import { defaultExportSettings } from '../../types/symphony';
import { HardwareKnob } from './hardware/HardwareKnob';
import { ToggleSwitch } from './hardware/LcdPanel';

export interface SymphonySettingsPanelProps {
  project: SymphonyProject;
  prefs: SymphonyPrefs;
  onProjectChange: (patch: Partial<SymphonyProject>) => void;
  onPrefsChange: (patch: Partial<SymphonyPrefs>) => void;
  /** Live engine diagnostics (read-only). */
  engineInfo?: {
    sampleRate?: number;
    baseLatencyMs?: number;
    outputLatencyMs?: number;
  };
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="sym-settings__row">
      <span>{label}</span>
      {children}
    </div>
  );
}

const dB = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`;

export function SymphonySettingsPanel({
  project, prefs, onProjectChange, onPrefsChange, engineInfo,
}: SymphonySettingsPanelProps) {
  const masterEq = project.masterEq ?? { low: 0, mid: 0, high: 0, midFreq: 1000 };
  const exportDefaults: ExportSettings = {
    ...defaultExportSettings(project.name),
    ...prefs.exportDefaults,
    fileName: project.name,
  };

  const patchExportDefaults = (patch: Partial<ExportSettings>) => {
    onPrefsChange({ exportDefaults: { ...prefs.exportDefaults, ...patch } });
  };

  return (
    <div className="sym-settings sym-grain relative">
      {/* ── Master bus ── */}
      <section className="sym-settings__group">
        <h3 className="sym-settings__title"><Waves className="h-3.5 w-3.5 text-emerald-300/80" /> Master Bus</h3>
        <div className="sym-settings__grid">
          <HardwareKnob
            value={project.masterVolume ?? 85}
            min={0} max={100}
            label="Master Volume"
            displayValue={(v) => `${Math.round(v)}%`}
            onChange={(masterVolume) => onProjectChange({ masterVolume })}
          />
          <HardwareKnob
            value={masterEq.low}
            min={-15} max={15} bipolar
            label="EQ Low"
            displayValue={dB}
            onChange={(low) => onProjectChange({ masterEq: { ...masterEq, low } })}
          />
          <HardwareKnob
            value={masterEq.mid}
            min={-15} max={15} bipolar
            label="EQ Mid"
            displayValue={dB}
            onChange={(mid) => onProjectChange({ masterEq: { ...masterEq, mid } })}
          />
          <HardwareKnob
            value={masterEq.high}
            min={-15} max={15} bipolar
            label="EQ High"
            displayValue={dB}
            onChange={(high) => onProjectChange({ masterEq: { ...masterEq, high } })}
          />
          <HardwareKnob
            value={masterEq.midFreq}
            min={200} max={5000}
            label="Mid Freq"
            displayValue={(v) => `${Math.round(v)} Hz`}
            defaultValue={1000}
            onChange={(midFreq) => onProjectChange({ masterEq: { ...masterEq, midFreq } })}
          />
          <HardwareKnob
            value={project.masterDrive ?? 0}
            min={0} max={100}
            label="Bus Drive"
            displayValue={(v) => `${Math.round(v)}%`}
            onChange={(masterDrive) => onProjectChange({ masterDrive })}
          />
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <SettingRow label="Master limiter">
            <ToggleSwitch
              label="Master limiter"
              checked={project.limiterEnabled !== false}
              onChange={(limiterEnabled) => onProjectChange({ limiterEnabled })}
            />
          </SettingRow>
          <SettingRow label="Limiter threshold">
            <input
              type="number"
              className="sym-settings__number"
              min={-36} max={0} step={1}
              value={project.limiterThreshold ?? -18}
              onChange={(e) => onProjectChange({ limiterThreshold: Number(e.target.value) })}
            />
          </SettingRow>
        </div>
      </section>

      {/* ── Metronome & recording ── */}
      <section className="sym-settings__group">
        <h3 className="sym-settings__title"><Timer className="h-3.5 w-3.5 text-amber-300/80" /> Metronome & Recording</h3>
        <div className="sym-settings__grid">
          <HardwareKnob
            value={project.metronomeVolume ?? 70}
            min={0} max={100}
            label="Click Level"
            displayValue={(v) => `${Math.round(v)}%`}
            onChange={(metronomeVolume) => onProjectChange({ metronomeVolume })}
          />
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <SettingRow label="Count-in bars">
            <select
              className="sym-settings__select"
              value={project.countInBars ?? 4}
              onChange={(e) => onProjectChange({ countInBars: Number(e.target.value) })}
            >
              <option value={0}>Off</option>
              <option value={1}>1 bar</option>
              <option value={2}>2 bars</option>
              <option value={4}>4 bars</option>
            </select>
          </SettingRow>
        </div>
      </section>

      {/* ── Metering & display ── */}
      <section className="sym-settings__group">
        <h3 className="sym-settings__title"><Gauge className="h-3.5 w-3.5 text-sky-300/80" /> Metering & Display</h3>
        <div className="sym-settings__grid">
          <HardwareKnob
            value={prefs.peakHoldMs}
            min={0} max={5000}
            label="Peak Hold"
            displayValue={(v) => `${Math.round(v)} ms`}
            defaultValue={1600}
            onChange={(peakHoldMs) => onPrefsChange({ peakHoldMs })}
          />
          <HardwareKnob
            value={prefs.meterDecayDbPerSec}
            min={6} max={48}
            label="Meter Decay"
            displayValue={(v) => `${Math.round(v)} dB/s`}
            defaultValue={24}
            onChange={(meterDecayDbPerSec) => onPrefsChange({ meterDecayDbPerSec })}
          />
          <HardwareKnob
            value={prefs.metalGrain}
            min={0} max={100}
            label="Metal Grain"
            displayValue={(v) => `${Math.round(v)}%`}
            defaultValue={100}
            onChange={(metalGrain) => onPrefsChange({ metalGrain })}
          />
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <SettingRow label="Knob value arcs">
            <ToggleSwitch
              label="Knob value arcs"
              checked={prefs.showValueArcs}
              onChange={(showValueArcs) => onPrefsChange({ showValueArcs })}
            />
          </SettingRow>
        </div>
      </section>

      {/* ── Control feel ── */}
      <section className="sym-settings__group">
        <h3 className="sym-settings__title"><SlidersHorizontal className="h-3.5 w-3.5 text-violet-300/80" /> Control Feel</h3>
        <div className="sym-settings__grid">
          <HardwareKnob
            value={prefs.knobSensitivity}
            min={0.5} max={2}
            label="Knob Sensitivity"
            displayValue={(v) => `${v.toFixed(2)}×`}
            defaultValue={1}
            onChange={(knobSensitivity) => onPrefsChange({ knobSensitivity })}
          />
        </div>
      </section>

      {/* ── Export defaults ── */}
      <section className="sym-settings__group">
        <h3 className="sym-settings__title"><Zap className="h-3.5 w-3.5 text-fuchsia-300/80" /> Export Defaults</h3>
        <div className="mt-1 flex flex-col gap-2">
          <SettingRow label="Default format">
            <select
              className="sym-settings__select"
              value={exportDefaults.format}
              onChange={(e) => patchExportDefaults({ format: e.target.value as ExportSettings['format'] })}
            >
              <option value="wav">WAV</option>
              <option value="aiff">AIFF</option>
              <option value="mp3">MP3</option>
            </select>
          </SettingRow>
          <SettingRow label="Sample rate">
            <select
              className="sym-settings__select"
              value={exportDefaults.sampleRate}
              onChange={(e) => patchExportDefaults({ sampleRate: Number(e.target.value) })}
            >
              <option value={44100}>44.1 kHz</option>
              <option value={48000}>48 kHz</option>
              <option value={96000}>96 kHz</option>
            </select>
          </SettingRow>
          <SettingRow label="Bit depth">
            <select
              className="sym-settings__select"
              value={exportDefaults.bitDepth}
              onChange={(e) => patchExportDefaults({ bitDepth: Number(e.target.value) as 16 | 24 })}
            >
              <option value={16}>16-bit</option>
              <option value={24}>24-bit</option>
            </select>
          </SettingRow>
          <SettingRow label="MP3 bitrate">
            <select
              className="sym-settings__select"
              value={exportDefaults.mp3BitrateKbps}
              onChange={(e) => patchExportDefaults({ mp3BitrateKbps: Number(e.target.value) as ExportSettings['mp3BitrateKbps'] })}
            >
              <option value={128}>128 kbps</option>
              <option value={192}>192 kbps</option>
              <option value={256}>256 kbps</option>
              <option value={320}>320 kbps</option>
            </select>
          </SettingRow>
          <SettingRow label="Normalize to −1 dBFS">
            <ToggleSwitch
              label="Normalize"
              checked={exportDefaults.normalize}
              onChange={(normalize) => patchExportDefaults({ normalize })}
            />
          </SettingRow>
          <SettingRow label="Include effect tail">
            <ToggleSwitch
              label="Include effect tail"
              checked={exportDefaults.includeTail}
              onChange={(includeTail) => patchExportDefaults({ includeTail })}
            />
          </SettingRow>
        </div>
      </section>

      {/* ── Engine diagnostics ── */}
      <section className="sym-settings__group">
        <h3 className="sym-settings__title"><Gauge className="h-3.5 w-3.5 text-emerald-300/80" /> Audio Engine</h3>
        <div className="sym-lcd-pro sym-lcd-pro__grid grid-cols-2 px-3 py-2 text-[10px]">
          <span className="sym-lcd-pro__label">Sample rate</span>
          <span>{engineInfo?.sampleRate ? `${(engineInfo.sampleRate / 1000).toFixed(1)} kHz` : '—'}</span>
          <span className="sym-lcd-pro__label">Output latency</span>
          <span>{engineInfo?.outputLatencyMs != null ? `${engineInfo.outputLatencyMs.toFixed(1)} ms` : '—'}</span>
          <span className="sym-lcd-pro__label">Base latency</span>
          <span>{engineInfo?.baseLatencyMs != null ? `${engineInfo.baseLatencyMs.toFixed(1)} ms` : '—'}</span>
          <span className="sym-lcd-pro__label">Graph</span>
          <span>FX · SENDING · AUTOMATION</span>
        </div>
      </section>
    </div>
  );
}
