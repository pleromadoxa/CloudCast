import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface FeatureHintProps {
  children: ReactNode;
  title?: string;
  className?: string;
}

/** Compact inline helper copy for mixer controls. */
export function FeatureHint({ children, title, className }: FeatureHintProps) {
  return (
    <p className={cn('text-[8px] leading-snug text-mixer-muted', className)}>
      {title ? (
        <>
          <span className="font-bold uppercase tracking-wide text-mixer-text/75">{title}</span>
          {' — '}
        </>
      ) : null}
      {children}
    </p>
  );
}
