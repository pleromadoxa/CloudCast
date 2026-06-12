import type { TransitionGraphicType } from '../../types/overlays';
import { cn } from '../../lib/utils';

const TYPE_STYLE: Record<TransitionGraphicType, { bg: string }> = {
  breaking: { bg: 'from-red-900 via-red-700 to-black' },
  'coming-up': { bg: 'from-blue-900 via-indigo-800 to-black' },
  sports: { bg: 'from-amber-700 via-orange-800 to-black' },
  weather: { bg: 'from-sky-800 via-cyan-900 to-black' },
};

interface TransitionStingerProps {
  type: TransitionGraphicType;
  title: string;
  headline: string;
}

export function TransitionStinger({ type, title, headline }: TransitionStingerProps) {
  const style = TYPE_STYLE[type];

  return (
    <div
      className={cn(
        'absolute inset-0 z-[25] flex animate-cloudcast-stinger flex-col items-center justify-center bg-gradient-to-br',
        style.bg,
      )}
    >
      <span className="mb-2 max-w-[85%] text-center text-[10px] font-black tracking-[0.35em] text-white/80">
        {title}
      </span>
      <h2 className="max-w-[80%] text-center text-2xl font-black uppercase tracking-tight text-white drop-shadow-lg md:text-4xl">
        {headline}
      </h2>
    </div>
  );
}
