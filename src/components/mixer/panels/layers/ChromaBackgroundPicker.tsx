import { useEffect, useRef } from 'react';
import {
  CHROMA_BACKGROUND_PRESETS,
  type ChromaBackgroundCategory,
  type ChromaBackgroundId,
} from '../../../../types/chromaBackgrounds';
import { renderChromaBackground } from '../../../../lib/chromaBackgrounds';
import { cn } from '../../../../lib/utils';

interface ChromaBackgroundPickerProps {
  selectedId: ChromaBackgroundId;
  onSelect: (id: ChromaBackgroundId) => void;
}

const CATEGORY_LABELS: Record<ChromaBackgroundCategory, string> = {
  plain: 'Plain',
  gradient: 'Gradients',
  animated: 'Animated',
};

function BackgroundThumb({ id, active, onClick }: { id: ChromaBackgroundId; active: boolean; onClick: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const preset = CHROMA_BACKGROUND_PRESETS.find((p) => p.id === id)!;
  const isAnimated = preset.category === 'animated';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const draw = (time: number) => {
      renderChromaBackground(ctx, canvas.width, canvas.height, id, time);
      if (isAnimated) raf = requestAnimationFrame(draw);
    };
    draw(performance.now());
    return () => cancelAnimationFrame(raf);
  }, [id, isAnimated]);

  return (
    <button
      type="button"
      onClick={onClick}
      title={preset.name}
      className={cn(
        'chroma-bg-thumb',
        active && 'chroma-bg-thumb-active',
        isAnimated && 'chroma-bg-thumb-animated',
      )}
    >
      <canvas ref={canvasRef} width={96} height={54} className="h-full w-full" />
      <span className="chroma-bg-thumb-label">{preset.name}</span>
      {isAnimated && <span className="chroma-bg-thumb-badge">ANIM</span>}
    </button>
  );
}

export function ChromaBackgroundPicker({ selectedId, onSelect }: ChromaBackgroundPickerProps) {
  const categories: ChromaBackgroundCategory[] = ['plain', 'gradient', 'animated'];

  return (
    <div className="chroma-bg-picker">
      {categories.map((cat) => (
        <div key={cat}>
          <p className="atem-group-label mb-1">{CATEGORY_LABELS[cat]}</p>
          <div className="chroma-bg-grid">
            {CHROMA_BACKGROUND_PRESETS.filter((p) => p.category === cat).map((preset) => (
              <BackgroundThumb
                key={preset.id}
                id={preset.id}
                active={selectedId === preset.id}
                onClick={() => onSelect(preset.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
