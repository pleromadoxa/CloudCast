/**
 * CloudCast Transition Effects Registry — 30 broadcast-quality transitions.
 *
 * Each effect defines how the programme cuts between shots: wipes, dissolves,
 * geometric reveals, motion sweeps, glitch artefacts, light flashes and 3D
 * rotations. The renderer translates these into CSS/GSAP animations or
 * canvas-based compositing depending on the production tier.
 */
import type { TransitionEffectDefinition, TransitionEffectCategory } from '../types/overlays';

function effect(
  id: string,
  name: string,
  description: string,
  category: TransitionEffectCategory,
  defaultDuration: number,
  accentColor: string,
  cssHint: string,
  supportsLogo: boolean,
): TransitionEffectDefinition {
  return { id, name, description, category, defaultDuration, accentColor, cssHint, supportsLogo };
}

export const TRANSITION_EFFECTS: TransitionEffectDefinition[] = [
  /* ════════════════════════════════════════════════════════════════
     WIPE TRANSITIONS (7)
     ════════════════════════════════════════════════════════════════ */
  effect('wipe-left', 'Wipe Left', 'Classic horizontal wipe from right to left', 'wipe', 0.8, '#38bdf8', 'translateX', true),
  effect('wipe-right', 'Wipe Right', 'Horizontal wipe from left to right', 'wipe', 0.8, '#38bdf8', 'translateX-reverse', true),
  effect('wipe-down', 'Wipe Down', 'Vertical wipe descending from top', 'wipe', 0.7, '#64748b', 'translateY', true),
  effect('wipe-up', 'Wipe Up', 'Vertical wipe ascending from bottom', 'wipe', 0.7, '#64748b', 'translateY-reverse', true),
  effect('wipe-diagonal', 'Diagonal Wipe', '45-degree diagonal sweep across frame', 'wipe', 0.9, '#8b5cf6', 'clip-path-diagonal', true),
  effect('wipe-clock', 'Clock Wipe', 'Radial clock-hand reveal from centre', 'wipe', 1.0, '#f59e0b', 'clip-path-radial', true),
  effect('wipe-barn-door', 'Barn Door', 'Dual doors open from centre revealing next shot', 'wipe', 0.8, '#94a3b8', 'clip-path-barn', true),

  /* ════════════════════════════════════════════════════════════════
     DISSOLVE TRANSITIONS (5)
     ════════════════════════════════════════════════════════════════ */
  effect('dissolve-cross', 'Cross Dissolve', 'Standard opacity crossfade between shots', 'dissolve', 1.0, '#ffffff', 'opacity', false),
  effect('dissolve-dip-black', 'Dip to Black', 'Fade outgoing to black, then fade incoming', 'dissolve', 1.2, '#000000', 'fade-black', false),
  effect('dissolve-dip-white', 'Dip to White', 'Fade outgoing to white flash, then incoming', 'dissolve', 0.9, '#ffffff', 'fade-white', false),
  effect('dissolve-additive', 'Additive Dissolve', 'Additive blending crossfade (bright bloom)', 'dissolve', 0.8, '#fbbf24', 'screen-blend', false),
  effect('dissolve-color', 'Color Dissolve', 'Crossfade tinted with accent colour overlay', 'dissolve', 1.0, '#ec4899', 'tinted-dissolve', false),

  /* ════════════════════════════════════════════════════════════════
     GEOMETRIC TRANSITIONS (5)
     ════════════════════════════════════════════════════════════════ */
  effect('geo-circle-open', 'Circle Open', 'Expanding circle reveals incoming shot from centre', 'geometric', 0.9, '#22d3ee', 'clip-path-circle-open', true),
  effect('geo-circle-close', 'Circle Close', 'Shrinking circle closes on outgoing shot', 'geometric', 0.9, '#22d3ee', 'clip-path-circle-close', true),
  effect('geo-diamond', 'Diamond Wipe', 'Diamond shape expands from centre', 'geometric', 0.85, '#f59e0b', 'clip-path-diamond', true),
  effect('geo-star', 'Star Reveal', 'Star shape expands from centre', 'geometric', 1.0, '#ef4444', 'clip-path-star', true),
  effect('geo-cross', 'Cross Reveal', 'Cross/plus shape expands from centre', 'geometric', 0.85, '#8b5cf6', 'clip-path-cross', true),

  /* ════════════════════════════════════════════════════════════════
     MOTION TRANSITIONS (4)
     ════════════════════════════════════════════════════════════════ */
  effect('motion-push-left', 'Push Left', 'Incoming shot pushes outgoing off-screen left', 'motion', 0.7, '#10b981', 'push-left', false),
  effect('motion-push-right', 'Push Right', 'Incoming shot pushes outgoing off-screen right', 'motion', 0.7, '#10b981', 'push-right', false),
  effect('motion-slide-zoom', 'Slide Zoom', 'Slide with perspective zoom punch', 'motion', 0.6, '#f97316', 'slide-zoom', false),
  effect('motion-whip', 'Whip Pan', 'Fast directional blur whip pan', 'motion', 0.4, '#ef4444', 'whip-pan', false),

  /* ════════════════════════════════════════════════════════════════
     GLITCH TRANSITIONS (4)
     ════════════════════════════════════════════════════════════════ */
  effect('glitch-digital', 'Digital Glitch', 'RGB split and scan-line corruption', 'glitch', 0.5, '#22d3ee', 'rgb-split', false),
  effect('glitch-static', 'Static Burst', 'TV static noise burst between shots', 'glitch', 0.4, '#a3a3a3', 'noise-overlay', false),
  effect('glitch-pixelate', 'Pixelate', 'Mosaic pixelation dissolve', 'glitch', 0.6, '#8b5cf6', 'pixelate', false),
  effect('glitch-data-mosh', 'Data Mosh', 'Compression artefact smear between frames', 'glitch', 0.5, '#f43f5e', 'data-mosh', false),

  /* ════════════════════════════════════════════════════════════════
     LIGHT TRANSITIONS (3)
     ════════════════════════════════════════════════════════════════ */
  effect('light-flash', 'Light Flash', 'Bright white flash between shots', 'light', 0.5, '#ffffff', 'flash-white', false),
  effect('light-lens-flare', 'Lens Flare', 'Anamorphic lens flare sweep across frame', 'light', 0.7, '#38bdf8', 'lens-flare', false),
  effect('light-light-leak', 'Light Leak', 'Warm organic light leak overlay dissolve', 'light', 0.9, '#f97316', 'light-leak', false),

  /* ════════════════════════════════════════════════════════════════
     3D TRANSITIONS (2)
     ════════════════════════════════════════════════════════════════ */
  effect('3d-flip', '3D Flip', 'Cube-face flip rotating on Y axis', '3d', 0.9, '#64748b', 'rotateY', true),
  effect('3d-page-turn', 'Page Turn', '3D page-curl revealing next shot', '3d', 1.1, '#d4af37', 'page-curl', true),
];

const EFFECT_INDEX = new Map(TRANSITION_EFFECTS.map((e) => [e.id, e]));

export function getTransitionEffect(id: string): TransitionEffectDefinition | undefined {
  return EFFECT_INDEX.get(id);
}

export function getTransitionEffectsByCategory(category: TransitionEffectCategory): TransitionEffectDefinition[] {
  return TRANSITION_EFFECTS.filter((e) => e.category === category);
}

export const TRANSITION_CATEGORIES: { id: TransitionEffectCategory; label: string; description: string }[] = [
  { id: 'wipe', label: 'Wipes', description: 'Directional and shape wipes' },
  { id: 'dissolve', label: 'Dissolves', description: 'Crossfades and dip transitions' },
  { id: 'geometric', label: 'Geometric', description: 'Shape-based reveals' },
  { id: 'motion', label: 'Motion', description: 'Push, slide and whip pans' },
  { id: 'glitch', label: 'Glitch', description: 'Digital artefact transitions' },
  { id: 'light', label: 'Light', description: 'Flash, flare and leak effects' },
  { id: '3d', label: '3D', description: 'Three-dimensional rotations' },
];
