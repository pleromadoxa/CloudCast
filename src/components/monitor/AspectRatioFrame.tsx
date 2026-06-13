import type { VideoAspectRatio } from '../../types/mixer';
import { ASPECT_RATIO_CSS } from '../../lib/aspectRatio';
import { cn } from '../../lib/utils';

interface AspectRatioFrameProps {
  ratio: VideoAspectRatio;
  className?: string;
  children: React.ReactNode;
}

/** Centers video content in a letterboxed frame with the chosen aspect ratio. */
export function AspectRatioFrame({ ratio, className, children }: AspectRatioFrameProps) {
  const [w, h] = ratio.split(':').map(Number);
  const cssRatio = ASPECT_RATIO_CSS[ratio];

  return (
    <div
      className={cn('@container/size relative h-full w-full bg-black', className)}
      style={{ containerType: 'size' }}
    >
      <div className="flex h-full w-full items-center justify-center">
        <div
          className="relative overflow-hidden"
          style={{
            aspectRatio: cssRatio,
            width: `min(100cqw, calc(100cqh * ${w} / ${h}))`,
            height: `min(100cqh, calc(100cqw * ${h} / ${w}))`,
            maxWidth: '100%',
            maxHeight: '100%',
          }}
        >
          <div className="absolute inset-0 overflow-hidden">{children}</div>
        </div>
      </div>
    </div>
  );
}
