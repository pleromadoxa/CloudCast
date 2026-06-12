import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { PLATFORM_GUIDE_SECTIONS } from '../../config/mixerGuide';
import { cn } from '../../lib/utils';

export function PlatformGuide({ compact = false }: { compact?: boolean }) {
  const [openId, setOpenId] = useState<string>(PLATFORM_GUIDE_SECTIONS[0]?.id ?? 'monitors');

  return (
    <div className={cn('platform-guide flex min-h-0 flex-col gap-2', compact && 'text-[8px]')}>
      <p className="text-[8px] leading-relaxed text-mixer-muted">
        Quick reference for monitors, panels, graphics, and transport controls. Terms match the labels on the mixer deck.
      </p>
      <div className="platform-guide-sections min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
        {PLATFORM_GUIDE_SECTIONS.map((section) => {
          const open = openId === section.id;
          return (
            <div
              key={section.id}
              className="overflow-hidden rounded border border-white/10 bg-black/30"
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? '' : section.id)}
                className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left hover:bg-white/5"
              >
                <span className="text-[9px] font-bold uppercase tracking-wider text-mixer-text">
                  {section.title}
                </span>
                <ChevronDown
                  className={cn('h-3.5 w-3.5 shrink-0 text-mixer-muted transition-transform', open && 'rotate-180')}
                />
              </button>
              {open && (
                <div className="space-y-2 border-t border-white/10 px-2.5 py-2">
                  {section.intro && (
                    <p className="text-[8px] leading-relaxed text-mixer-muted">{section.intro}</p>
                  )}
                  <ul className="space-y-2">
                    {section.entries.map((entry) => (
                      <li key={entry.term}>
                        <p className="text-[8px] font-bold uppercase tracking-wide text-mixer-red/90">
                          {entry.term}
                        </p>
                        <p className="mt-0.5 text-[8px] leading-relaxed text-mixer-muted">
                          {entry.description}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
