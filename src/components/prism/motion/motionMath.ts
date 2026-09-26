import * as THREE from 'three';

/** Timing + easing helpers for the Regal Prism 3D motion graphics engine. */

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const clamp = (x: number, min: number, max: number): number => (x < min ? min : x > max ? max : x);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeOutQuint = (t: number): number => 1 - Math.pow(1 - t, 5);
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeInCubic = (t: number): number => t * t * t;
export const easeOutExpo = (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeInExpo = (t: number): number => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10));
/** Overshoot-and-settle — the classic "punch into place" for title cards. */
export const backOut = (t: number, s = 1.70158): number =>
  1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / (edge1 - edge0 || 1e-6));
  return t * t * (3 - 2 * t);
};

/** Damped spring settle (critically-ish damped) for camera moves. */
export const settle = (t: number, damp = 5.5): number => 1 - Math.exp(-damp * t);

/**
 * Normalised, eased progress of `t` inside the window `[start, end]`.
 * The workhorse for every cue in a template timeline.
 */
export const seg = (
  t: number,
  start: number,
  end: number,
  ease: (x: number) => number = easeOutCubic,
): number => ease(clamp01((t - start) / Math.max(1e-6, end - start)));

/** 1 at `at`, decaying linearly to 0 over `width` seconds (after the peak). */
export const decay = (t: number, at: number, width: number): number => {
  if (t < at) return 0;
  return clamp01(1 - (t - at) / Math.max(1e-6, width));
};

/** Symmetric bell peaking at `at` — used for flashes and bloom pulses. */
export const bell = (t: number, at: number, width: number): number => {
  const x = (t - at) / Math.max(1e-6, width);
  return Math.exp(-4 * x * x);
};

/** Frame-rate independent exponential smoothing. */
export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

/** Deterministic PRNG so shard layouts are identical on every render. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shared circular sprite (soft dot) for additive particle systems. */
let particleSprite: THREE.Texture | null = null;
export function getParticleSprite(): THREE.Texture {
  if (particleSprite) return particleSprite;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  particleSprite = texture;
  return texture;
}

/** Radial glow texture — backdrops, flashes and light leaks. */
let radialGlow: THREE.Texture | null = null;
export function getRadialGlowTexture(): THREE.Texture {
  if (radialGlow) return radialGlow;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  radialGlow = texture;
  return texture;
}

/** Horizontal specular sweep strip — the gleam that crosses chrome and gold. */
let sweepTexture: THREE.Texture | null = null;
export function getSweepTexture(): THREE.Texture {
  if (sweepTexture) return sweepTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 8;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.15)');
  grad.addColorStop(0.5, 'rgba(255,255,255,1)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.15)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 8);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  sweepTexture = texture;
  return texture;
}

/** Vertical gradient backdrop (deep void with an accent-tinted horizon). */
let backdropTexture: THREE.Texture | null = null;
export function getBackdropTexture(): THREE.Texture {
  if (backdropTexture) return backdropTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#05060a');
  grad.addColorStop(0.55, '#0a0b11');
  grad.addColorStop(1, '#000000');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 8, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  backdropTexture = texture;
  return texture;
}

/** Bright at the cone apex, dissolving into the air — volumetric shaft map. */
let shaftTexture: THREE.Texture | null = null;
export function getShaftTexture(): THREE.Texture {
  if (shaftTexture) return shaftTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.42)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  shaftTexture = texture;
  return texture;
}
