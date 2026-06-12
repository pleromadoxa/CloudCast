import { Sparkles, Wand2 } from 'lucide-react';
import type { Region, SymphonyProject, Track } from '../../types/symphony';
import { SymphonyButton } from './SymphonyButton';
import { TRACK_COLOR_MAP } from './symphonyUi';
import { cn } from '../../lib/utils';

interface EffectsPanelProps {
  selectedTrack: Track | null;
  selectedRegion: Region | null;
  masterVolume: number;
  limiterThreshold: number;
  onTrackChange: (id: string, patch: Partial<Track>) => void;
  onRegionChange: (id: string, patch: Partial<Region>) => void;
  onProjectChange: (patch: Partial<SymphonyProject>) => void;
  onQuantize: () => void;
  onHumanize: () => void;
  onTranspose: (semitones: number) => void;
  onClearAutomation: (trackId: string) => void;
}

export function EffectsPanel({
  selectedTrack, selectedRegion, masterVolume, limiterThreshold,
  onTrackChange, onRegionChange, onProjectChange,
  onQuantize, onHumanize, onTranspose, onClearAutomation,
}: EffectsPanelProps) {
  return (
    <div className="sym-panel sym-panel--flat flex h-full flex-col">
      <div className="sym-panel__header">
        <Sparkles className="h-3.5 w-3.5 text-violet-400" />
        <span>Effects & Tools</span>
      </div>

      <div className="sym-panel__scroll flex-1 p-3 space-y-4">
        <section>
          <h3 className="sym-fx-section-title">Master Output</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="sym-fx-knob">
              <span>Master Volume</span>
              <input
                type="range"
                min={0}
                max={100}
                value={masterVolume}
                onChange={(e) => onProjectChange({ masterVolume: Number(e.target.value) })}
                className="sym-fader mt-1 w-full"
              />
              <span className="sym-fx-knob-val">{masterVolume}%</span>
            </label>
            <label className="sym-fx-knob">
              <span>Limiter Threshold</span>
              <input
                type="range"
                min={-36}
                max={0}
                value={limiterThreshold}
                onChange={(e) => onProjectChange({ limiterThreshold: Number(e.target.value) })}
                className="sym-fader mt-1 w-full"
              />
              <span className="sym-fx-knob-val">{limiterThreshold} dB</span>
            </label>
          </div>
        </section>

        {selectedTrack && (
          <section>
            <h3 className="sym-fx-section-title">Track — {selectedTrack.name}</h3>
            <div className={cn('mb-2 h-1 w-full rounded', TRACK_COLOR_MAP[selectedTrack.color].stripe)} />
            <label className="sym-fx-knob">
              <span>Reverb Send</span>
              <input
                type="range"
                min={0}
                max={100}
                value={selectedTrack.reverbSend ?? 0}
                onChange={(e) => onTrackChange(selectedTrack.id, { reverbSend: Number(e.target.value) })}
                className="sym-fader mt-1 w-full"
              />
              <span className="sym-fx-knob-val">{selectedTrack.reverbSend ?? 0}%</span>
            </label>
            {(selectedTrack.volumeAutomation?.length ?? 0) > 0 && (
              <SymphonyButton
                variant="tool"
                accent="yellow"
                className="mt-2"
                onClick={() => onClearAutomation(selectedTrack.id)}
              >
                CLEAR VOLUME AUTOMATION
              </SymphonyButton>
            )}
          </section>
        )}

        {selectedRegion && (
          <section>
            <h3 className="sym-fx-section-title">Region — {selectedRegion.name}</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="sym-fx-knob">
                <span>Transpose</span>
                <input
                  type="range"
                  min={-24}
                  max={24}
                  value={selectedRegion.transpose ?? 0}
                  onChange={(e) => onRegionChange(selectedRegion.id, { transpose: Number(e.target.value) })}
                  className="sym-fader mt-1 w-full"
                />
                <span className="sym-fx-knob-val">
                  {(selectedRegion.transpose ?? 0) > 0 ? '+' : ''}{selectedRegion.transpose ?? 0} st
                </span>
              </label>
              <label className="sym-fx-knob">
                <span>Gain</span>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={selectedRegion.gain ?? 100}
                  onChange={(e) => onRegionChange(selectedRegion.id, { gain: Number(e.target.value) })}
                  className="sym-fader mt-1 w-full"
                />
                <span className="sym-fx-knob-val">{selectedRegion.gain ?? 100}%</span>
              </label>
              <label className="sym-fx-knob">
                <span>Time Stretch</span>
                <input
                  type="range"
                  min={50}
                  max={200}
                  value={Math.round((selectedRegion.stretchFactor ?? 1) * 100)}
                  onChange={(e) => onRegionChange(selectedRegion.id, { stretchFactor: Number(e.target.value) / 100 })}
                  className="sym-fader mt-1 w-full"
                />
                <span className="sym-fx-knob-val">{Math.round((selectedRegion.stretchFactor ?? 1) * 100)}%</span>
              </label>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <SymphonyButton
                variant="toggle"
                accent="yellow"
                active={!!selectedRegion.muted}
                onClick={() => onRegionChange(selectedRegion.id, { muted: !selectedRegion.muted })}
              >
                MUTE REGION
              </SymphonyButton>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <SymphonyButton variant="tool" accent="violet" onClick={onQuantize}>
                <Wand2 className="h-3 w-3" /> QUANTIZE
              </SymphonyButton>
              <SymphonyButton variant="tool" accent="neutral" onClick={onHumanize}>HUMANIZE</SymphonyButton>
              <SymphonyButton variant="tool" accent="neutral" onClick={() => onTranspose(-1)}>−1 ST</SymphonyButton>
              <SymphonyButton variant="tool" accent="neutral" onClick={() => onTranspose(1)}>+1 ST</SymphonyButton>
              <SymphonyButton variant="tool" accent="neutral" onClick={() => onTranspose(12)}>+1 OCT</SymphonyButton>
            </div>
          </section>
        )}

        {!selectedTrack && !selectedRegion && (
          <p className="text-[11px] text-white/35 leading-relaxed">
            Select a track or region to adjust reverb, transpose, gain, and note tools.
          </p>
        )}
      </div>
    </div>
  );
}

interface CyclePanelProps {
  cycleStartBar?: number;
  cycleEndBar?: number;
  useCycleRegion?: boolean;
  totalBars: number;
  playheadBar: number;
  onSetCycle: (start: number, end: number, enabled: boolean) => void;
}

export function CyclePanel({
  cycleStartBar = 0, cycleEndBar = 8, useCycleRegion, totalBars, playheadBar, onSetCycle,
}: CyclePanelProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-[10px]">
      <span className="font-bold tracking-wider text-violet-300/60">CYCLE</span>
      <SymphonyButton
        variant="toggle"
        accent="violet"
        active={!!useCycleRegion}
        onClick={() => onSetCycle(cycleStartBar, cycleEndBar, !useCycleRegion)}
      >
        {useCycleRegion ? 'ON' : 'OFF'}
      </SymphonyButton>
      <label className="flex items-center gap-1 text-white/40">
        Start
        <input
          type="number"
          min={0}
          max={totalBars - 1}
          value={cycleStartBar}
          onChange={(e) => onSetCycle(Number(e.target.value), cycleEndBar, !!useCycleRegion)}
          className="sym-cycle-input w-10"
        />
      </label>
      <label className="flex items-center gap-1 text-white/40">
        End
        <input
          type="number"
          min={1}
          max={totalBars}
          value={cycleEndBar}
          onChange={(e) => onSetCycle(cycleStartBar, Number(e.target.value), !!useCycleRegion)}
          className="sym-cycle-input w-10"
        />
      </label>
      <SymphonyButton
        variant="tool"
        accent="neutral"
        onClick={() => onSetCycle(playheadBar - 1, Math.min(totalBars, playheadBar + 3), true)}
      >
        SET FROM PLAYHEAD
      </SymphonyButton>
    </div>
  );
}
