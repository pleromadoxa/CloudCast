import { useLayoutEffect, useRef, useState } from 'react';
import { DISPLAY_CANVAS_HEIGHT, DISPLAY_CANVAS_WIDTH } from '../../lib/displayCanvas';
import { cn } from '../../lib/utils';

interface DisplayCanvasProps {
  className?: string;
  children: React.ReactNode;
}

/** Letterboxes a fixed 1920×1080 slide canvas to fit any container. */
export function DisplayCanvas({ className, children }: DisplayCanvasProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w === 0 || h === 0) return;
      setScale(Math.min(w / DISPLAY_CANVAS_WIDTH, h / DISPLAY_CANVAS_HEIGHT));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={outerRef} className={cn('relative h-full w-full overflow-hidden', className)}>
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: DISPLAY_CANVAS_WIDTH,
          height: DISPLAY_CANVAS_HEIGHT,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
