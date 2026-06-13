import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';

interface DisplayCongregationClockProps {
  className?: string;
}

export function DisplayCongregationClock({ className }: DisplayCongregationClockProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <div
      className={cn(
        'pointer-events-none rounded bg-black/50 px-[20px] py-[10px] font-mono text-[32px] font-semibold tracking-wide text-white/90 backdrop-blur-sm',
        className,
      )}
    >
      {time}
    </div>
  );
}
