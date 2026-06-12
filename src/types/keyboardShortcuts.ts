/** Logical mixer actions that can be bound to keys. */
export type ShortcutActionId =
  | 'source_0'
  | 'source_1'
  | 'source_2'
  | 'source_3'
  | 'source_4'
  | 'source_5'
  | 'source_6'
  | 'source_7'
  | 'source_8'
  | 'source_9'
  | 'cut_source_0'
  | 'cut_source_1'
  | 'cut_source_2'
  | 'cut_source_3'
  | 'cut_source_4'
  | 'cut_source_5'
  | 'cut_source_6'
  | 'cut_source_7'
  | 'cut_source_8'
  | 'cut_source_9'
  | 'cut'
  | 'take'
  | 'fade_black'
  | 'toggle_on_air'
  | 'toggle_multiview'
  | 'toggle_fullscreen'
  | 'toggle_recording'
  | 'swap_pst_pgm';

export type KeyboardShortcutBindings = Record<ShortcutActionId, string>;

export interface ShortcutActionDef {
  id: ShortcutActionId;
  label: string;
  group: 'sources' | 'transport' | 'output';
}

export const SHORTCUT_ACTIONS: ShortcutActionDef[] = [
  { id: 'source_0', label: 'Preview input 1', group: 'sources' },
  { id: 'source_1', label: 'Preview input 2', group: 'sources' },
  { id: 'source_2', label: 'Preview input 3', group: 'sources' },
  { id: 'source_3', label: 'Preview input 4', group: 'sources' },
  { id: 'source_4', label: 'Preview input 5', group: 'sources' },
  { id: 'source_5', label: 'Preview input 6', group: 'sources' },
  { id: 'source_6', label: 'Preview input 7', group: 'sources' },
  { id: 'source_7', label: 'Preview input 8', group: 'sources' },
  { id: 'source_8', label: 'Preview input 9', group: 'sources' },
  { id: 'source_9', label: 'Preview input 10', group: 'sources' },
  { id: 'cut_source_0', label: 'Cut input 1 to PGM', group: 'sources' },
  { id: 'cut_source_1', label: 'Cut input 2 to PGM', group: 'sources' },
  { id: 'cut_source_2', label: 'Cut input 3 to PGM', group: 'sources' },
  { id: 'cut_source_3', label: 'Cut input 4 to PGM', group: 'sources' },
  { id: 'cut_source_4', label: 'Cut input 5 to PGM', group: 'sources' },
  { id: 'cut_source_5', label: 'Cut input 6 to PGM', group: 'sources' },
  { id: 'cut_source_6', label: 'Cut input 7 to PGM', group: 'sources' },
  { id: 'cut_source_7', label: 'Cut input 8 to PGM', group: 'sources' },
  { id: 'cut_source_8', label: 'Cut input 9 to PGM', group: 'sources' },
  { id: 'cut_source_9', label: 'Cut input 10 to PGM', group: 'sources' },
  { id: 'cut', label: 'Cut (PST → PGM instant)', group: 'transport' },
  { id: 'take', label: 'Take / Auto-trans (PST → PGM)', group: 'transport' },
  { id: 'fade_black', label: 'Fade to black', group: 'transport' },
  { id: 'swap_pst_pgm', label: 'Swap PST / PGM', group: 'transport' },
  { id: 'toggle_on_air', label: 'Stream / On air', group: 'output' },
  { id: 'toggle_multiview', label: 'Multiview', group: 'output' },
  { id: 'toggle_fullscreen', label: 'Fullscreen PGM', group: 'output' },
  { id: 'toggle_recording', label: 'Record PGM', group: 'output' },
];

export const DEFAULT_KEYBOARD_SHORTCUTS: KeyboardShortcutBindings = {
  source_0: '1',
  source_1: '2',
  source_2: '3',
  source_3: '4',
  source_4: '5',
  source_5: '6',
  source_6: '7',
  source_7: '8',
  source_8: '9',
  source_9: '0',
  cut_source_0: 'Ctrl+1',
  cut_source_1: 'Ctrl+2',
  cut_source_2: 'Ctrl+3',
  cut_source_3: 'Ctrl+4',
  cut_source_4: 'Ctrl+5',
  cut_source_5: 'Ctrl+6',
  cut_source_6: 'Ctrl+7',
  cut_source_7: 'Ctrl+8',
  cut_source_8: 'Ctrl+9',
  cut_source_9: 'Ctrl+0',
  cut: 'c',
  take: 'Enter',
  fade_black: 'b',
  toggle_on_air: 'o',
  toggle_multiview: 'm',
  toggle_fullscreen: 'f',
  toggle_recording: 'r',
  swap_pst_pgm: 's',
};

/** Also triggers take when bound to Enter (matches ATEM-style Space bar). */
export const SECONDARY_TAKE_KEY = 'Space';
