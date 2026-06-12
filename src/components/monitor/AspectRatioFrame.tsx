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
  return (
    <div className={cn('flex h-full w-full items-center justify-center bg-black', className)}>
      <div
        className="relative max-h-full max-w-full"
        style={{ aspectRatio: ASPECT_RATIO_CSS[ratio], width: '100%', height: 'auto' }}
      >
        <div className="absolute inset-0 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
