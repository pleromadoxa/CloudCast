/**
 * CloudCast 3D Logo Animation Registry — 20 animated logo reveals.
 *
 * Every animation is a self-contained entrance sequence: the logo flies in,
 * spins, morphs, explodes into particles, catches light, transforms in 3D
 * space, glitches, or types itself on screen. Each animation includes a
 * replaceable logo slot so the operator can drop in any brand mark.
 *
 * The renderer applies CSS @keyframes, WebGL particle systems, or SVG
 * SMIL animations depending on the production tier and device capability.
 */
import type { LogoAnimationDefinition, LogoAnimationCategory } from '../types/overlays';

function logoAnim(
  id: string,
  name: string,
  description: string,
  category: LogoAnimationCategory,
  defaultDuration: number,
  hasLogoSlot: boolean,
  logoSlotLabel: string | undefined,
  accentColor: string,
  entranceFrom: LogoAnimationDefinition['entranceFrom'],
  leavesBug: boolean,
): LogoAnimationDefinition {
  return { id, name, description, category, defaultDuration, hasLogoSlot, logoSlotLabel, accentColor, entranceFrom, leavesBug };
}

export const LOGO_ANIMATIONS: LogoAnimationDefinition[] = [
  /* ════════════════════════════════════════════════════════════════
     REVEAL ANIMATIONS (4)
     ════════════════════════════════════════════════════════════════ */
  logoAnim('reveal-slide-in', 'Slide In', 'Logo slides in from the side with ease-out deceleration', 'reveal', 1.2, true, 'mainLogo', '#38bdf8', 'left', true),
  logoAnim('reveal-fade-up', 'Fade Up', 'Logo fades in while floating upward from below', 'reveal', 1.0, true, 'mainLogo', '#ffffff', 'bottom', true),
  logoAnim('reveal-scale-pop', 'Scale Pop', 'Logo pops in from zero scale with elastic bounce', 'reveal', 0.8, true, 'mainLogo', '#22d3ee', 'center', true),
  logoAnim('reveal-mask-wipe', 'Mask Wipe', 'Logo revealed through an expanding circular mask', 'reveal', 1.1, true, 'mainLogo', '#8b5cf6', 'center', true),

  /* ════════════════════════════════════════════════════════════════
     SPIN ANIMATIONS (3)
     ════════════════════════════════════════════════════════════════ */
  logoAnim('spin-y-360', 'Spin Y 360°', 'Full rotation on Y axis landing face-forward', 'spin', 1.4, true, 'mainLogo', '#f59e0b', 'depth', true),
  logoAnim('spin-tumble', 'Tumble', 'Multi-axis tumble landing with settle', 'spin', 1.6, true, 'mainLogo', '#ef4444', 'depth', true),
  logoAnim('spin-flip-in', 'Flip In', 'Quick 180° X-axis flip revealing the logo', 'spin', 0.9, true, 'mainLogo', '#10b981', 'top', true),

  /* ════════════════════════════════════════════════════════════════
     MORPH ANIMATIONS (2)
     ════════════════════════════════════════════════════════════════ */
  logoAnim('morph-circle', 'Circle Morph', 'Shape morphs from a circle into the logo silhouette', 'morph', 1.3, true, 'mainLogo', '#ec4899', 'center', true),
  logoAnim('morph-shatter', 'Shatter Assemble', 'Fragmented pieces fly in and assemble into logo', 'morph', 1.8, true, 'mainLogo', '#8b5cf6', 'center', true),

  /* ════════════════════════════════════════════════════════════════
     PARTICLE ANIMATIONS (3)
     ════════════════════════════════════════════════════════════════ */
  logoAnim('particle-converge', 'Converge', 'Particles swirl inward and coalesce into the logo', 'particle', 2.0, true, 'mainLogo', '#22d3ee', 'center', true),
  logoAnim('particle-explode', 'Explode In', 'Logo assembles from an outward particle burst', 'particle', 1.5, true, 'mainLogo', '#f97316', 'center', true),
  logoAnim('particle-trail', 'Trail Reveal', 'Light trail traces the logo outline then fills', 'particle', 1.8, true, 'mainLogo', '#a855f7', 'left', true),

  /* ════════════════════════════════════════════════════════════════
     LIGHT ANIMATIONS (2)
     ════════════════════════════════════════════════════════════════ */
  logoAnim('light-sweep', 'Light Sweep', 'Bright highlight sweeps across the logo surface', 'light', 1.2, true, 'mainLogo', '#ffffff', 'left', true),
  logoAnim('light-glow-pulse', 'Glow Pulse', 'Logo fades in with a pulsing emissive glow', 'light', 1.5, true, 'mainLogo', '#fbbf24', 'center', true),

  /* ════════════════════════════════════════════════════════════════
     3D TRANSFORM ANIMATIONS (3)
     ════════════════════════════════════════════════════════════════ */
  logoAnim('3d-cube-rotate', 'Cube Rotate', 'Logo on a 3D cube face rotating into view', '3d-transform', 1.4, true, 'mainLogo', '#64748b', 'depth', true),
  logoAnim('3d-card-flip', 'Card Flip', '3D card flip revealing logo on the reverse', '3d-transform', 1.0, true, 'mainLogo', '#0ea5e9', 'depth', true),
  logoAnim('3d-extrude', 'Extrude', 'Flat logo extrudes into 3D depth then settles', '3d-transform', 1.6, true, 'mainLogo', '#d4af37', 'depth', true),

  /* ════════════════════════════════════════════════════════════════
     GLITCH ANIMATION (1)
     ════════════════════════════════════════════════════════════════ */
  logoAnim('glitch-logo', 'Glitch Reveal', 'RGB-split glitch artefacts resolving into the logo', 'glitch', 1.0, true, 'mainLogo', '#f43f5e', 'center', true),

  /* ════════════════════════════════════════════════════════════════
     TYPOGRAPHY ANIMATION (1)
     ════════════════════════════════════════════════════════════════ */
  logoAnim('type-on', 'Type On', 'Logo text types on character by character with cursor', 'typography', 2.0, true, 'mainLogo', '#10b981', 'left', true),

  /* ════════════════════════════════════════════════════════════════
     SECONDARY REVEAL (1 — completing 20)
     ════════════════════════════════════════════════════════════════ */
  logoAnim('reveal-zoom-blur', 'Zoom Blur', 'Logo zooms in from far with radial blur settling to sharp', 'reveal', 1.1, true, 'mainLogo', '#f43f5e', 'depth', true),
];

const ANIM_INDEX = new Map(LOGO_ANIMATIONS.map((a) => [a.id, a]));

export function getLogoAnimation(id: string): LogoAnimationDefinition | undefined {
  return ANIM_INDEX.get(id);
}

export function getLogoAnimationsByCategory(category: LogoAnimationCategory): LogoAnimationDefinition[] {
  return LOGO_ANIMATIONS.filter((a) => a.category === category);
}

export const LOGO_ANIMATION_CATEGORIES: { id: LogoAnimationCategory; label: string; description: string }[] = [
  { id: 'reveal', label: 'Reveal', description: 'Slide, fade and scale entrances' },
  { id: 'spin', label: 'Spin', description: 'Rotation-based entrances' },
  { id: 'morph', label: 'Morph', description: 'Shape transformation entrances' },
  { id: 'particle', label: 'Particle', description: 'Particle system assemblies' },
  { id: 'light', label: 'Light', description: 'Light sweep and glow effects' },
  { id: '3d-transform', label: '3D Transform', description: 'Three-dimensional rotations' },
  { id: 'glitch', label: 'Glitch', description: 'Digital artefact reveals' },
  { id: 'typography', label: 'Typography', description: 'Text-based type-on effects' },
];
