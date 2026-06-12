import { useMemo, useState } from 'react';
import { GripVertical, Play, Search, Sparkles } from 'lucide-react';
import { LOOP_FILTER_TAGS, LOOP_LIBRARY } from '../../lib/symphony/loops';
import { INSTRUMENT_CATEGORIES, INSTRUMENT_LIBRARY } from '../../lib/symphony/instruments';
import { DND_INSTRUMENT, DND_LOOP } from '../../lib/symphony/dragTypes';
import type { LoopItem } from '../../types/symphony';
import { WaveformMini } from './symphonyUi';
import { SymphonyButton, symListItemClass } from './SymphonyButton';
import { cn } from '../../lib/utils';

interface LoopBrowserProps {
  selectedLoopId: string | null;
  onSelectLoop: (loop: LoopItem) => void;
  onPreviewLoop: (loop: LoopItem) => void;
  onAddLoopToTrack: (loop: LoopItem) => void;
}

const LOOP_TAG_COLORS: Record<string, string> = {
  drums: 'sym-tag--amber',
  bass: 'sym-tag--green',
  synth: 'sym-tag--violet',
  keys: 'sym-tag--sky',
  guitar: 'sym-tag--orange',
  vocal: 'sym-tag--rose',
  fx: 'sym-tag--cyan',
};

export function LoopBrowser({ selectedLoopId, onSelectLoop, onPreviewLoop, onAddLoopToTrack }: LoopBrowserProps) {
  const [search, setSearch] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [previewVolume, setPreviewVolume] = useState(80);

  const filtered = useMemo(() => {
    return LOOP_LIBRARY.filter((loop) => {
      const q = search.toLowerCase();
      const matchesSearch = !q || loop.name.toLowerCase().includes(q) || loop.tags.some((t) => t.toLowerCase().includes(q));
      const matchesTags = activeTags.length === 0 || activeTags.every((t) => loop.tags.includes(t));
      return matchesSearch && matchesTags;
    });
  }, [search, activeTags]);

  const selected = LOOP_LIBRARY.find((l) => l.id === selectedLoopId) ?? filtered[0] ?? null;

  const toggleTag = (tag: string) => {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handlePreview = (loop: LoopItem) => {
    setPreviewing(true);
    onPreviewLoop(loop);
    window.setTimeout(() => setPreviewing(false), 2000);
  };

  return (
    <aside className="sym-panel sym-panel--loops flex w-56 shrink-0 flex-col lg:w-64">
      <div className="sym-panel__header">
        <Sparkles className="h-3.5 w-3.5 text-violet-400" />
        <span>Loop Library</span>
        <span className="sym-panel__badge">{filtered.length}</span>
      </div>

      <div className="border-b border-white/[0.06] p-2.5">
        <div className="sym-search">
          <Search className="sym-search__icon" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search loops…"
            className="sym-search__input"
          />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1">
          {activeTags.length > 0 && (
            <SymphonyButton variant="ghost" accent="violet" onClick={() => setActiveTags([])} className="text-[9px]">
              Clear
            </SymphonyButton>
          )}
          {LOOP_FILTER_TAGS.slice(0, 6).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={cn('sym-tag', LOOP_TAG_COLORS[tag] ?? 'sym-tag--violet', activeTags.includes(tag) && 'sym-tag--active')}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="sym-panel__scroll min-h-0 flex-1">
        {filtered.map((loop) => (
          <div
            key={loop.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(DND_LOOP, loop.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            role="button"
            tabIndex={0}
            onClick={() => onSelectLoop(loop)}
            onDoubleClick={() => onAddLoopToTrack(loop)}
            onKeyDown={(e) => e.key === 'Enter' && onSelectLoop(loop)}
            className={cn(
              'sym-loop-card',
              selectedLoopId === loop.id && 'sym-loop-card--selected',
            )}
          >
            <GripVertical className="sym-loop-card__grip h-3 w-3 shrink-0 opacity-30" />
            <div className="min-w-0 flex-1">
              <span className="sym-loop-card__name">{loop.name}</span>
              <div className="mt-1 flex items-center gap-2">
                <span className="sym-loop-card__meta">{loop.bpm} BPM</span>
                <span className="text-white/15">·</span>
                <span className="sym-loop-card__meta">{loop.bars} bars</span>
              </div>
            </div>
            <button
              type="button"
              className="sym-loop-card__play"
              onClick={(e) => { e.stopPropagation(); handlePreview(loop); }}
              title="Preview"
            >
              <Play className="h-2.5 w-2.5 fill-current" />
            </button>
          </div>
        ))}
      </div>

      {selected && (
        <div className="sym-loop-preview shrink-0">
          <p className="sym-loop-preview__label">Now Selected</p>
          <p className="sym-loop-preview__title">{selected.name}</p>
          <WaveformMini className="mt-2" active={previewing && selectedLoopId === selected.id} />
          <div className="mt-3 flex items-center gap-2">
            <SymphonyButton variant="round" accent="violet" onClick={() => handlePreview(selected)} title="Preview">
              <Play className="h-3 w-3 fill-current" />
            </SymphonyButton>
            <input type="range" min={0} max={100} value={previewVolume} onChange={(e) => setPreviewVolume(Number(e.target.value))} className="sym-fader flex-1" />
            <SymphonyButton variant="toggle" accent="violet" onClick={() => onAddLoopToTrack(selected)}>
              ADD
            </SymphonyButton>
          </div>
        </div>
      )}
    </aside>
  );
}

export function InstrumentLibraryPanel({
  category,
  onCategoryChange,
  onSelectInstrument,
  selectedInstrumentId,
}: {
  category: string;
  onCategoryChange: (cat: string) => void;
  onSelectInstrument: (id: string) => void;
  selectedInstrumentId: string | null;
}) {
  const filtered = INSTRUMENT_LIBRARY.filter((i) => !category || i.category === category);

  return (
    <div className="sym-panel sym-panel--flat flex h-full flex-col">
      <div className="sym-panel__header">
        <span>Instrument Library</span>
        <span className="sym-panel__badge">{filtered.length}</span>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-white/[0.06] p-2">
        <SymphonyButton variant="toggle" accent="violet" active={!category} onClick={() => onCategoryChange('')} className="!min-h-0 px-2 py-0.5 text-[9px]">
          All
        </SymphonyButton>
        {INSTRUMENT_CATEGORIES.map((c) => (
          <SymphonyButton
            key={c.id}
            variant="toggle"
            accent="violet"
            active={category === c.id}
            onClick={() => onCategoryChange(c.id)}
            className="!min-h-0 px-2 py-0.5 text-[9px] normal-case tracking-normal"
          >
            {c.label}
          </SymphonyButton>
        ))}
      </div>
      <div className="sym-panel__scroll min-h-0 flex-1 p-1.5">
        {filtered.map((inst) => (
          <div
            key={inst.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(DND_INSTRUMENT, inst.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            role="button"
            tabIndex={0}
            onClick={() => onSelectInstrument(inst.id)}
            onKeyDown={(e) => e.key === 'Enter' && onSelectInstrument(inst.id)}
            className={symListItemClass(selectedInstrumentId === inst.id, 'sym-instrument-card mb-1 cursor-grab active:cursor-grabbing')}
          >
            <span className="text-xs font-semibold text-white/95">{inst.name}</span>
            <span className="text-[10px] text-white/40">{inst.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
