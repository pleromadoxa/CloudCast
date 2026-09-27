import { X } from 'lucide-react';
import { SymphonyButton } from './SymphonyButton';

interface ShortcutsDialogProps {
  onClose: () => void;
}

const SECTIONS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Transport',
    items: [
      ['Space', 'Play / pause'],
      ['R', 'Toggle record arm mode'],
      ['L', 'Toggle loop / cycle'],
    ],
  },
  {
    title: 'Editing',
    items: [
      ['⌘Z / ⌘⇧Z', 'Undo / redo'],
      ['⌘C / ⌘X / ⌘V', 'Copy / cut / paste region'],
      ['⌘D', 'Duplicate region'],
      ['Q', 'Quantize region'],
      ['⌫', 'Delete selected region'],
    ],
  },
  {
    title: 'View',
    items: [
      ['⌘ + / ⌘ −', 'Zoom timeline in / out'],
      ['?', 'This shortcut sheet'],
    ],
  },
  {
    title: 'Automation editor',
    items: [
      ['Click grid', 'Add point'],
      ['Arrow keys', 'Nudge selected point'],
      ['⌫', 'Delete selected point'],
    ],
  },
  {
    title: 'Mixer',
    items: [
      ['Double-click name', 'Rename channel'],
      ['Click color stripe', 'Change track color'],
    ],
  },
];

export function ShortcutsDialog({ onClose }: ShortcutsDialogProps) {
  return (
    <div className="sym-dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sym-dialog sym-grain relative" role="dialog" aria-label="Keyboard shortcuts">
        <div className="sym-dialog__title">
          <span className="flex items-center gap-2">⌨ Keyboard Shortcuts</span>
          <button type="button" onClick={onClose} aria-label="Close" className="text-white/50 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SECTIONS.map((section) => (
            <div key={section.title} className="sym-settings__group">
              <div className="sym-lcd-pro__label mb-1.5">{section.title}</div>
              <div className="flex flex-col gap-1">
                {section.items.map(([keys, desc]) => (
                  <div key={keys} className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-white/60">{desc}</span>
                    <kbd className="sym-kbd">{keys}</kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <SymphonyButton variant="default" accent="violet" onClick={onClose}>
            GOT IT
          </SymphonyButton>
        </div>
      </div>
    </div>
  );
}
