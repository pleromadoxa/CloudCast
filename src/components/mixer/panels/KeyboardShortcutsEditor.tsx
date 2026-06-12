import { useCallback, useEffect, useState } from 'react';
import type { KeyboardShortcutBindings, ShortcutActionId } from '../../../types/keyboardShortcuts';
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  SHORTCUT_ACTIONS,
} from '../../../types/keyboardShortcuts';
import { formatBindingLabel, keyEventToBinding } from '../../../lib/keyboardBinding';
import { cn } from '../../../lib/utils';

interface KeyboardShortcutsEditorProps {
  bindings: KeyboardShortcutBindings;
  onChange: (bindings: KeyboardShortcutBindings) => void;
  onAssigningChange?: (assigning: boolean) => void;
}

const PREVIEW_SLOTS = Array.from({ length: 10 }, (_, i) => ({
  id: `source_${i}` as ShortcutActionId,
  input: i === 9 ? '10' : String(i + 1),
}));

const CUT_SLOTS = Array.from({ length: 10 }, (_, i) => ({
  id: `cut_source_${i}` as ShortcutActionId,
  input: i === 9 ? '10' : String(i + 1),
}));

const TRANSPORT_ACTIONS = SHORTCUT_ACTIONS.filter((a) => a.group === 'transport');
const OUTPUT_ACTIONS = SHORTCUT_ACTIONS.filter((a) => a.group === 'output');

function shortLabel(label: string): string {
  return label
    .replace('Preview input ', 'IN ')
    .replace('Cut input ', 'CUT ')
    .replace(' to PGM', '')
    .replace(' (PST → PGM instant)', '')
    .replace(' / Auto-trans (PST → PGM)', '')
    .replace('Fade to black', 'FTB')
    .replace('Swap PST / PGM', 'SWAP')
    .replace('Stream / On air', 'STREAM')
    .replace('Multiview', 'MULTI');
}

interface ShortcutPadProps {
  actionId: ShortcutActionId;
  label: string;
  binding: string;
  assigning: ShortcutActionId | null;
  onAssign: (id: ShortcutActionId) => void;
  size?: 'sm' | 'md' | 'lg';
}

function ShortcutPad({ actionId, label, binding, assigning, onAssign, size = 'sm' }: ShortcutPadProps) {
  return (
    <button
      type="button"
      title={`${label} — click to rebind`}
      onClick={() => onAssign(actionId)}
      className={cn(
        'shortcut-pad deck-pad-btn',
        size === 'md' && 'shortcut-pad-md',
        size === 'lg' && 'shortcut-pad-lg',
        assigning === actionId && 'atem-toggle-on',
      )}
    >
      <span className="shortcut-pad-label">{shortLabel(label)}</span>
      <span className="shortcut-pad-key">{formatBindingLabel(binding)}</span>
    </button>
  );
}

export function KeyboardShortcutsEditor({ bindings, onChange, onAssigningChange }: KeyboardShortcutsEditorProps) {
  const [assigning, setAssigning] = useState<ShortcutActionId | null>(null);

  useEffect(() => {
    onAssigningChange?.(assigning !== null);
  }, [assigning, onAssigningChange]);

  const captureKey = useCallback(
    (e: KeyboardEvent) => {
      if (!assigning) return;
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setAssigning(null);
        return;
      }

      const next = keyEventToBinding(e);
      if (!next || next === 'Ctrl+Escape') return;

      const previous = bindings[assigning];
      const conflicting = (Object.entries(bindings) as [ShortcutActionId, string][]).find(
        ([id, binding]) => id !== assigning && binding === next,
      )?.[0];

      const updated = { ...bindings, [assigning]: next };
      if (conflicting) updated[conflicting] = previous;
      onChange(updated);
      setAssigning(null);
    },
    [assigning, bindings, onChange],
  );

  useEffect(() => {
    if (!assigning) return;
    window.addEventListener('keydown', captureKey, true);
    return () => window.removeEventListener('keydown', captureKey, true);
  }, [assigning, captureKey]);

  const assigningLabel = SHORTCUT_ACTIONS.find((a) => a.id === assigning)?.label;

  return (
    <div className="shortcut-editor">
      <div className="shortcut-editor-toolbar">
        <p className="text-[9px] text-mixer-muted">Tap any pad to rebind · Esc cancels</p>
        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_KEYBOARD_SHORTCUTS })}
          className="deck-pad-btn px-3 py-1 text-[9px]"
        >
          Reset defaults
        </button>
      </div>

      {assigning && (
        <div className="shortcut-assign-banner">
          Press new key for: <strong>{assigningLabel}</strong>
        </div>
      )}

      <div className="shortcut-deck">
        <div className="shortcut-deck-col">
          <p className="shortcut-deck-title">Camera inputs</p>
          <p className="shortcut-deck-hint">Preview bus (PST)</p>
          <div className="shortcut-pad-grid-5">
            {PREVIEW_SLOTS.map((slot) => (
              <ShortcutPad
                key={slot.id}
                actionId={slot.id}
                label={`Preview input ${slot.input}`}
                binding={bindings[slot.id]}
                assigning={assigning}
                onAssign={setAssigning}
              />
            ))}
          </div>
          <p className="shortcut-deck-hint mt-2">Cut straight to PGM</p>
          <div className="shortcut-pad-grid-5">
            {CUT_SLOTS.map((slot) => (
              <ShortcutPad
                key={slot.id}
                actionId={slot.id}
                label={`Cut input ${slot.input} to PGM`}
                binding={bindings[slot.id]}
                assigning={assigning}
                onAssign={setAssigning}
              />
            ))}
          </div>
        </div>

        <div className="shortcut-deck-col">
          <p className="shortcut-deck-title">Transitions</p>
          <div className="shortcut-pad-stack">
            {TRANSPORT_ACTIONS.map((action) => (
              <ShortcutPad
                key={action.id}
                actionId={action.id}
                label={action.label}
                binding={bindings[action.id]}
                assigning={assigning}
                onAssign={setAssigning}
                size="md"
              />
            ))}
          </div>
        </div>

        <div className="shortcut-deck-col shortcut-deck-col-narrow">
          <p className="shortcut-deck-title">Output</p>
          <div className="shortcut-pad-stack">
            {OUTPUT_ACTIONS.map((action) => (
              <ShortcutPad
                key={action.id}
                actionId={action.id}
                label={action.label}
                binding={bindings[action.id]}
                assigning={assigning}
                onAssign={setAssigning}
                size="md"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
