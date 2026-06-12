import type { LucideIcon } from 'lucide-react';
import { LayoutGrid } from 'lucide-react';
import type { MixerPanel } from '../../types/mixer';
import { CORE_MIXER_PANELS, MIXER_PANELS } from '../../config/mixerPanels';
import { cn } from '../../lib/utils';

interface MixerTabGuideProps {
  activePanel: MixerPanel;
  openPanels: MixerPanel[];
  onSelectPanel: (panel: MixerPanel) => void;
  onToggleOpenPanel: (panel: MixerPanel) => void;
  className?: string;
}

export function MixerTabGuide({
  activePanel,
  openPanels,
  onSelectPanel,
  onToggleOpenPanel,
  className,
}: MixerTabGuideProps) {
  const auxPanels = MIXER_PANELS.filter((panel) => !CORE_MIXER_PANELS.includes(panel.id));

  const renderPanelButton = (
    id: MixerPanel,
    label: string,
    description: string,
    Icon: LucideIcon,
    compact = false,
  ) => {
    const active = activePanel === id;
    const open = openPanels.includes(id);

    return (
      <button
        key={id}
        type="button"
        onClick={() => onToggleOpenPanel(id)}
        onDoubleClick={() => onSelectPanel(id)}
        className={cn(
          'mixer-tab-guide-cell group relative rounded-md border text-left transition-all',
          compact ? 'px-2 py-1.5' : 'px-2.5 py-2',
          open
            ? 'border-mixer-red/40 bg-gradient-to-br from-mixer-red/15 to-mixer-red/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
            : 'border-white/8 bg-black/30 hover:border-white/20 hover:bg-white/5',
          active && 'ring-1 ring-mixer-red/55',
        )}
        title={`${description} · Click to open/close · double-click to focus`}
      >
        <div className="flex items-start gap-2">
          <span
            className={cn(
              'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border',
              open ? 'border-mixer-red/30 bg-mixer-red/20 text-mixer-red' : 'border-white/10 bg-black/40 text-mixer-muted',
            )}
          >
            <Icon className={cn(compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  'font-bold uppercase tracking-wide',
                  compact ? 'text-[8px]' : 'text-[9px]',
                  active ? 'text-mixer-red' : 'text-mixer-text',
                )}
              >
                {label}
              </span>
              {open && (
                <span className="rounded bg-mixer-green/20 px-1 py-px text-[7px] font-bold uppercase tracking-wider text-mixer-green">
                  Open
                </span>
              )}
              {active && (
                <span className="rounded bg-mixer-red/20 px-1 py-px text-[7px] font-bold uppercase tracking-wider text-mixer-red">
                  Focus
                </span>
              )}
            </span>
            <span
              className={cn(
                'mt-0.5 block leading-snug text-mixer-muted',
                compact ? 'text-[7px] line-clamp-1' : 'text-[8px] line-clamp-2',
              )}
            >
              {description}
            </span>
          </span>
        </div>
      </button>
    );
  };

  return (
    <nav className={cn('mixer-tab-guide flex min-h-0 flex-col gap-2', className)} aria-label="Mixer panels">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-1.5">
          <LayoutGrid className="h-3.5 w-3.5 text-mixer-red" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-mixer-text">Mixer panels</span>
        </div>
        <span className="text-[7px] font-bold uppercase tracking-wider text-mixer-muted">
          {openPanels.length} open
        </span>
      </div>
      <p className="px-0.5 text-[7px] leading-relaxed text-mixer-muted">
        Open several panels side-by-side in the deck below. Click to toggle · double-click to focus.
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {CORE_MIXER_PANELS.map((id) => {
          const panel = MIXER_PANELS.find((entry) => entry.id === id);
          if (!panel) return null;
          return renderPanelButton(panel.id, panel.label, panel.description, panel.icon);
        })}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {auxPanels.map((panel) => renderPanelButton(panel.id, panel.label, panel.description, panel.icon, true))}
      </div>
    </nav>
  );
}
