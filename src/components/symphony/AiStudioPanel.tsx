import { useMemo, useState } from 'react';
import { FileText, Music2, RefreshCw, Sparkles, Wand2, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  composeSong, describeSong, songToProjectPatch,
  type AiProjectPatch, type AiSong,
} from '../../lib/symphony/aiComposer';
import { SymphonyButton } from './SymphonyButton';
import { symListItemClass } from './symphonyTheme';

const PRESET_PROMPTS: { label: string; prompt: string }[] = [
  { label: 'SUNNY POP', prompt: 'uplifting pop anthem with bright synths and a catchy chorus' },
  { label: 'DARK TRAP', prompt: 'dark trap banger with heavy 808s and haunting melodies' },
  { label: 'LO-FI', prompt: 'lofi chill study beats with dusty warm keys' },
  { label: 'EDM DROP', prompt: 'energetic EDM festival banger with a massive drop' },
  { label: 'CINEMATIC', prompt: 'epic orchestral trailer with rising strings and thunder' },
  { label: 'DREAMY', prompt: 'dreamy ambient soundscape floating in space' },
];

const KEYS = ['auto', 'C maj', 'G maj', 'D maj', 'A maj', 'E maj', 'F maj', 'B maj', 'A min', 'E min', 'D min'];

export interface AiStudioPanelProps {
  onApplyPatch: (patch: AiProjectPatch, mode: 'replace' | 'append') => void;
  className?: string;
}

export function AiStudioPanel({ onApplyPatch, className }: AiStudioPanelProps) {
  const [prompt, setPrompt] = useState(PRESET_PROMPTS[0].prompt);
  const [seed, setSeed] = useState(1);
  const [keyOverride, setKeyOverride] = useState('auto');
  const [tempoOverride, setTempoOverride] = useState(0); // 0 = auto
  const [energy, setEnergy] = useState(55);
  const [complexity, setComplexity] = useState(50);
  const [song, setSong] = useState<AiSong | null>(null);
  const [lyrics, setLyrics] = useState('');

  const patch = useMemo<AiProjectPatch | null>(
    () => (song ? songToProjectPatch(song) : null),
    [song],
  );

  const compose = (newSeed?: number) => {
    const nextSeed = newSeed ?? seed;
    if (newSeed !== undefined) setSeed(newSeed);
    const result = composeSong({
      prompt,
      seed: nextSeed,
      key: keyOverride === 'auto' ? undefined : keyOverride,
      tempo: tempoOverride > 0 ? tempoOverride : undefined,
      energy,
      complexity,
    });
    setSong(result);
    setLyrics(result.lyrics);
  };

  return (
    <div className={cn('sym-ai-panel flex h-full gap-3 p-3', className)}>
      {/* Prompt & controls */}
      <div className="flex w-[300px] shrink-0 flex-col gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-200">
          <Sparkles className="h-3.5 w-3.5 text-violet-300" /> AI Composer
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="Describe your song… e.g. 'dark cinematic trailer in D minor'"
          className="sym-lcd w-full resize-none rounded-md px-2.5 py-2 text-[11px] text-violet-100 outline-none"
        />
        <div className="flex flex-wrap gap-1">
          {PRESET_PROMPTS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => { setPrompt(p.prompt); }}
              className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-white/55 transition hover:border-violet-400/50 hover:text-violet-200"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <label className="flex flex-col gap-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-white/45">
            Key
            <select
              value={keyOverride}
              onChange={(e) => setKeyOverride(e.target.value)}
              className="sym-lcd rounded px-1.5 py-1 text-[10px] text-violet-100 outline-none"
            >
              {KEYS.map((k) => <option key={k} value={k}>{k === 'auto' ? 'Auto (AI)' : k}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-white/45">
            Tempo {tempoOverride > 0 ? tempoOverride : 'auto'}
            <input
              type="range" min={0} max={190} value={tempoOverride}
              onChange={(e) => setTempoOverride(Number(e.target.value))}
              className="sym-slider mt-1"
            />
          </label>
          <label className="flex flex-col gap-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-white/45">
            Energy {energy}
            <input
              type="range" min={0} max={100} value={energy}
              onChange={(e) => setEnergy(Number(e.target.value))}
              className="sym-slider mt-1"
            />
          </label>
          <label className="flex flex-col gap-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-white/45">
            Complexity {complexity}
            <input
              type="range" min={0} max={100} value={complexity}
              onChange={(e) => setComplexity(Number(e.target.value))}
              className="sym-slider mt-1"
            />
          </label>
        </div>

        <div className="mt-auto flex gap-1.5">
          <SymphonyButton variant="default" accent="violet" className="flex-1" onClick={() => compose()}>
            <Wand2 className="h-3 w-3" /> COMPOSE
          </SymphonyButton>
          <SymphonyButton variant="toggle" accent="sky" onClick={() => compose(seed + 1)} title="New variation (next seed)">
            <RefreshCw className="h-3 w-3" /> VAR
          </SymphonyButton>
        </div>
      </div>

      {/* Preview */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {song && patch ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold text-white">{song.title}</p>
                <p className="truncate text-[9px] text-violet-300/80">{describeSong(song)}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <SymphonyButton variant="default" accent="green" onClick={() => onApplyPatch(patch, 'replace')}>
                  <Zap className="h-3 w-3" /> NEW SONG
                </SymphonyButton>
                <SymphonyButton variant="toggle" accent="amber" onClick={() => onApplyPatch(patch, 'append')}>
                  ADD TRACKS
                </SymphonyButton>
              </div>
            </div>

            {/* Arrangement + chords */}
            <div className="flex flex-wrap gap-1">
              {song.arrangement.map((s) => (
                <span
                  key={s.id}
                  title={`${s.lengthBars} bars`}
                  className="rounded-sm border border-sky-400/25 bg-sky-400/10 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-sky-200"
                >
                  {s.name.toUpperCase()} {s.lengthBars}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {song.chordEvents.slice(0, 16).map((c, i) => (
                <span key={`${c.bar}-${i}`} className="rounded-sm border border-amber-400/25 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9px] text-amber-200">
                  {c.chord}
                </span>
              ))}
              {song.chordEvents.length > 16 && <span className="text-[9px] text-white/35">+{song.chordEvents.length - 16} more…</span>}
            </div>

            {/* Tracks */}
            <div className="sym-panel__scroll min-h-0 flex-1">
              {song.tracks.map((t) => (
                <div key={t.name} className={cn(symListItemClass, 'flex items-center justify-between py-1')}>
                  <div className="flex items-center gap-2">
                    <Music2 className="h-3 w-3 text-violet-300" />
                    <span className="text-[10px] font-semibold text-white/85">{t.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[8px] text-white/40">
                    <span>{t.instrumentId}</span>
                    <span>{t.regions.reduce((s, r) => s + r.notes.length, 0)} notes</span>
                    <span>pan {t.pan > 0 ? `R${t.pan}` : t.pan < 0 ? `L${-t.pan}` : 'C'}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-white/35">
            <Sparkles className="h-8 w-8 text-violet-400/40" />
            <p className="text-[11px]">Describe a vibe and hit COMPOSE — structure, chords,</p>
            <p className="text-[11px]">melody, bass, drums and lyrics appear here.</p>
          </div>
        )}
      </div>

      {/* Lyrics */}
      <div className="flex w-[240px] shrink-0 flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
          <FileText className="h-3.5 w-3.5" /> Lyrics
        </div>
        <textarea
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          placeholder="Generated lyrics appear here — editable."
          className="sym-lcd min-h-0 flex-1 resize-none rounded-md px-2.5 py-2 font-mono text-[10px] leading-relaxed text-violet-100/90 outline-none"
        />
      </div>
    </div>
  );
}
