import { useRef, useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import type { LayerSettings } from '../../../../types/mixer';
import type { AdCarouselEntry, AdLiveVideoSource, AdZoneSourceKind } from '../../../../types/overlays';
import { MAX_AD_CAROUSEL_ENTRIES } from '../../../../types/overlays';
import { resizeImageForOverlay } from '../../../../lib/imageResize';
import { GraphicsPlacementButtons } from './GraphicsPlacementButtons';
import { cn } from '../../../../lib/utils';

interface AdZoneEditorProps {
  layers: LayerSettings;
  onPatch: (partial: Partial<LayerSettings>) => void;
}

const SOURCE_KINDS: AdZoneSourceKind[] = ['image', 'live-video', 'carousel'];

export function AdZoneEditor({ layers, onPatch }: AdZoneEditorProps) {
  const ad = layers.adZone;
  const [error, setError] = useState<string | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const carouselRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const videoItems = layers.mediaLibrary.filter((m) => m.kind === 'video');

  const uploadImage = async (file: File, apply: (dataUrl: string) => void) => {
    try {
      const { dataUrl } = await resizeImageForOverlay(file, 960, 540);
      apply(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  return (
    <div className="layer-editor-card flex flex-col gap-2">
      <div className="layer-editor-section">
        <div className="layer-field-group">
          <label className="layer-field-label">Ad name</label>
          <input
            className="layer-field-input"
            placeholder="Sponsor Message"
            value={ad.adName}
            onChange={(e) => onPatch({ adZone: { ...ad, adName: e.target.value } })}
          />
        </div>
        <div className="mt-1.5 flex gap-1">
          {SOURCE_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => onPatch({ adZone: { ...ad, sourceKind: kind } })}
              className={cn('mixer-btn flex-1 py-1 text-[8px]', ad.sourceKind === kind && 'mixer-btn-active')}
            >
              {kind.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {ad.sourceKind === 'image' && (
        <div className="layer-editor-section">
          <p className="layer-editor-section-label">Static creative</p>
          {ad.imageDataUrl ? (
            <img src={ad.imageDataUrl} alt="" className="h-16 w-full rounded object-cover" />
          ) : (
            <p className="rounded border border-dashed border-mixer-border py-3 text-center text-[8px] text-mixer-muted">
              No creative loaded
            </p>
          )}
          <button
            type="button"
            className="mixer-btn mt-1 flex w-full items-center justify-center gap-1.5 py-1.5 text-[9px]"
            onClick={() => imageRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            {ad.imageDataUrl ? 'Replace image' : 'Upload image'}
          </button>
          <input
            ref={imageRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void uploadImage(file, (dataUrl) => onPatch({ adZone: { ...ad, imageDataUrl: dataUrl } }));
            }}
          />
        </div>
      )}

      {ad.sourceKind === 'live-video' && (
        <div className="layer-editor-section">
          <p className="layer-editor-section-label">Live video (PiP)</p>
          <select
            className="layer-field-input"
            value={ad.liveVideoSource}
            onChange={(e) =>
              onPatch({ adZone: { ...ad, liveVideoSource: e.target.value as AdLiveVideoSource } })
            }
          >
            <option value="none">None</option>
            <option value="camera">Camera (device)</option>
            <option value="browser">Screen / browser capture</option>
            {videoItems.map((item) => (
              <option key={item.id} value={`media:${item.id}`}>{item.name}</option>
            ))}
          </select>
          <p className="mt-1 text-[8px] text-mixer-green">
            Renders as a muted live <code>&lt;video&gt;</code> in the PGM composite. Camera and screen
            sources ask for permission on first use.
          </p>
          {videoItems.length === 0 && (
            <p className="mt-1 text-[8px] text-mixer-muted">
              No media-library videos yet — upload one in the Media panel to use <code>media:</code> sources.
            </p>
          )}
        </div>
      )}

      {ad.sourceKind === 'carousel' && (
        <div className="layer-editor-section">
          <div className="flex items-center justify-between">
            <p className="layer-editor-section-label">Carousel ({ad.carousel.length}/{MAX_AD_CAROUSEL_ENTRIES})</p>
            {ad.carousel.length < MAX_AD_CAROUSEL_ENTRIES && (
              <button
                type="button"
                className="mixer-btn px-2 py-0.5 text-[8px]"
                onClick={() =>
                  onPatch({
                    adZone: {
                      ...ad,
                      carousel: [
                        ...ad.carousel,
                        {
                          id: crypto.randomUUID(),
                          imageDataUrl: '',
                          caption: '',
                          durationSeconds: ad.rotateIntervalSeconds,
                        },
                      ],
                    },
                  })
                }
              >
                <Plus className="inline h-3 w-3" /> Creative
              </button>
            )}
          </div>
          <div className="flex flex-col gap-1">
            {ad.carousel.map((entry, index) => (
              <div key={entry.id} className="rounded border border-mixer-border bg-black/20 p-1.5">
                <div className="flex items-center gap-1.5">
                  {entry.imageDataUrl ? (
                    <img src={entry.imageDataUrl} alt="" className="h-8 w-12 rounded object-cover" />
                  ) : (
                    <div className="flex h-8 w-12 items-center justify-center rounded bg-slate-900 text-[7px] text-mixer-muted">
                      EMPTY
                    </div>
                  )}
                  <button
                    type="button"
                    className="mixer-btn px-1.5 py-0.5 text-[8px]"
                    onClick={() => carouselRefs.current[entry.id]?.click()}
                  >
                    <Upload className="inline h-3 w-3" /> {entry.imageDataUrl ? 'Replace' : 'Upload'}
                  </button>
                  <label className="flex items-center gap-1 text-[8px] text-mixer-muted">
                    Sec
                    <input
                      type="number"
                      min={2}
                      max={120}
                      className="layer-field-input w-12 px-1 py-0.5"
                      value={entry.durationSeconds}
                      onChange={(e) =>
                        onPatch({
                          adZone: {
                            ...ad,
                            carousel: ad.carousel.map((c: AdCarouselEntry, i: number) =>
                              i === index ? { ...c, durationSeconds: Number(e.target.value) } : c,
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
                      onPatch({ adZone: { ...ad, carousel: ad.carousel.filter((_, i) => i !== index) } })
                    }
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <input
                  className="layer-field-input mt-1 px-1 py-0.5 text-[8px]"
                  placeholder="Caption (optional)"
                  value={entry.caption ?? ''}
                  onChange={(e) =>
                    onPatch({
                      adZone: {
                        ...ad,
                        carousel: ad.carousel.map((c, i) =>
                          i === index ? { ...c, caption: e.target.value } : c,
                        ),
                      },
                    })
                  }
                />
                <input
                  ref={(el) => {
                    carouselRefs.current[entry.id] = el;
                  }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    void uploadImage(file, (dataUrl) =>
                      onPatch({
                        adZone: {
                          ...ad,
                          carousel: ad.carousel.map((c, i) =>
                            i === index ? { ...c, imageDataUrl: dataUrl } : c,
                          ),
                        },
                      }),
                    );
                  }}
                />
              </div>
            ))}
          </div>
          <label className="mt-1 flex items-center gap-1 text-[8px] text-mixer-muted">
            Auto-rotate every
            <input
              type="number"
              min={2}
              max={60}
              className="layer-field-input w-14 px-1 py-0.5"
              value={ad.rotateIntervalSeconds}
              onChange={(e) => onPatch({ adZone: { ...ad, rotateIntervalSeconds: Number(e.target.value) } })}
            />
            sec
          </label>
        </div>
      )}

      <div className="layer-editor-section">
        <p className="layer-editor-section-label">Disclosure &amp; caption</p>
        <label className="flex items-center gap-2 text-[9px]">
          <input
            type="checkbox"
            checked={ad.showAdBadge}
            onChange={(e) => onPatch({ adZone: { ...ad, showAdBadge: e.target.checked } })}
          />
          Show &ldquo;AD&rdquo; disclosure badge
        </label>
        <label className="flex items-center gap-2 text-[9px]">
          <input
            type="checkbox"
            checked={ad.showCaptionBar}
            onChange={(e) => onPatch({ adZone: { ...ad, showCaptionBar: e.target.checked } })}
          />
          Sponsor caption bar
        </label>
        <div className="layer-field-group mt-1">
          <label className="layer-field-label">Sponsor label</label>
          <input
            className="layer-field-input"
            placeholder="PRESENTED BY"
            value={ad.sponsorLabel}
            onChange={(e) => onPatch({ adZone: { ...ad, sponsorLabel: e.target.value } })}
          />
        </div>
      </div>

      <div className="layer-editor-section">
        <p className="layer-editor-section-label">Frame</p>
        <label className="text-[8px] text-mixer-muted">
          Width {ad.widthPercent}%
          <input
            type="range"
            min={12}
            max={60}
            value={ad.widthPercent}
            onChange={(e) => onPatch({ adZone: { ...ad, widthPercent: Number(e.target.value) } })}
            className="w-full accent-mixer-red"
          />
        </label>
        <label className="text-[8px] text-mixer-muted">
          Opacity {ad.opacity}%
          <input
            type="range"
            min={10}
            max={100}
            value={ad.opacity}
            onChange={(e) => onPatch({ adZone: { ...ad, opacity: Number(e.target.value) } })}
            className="w-full accent-mixer-green"
          />
        </label>
        <GraphicsPlacementButtons
          value={ad.position}
          onChange={(position, xPercent, yPercent) =>
            onPatch({ adZone: { ...ad, position, xPercent, yPercent } })
          }
        />
      </div>

      {error && <p className="mixer-panel-notice mixer-panel-notice--error">{error}</p>}
    </div>
  );
}
