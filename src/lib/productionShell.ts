import { cn } from './utils';

/** Shared stacking for production consoles kept alive inside ProductionHost. */
export function productionShellClass(hidden: boolean, visibleClass: string): string {
  const stack = 'absolute inset-0 min-h-0 overflow-hidden';
  if (hidden) {
    return cn(stack, 'pointer-events-none hidden z-0');
  }
  return cn(stack, 'z-10', visibleClass);
}
