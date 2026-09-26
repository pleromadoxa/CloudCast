import { Plus, Trash2 } from 'lucide-react';
import type { LayerSettings } from '../../../../types/mixer';
import type { TemperatureUnit, WeatherForecastDay, WeatherIconId } from '../../../../types/overlays';
import { MAX_WEATHER_FORECAST_DAYS } from '../../../../types/overlays';
import { WeatherGlyph } from '../../../overlays/WeatherPanel';
import { GraphicsPlacementButtons } from './GraphicsPlacementButtons';
import { cn } from '../../../../lib/utils';

interface WeatherPanelEditorProps {
  layers: LayerSettings;
  onPatch: (partial: Partial<LayerSettings>) => void;
}

const ICONS: WeatherIconId[] = ['sun', 'cloud', 'rain', 'snow', 'storm', 'wind', 'fog'];
const STYLES: Array<LayerSettings['weather']['style']> = ['slate', 'glass', 'minimal', 'ticker-pill'];

function patchForecast(
  layers: LayerSettings,
  onPatch: (partial: Partial<LayerSettings>) => void,
  index: number,
  patch: Partial<WeatherForecastDay>,
) {
  onPatch({
    weather: {
      ...layers.weather,
      forecast: layers.weather.forecast.map((day, i) => (i === index ? { ...day, ...patch } : day)),
    },
  });
}

export function WeatherPanelEditor({ layers, onPatch }: WeatherPanelEditorProps) {
  const w = layers.weather;
  return (
    <div className="layer-editor-card flex flex-col gap-2">
      <div className="layer-editor-section">
        <p className="layer-editor-section-label">Current conditions</p>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="layer-field-group">
            <label className="layer-field-label">Location</label>
            <input
              className="layer-field-input"
              placeholder="NEW YORK"
              value={w.location}
              onChange={(e) => onPatch({ weather: { ...w, location: e.target.value } })}
            />
          </div>
          <div className="layer-field-group">
            <label className="layer-field-label">Condition</label>
            <input
              className="layer-field-input"
              placeholder="Partly Cloudy"
              value={w.condition}
              onChange={(e) => onPatch({ weather: { ...w, condition: e.target.value } })}
            />
          </div>
        </div>
        <div className="mt-1.5 flex items-end gap-2">
          <div className="layer-field-group w-24">
            <label className="layer-field-label">Temperature</label>
            <input
              type="number"
              className="layer-field-input"
              value={w.temperature}
              onChange={(e) => onPatch({ weather: { ...w, temperature: Number(e.target.value) } })}
            />
          </div>
          <div className="flex gap-0.5">
            {(['C', 'F'] as TemperatureUnit[]).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => onPatch({ weather: { ...w, unit: u } })}
                className={cn('mixer-btn px-2.5 py-1 text-[9px]', w.unit === u && 'mixer-btn-active')}
              >
                °{u}
              </button>
            ))}
          </div>
          <label className="ml-auto flex items-center gap-1 text-[8px] text-mixer-muted">
            <input
              type="checkbox"
              checked={w.showClock}
              onChange={(e) => onPatch({ weather: { ...w, showClock: e.target.checked } })}
            />
            Live clock
          </label>
        </div>
      </div>

      <div className="layer-editor-section">
        <p className="layer-editor-section-label">Icon</p>
        <div className="flex flex-wrap gap-1">
          {ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              title={icon}
              onClick={() => onPatch({ weather: { ...w, icon } })}
              className={cn(
                'mixer-btn flex h-8 w-8 items-center justify-center',
                w.icon === icon && 'mixer-btn-active',
              )}
            >
              <WeatherGlyph icon={icon} className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      <div className="layer-editor-section">
        <div className="flex items-center justify-between">
          <p className="layer-editor-section-label">Forecast ({w.forecast.length}/{MAX_WEATHER_FORECAST_DAYS})</p>
          {w.forecast.length < MAX_WEATHER_FORECAST_DAYS && (
            <button
              type="button"
              className="mixer-btn px-2 py-0.5 text-[8px]"
              onClick={() =>
                onPatch({
                  weather: {
                    ...w,
                    forecast: [
                      ...w.forecast,
                      { day: `D${w.forecast.length + 1}`, icon: 'cloud', hi: 20, lo: 12 },
                    ],
                  },
                })
              }
            >
              <Plus className="inline h-3 w-3" /> Day
            </button>
          )}
        </div>
        <div className="flex flex-col gap-1">
          {w.forecast.map((day, index) => (
            <div key={index} className="flex items-center gap-1 rounded border border-mixer-border bg-black/20 p-1">
              <input
                className="layer-field-input w-14 px-1 py-0.5 text-[8px]"
                value={day.day}
                maxLength={6}
                onChange={(e) => patchForecast(layers, onPatch, index, { day: e.target.value })}
              />
              <select
                className="layer-field-input w-16 px-1 py-0.5 text-[8px]"
                value={day.icon}
                onChange={(e) => patchForecast(layers, onPatch, index, { icon: e.target.value as WeatherIconId })}
              >
                {ICONS.map((icon) => (
                  <option key={icon} value={icon}>{icon}</option>
                ))}
              </select>
              <input
                type="number"
                className="layer-field-input w-12 px-1 py-0.5 text-[8px]"
                value={day.hi}
                onChange={(e) => patchForecast(layers, onPatch, index, { hi: Number(e.target.value) })}
              />
              <input
                type="number"
                className="layer-field-input w-12 px-1 py-0.5 text-[8px]"
                value={day.lo}
                onChange={(e) => patchForecast(layers, onPatch, index, { lo: Number(e.target.value) })}
              />
              <button
                type="button"
                className="ml-auto text-mixer-muted hover:text-red-400"
                onClick={() =>
                  onPatch({ weather: { ...w, forecast: w.forecast.filter((_, i) => i !== index) } })
                }
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
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
              onClick={() => onPatch({ weather: { ...w, style } })}
              className={cn('mixer-btn px-2 py-1 text-[8px]', w.style === style && 'mixer-btn-active')}
            >
              {style}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-1 text-[8px] text-mixer-muted">
            Accent
            <input
              type="color"
              className="h-6 w-8 cursor-pointer"
              value={w.accentColor}
              onChange={(e) => onPatch({ weather: { ...w, accentColor: e.target.value } })}
            />
          </label>
        </div>
        <label className="mt-1 text-[8px] text-mixer-muted">
          Opacity {w.opacity}%
          <input
            type="range"
            min={10}
            max={100}
            value={w.opacity}
            onChange={(e) => onPatch({ weather: { ...w, opacity: Number(e.target.value) } })}
            className="w-full accent-mixer-green"
          />
        </label>
        <GraphicsPlacementButtons
          value={w.position}
          onChange={(position, xPercent, yPercent) =>
            onPatch({ weather: { ...w, position, xPercent, yPercent } })
          }
        />
      </div>
    </div>
  );
}
