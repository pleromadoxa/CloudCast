export type PipCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface PrismSecondarySlot {
  id: string;
  /** local device id, mobile device id, or empty when inactive */
  sourceId: string;
  label: string;
  corner: PipCorner;
  active: boolean;
  keyed: boolean;
}

export function createSecondarySlot(index: number, corner: PipCorner): PrismSecondarySlot {
  return {
    id: `pip-${index}`,
    sourceId: '',
    label: `Camera ${index + 2}`,
    corner,
    active: false,
    keyed: true,
  };
}

export const DEFAULT_SECONDARY_SLOTS: PrismSecondarySlot[] = [
  createSecondarySlot(0, 'bottom-right'),
  createSecondarySlot(1, 'bottom-left'),
  createSecondarySlot(2, 'top-right'),
];
