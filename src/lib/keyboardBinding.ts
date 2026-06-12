import type { KeyboardShortcutBindings, ShortcutActionId } from '../types/keyboardShortcuts';
import { DEFAULT_KEYBOARD_SHORTCUTS } from '../types/keyboardShortcuts';

/** Normalize a KeyboardEvent into a binding string e.g. `Ctrl+1`, `Enter`, `Space`. */
export function keyEventToBinding(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  let key = e.key;
  if (key === ' ') key = 'Space';
  else if (key.length === 1) key = key.toLowerCase();
  else if (key === 'Esc') key = 'Escape';

  parts.push(key);
  return parts.join('+');
}

export function formatBindingLabel(binding: string): string {
  return binding.replace(/\+/g, ' + ');
}

export function bindingMatchesEvent(binding: string, e: KeyboardEvent): boolean {
  return keyEventToBinding(e) === binding;
}

export function findActionForEvent(
  bindings: KeyboardShortcutBindings,
  e: KeyboardEvent,
): ShortcutActionId | null {
  const pressed = keyEventToBinding(e);
  for (const [actionId, binding] of Object.entries(bindings) as [ShortcutActionId, string][]) {
    if (binding === pressed) return actionId;
  }
  return null;
}

export function normalizeBindings(input?: Partial<KeyboardShortcutBindings>): KeyboardShortcutBindings {
  return { ...DEFAULT_KEYBOARD_SHORTCUTS, ...input };
}

export function slotIndexFromAction(actionId: ShortcutActionId): number | null {
  const preview = actionId.match(/^source_(\d+)$/);
  if (preview) return Number(preview[1]);
  const cut = actionId.match(/^cut_source_(\d+)$/);
  if (cut) return Number(cut[1]);
  return null;
}
