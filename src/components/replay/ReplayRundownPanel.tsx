import { useCallback, useMemo, useState } from 'react';
import { ListOrdered, Play, Save, Trash2, Plus } from 'lucide-react';
import type { ReplayBankSlot, ReplayRundownItem } from '../../types/replay';
import { cn } from '../../lib/utils';

interface ReplayRundownPanelProps {
  banks: ReplayBankSlot[];
  activeBankIndex: number;
  playbackRate: number;
  rundownDraft: number[];
  onToggleBank: (bankIndex: number) => void;
  onClearDraft: () => void;
  onPlayRundown: (items: ReplayRundownItem[]) => void;
  remainingCount: number;
  readOnly: boolean;
  canSaveTemplates?: boolean;
  templates?: Array<{ id: string; name: string; itemCount: number }>;
  onSaveTemplate?: (name: string) => void;
  onLoadTemplate?: (templateId: string) => void;
  onDeleteTemplate?: (templateId: string) => void;
  className?: string;
}

export function ReplayRundownPanel({
  banks,
  activeBankIndex,
  playbackRate,
  rundownDraft,
  onToggleBank,
  onClearDraft,
  onPlayRundown,
  remainingCount,
  readOnly,
  canSaveTemplates = false,
  templates = [],
  onSaveTemplate,
  onLoadTemplate,
  onDeleteTemplate,
  className,
}: ReplayRundownPanelProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');

  const draftItems = useMemo((): ReplayRundownItem[] => {
    const items: ReplayRundownItem[] = [];
    for (const bankIndex of rundownDraft) {
      const clip = banks[bankIndex]?.clip;
      if (!clip) continue;
      items.push({
        url: clip.blobUrl,
        label: clip.sourceLabel,
        clipId: clip.id,
        playbackRate,
        busTake: true,
        bankIndex,
      });
    }
    return items;
  }, [banks, rundownDraft, playbackRate]);

  const handlePlay = useCallback(() => {
    if (draftItems.length === 0) {
      setStatus('Add banks with clips to the rundown first.');
      return;
    }
    onPlayRundown(draftItems);
    setStatus(`Rundown started — ${draftItems.length} clip(s) queued on PGM.`);
  }, [draftItems, onPlayRundown]);

  const handleAddActive = useCallback(() => {
    const clip = banks[activeBankIndex]?.clip;
    if (!clip) {
      setStatus('Active bank has no clip.');
      return;
    }
    if (rundownDraft.includes(activeBankIndex)) {
      setStatus('Active bank is already in the rundown.');
      return;
    }
    onToggleBank(activeBankIndex);
    setStatus(`Added bank ${activeBankIndex + 1} to rundown.`);
  }, [banks, activeBankIndex, rundownDraft, onToggleBank]);

  return (
    <section className={cn('border-t border-white/5 px-3 py-2', className)}>
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-mixer-muted">
          <ListOrdered className="h-3 w-3" /> PGM rundown
        </p>
        {remainingCount > 0 && (
          <span className="text-[9px] text-emerald-300">{remainingCount} queued on PGM</span>
        )}
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        {banks.map((bank, i) => (
          <button
            key={bank.id}
            type="button"
            disabled={!bank.clip || readOnly}
            onClick={() => onToggleBank(i)}
            className={cn(
              'rounded border px-1.5 py-0.5 text-[9px] font-bold',
              rundownDraft.includes(i)
                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-100'
                : 'border-white/10 text-mixer-muted hover:border-white/25',
              !bank.clip && 'opacity-40',
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {rundownDraft.length > 0 && (
        <ol className="mb-2 space-y-0.5 text-[10px] text-emerald-200/90">
          {draftItems.map((item, idx) => (
            <li key={`${item.clipId}-${idx}`}>
              {idx + 1}. {item.label}
              {item.bankIndex != null ? ` (bank ${item.bankIndex + 1})` : ''}
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap gap-1">
        <button type="button" disabled={readOnly} className="replay-btn text-[9px]" onClick={handleAddActive}>
          <Plus className="h-3 w-3" /> ADD ACTIVE
        </button>
        <button type="button" disabled={readOnly || draftItems.length === 0} className="replay-btn replay-btn--primary text-[9px]" onClick={handlePlay}>
          <Play className="h-3 w-3" /> PLAY RUNDOWN
        </button>
        <button type="button" disabled={readOnly || rundownDraft.length === 0} className="replay-btn text-[9px]" onClick={onClearDraft}>
          <Trash2 className="h-3 w-3" /> CLEAR
        </button>
      </div>

      {status && <p className="mt-1 text-[9px] text-mixer-muted">{status}</p>}

      {canSaveTemplates && (
        <div className="mt-2 border-t border-white/5 pt-2">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-mixer-muted">Saved rundowns</p>
          <div className="mb-1 flex gap-1">
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name"
              className="min-w-0 flex-1 rounded border border-white/10 bg-black px-2 py-1 text-[10px] outline-none focus:border-emerald-500/40"
            />
            <button
              type="button"
              disabled={readOnly || rundownDraft.length === 0}
              className="replay-btn text-[9px]"
              onClick={() => {
                const name = templateName.trim() || `Rundown ${templates.length + 1}`;
                onSaveTemplate?.(name);
                setTemplateName('');
                setStatus(`Saved rundown template "${name}".`);
              }}
            >
              <Save className="h-3 w-3" />
            </button>
          </div>
          {templates.length > 0 ? (
            <ul className="space-y-1">
              {templates.map((template) => (
                <li key={template.id} className="flex items-center justify-between gap-2 text-[10px]">
                  <button
                    type="button"
                    className="text-emerald-200 hover:text-white"
                    onClick={() => {
                      onLoadTemplate?.(template.id);
                      setStatus(`Loaded "${template.name}" (${template.itemCount} clips).`);
                    }}
                  >
                    {template.name} · {template.itemCount}
                  </button>
                  {!readOnly && (
                    <button
                      type="button"
                      className="text-mixer-muted hover:text-mixer-red"
                      onClick={() => { onDeleteTemplate?.(template.id); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[9px] text-white/30">Save bank orders for this show or session.</p>
          )}
        </div>
      )}
    </section>
  );
}
