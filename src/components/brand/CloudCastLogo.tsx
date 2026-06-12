import { SITE_LEGAL } from '../../config/siteLegal';
import { CLOUDCAST_LOGO } from '../../lib/branding';
import { cn } from '../../lib/utils';

export type CloudCastLogoVariant = keyof typeof CLOUDCAST_LOGO;

interface CloudCastLogoProps {
  /** `dark` = full badge logo; `dark-header` = compact wordmark; `light` = for light backgrounds. */
  variant?: CloudCastLogoVariant;
  className?: string;
  alt?: string;
}

export function CloudCastLogo({
  variant = 'dark',
  className,
  alt = SITE_LEGAL.brandLine,
}: CloudCastLogoProps) {
  return (
    <img
      src={CLOUDCAST_LOGO[variant]}
      alt={alt}
      className={cn('block w-auto object-contain', className)}
      draggable={false}
    />
  );
}
