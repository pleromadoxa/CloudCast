import type { LayerSettings } from '../../../../types/mixer';
import type { CountdownMode } from '../../../../types/overlays';
import { GraphicsPlacementButtons } from './GraphicsPlacementButtons';
import { cn } from '../../../../lib/utils';

interface CountdownEditorProps {
  layers: LayerSettings;
  onPatch: (partial: Partial<LayerSettings>) => void;
}

const MODES: CountdownMode[] = ['countdown', 'count-up', 'time-of-day'];

export function CountdownEditor({ layers, onPatch }: CountdownEditorProps) {
  const c = layers.countdown;
  const minutes = Math.floor(c.targetSeconds / 60);
  const seconds = c.targetSeconds % 60;

  return (
    <div className="layer-editor-card flex flex-col gap-2">
      <div className="layer-editor-section">
        <p className="layer-editor-section-label">Mode</p>
        <div className="flex gap-1">
          {MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onPatch({ countdown: { ...c, mode } })}
              className={cn('mixer-btn flex-1 py-1 text-[8px]', c.mode === mode && 'mixer-btn-active')}
            >
              {mode.replace('-', ' ')}
            </button>
          ))}
        </div>

        {c.mode !== 'time-of-day' && (
          <div className="mt-1.5 flex items-end gap-2">
            <div className="layer-field-group w-16">
              <label className="layer-field-label">Minutes</label>
              <input
                type="number"
                className="layer-field-input"
                value={minutes}
                onChange={(e) =>
                  onPatch({
                    countdown: {
                      ...c,
                      targetSeconds: Math.max(0, Number(e.target.value)) * 60 + seconds,
                    },
                  })
                }
              />
            </div>
            <div className="layer-field-group w-16">
              <label className="layer-field-label">Seconds</label>
              <input
                type="number"
                className="layer-field-input"
                value={seconds}
                onChange={(e) =>
                  onPatch({
                    countdown: {
                      ...c,
                      targetSeconds: minutes * 60 + Math.min(59, Math.max(0, Number(e.target.value))),
                    },
                  })
                }
              />
            </div>
            <p className="pb-1 text-[8px] text-mixer-muted">
              {c.mode === 'countdown' ? 'Counts down to zero' : 'Counts up to target'}
            </p>
          </div>
        )}
      </div>

      <div className="layer-editor-section">
        <div className="layer-field-group">
          <label className="layer-field-label">Title</label>
          <input
            className="layer-field-input"
            placeholder="ON AIR IN"
            value={c.title}
            onChange={(e) => onPatch({ countdown: { ...c, title: e.target.value } })}
          />
        </div>
        <div className="layer-field-group mt-1.5">
          <label className="layer-field-label">Caption</label>
          <input
            className="layer-field-input"
            placeholder="Stay tuned for live coverage"
            value={c.label}
            onChange={(e) => onPatch({ countdown: { ...c, label: e.target.value } })}
          />
        </div>
      </div>

      <div className="layer-editor-section">
        <p className="layer-editor-section-label">Look</p>
        <label className="flex items-center gap-2 text-[9px]">
          <input
            type="checkbox"
            checked={c.showRing}
            onChange={(e) => onPatch({ countdown: { ...c, showRing: e.target.checked } })}
          />
          Progress ring
        </label>
        {c.mode === 'countdown' && (
          <label className="flex items-center gap-2 text-[9px]">
            <input
              type="checkbox"
              checked={c.autoHideAtZero}
              onChange={(e) => onPatch({ countdown: { ...c, autoHideAtZero: e.target.checked } })}
            />
            Auto-hide at zero
          </label>
        )}
        <div className="mt-1 flex items-center gap-2">
          <label className="flex items-center gap-1 text-[8px] text-mixer-muted">
            Accent
            <input
              type="color"
              className="h-6 w-8 cursor-pointer"
              value={c.accentColor}
              onChange={(e) => onPatch({ countdown: { ...c, accentColor: e.target.value } })}
            />
          </label>
          <label className="ml-auto text-[8px] text-mixer-muted">
            Opacity {c.opacity}%
            <input
              type="range"
              min={10}
              max={100}
              value={c.opacity}
              onChange={(e) => onPatch({ countdown: { ...c, opacity: Number(e.target.value) } })}
              className="ml-1 w-24 accent-mixer-green"
            />
          </label>
        </div>
        <GraphicsPlacementButtons
          value={c.position}
          onChange={(position, xPercent, yPercent) =>
            onPatch({ countdown: { ...c, position, xPercent, yPercent } })
          }
        />
        <p className="mt-1 text-[8px] text-mixer-green">
          The clock starts when the layer mounts — take it live and it runs.
        </p>
      </div>
    </div>
  );
}
