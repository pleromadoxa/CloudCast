import { Lock } from 'lucide-react';
import type { VirtualSetDefinition } from '../../lib/prism/virtualSets';
import { cn } from '../../lib/utils';

interface SceneSelectorProps {
  sets: VirtualSetDefinition[];
  selectedId: string;
  onSelect: (id: string) => void;
  lockedIds?: Set<string>;
}

export function SceneSelector({ sets, selectedId, onSelect, lockedIds }: SceneSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {sets.map((set) => {
        const locked = lockedIds?.has(set.id);
        const active = set.id === selectedId;
        return (
          <button
            key={set.id}
            type="button"
            disabled={locked}
            onClick={() => onSelect(set.id)}
            className={cn(
              'relative rounded-lg border p-3 text-left transition-colors',
              active
                ? 'border-amber-500/60 bg-amber-500/10'
                : 'border-white/10 bg-black/40 hover:border-white/25',
              locked && 'cursor-not-allowed opacity-50',
            )}
          >
            {locked && <Lock className="absolute right-2 top-2 h-3 w-3 text-mixer-muted" />}
            <p className="text-xs font-bold text-white">{set.name}</p>
            <p className="mt-1 text-[10px] leading-snug text-mixer-muted">{set.description}</p>
          </button>
        );
      })}
    </div>
  );
}
