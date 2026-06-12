import type { KeyboardShortcutBindings } from '../types/keyboardShortcuts';
import { normalizeBindings } from './keyboardBinding';

const STORAGE_KEY = 'cloudcast-keyboard-shortcuts';

export function loadKeyboardShortcuts(): KeyboardShortcutBindings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizeBindings();
    return normalizeBindings(JSON.parse(raw) as Partial<KeyboardShortcutBindings>);
  } catch {
    return normalizeBindings();
  }
}

export function saveKeyboardShortcuts(bindings: KeyboardShortcutBindings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    /* quota */
  }
}
