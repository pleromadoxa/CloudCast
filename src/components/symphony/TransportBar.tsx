import { Circle, Pause, Play, Repeat, Square, Timer } from 'lucide-react';
import { SymphonyButton } from './SymphonyButton';
import { cn } from '../../lib/utils';

const KEYS = ['C maj', 'G maj', 'D maj', 'A maj', 'E maj', 'F maj', 'B maj', 'A min', 'E min', 'D min'];

interface TransportBarProps {
  playing: boolean;
  paused: boolean;
  recording: boolean;
  looping: boolean;
  metronome: boolean;
  countIn: boolean;
  position: { bar: number; beat: number; tick: number };
  tempo: number;
  timeSignature: [number, number];
  musicalKey: string;
  projectName: string;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRecord: () => void;
  onToggleLoop: () => void;
  onToggleMetronome: () => void;
  onToggleCountIn: () => void;
  onTempoChange: (tempo: number) => void;
  onKeyChange: (key: string) => void;
  onProjectNameChange: (name: string) => void;
}

export function TransportBar({
  playing, paused, recording, looping, metronome, countIn, position, tempo, timeSignature, musicalKey, projectName,
  onPlay, onPause, onStop, onRecord, onToggleLoop, onToggleMetronome, onToggleCountIn,
  onTempoChange, onKeyChange, onProjectNameChange,
}: TransportBarProps) {
  return (
    <header className="sym-transport-bar flex shrink-0 flex-wrap items-center gap-3 px-3 py-2">
      <div className="sym-transport-rail">
        <SymphonyButton variant="transport" active={recording} accent="red" onClick={onRecord} title="Record (arm a track first)">
          <Circle className="h-3.5 w-3.5 fill-current" />
        </SymphonyButton>
        <SymphonyButton
          variant="transport"
          active={playing || paused}
          accent="green"
          onClick={playing ? onPause : onPlay}
          title={playing ? 'Pause' : paused ? 'Resume' : 'Play'}
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </SymphonyButton>
        <SymphonyButton variant="transport" accent="neutral" onClick={onStop} title="Stop">
          <Square className="h-3 w-3 fill-current" />
        </SymphonyButton>
        <div className="sym-transport-divider" />
        <SymphonyButton variant="transport" active={looping} accent="violet" onClick={onToggleLoop} title="Loop">
          <Repeat className="h-3.5 w-3.5" />
        </SymphonyButton>
        <SymphonyButton variant="transport" active={metronome} accent="amber" onClick={onToggleMetronome} title="Metronome">
          <span className="text-[10px] font-bold">M</span>
        </SymphonyButton>
        <SymphonyButton variant="transport" active={countIn} accent="sky" onClick={onToggleCountIn} title="Count-in">
          <Timer className="h-3.5 w-3.5" />
        </SymphonyButton>
      </div>

      <div className="sym-transport-lcd">
        <div className="sym-transport-lcd__cell">
          <span className="sym-transport-lcd__label">Status</span>
          <div className="sym-transport-lcd__dots">
            <span className={cn('sym-transport-led', (playing || paused) && 'sym-transport-led--on')} title="Play" />
            <span className={cn('sym-transport-led', recording && 'sym-transport-led--rec')} title="Record" />
            <span className={cn('sym-transport-led', looping && 'sym-transport-led--on')} title="Loop" />
            <span className={cn('sym-transport-led', metronome && 'sym-transport-led--on')} title="Metronome" />
          </div>
        </div>

        <div className="sym-transport-lcd__cell">
          <span className="sym-transport-lcd__label">Bar</span>
          <span className="sym-transport-lcd__value">{String(position.bar).padStart(3, '0')}</span>
        </div>
        <div className="sym-transport-lcd__cell">
          <span className="sym-transport-lcd__label">Beat</span>
          <span className="sym-transport-lcd__value">{position.beat}</span>
        </div>
        <div className="sym-transport-lcd__cell">
          <span className="sym-transport-lcd__label">Tick</span>
          <span className="sym-transport-lcd__value">{String(position.tick).padStart(3, '0')}</span>
        </div>

        <div className="sym-transport-lcd__cell">
          <span className="sym-transport-lcd__label">Tempo</span>
          <input
            type="number"
            min={40}
            max={300}
            step={0.1}
            value={tempo}
            onChange={(e) => onTempoChange(Number(e.target.value))}
            className="sym-transport-lcd__value sym-transport-lcd__value--sm w-[62px] border-none bg-transparent outline-none"
          />
        </div>
        <div className="sym-transport-lcd__cell">
          <span className="sym-transport-lcd__label">Sig</span>
          <span className="sym-transport-lcd__value sym-transport-lcd__value--sm">
            {timeSignature[0]}/{timeSignature[1]}
          </span>
        </div>
        <div className="sym-transport-lcd__cell">
          <span className="sym-transport-lcd__label">Key</span>
          <select
            value={musicalKey}
            onChange={(e) => onKeyChange(e.target.value)}
            className="sym-transport-lcd__value sym-transport-lcd__value--sm border-none bg-transparent outline-none"
          >
            {KEYS.map((k) => <option key={k} value={k} className="bg-black">{k}</option>)}
          </select>
        </div>
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-3">
        <input
          type="text"
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
          className="sym-project-name hidden max-w-[180px] truncate sm:inline"
          placeholder="Untitled Project"
        />
        <div className="sym-cloud-badge">
          <span className={playing || paused || recording ? 'sym-meter-led sym-meter-led--active' : 'sym-meter-led'} />
          <span className="sym-cloud-badge__text">REGAL CLOUD</span>
        </div>
      </div>
    </header>
  );
}
