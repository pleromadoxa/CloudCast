import { useEffect, useRef } from 'react';
import type { LayerSettings } from '../../../../types/mixer';
import type { LayerStackId } from './layerStackTypes';

interface LayerTextEntryProps {
  layerId: LayerStackId;
  layers: LayerSettings;
  onPatch: (partial: Partial<LayerSettings>) => void;
}

export function LayerTextEntry({ layerId, layers, onPatch }: LayerTextEntryProps) {
  const primaryRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = setTimeout(() => primaryRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [layerId]);

  if (layerId === 'breaking' || layerId === 'transition') {
    return null;
  }

  if (layerId === 'lower-third') {
    return (
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <div className="layer-field-group">
          <label className="layer-field-label">Headline</label>
          <input
            ref={primaryRef as React.RefObject<HTMLInputElement>}
            className="layer-field-input"
            placeholder="Main title"
            value={layers.lowerThirdText}
            onChange={(e) => onPatch({ lowerThirdText: e.target.value })}
          />
        </div>
        <div className="layer-field-group">
          <label className="layer-field-label">Subline</label>
          <input
            className="layer-field-input"
            placeholder="Subtitle or location"
            value={layers.lowerThirdSubtext}
            onChange={(e) => onPatch({ lowerThirdSubtext: e.target.value })}
          />
        </div>
      </div>
    );
  }

  if (layerId === 'live-button') {
    return (
      <div className="layer-field-group">
        <label className="layer-field-label">Button label</label>
        <input
          ref={primaryRef as React.RefObject<HTMLInputElement>}
          className="layer-field-input"
          placeholder="LIVE"
          value={layers.liveButton.label}
          onChange={(e) => onPatch({ liveButton: { ...layers.liveButton, label: e.target.value } })}
        />
      </div>
    );
  }

  if (layerId === 'logo' && layers.programLogo.mode === 'text') {
    return (
      <div className="layer-field-group">
        <label className="layer-field-label">Logo text</label>
        <input
          ref={primaryRef as React.RefObject<HTMLInputElement>}
          className="layer-field-input"
          placeholder="CLOUDCAST"
          value={layers.programLogo.text}
          onChange={(e) => onPatch({ programLogo: { ...layers.programLogo, text: e.target.value } })}
        />
      </div>
    );
  }

  if (layerId === 'crawler') {
    return (
      <div className="layer-field-group">
        <label className="layer-field-label">Ticker text</label>
        <textarea
          ref={primaryRef as React.RefObject<HTMLTextAreaElement>}
          className="layer-field-input min-h-[52px] resize-none"
          placeholder="Scrolling news text…"
          rows={2}
          value={layers.crawler.text}
          onChange={(e) => onPatch({ crawler: { ...layers.crawler, text: e.target.value } })}
        />
      </div>
    );
  }

  if (layerId.startsWith('image:')) {
    return null;
  }

  return null;
}
