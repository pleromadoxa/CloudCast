import { useMemo, type ReactElement } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { MotionTemplateVisual } from '../../../../../lib/prism/motionTemplateBank';
import { shiftAccent } from '../../../../../lib/prism/motionGraphics';
import { brandLogoSlot, DEFAULT_BRAND_KIT, type PrismBrandKit } from '../../../../../lib/prism/brandKit';
import {
  AmbientDust,
  ImpactFlash,
  LoopFade,
  MetalText,
  MotionEnvironment,
  MotionPostFx,
  MotionShaft,
  ParticleBurst,
  RuleLine,
  ShockRing,
  SpecSweep,
  VoidBackdrop,
  useMotionClock,
  type MotionSceneProps,
} from '../../kit';
import { BrandMark } from '../../BrandMark';
import { ImageBackdrop } from '../../ImageBackdrop';
import { easeInOutCubic, easeOutCubic, easeOutExpo, smoothstep } from '../../motionMath';
import { Ornament } from './ornaments';

/**
 * The full-frame motion template engine — one title lockup, fifteen ornament
 * families and six camera moves. Each bank template closes over its visual
 * preset and duration; the engine derives every beat from the timeline so all
 * twenty compositions share one broadcast rhythm:
 *
 *   build → punch (flash/rings) → title → sub-line → rule → hold → loop fade
 */

export function makeMotionScene(
  visual: MotionTemplateVisual,
  duration: number,
): (props: MotionSceneProps) => ReactElement {
  // Beats derived from the template length so every pace feels identical.
  const punchT = duration * 0.17;
  const titleWin: [number, number] = [punchT, punchT + duration * 0.11];
  const subWin: [number, number] = [punchT + duration * 0.06, punchT + duration * 0.17];
  const ruleWin: [number, number] = [punchT + duration * 0.1, punchT + duration * 0.22];
  const burstWin: [number, number] = [punchT, punchT + duration * 0.12];
  const sweepWin: [number, number] = [punchT - duration * 0.05, punchT + duration * 0.2];
  const markWin: [number, number] = [Math.max(0.05, punchT - duration * 0.12), punchT];
  const loopFade: [number, number] = [duration * 0.88, duration * 0.995];

  const showMark = visual.mark && visual.ornament !== 'mark';
  const titleY = visual.ornament === 'mark' ? -1.15 : visual.ornament === 'countdown' ? -1.72 : -0.52;
  const subY = titleY - 0.48;
  const ruleY = subY - 0.32;

  return function MotionTemplateScene({ headline, subline, accent, brand, overrides }: MotionSceneProps) {
    const clock = useMotionClock();
    const lookAt = useMemo(() => new THREE.Vector3(0, 0, 0), []);
    const desired = useMemo(() => new THREE.Vector3(0, 0.3, 7.4), []);

    /* ---- operator-editable extras: copy, logo, palette, background plate ---- */

    const kicker = (overrides?.kicker ?? '').trim();
    const footer = (overrides?.footer ?? '').trim();
    const secondary = overrides?.secondaryAccent ?? shiftAccent(accent, 0.72);
    const bgImage = overrides?.backgroundImage ?? null;
    const hasLogo = Boolean(brand?.logoDataUrl || (brand?.wordmark ?? '').trim());
    const logoWanted = overrides?.showLogo ?? (showMark || hasLogo);
    // The `mark` ornament carries its own lockup mark — never double it here.
    const markSlotVisible = logoWanted && visual.ornament !== 'mark';
    const logoSlot =
      (overrides?.logoPosition ?? brand?.logoPosition ?? 'mark-slot') === 'mark-slot'
        ? ([0, titleY + 1.25, 0] as [number, number, number])
        : brandLogoSlot(overrides?.logoPosition ?? brand?.logoPosition ?? 'mark-slot', 3.9, 2.1, 1.1);
    // Logo off also silences the ornament-carried mark (and its wordmark).
    const brandKit: PrismBrandKit = logoWanted
      ? { ...DEFAULT_BRAND_KIT, ...brand }
      : { ...DEFAULT_BRAND_KIT, ...brand, logoDataUrl: null, wordmark: '', hideProceduralMark: true };

    useFrame(({ camera }, dt) => {
      const t = clock.t;
      const u = Math.min(1, t / Math.max(0.1, duration));

      switch (visual.camera) {
        case 'push': {
          const k = easeOutCubic(Math.min(1, t / (duration * 0.35)));
          desired.set(Math.sin(t * 0.32) * 0.1, 0.34 + Math.sin(t * 0.35) * 0.05, 8.6 - k * 2.3);
          break;
        }
        case 'orbit': {
          const az = Math.sin(t * 0.22) * 0.5;
          desired.set(Math.sin(az) * 7.2, 0.8 + Math.sin(t * 0.3) * 0.18, Math.cos(az) * 7.2);
          break;
        }
        case 'whip': {
          const k = easeOutExpo(Math.min(1, t / (duration * 0.22)));
          desired.set(-2.2 * (1 - k) + Math.sin(t * 0.4) * 0.08, 0.3, 7.6 - k * 0.7);
          break;
        }
        case 'crane': {
          const k = easeInOutCubic(u);
          desired.set(Math.sin(t * 0.26) * 0.5, 2.2 - k * 1.7, 7.8 - k * 1.3);
          break;
        }
        case 'pullback': {
          const k = easeInOutCubic(u);
          desired.set(Math.sin(t * 0.2) * 0.16, 0.28 + k * 0.4, 6.1 + k * 2.7);
          break;
        }
        case 'static':
        default:
          desired.set(Math.sin(t * 0.18) * 0.06, 0.16, 7.4);
          break;
      }

      if (t < 0.08 || dt <= 0) camera.position.copy(desired);
      else camera.position.lerp(desired, 1 - Math.exp(-8 * dt));
      camera.lookAt(lookAt);

      const cam = camera as THREE.PerspectiveCamera;
      const targetFov = visual.camera === 'whip' ? 50 - 4 * smoothstep(0, 0.3, u) : visual.camera === 'push' ? 47 - 3 * smoothstep(0, 0.4, u) : 47;
      if (Math.abs(cam.fov - targetFov) > 0.01) {
        cam.fov = targetFov;
        cam.updateProjectionMatrix();
      }
    });

    return (
      <>
        {bgImage ? <ImageBackdrop url={bgImage} /> : <VoidBackdrop />}
        <MotionEnvironment accent={accent} intensity={1.2} />
        <ambientLight intensity={0.26} />
        <spotLight position={[0, 5.5, 4]} angle={0.7} penumbra={0.8} intensity={24} color="#ffffff" distance={26} decay={1.9} />
        <pointLight position={[-4, -1, 3]} intensity={12} color={accent} distance={22} decay={1.8} />

        <Ornament ornament={visual.ornament} accent={accent} punchT={punchT} duration={duration} chip={visual.chip} brand={brandKit} />

        <AmbientDust count={240} radius={11} color={shiftAccent(accent, 0.55)} size={0.05} opacity={0.5} reveal={[0, punchT * 1.5]} />

        {visual.shafts && (
          <>
            <MotionShaft position={[-2.8, 4.4, -1.8]} rotation={[0.18, 0, 0.28]} height={9} radius={2.1} color="#fff7ed" opacity={0.13} ignite={[0, punchT]} />
            <MotionShaft position={[2.8, 4.4, -1.8]} rotation={[0.18, 0, -0.28]} height={9} radius={2.1} color={accent} opacity={0.1} ignite={[0, punchT * 1.2]} />
          </>
        )}

        {markSlotVisible && (
          <BrandMark
            accent={accent}
            logo={brandKit}
            logoScale={overrides?.logoScale ?? 1}
            assemble={markWin}
            position={logoSlot}
            scale={0.52}
            spin={0.18}
            hideBefore
          />
        )}

        {visual.flash && (
          <>
            <ImpactFlash at={punchT} width={0.24} strength={0.9} color="#fff7ea" position={[0, 0.3, 1.6]} scale={20} />
            <ShockRing at={punchT} duration={0.9} color={accent} maxRadius={7} position={[0, 0.3, 0.4]} />
          </>
        )}

        {visual.particleBurst && (
          <ParticleBurst count={560} color={accent} size={0.1} seed={17} spread={7.5} origin={[0, 0.3, 0]} window={burstWin} fadeOut={1.3} />
        )}

        {visual.ornament === 'sweep' && (
          <SpecSweep window={sweepWin} width={13} height={4.6} position={[0, 0, -1.1]} intensity={1} />
        )}

        {/* title lockup */}
        {kicker && (
          <MetalText
            text={kicker}
            accent={secondary}
            size={0.15}
            position={[0, titleY + 0.44, 0.4]}
            letterSpacing={0.34}
            reveal={titleWin}
            rise={0.08}
            metalness={0.3}
            roughness={0.48}
          />
        )}
        <MetalText text={headline} accent={accent} size={0.56} position={[0, titleY, 0.4]} letterSpacing={0.06} reveal={titleWin} rise={0.12} />
        <MetalText
          text={subline}
          accent={secondary}
          size={0.19}
          position={[0, subY, 0.4]}
          letterSpacing={0.3}
          reveal={subWin}
          metalness={0.25}
          roughness={0.5}
        />
        {visual.rule && <RuleLine y={ruleY} color={accent} from={ruleWin[0]} to={ruleWin[1]} width={3.6} />}
        {footer && (
          <MetalText
            text={footer}
            accent={secondary}
            size={0.12}
            position={[0, Math.max(ruleY - 0.5, -2.9), 0.4]}
            letterSpacing={0.26}
            reveal={subWin}
            rise={0.05}
            metalness={0.22}
            roughness={0.52}
          />
        )}

        <LoopFade from={loopFade[0]} to={loopFade[1]} />
        <MotionPostFx
          bloomIntensity={0.9}
          pulse={visual.flash ? { at: punchT, width: 0.24, boost: 1.9 } : undefined}
          chroma={0.0012}
          grain={0.05}
          vignette={0.72}
        />
      </>
    );
  };
}
