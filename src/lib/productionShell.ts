import type { CSSProperties } from 'react';

export const PRODUCTION_OFFSCREEN_STYLE: CSSProperties = {
  left: -10000,
  top: 0,
  width: '100%',
  height: '100%',
};

export function productionShellClass(hidden: boolean, visibleClass: string): string {
  return hidden ? 'pointer-events-none fixed opacity-0' : visibleClass;
}
