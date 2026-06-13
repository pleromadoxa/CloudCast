import { usePrismFeed } from '../../context/PrismFeedContext';

export function PrismGraphicsPanel() {
  const { state, setLowerThird } = usePrismFeed();
  const lt = state.lowerThird;

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={lt.visible}
          onChange={(e) => setLowerThird({ visible: e.target.checked })}
        />
        Show lower third on program output
      </label>
      <label className="block">
        <span className="text-[10px] font-bold tracking-wider text-mixer-muted">TITLE</span>
        <input
          type="text"
          value={lt.title}
          onChange={(e) => setLowerThird({ title: e.target.value })}
          placeholder="Guest name or headline"
          className="mt-1 w-full rounded border border-white/10 bg-black px-2 py-1.5 text-xs outline-none focus:border-amber-500/40"
        />
      </label>
      <label className="block">
        <span className="text-[10px] font-bold tracking-wider text-mixer-muted">SUBTITLE</span>
        <input
          type="text"
          value={lt.subtitle}
          onChange={(e) => setLowerThird({ subtitle: e.target.value })}
          placeholder="Title, location, or ticker"
          className="mt-1 w-full rounded border border-white/10 bg-black px-2 py-1.5 text-xs outline-none focus:border-amber-500/40"
        />
      </label>
      <div className="rounded border border-white/10 bg-black/50 p-2">
        <div className="border-l-4 border-amber-500 bg-black/80 px-2 py-1.5">
          <p className="text-xs font-bold text-white">{lt.title || 'Title preview'}</p>
          {lt.subtitle && <p className="text-[10px] text-white/80">{lt.subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
