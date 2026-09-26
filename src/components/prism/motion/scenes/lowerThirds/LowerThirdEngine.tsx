/* eslint-disable react-refresh/only-export-components -- scene factory and its camera helper share one preset-driven module */
import { useMemo, useRef, type ReactElement } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LowerThirdVisual } from '../../../../../lib/prism/motionTemplateBank';
import { shiftAccent } from '../../../../../lib/prism/motionGraphics';
import { brandLogoSlot, DEFAULT_BRAND_KIT, type BrandLogoPosition, type PrismBrandKit } from '../../../../../lib/prism/brandKit';
import {
  MetalText,
  MotionEnvironment,
  SpecSweep,
  useMotionClock,
  type MotionSceneProps,
} from '../../kit';
import { BrandMark } from '../../BrandMark';
import { ImageBackdrop } from '../../ImageBackdrop';
import { backOut, clamp01, easeInCubic, easeOutExpo, mulberry32, seg } from '../../motionMath';
import { LowerThirdShape } from './shapes';

/**
 * The 3D lower-third engine — one timeline, twenty plate archetypes.
 *
 * Every lower third in the bank plays the same broadcast rhythm: the plate
 * enters on a distinct move, the name and role reveal on their own beats, a
 * specular rake crosses the plate, the graphic holds, then exits frame on the
 * out cue. The plate geometry comes from `LowerThirdShape`; the entrance move
 * is selected by `visual.entrance`.
 */

/** Shared timeline for every 6s lower third (seconds). */
const IN_WIN: [number, number] = [0.3, 1.15];
const OUT_WIN: [number, number] = [4.85, 5.7];
const NAME_WIN: [number, number] = [1.0, 1.55];
const SUB_WIN: [number, number] = [1.22, 1.82];
const CHIP_WIN: [number, number] = [1.35, 1.85];
const SWEEP_WIN: [number, number] = [1.25, 2.45];

function StaticCamera() {
  useFrame(({ camera }) => {
    const cam = camera as THREE.PerspectiveCamera;
    if (Math.abs(cam.fov - 48) > 0.01) {
      cam.fov = 48;
      cam.updateProjectionMatrix();
    }
    if (cam.position.z !== 6) {
      cam.position.set(0, 0, 6);
      cam.lookAt(0, 0, 0);
    }
  });
  return null;
}

/** Where the chip label sits on each plate family. */
function chipLayout(visual: LowerThirdVisual): { position: [number, number, number]; size: number } | null {
  const { shape, width: w, height: h } = visual;
  switch (shape) {
    case 'slab':
    case 'crest':
      return { position: [w / 2 - 0.62, 0, 0.15], size: 0.11 };
    case 'stripes':
      return { position: [w / 2 - 0.55, 0, 0.15], size: 0.17 };
    case 'grid':
      return { position: [w / 2 - 0.75, h / 2 - 0.16, 0.11], size: 0.095 };
    case 'tag':
      return { position: [-w / 2 + 1.05, h / 2 + 0.16, 0.12], size: 0.12 };
    case 'data':
      return { position: [w / 2 - 0.6, 0.08, 0.15], size: 0.1 };
    default:
      return null;
  }
}

/** Text block placement per plate family. */
function textLayout(visual: LowerThirdVisual): { inset: number; nameY: number; subY: number; nameSize: number; subSize: number } {
  const { shape, height: h } = visual;
  switch (shape) {
    case 'line':
      return { inset: 0.14, nameY: 0.17, subY: -0.11, nameSize: 0.3, subSize: 0.15 };
    case 'crest':
      return { inset: 1.3, nameY: h * 0.14, subY: -h * 0.3, nameSize: 0.28, subSize: 0.14 };
    case 'capsule':
      return { inset: 0.62, nameY: h * 0.16, subY: -h * 0.32, nameSize: 0.25, subSize: 0.13 };
    case 'editorial':
      return { inset: 0.32, nameY: h * 0.1, subY: -h * 0.3, nameSize: 0.26, subSize: 0.135 };
    default:
      return { inset: 0.36, nameY: h * 0.15, subY: -h * 0.31, nameSize: 0.27, subSize: 0.14 };
  }
}

export function makeLowerThirdScene(visual: LowerThirdVisual): (props: MotionSceneProps) => ReactElement {
  return function LowerThirdScene({ headline, subline, accent, brand, overrides }: MotionSceneProps) {
    const clock = useMotionClock();
    const groupRef = useRef<THREE.Group>(null);
    const floatPhase = useMemo(() => mulberry32(5150)() * Math.PI * 2, []);

    const text = textLayout(visual);
    const chip = chipLayout(visual);

    /* ---- operator-editable extras: copy, colours, logo, background plate ---- */

    const ex = overrides ?? {};
    const kicker = (ex.kicker ?? '').trim();
    const footer = (ex.footer ?? '').trim();
    const secondary = ex.secondaryAccent ?? shiftAccent(visual.trim, 0.55);
    const bgImage = ex.backgroundImage ?? null;
    const eff: LowerThirdVisual = {
      ...visual,
      plate: ex.plate ?? visual.plate,
      ink: ex.ink ?? visual.ink,
      trim: ex.trim ?? visual.trim,
    };
    const hasLogo = Boolean(brand?.logoDataUrl || (brand?.wordmark ?? '').trim());
    const showLogo = ex.showLogo ?? hasLogo;
    const logoPos: BrandLogoPosition = ex.logoPosition ?? brand?.logoPosition ?? 'mark-slot';
    // Crest / prism plates carry their own medallion mark — that is the slot.
    const medallion = visual.shape === 'crest' || visual.shape === 'prism';
    const logoOnPlate = showLogo && !medallion;
    const logoSlot: [number, number, number] =
      logoPos === 'mark-slot'
        ? [-visual.width / 2 + 0.52, 0, 0.14]
        : brandLogoSlot(logoPos, visual.width / 2 - 0.45, visual.height / 2 - 0.16, 0.14);
    const shiftText =
      logoOnPlate && (logoPos === 'mark-slot' || logoPos === 'top-left' || logoPos === 'bottom-left');
    const brandKit: PrismBrandKit = showLogo
      ? { ...DEFAULT_BRAND_KIT, ...brand }
      : { ...DEFAULT_BRAND_KIT, ...brand, logoDataUrl: null, wordmark: '', hideProceduralMark: true };
    const nameX = -visual.width / 2 + text.inset + (shiftText ? 0.55 : 0);

    useFrame(() => {
      const t = clock.t;
      const group = groupRef.current;
      if (!group) return;

      const inP = seg(t, IN_WIN[0], IN_WIN[1], easeOutExpo);
      const outP = seg(t, OUT_WIN[0], OUT_WIN[1], easeInCubic);
      const live = t >= IN_WIN[0] && outP < 1;
      group.visible = live;
      if (!live) return;

      // Gentle float once parked — the plate never sits perfectly still.
      const float = Math.sin((t - IN_WIN[1]) * 1.4 + floatPhase) * 0.016 * clamp01(inP - 0.55) * (1 - outP);

      switch (visual.entrance) {
        case 'slide':
          group.position.set(visual.x - (1 - inP) * 9 + outP * 9.4, visual.y + float, 0);
          group.rotation.set(0, (1 - inP) * 0.12 - outP * 0.1, 0);
          break;
        case 'wipe':
          group.position.set(visual.x - (1 - inP) * 2.6 + outP * 2.8, visual.y + float, 0);
          group.scale.setScalar(1);
          break;
        case 'drop': {
          const overshoot = backOut(inP, 1.2);
          group.position.set(visual.x + outP * 1.2, visual.y + (1 - overshoot) * 2.4 - outP * 1.9 + float, 0);
          group.rotation.set(0, 0, 0);
          break;
        }
        case 'scale':
          group.position.set(visual.x - (1 - inP) * 0.9 + outP * 1.6, visual.y + float, 0);
          group.scale.setScalar(0.82 + 0.18 * inP - outP * 0.12);
          group.rotation.set(0, 0, 0);
          break;
        case 'split': {
          group.position.set(visual.x, visual.y + float, 0);
          group.scale.setScalar(1);
          // halves converge from both sides
          const half = group.getObjectByName('lt-half-a');
          const halfB = group.getObjectByName('lt-half-b');
          if (half && halfB) {
            half.position.x = -(1 - inP) * 3.2 + outP * 3.4;
            halfB.position.x = (1 - inP) * 3.2 - outP * 3.4;
          }
          break;
        }
      }
    });

    return (
      <>
        <StaticCamera />
        {/* reflections only — never paints a backdrop on the transparent canvas */}
        {bgImage && <ImageBackdrop url={bgImage} />}
        <MotionEnvironment accent={accent} intensity={1.3} />
        <ambientLight intensity={0.62} />
        <directionalLight position={[2, 4, 6]} intensity={1.8} color="#ffffff" />
        <directionalLight position={[-5, -1, 3]} intensity={0.95} color={accent} />
        <pointLight position={[0, 1.6, 3.2]} intensity={7} color="#ffffff" distance={14} decay={1.8} />

        <group ref={groupRef} visible={false} position={[visual.x, visual.y, 0]}>
          <LowerThirdShape visual={eff} accent={accent} brand={brandKit} />

          {logoOnPlate && (
            <BrandMark
              accent={accent}
              logo={brandKit}
              logoScale={ex.logoScale ?? 1}
              position={logoSlot}
              scale={0.3}
              assemble={IN_WIN}
              spin={0.14}
              hideBefore={false}
            />
          )}

          {kicker && (
            <MetalText
              text={kicker}
              accent={secondary}
              size={0.1}
              position={[-visual.width / 2 + text.inset, visual.height / 2 + 0.17, 0.1]}
              letterSpacing={0.22}
              reveal={CHIP_WIN}
              rise={0.03}
              align="left"
              metalness={0.25}
              roughness={0.5}
            />
          )}

          <MetalText
            text={headline}
            accent={eff.ink}
            size={text.nameSize}
            position={[nameX, text.nameY, 0.11]}
            letterSpacing={0.045}
            reveal={NAME_WIN}
            rise={0.07}
            align="left"
            metalness={0.32}
            roughness={0.42}
          />
          <MetalText
            text={subline}
            accent={secondary}
            size={text.subSize}
            position={[nameX, text.subY, 0.11]}
            letterSpacing={0.1 * (visual.subKern ?? 1)}
            reveal={SUB_WIN}
            rise={0.05}
            align="left"
            metalness={0.18}
            roughness={0.52}
          />
          {footer && (
            <MetalText
              text={footer}
              accent={shiftAccent(eff.trim, 0.5)}
              size={0.09}
              position={[-visual.width / 2 + text.inset, -visual.height / 2 - 0.15, 0.1]}
              letterSpacing={0.18}
              reveal={SUB_WIN}
              rise={0.03}
              align="left"
              metalness={0.2}
              roughness={0.55}
            />
          )}
          {chip && visual.chip && (
            <MetalText
              text={visual.chip}
              accent={visual.shape === 'tag' ? '#ffffff' : shiftAccent(accent, 0.72)}
              size={chip.size}
              position={chip.position}
              letterSpacing={0.12}
              reveal={CHIP_WIN}
              rise={0.03}
              align="center"
              metalness={0.2}
              roughness={0.5}
            />
          )}
        </group>

        {visual.shape !== 'line' && (
          <SpecSweep
            window={SWEEP_WIN}
            width={visual.width + 0.6}
            height={visual.height * 1.9}
            position={[visual.x, visual.y, 0.16]}
            intensity={0.8}
          />
        )}
      </>
    );
  };
}
