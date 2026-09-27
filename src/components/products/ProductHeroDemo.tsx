import type { CloudCastProductId } from '../../types/products';
import { productAccentTheme } from './productAccent';
import type { CloudCastProduct } from '../../types/products';
import { HeroDemoStage } from './heroDemo/shared';
import { VideoMixerDemo } from './heroDemo/VideoMixerDemo';
import { AudioMixerDemo } from './heroDemo/AudioMixerDemo';
import { SymphonyDemo } from './heroDemo/SymphonyDemo';
import { ReplayDemo } from './heroDemo/ReplayDemo';
import { DisplayDemo } from './heroDemo/DisplayDemo';
import { PrismDemo } from './heroDemo/PrismDemo';

function Demo({ productId }: { productId: CloudCastProductId }) {
  switch (productId) {
    case 'video_mixer':
      return <VideoMixerDemo />;
    case 'audio_mixer':
      return <AudioMixerDemo />;
    case 'symphony_studio':
      return <SymphonyDemo />;
    case 'instant_replay':
      return <ReplayDemo />;
    case 'regal_display':
      return <DisplayDemo />;
    default:
      return <PrismDemo />;
  }
}

interface ProductHeroDemoProps {
  productId: CloudCastProductId;
  accent: CloudCastProduct['accent'];
  className?: string;
}

/**
 * Live, animated 3D preview of the product's real dashboard — blended into
 * the landing hero so visitors see the workspace before they sign in.
 * Purely decorative: everything is aria-hidden and freezes for reduced motion.
 */
export function ProductHeroDemo({ productId, accent, className }: ProductHeroDemoProps) {
  const theme = productAccentTheme(accent);
  return (
    <HeroDemoStage
      label="Animated product dashboard preview"
      glowColor={`${theme.hex}2e`}
      className={className}
    >
      <Demo productId={productId} />
    </HeroDemoStage>
  );
}
