import type { LucideIcon } from 'lucide-react';
import { LayoutGrid } from 'lucide-react';
import type { MixerPanel } from '../../types/mixer';
import { MIXER_PANELS } from '../../config/mixerPanels';
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
  const renderPanelButton = (
    id: MixerPanel,
    label: string,
    description: string,
    Icon: LucideIcon,
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
          'mixer-tab-guide-cell group relative shrink-0 rounded-md border text-left transition-all',
          'min-w-[7rem] max-w-[10rem] flex-1 px-2 py-1',
          open
            ? 'border-mixer-red/40 bg-gradient-to-br from-mixer-red/15 to-mixer-red/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
            : 'border-white/8 bg-black/30 hover:border-white/20 hover:bg-white/5',
          active && 'ring-1 ring-mixer-red/55',
        )}
        title={`${description} · Click to open/close · double-click to focus`}
      >
        <div className="flex items-start gap-1.5">
          <span
            className={cn(
              'mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded border',
              open ? 'border-mixer-red/30 bg-mixer-red/20 text-mixer-red' : 'border-white/10 bg-black/40 text-mixer-muted',
            )}
          >
            <Icon className="h-3 w-3" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1">
              <span
                className={cn(
                  'font-bold uppercase tracking-wide text-[8px]',
                  active ? 'text-mixer-red' : 'text-mixer-text',
                )}
              >
                {label}
              </span>
              {open && (
                <span className="rounded bg-mixer-green/20 px-1 py-px text-[6px] font-bold uppercase tracking-wider text-mixer-green">
                  Open
                </span>
              )}
            </span>
            <span className="mt-0.5 block truncate text-[7px] leading-snug text-mixer-muted">
              {description}
            </span>
          </span>
        </div>
      </button>
    );
  };

  return (
    <nav className={cn('mixer-tab-guide shrink-0', className)} aria-label="Mixer panels">
      <div className="flex items-center gap-2">
        <div className="flex shrink-0 items-center gap-1.5 pr-1">
          <LayoutGrid className="h-3 w-3 text-mixer-red" />
          <span className="hidden text-[8px] font-bold uppercase tracking-wider text-mixer-text sm:inline">
            Panels
          </span>
          <span className="text-[7px] font-bold uppercase tracking-wider text-mixer-muted">
            {openPanels.length} open
          </span>
        </div>
        <div className="mixer-tab-guide-row flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {MIXER_PANELS.map((panel) =>
            renderPanelButton(panel.id, panel.label, panel.description, panel.icon),
          )}
        </div>
      </div>
    </nav>
  );
}
