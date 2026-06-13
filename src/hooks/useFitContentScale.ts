import { useLayoutEffect, useRef, useState } from 'react';

const SCALE_SAFETY = 0.98;

export interface FitContentScale {
  scale: number;
  width: number;
  height: number;
}

/** Shrinks content with transform scale when it overflows its container. */
export function useFitContentScale(deps: readonly unknown[] = []) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<FitContentScale>({ scale: 1, width: 0, height: 0 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    let frame = 0;

    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        content.style.transform = 'none';
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        if (cw > 0) {
          content.style.width = `${cw}px`;
          content.style.maxWidth = `${cw}px`;
        }
        const sw = content.scrollWidth;
        const sh = content.scrollHeight;
        if (cw === 0 || ch === 0 || sw === 0 || sh === 0) {
          setFit({ scale: 1, width: sw, height: sh });
          return;
        }
        const scale = Math.min(1, cw / sw, ch / sh) * SCALE_SAFETY;
        setFit({ scale, width: sw * scale, height: sh * scale });
      });
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(content);

    const mutationObserver = new MutationObserver(measure);
    mutationObserver.observe(content, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });

    const onImageLoad = (event: Event) => {
      if (event.target instanceof HTMLImageElement && content.contains(event.target)) {
        measure();
      }
    };
    content.addEventListener('load', onImageLoad, true);

    void document.fonts?.ready.then(measure);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      mutationObserver.disconnect();
      content.removeEventListener('load', onImageLoad, true);
    };
  }, deps);

  return { containerRef, contentRef, fit };
}
