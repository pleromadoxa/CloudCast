import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import type { LayerSettings } from '../../../../types/mixer';
import type { ScoreboardPossession, ScoreboardStyle, ScoreboardTeam } from '../../../../types/overlays';
import { resizeImageForOverlay } from '../../../../lib/imageResize';
import { GraphicsPlacementButtons } from './GraphicsPlacementButtons';
import { cn } from '../../../../lib/utils';

interface ScoreboardEditorProps {
  layers: LayerSettings;
  onPatch: (partial: Partial<LayerSettings>) => void;
}

const STYLES: ScoreboardStyle[] = ['bug', 'bar', 'fullwidth', 'minimal'];

function TeamEditor({
  team,
  label,
  accentColor,
  onChange,
}: {
  team: ScoreboardTeam;
  label: string;
  accentColor: string;
  onChange: (patch: Partial<ScoreboardTeam>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded border border-mixer-border bg-black/20 p-1.5">
      <p className="text-[8px] font-bold uppercase tracking-wide text-mixer-muted">{label}</p>
      <div className="mt-1 flex items-center gap-1.5">
        {team.logoDataUrl ? (
          <img src={team.logoDataUrl} alt="" className="h-8 w-8 rounded object-contain" />
        ) : (
          <div
            className="flex h-8 w-8 items-center justify-center rounded text-[8px] font-black text-slate-950"
            style={{ backgroundColor: accentColor }}
          >
            {(team.name || '?').slice(0, 2).toUpperCase()}
          </div>
        )}
        <input
          className="layer-field-input flex-1 px-1 py-0.5 text-[9px]"
          placeholder="Team name"
          value={team.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <button
          type="button"
          title={team.logoDataUrl ? 'Replace logo' : 'Upload logo'}
          className="mixer-btn px-1.5 py-1"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-3 w-3" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
              const { dataUrl } = await resizeImageForOverlay(file, 256, 256);
              onChange({ logoDataUrl: dataUrl });
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Upload failed');
            }
          }}
        />
      </div>
      {team.logoDataUrl && (
        <button
          type="button"
          className="mt-1 text-[8px] text-mixer-muted underline hover:text-red-400"
          onClick={() => onChange({ logoDataUrl: null })}
        >
          Remove logo
        </button>
      )}
      <div className="mt-1 flex items-center gap-1">
        <button type="button" className="mixer-btn px-2 py-0.5 text-[9px]" onClick={() => onChange({ score: Math.max(0, team.score - 1) })}>−</button>
        <input
          type="number"
          className="layer-field-input w-14 px-1 py-0.5 text-center text-[10px]"
          value={team.score}
          onChange={(e) => onChange({ score: Math.max(0, Math.round(Number(e.target.value))) })}
        />
        <button type="button" className="mixer-btn px-2 py-0.5 text-[9px]" onClick={() => onChange({ score: team.score + 1 })}>+</button>
      </div>
      {error && <p className="mt-1 text-[8px] text-red-400">{error}</p>}
    </div>
  );
}

export function ScoreboardEditor({ layers, onPatch }: ScoreboardEditorProps) {
  const s = layers.scoreboard;
  const minutes = Math.floor(s.clockSeconds / 60);
  const seconds = s.clockSeconds % 60;

  return (
    <div className="layer-editor-card flex flex-col gap-2">
      <div className="layer-editor-section">
        <p className="layer-editor-section-label">Teams</p>
        <div className="flex flex-col gap-1.5">
          <TeamEditor
            team={s.home}
            label="Home"
            accentColor={s.accentColor}
            onChange={(patch) => onPatch({ scoreboard: { ...s, home: { ...s.home, ...patch } } })}
          />
          <TeamEditor
            team={s.away}
            label="Away"
            accentColor={s.accentColor}
            onChange={(patch) => onPatch({ scoreboard: { ...s, away: { ...s.away, ...patch } } })}
          />
        </div>
      </div>

      <div className="layer-editor-section">
        <p className="layer-editor-section-label">Game state</p>
        <div className="flex items-end gap-2">
          <div className="layer-field-group w-16">
            <label className="layer-field-label">Period</label>
            <input
              className="layer-field-input"
              placeholder="Q3"
              maxLength={8}
              value={s.periodLabel}
              onChange={(e) => onPatch({ scoreboard: { ...s, periodLabel: e.target.value } })}
            />
          </div>
          <div className="layer-field-group w-14">
            <label className="layer-field-label">Min</label>
            <input
              type="number"
              className="layer-field-input"
              value={minutes}
              onChange={(e) =>
                onPatch({
                  scoreboard: { ...s, clockSeconds: Math.max(0, Number(e.target.value)) * 60 + seconds },
                })
              }
            />
          </div>
          <div className="layer-field-group w-14">
            <label className="layer-field-label">Sec</label>
            <input
              type="number"
              className="layer-field-input"
              value={seconds}
              onChange={(e) =>
                onPatch({
                  scoreboard: {
                    ...s,
                    clockSeconds: minutes * 60 + Math.min(59, Math.max(0, Number(e.target.value))),
                  },
                })
              }
            />
          </div>
          <label className="flex items-center gap-1 pb-1 text-[8px] text-mixer-muted">
            <input
              type="checkbox"
              checked={s.clockRunning}
              onChange={(e) => onPatch({ scoreboard: { ...s, clockRunning: e.target.checked } })}
            />
            Run clock
          </label>
        </div>
        <div className="mt-1.5 flex items-center gap-1">
          <span className="text-[8px] text-mixer-muted">Possession</span>
          {(['none', 'home', 'away'] as ScoreboardPossession[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPatch({ scoreboard: { ...s, possession: p } })}
              className={cn('mixer-btn px-2 py-0.5 text-[8px]', s.possession === p && 'mixer-btn-active')}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="layer-editor-section">
        <p className="layer-editor-section-label">Look</p>
        <div className="flex flex-wrap gap-1">
          {STYLES.map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => onPatch({ scoreboard: { ...s, style } })}
              className={cn('mixer-btn px-2 py-1 text-[8px]', s.style === style && 'mixer-btn-active')}
            >
              {style}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-1 text-[8px] text-mixer-muted">
            Accent
            <input
              type="color"
              className="h-6 w-8 cursor-pointer"
              value={s.accentColor}
              onChange={(e) => onPatch({ scoreboard: { ...s, accentColor: e.target.value } })}
            />
          </label>
        </div>
        <label className="mt-1 text-[8px] text-mixer-muted">
          Opacity {s.opacity}%
          <input
            type="range"
            min={10}
            max={100}
            value={s.opacity}
            onChange={(e) => onPatch({ scoreboard: { ...s, opacity: Number(e.target.value) } })}
            className="w-full accent-mixer-green"
          />
        </label>
        <GraphicsPlacementButtons
          value={s.position}
          onChange={(position, xPercent, yPercent) =>
            onPatch({ scoreboard: { ...s, position, xPercent, yPercent } })
          }
        />
      </div>
    </div>
  );
}
