interface BreakingBannerProps {
  headline: string;
}

export function BreakingBanner({ headline }: BreakingBannerProps) {
  return (
    <div className="absolute left-0 right-0 top-0 z-[19] flex items-center gap-2 bg-gradient-to-r from-red-700 via-red-600 to-red-800 px-3 py-1.5 shadow-lg">
      <span className="animate-pulse rounded bg-white px-1.5 py-0.5 text-[8px] font-black text-red-700">BREAKING</span>
      <span className="truncate text-[11px] font-bold uppercase tracking-wider text-white">{headline}</span>
    </div>
  );
}
