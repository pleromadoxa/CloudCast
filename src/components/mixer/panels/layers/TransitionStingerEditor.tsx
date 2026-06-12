import { Zap } from 'lucide-react';
import type { LayerSettings } from '../../../../types/mixer';
import type { TransitionGraphicType } from '../../../../types/overlays';
import { STINGER_TYPE_DEFAULTS } from '../../../../types/overlays';
import { cn } from '../../../../lib/utils';

const STINGER_STYLES: { type: TransitionGraphicType; label: string }[] = [
  { type: 'breaking', label: 'Breaking' },
  { type: 'coming-up', label: 'Coming Up' },
  { type: 'sports', label: 'Sports' },
  { type: 'weather', label: 'Weather' },
];

interface TransitionStingerEditorProps {
  layers: LayerSettings;
  onPatch: (partial: Partial<LayerSettings>) => void;
  onFire: (type: TransitionGraphicType, title: string, headline: string) => void;
}

export function TransitionStingerEditor({ layers, onPatch, onFire }: TransitionStingerEditorProps) {
  const tg = layers.transitionGraphic;

  const selectStyle = (type: TransitionGraphicType) => {
    const defs = STINGER_TYPE_DEFAULTS[type];
    const switching = tg.type !== type;
    onPatch({
      transitionGraphic: {
        ...tg,
        type,
        title: switching ? defs.title : tg.title || defs.title,
        headline: tg.headline || defs.headline,
      },
    });
  };

  return (
    <div className="layer-editor-card">
      <div className="layer-editor-section">
        <p className="layer-editor-section-label">On-screen copy</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="layer-field-group">
            <label className="layer-field-label">Title</label>
            <input
              className="layer-field-input"
              placeholder="BREAKING NEWS"
              value={tg.title}
              onChange={(e) => onPatch({ transitionGraphic: { ...tg, title: e.target.value } })}
            />
          </div>
          <div className="layer-field-group">
            <label className="layer-field-label">Headline</label>
            <input
              className="layer-field-input"
              placeholder="LIVE COVERAGE"
              value={tg.headline}
              onChange={(e) => onPatch({ transitionGraphic: { ...tg, headline: e.target.value } })}
            />
          </div>
        </div>
      </div>

      <div className="layer-editor-section">
        <p className="layer-editor-section-label">Look</p>
        <div className="grid grid-cols-4 gap-1">
          {STINGER_STYLES.map((s) => (
            <button
              key={s.type}
              type="button"
              onClick={() => selectStyle(s.type)}
              className={cn('mixer-btn py-2 text-[9px] font-bold', tg.type === s.type && 'mixer-btn-active')}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="layer-editor-section">
        <button
          type="button"
          onClick={() => onFire(tg.type, tg.title, tg.headline)}
          className="mixer-btn flex w-full items-center justify-center gap-1.5 py-3 text-[11px] font-bold atem-toggle-on"
        >
          <Zap className="h-4 w-4" /> Fire stinger on PGM
        </button>
        <p className="text-center text-[8px] text-mixer-muted">Fullscreen animation · ~3 seconds</p>
      </div>
    </div>
  );
}
