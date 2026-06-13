import type { ChromaKeySettings } from '../../lib/prism/chromaKey';

interface ChromaKeyPanelProps {
  settings: ChromaKeySettings;
  onChange: (patch: Partial<ChromaKeySettings>) => void;
  disabled?: boolean;
}

const PRESET_COLORS = [
  { label: 'Green', r: 0, g: 177, b: 64 },
  { label: 'Blue', r: 0, g: 71, b: 187 },
  { label: 'Magenta', r: 255, g: 0, b: 255 },
];

export function ChromaKeyPanel({ settings, onChange, disabled }: ChromaKeyPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[10px] font-bold tracking-wider text-amber-400/80">KEY COLOR</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c.label}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ keyColor: { r: c.r, g: c.g, b: c.b } })}
              className="rounded border border-white/10 px-2 py-1 text-[10px] font-bold tracking-wider hover:border-amber-500/50 disabled:opacity-40"
              style={{
                backgroundColor: `rgb(${c.r},${c.g},${c.b})`,
                color: c.g > 150 ? '#000' : '#fff',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {(
        [
          { key: 'similarity' as const, label: 'Similarity', min: 0.1, max: 0.8, step: 0.01 },
          { key: 'smoothness' as const, label: 'Smoothness', min: 0.01, max: 0.3, step: 0.01 },
          { key: 'spill' as const, label: 'Spill Suppression', min: 0, max: 1, step: 0.05 },
          { key: 'lightWrap' as const, label: 'Light Wrap', min: 0, max: 0.5, step: 0.01 },
        ] as const
      ).map(({ key, label, min, max, step }) => (
        <label key={key} className="block">
          <span className="flex justify-between text-[10px] font-bold tracking-wider text-mixer-muted">
            {label}
            <span className="font-mono text-amber-300">{settings[key].toFixed(2)}</span>
          </span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            value={settings[key]}
            onChange={(e) => onChange({ [key]: parseFloat(e.target.value) })}
            className="mt-1 w-full accent-amber-500 disabled:opacity-40"
          />
        </label>
      ))}
    </div>
  );
}
