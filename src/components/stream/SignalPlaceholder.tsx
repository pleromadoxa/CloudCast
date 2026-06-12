import { WifiOff } from 'lucide-react';
import { CloudCastLogo } from '../brand/CloudCastLogo';
import { cn } from '../../lib/utils';

type SignalVariant = 'no-signal' | 'offline';

interface SignalPlaceholderProps {
  variant: SignalVariant;
  compact?: boolean;
  className?: string;
}

const COPY: Record<SignalVariant, { title: string; hint: string }> = {
  'no-signal': {
    title: 'NO SIGNAL',
    hint: 'Assign a camera to this input',
  },
  offline: {
    title: 'OFFLINE',
    hint: 'Pair your camera with the access code, then tap Go Live',
  },
};

export function SignalPlaceholder({ variant, compact = false, className }: SignalPlaceholderProps) {
  const { title, hint } = COPY[variant];

  return (
    <div
      className={cn(
        'flex h-full flex-col items-center justify-center gap-1.5 px-3 text-center text-mixer-muted',
        className,
      )}
    >
      {variant === 'offline' && (
        <WifiOff className={compact ? 'h-4 w-4' : 'h-8 w-8'} />
      )}
      <span className={cn('font-bold tracking-wider', compact ? 'text-[8px]' : 'text-xs')}>
        {title}
      </span>
      <CloudCastLogo
        variant="dark-header"
        className={cn('opacity-70', compact ? 'mt-0.5 h-3' : 'mt-1 h-5')}
      />
      <span
        className={cn(
          'max-w-[14rem] leading-snug text-mixer-muted/90',
          compact ? 'text-[7px]' : 'text-[10px]',
        )}
      >
        {hint}
      </span>
    </div>
  );
}
