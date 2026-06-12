import type { LowerThirdCustomization, LowerThirdTemplateId } from '../../types/overlays';
import { renderLowerThird } from '../../lib/lowerThirdRender';
import { resolveLowerThirdCustomization } from '../../lib/lowerThirdTemplates';

interface LowerThirdOverlayProps {
  template: LowerThirdTemplateId;
  customization?: Partial<LowerThirdCustomization>;
  headline: string;
  subline?: string;
  preview?: boolean;
  className?: string;
}

export function LowerThirdOverlay({
  template,
  customization,
  headline,
  subline,
  preview = false,
  className,
}: LowerThirdOverlayProps) {
  return renderLowerThird({
    templateId: template,
    customization: resolveLowerThirdCustomization(template, customization),
    headline,
    subline,
    preview,
    className,
  });
}
