import type { ProgramLogoSettings } from '../../types/overlays';
import { rescaleOverlayDimensions } from '../../lib/imageResize';
import { placementStyle, resolveCornerPlacement } from '../../lib/overlayPlacement';
import { cn } from '../../lib/utils';

interface LogoOverlayProps {
  logo: ProgramLogoSettings;
}

export function LogoOverlay({ logo }: LogoOverlayProps) {
  const posStyle = placementStyle(resolveCornerPlacement(logo.position, logo));

  if (logo.mode === 'image' && logo.imageDataUrl) {
    const size = rescaleOverlayDimensions(logo.naturalWidth, logo.naturalHeight, logo.scale);
    return (
      <img
        src={logo.imageDataUrl}
        alt="Program logo"
        className="pointer-events-none absolute z-[16] object-contain"
        style={{
          ...posStyle,
          width: size.width,
          height: size.height,
          maxWidth: '35%',
          opacity: logo.opacity / 100,
        }}
      />
    );
  }

  return (
    <div
      className="absolute z-[16]"
      style={{ ...posStyle, opacity: logo.opacity / 100 }}
    >
      <div
        className={cn(
          'px-2.5 py-1 text-[10px] font-bold tracking-[0.2em] text-white',
          logo.showBackground && 'rounded bg-mixer-red/90 shadow-lg',
        )}
      >
        {logo.text}
      </div>
    </div>
  );
}
