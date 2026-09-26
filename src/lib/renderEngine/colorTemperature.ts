/**
 * Physically based colour temperature for the light rig.
 *
 * Colour temperature is expressed in kelvin along the Planckian locus — the
 * actual chromaticity a black-body radiator takes at a given temperature — so
 * a 3200 K tungsten key and a 5600 K daylight key land on the same whites a
 * real fixture would. This replaces the old hand-picked "cool ↔ warm" hex
 * interpolation with a physically meaningful mapping.
 *
 * The Planckian approximation (Tanner Helland's fit of the CIE 1931 locus) is
 * accurate to a couple of Kelvin-mired across 1000 K – 40 000 K, which covers
 * every practical studio fixture (candle ~1800 K → HMI/shade ~9000 K).
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Physically plausible studio fixture range, in kelvin. */
export const MIN_KELVIN = 1800;
export const MAX_KELVIN = 12000;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Black-body colour for a temperature in kelvin, as linear-ish sRGB channels in
 * 0…1. Planckian-locus fit: below ~6600 K the red channel saturates and the
 * blue rises; above it the blue saturates and red falls — exactly the tungsten →
 * daylight → shade progression a lighting desk shows.
 */
export function kelvinToRgb(kelvin: number): Rgb {
  const t = clamp(kelvin, MIN_KELVIN, MAX_KELVIN) / 100;

  let r: number;
  let g: number;
  let b: number;

  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  }

  if (t >= 66) {
    b = 255;
  } else if (t <= 19) {
    b = 0;
  } else {
    b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  }

  return {
    r: clamp(r / 255, 0, 1),
    g: clamp(g / 255, 0, 1),
    b: clamp(b / 255, 0, 1),
  };
}

function toHex2(v: number): string {
  return Math.round(clamp(v, 0, 1) * 255)
    .toString(16)
    .padStart(2, '0');
}

/** Black-body colour for a temperature in kelvin, as `#rrggbb`. */
export function kelvinToHex(kelvin: number): string {
  const { r, g, b } = kelvinToRgb(kelvin);
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
}

/** Reciprocal colour temperature in mired — perceptually uniform for grading. */
export function kelvinToMired(kelvin: number): number {
  return 1_000_000 / clamp(kelvin, MIN_KELVIN, MAX_KELVIN);
}

/**
 * Operator temperature control → kelvin.
 *
 * The desk exposes colour balance as a single 0…1 fader (0 = cool daylight,
 * 0.5 = balanced, 1 = warm tungsten). It is remapped through mired so the fader
 * feels perceptually linear: equal steps read as equal shifts in warmth, the
 * way a real CC filter or LED fixture's CCT knob behaves.
 *
 *   0   → 7500 K (cool / north-window daylight)
 *   0.5 → 5600 K (balanced daylight)
 *   1   → 2700 K (warm tungsten)
 */
export function temperatureToKelvin(temperature: number): number {
  const t = clamp(temperature, 0, 1);
  const warmMired = 1_000_000 / 2700;
  const coolMired = 1_000_000 / 7500;
  const mired = coolMired + (warmMired - coolMired) * t;
  return 1_000_000 / mired;
}

/** Convenience: the rig's white-balance colour for a 0…1 temperature fader. */
export function temperatureColor(temperature: number): string {
  return kelvinToHex(temperatureToKelvin(temperature));
}

/**
 * Physically accurate light falloff (inverse-square) for point/spot emitters.
 *
 * Returns the intensity multiplier at `distance` for a light of `range` using
 * the standard three.js punctual-light attenuation: smooth windowed
 * inverse-square decay so energy falls off as 1/d² (the physical law) without
 * the singularity at the source. Three applies this via `decay` + `distance`;
 * this helper exists so intensity can be authored in physical terms (candela)
 * and converted to a target illuminance at a working distance.
 */
export function falloffAt(distance: number, decay = 2, referenceDistance = 1): number {
  const d = Math.max(referenceDistance, distance);
  return Math.pow(referenceDistance / d, decay);
}

/**
 * Candela → the intensity value three.js needs for a punctual light to deliver
 * `targetIlluminance` (lux) at `distance` metres under inverse-square falloff.
 * Lets the rig be authored in real fixture terms (lux on the desk) rather than
 * arbitrary units.
 */
export function intensityForIlluminance(targetIlluminance: number, distance: number, decay = 2): number {
  const d = Math.max(0.01, distance);
  return targetIlluminance * Math.pow(d, decay);
}
