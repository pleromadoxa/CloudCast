import type { LayerSettings } from '../../../../types/mixer';

interface BreakingBannerEditorProps {
  layers: LayerSettings;
  onPatch: (partial: Partial<LayerSettings>) => void;
}

export function BreakingBannerEditor({ layers, onPatch }: BreakingBannerEditorProps) {
  return (
    <div className="layer-editor-card">
      <div className="layer-editor-section">
        <p className="layer-editor-section-label">Banner text</p>
        <div className="layer-field-group">
          <label className="layer-field-label">Headline</label>
          <input
            className="layer-field-input"
            placeholder="BREAKING NEWS"
            value={layers.breakingNews.headline}
            onChange={(e) =>
              onPatch({ breakingNews: { ...layers.breakingNews, headline: e.target.value } })
            }
          />
        </div>
        <p className="text-[8px] text-mixer-muted">
          Shows as a red top banner on preview. Toggle the eye in the stack to preview, then push to PGM.
        </p>
      </div>
    </div>
  );
}
