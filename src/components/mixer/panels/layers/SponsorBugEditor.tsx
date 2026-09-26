import { useRef, useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import type { LayerSettings } from '../../../../types/mixer';
import { MAX_SPONSOR_BUG_ENTRIES } from '../../../../types/overlays';
import { resizeImageForOverlay } from '../../../../lib/imageResize';
import { GraphicsPlacementButtons } from './GraphicsPlacementButtons';

interface SponsorBugEditorProps {
  layers: LayerSettings;
  onPatch: (partial: Partial<LayerSettings>) => void;
}

export function SponsorBugEditor({ layers, onPatch }: SponsorBugEditorProps) {
  const bug = layers.sponsorBug;
  const [error, setError] = useState<string | null>(null);
  const logoRefs = useRef<Record<string, HTMLInputElement | null>>({});

  return (
    <div className="layer-editor-card flex flex-col gap-2">
      <div className="layer-editor-section">
        <div className="flex items-center justify-between">
          <p className="layer-editor-section-label">Sponsors ({bug.entries.length}/{MAX_SPONSOR_BUG_ENTRIES})</p>
          {bug.entries.length < MAX_SPONSOR_BUG_ENTRIES && (
            <button
              type="button"
              className="mixer-btn px-2 py-0.5 text-[8px]"
              onClick={() =>
                onPatch({
                  sponsorBug: {
                    ...bug,
                    entries: [
                      ...bug.entries,
                      { id: crypto.randomUUID(), logoDataUrl: '', label: '', seconds: 8 },
                    ],
                  },
                })
              }
            >
              <Plus className="inline h-3 w-3" /> Sponsor
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1">
          {bug.entries.length === 0 && (
            <p className="rounded border border-dashed border-mixer-border py-3 text-center text-[8px] text-mixer-muted">
              Add sponsors — each rotates in the corner bug
            </p>
          )}
          {bug.entries.map((entry, index) => (
            <div key={entry.id} className="rounded border border-mixer-border bg-black/20 p-1.5">
              <div className="flex items-center gap-1.5">
                {entry.logoDataUrl ? (
                  <img src={entry.logoDataUrl} alt="" className="h-8 w-10 rounded object-contain" />
                ) : (
                  <div className="flex h-8 w-10 items-center justify-center rounded bg-slate-900 text-[7px] text-mixer-muted">
                    LOGO
                  </div>
                )}
                <button
                  type="button"
                  className="mixer-btn px-1.5 py-0.5 text-[8px]"
                  onClick={() => logoRefs.current[entry.id]?.click()}
                >
                  <Upload className="inline h-3 w-3" /> {entry.logoDataUrl ? 'Replace logo' : 'Upload logo'}
                </button>
                <label className="flex items-center gap-1 text-[8px] text-mixer-muted">
                  Sec
                  <input
                    type="number"
                    min={2}
                    max={60}
                    className="layer-field-input w-12 px-1 py-0.5"
                    value={entry.seconds}
                    onChange={(e) =>
                      onPatch({
                        sponsorBug: {
                          ...bug,
                          entries: bug.entries.map((s, i) =>
                            i === index ? { ...s, seconds: Number(e.target.value) } : s,
                          ),
                        },
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="ml-auto text-mixer-muted hover:text-red-400"
                  onClick={() =>
                    onPatch({ sponsorBug: { ...bug, entries: bug.entries.filter((_, i) => i !== index) } })
                  }
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <input
                className="layer-field-input mt-1 px-1 py-0.5 text-[8px]"
                placeholder="Label (optional)"
                value={entry.label ?? ''}
                onChange={(e) =>
                  onPatch({
                    sponsorBug: {
                      ...bug,
                      entries: bug.entries.map((s, i) =>
                        i === index ? { ...s, label: e.target.value } : s,
                      ),
                    },
                  })
                }
              />
              <input
                ref={(el) => {
                  logoRefs.current[entry.id] = el;
                }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  try {
                    const { dataUrl } = await resizeImageForOverlay(file, 320, 320);
                    onPatch({
                      sponsorBug: {
                        ...bug,
                        entries: bug.entries.map((s, i) =>
                          i === index ? { ...s, logoDataUrl: dataUrl } : s,
                        ),
                      },
                    });
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Upload failed');
                  }
                }}
              />
            </div>
          ))}
        </div>
        {error && <p className="mixer-panel-notice mixer-panel-notice--error">{error}</p>}
      </div>

      <div className="layer-editor-section">
        <p className="layer-editor-section-label">Frame</p>
        <label className="text-[8px] text-mixer-muted">
          Size {bug.size}%
          <input
            type="range"
            min={6}
            max={30}
            value={bug.size}
            onChange={(e) => onPatch({ sponsorBug: { ...bug, size: Number(e.target.value) } })}
            className="w-full accent-mixer-red"
          />
        </label>
        <label className="text-[8px] text-mixer-muted">
          Opacity {bug.opacity}%
          <input
            type="range"
            min={10}
            max={100}
            value={bug.opacity}
            onChange={(e) => onPatch({ sponsorBug: { ...bug, opacity: Number(e.target.value) } })}
            className="w-full accent-mixer-green"
          />
        </label>
        <GraphicsPlacementButtons
          value={bug.position}
          onChange={(position, xPercent, yPercent) =>
            onPatch({ sponsorBug: { ...bug, position, xPercent, yPercent } })
          }
        />
      </div>
    </div>
  );
}
