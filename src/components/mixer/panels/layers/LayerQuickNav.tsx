import type { LayerStackId } from './layerStackTypes';
import { cn } from '../../../../lib/utils';

const SHORTCUTS: { id: LayerStackId; label: string; tier?: 'advanced' | 'chroma' }[] = [
  { id: 'breaking', label: 'Breaking', tier: 'advanced' },
  { id: 'live-button', label: 'Live' },
  { id: 'lower-third', label: 'Lower 3rd' },
  { id: 'logo', label: 'Logo' },
  { id: 'crawler', label: 'Crawler', tier: 'advanced' },
  { id: 'transition', label: 'Stinger', tier: 'advanced' },
  { id: 'chroma', label: 'Chroma', tier: 'chroma' },
];

interface LayerQuickNavProps {
  selectedId: LayerStackId;
  onSelect: (id: LayerStackId) => void;
  chromaLocked?: boolean;
  advancedLocked?: boolean;
}

export function LayerQuickNav({
  selectedId,
  onSelect,
  chromaLocked,
  advancedLocked,
}: LayerQuickNavProps) {
  return (
    <div className="flex flex-wrap gap-0.5">
      {SHORTCUTS.map((s) => {
        const locked =
          (s.tier === 'chroma' && chromaLocked) || (s.tier === 'advanced' && advancedLocked);
        return (
          <button
            key={s.id}
            type="button"
            disabled={locked}
            title={locked ? 'Pro or Pro Master required' : undefined}
            onClick={() => onSelect(s.id)}
            className={cn(
              'layer-quick-nav-btn',
              selectedId === s.id && 'layer-quick-nav-btn-active',
              locked && 'opacity-40',
            )}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
