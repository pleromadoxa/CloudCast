/**
 * WGSL common kernel library.
 *
 * Shared math every CloudCast kernel builds on: hashing/sampling, colour
 * science (sRGB, luminance, YCoCg), and the display transforms (AgX, ACES,
 * Khronos PBR Neutral, filmic, Reinhard). This is the colourist brain of the
 * engine — the same operators are mirrored for the WebGL2 path via the
 * `postprocessing` ToneMappingMode enum so both backends grade identically.
 *
 * All kernels include this source via string composition.
 */

export const WGSL_COMMON = /* wgsl */ `
const PI: f32 = 3.141592653589793;
const EPS: f32 = 1e-5;

/* ------------------------------------------------------------ hashing --- */

fn pcg_hash(v: u32) -> u32 {
  var state = v * 747796405u + 2891336453u;
  let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

fn hash12(p: vec2<f32>) -> f32 {
  let p3 = fract(vec3<f32>(p.xyx) * 0.1031);
  let p3d = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3d.x + p3d.y) * p3d.z);
}

fn hash33(p: vec3<f32>) -> vec3<f32> {
  var p3 = fract(p * vec3<f32>(0.1031, 0.1030, 0.0973));
  p3 = p3 + dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}

/** Owen-scrambled-ish per-pixel random in [0,1) keyed on frame. */
fn frame_random(pixel: vec2<f32>, frame: f32) -> f32 {
  let s = pcg_hash(u32(pixel.x) * 1973u + u32(pixel.y) * 9277u + u32(frame) * 26699u);
  return f32(s) * (1.0 / 4294967296.0);
}

/** 2D golden-ratio / R2 low discrepancy sequence — decorrelates samples. */
fn r2_sequence(index: u32) -> vec2<f32> {
  let g = 1.32471795724474602596;
  let a1 = 1.0 / g;
  let a2 = 1.0 / (g * g);
  return fract(vec2<f32>(0.5 + a1 * f32(index), 0.5 + a2 * f32(index)));
}

/* ------------------------------------------------------- colour space --- */

fn luminance(c: vec3<f32>) -> f32 {
  return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
}

fn linear_to_srgb(c: vec3<f32>) -> vec3<f32> {
  let lo = c * 12.92;
  let hi = 1.055 * pow(max(c, vec3<f32>(0.0)), vec3<f32>(1.0 / 2.4)) - 0.055;
  return select(hi, lo, c <= vec3<f32>(0.0031308));
}

fn srgb_to_linear(c: vec3<f32>) -> vec3<f32> {
  let lo = c / 12.92;
  let hi = pow((c + 0.055) / 1.055, vec3<f32>(2.4));
  return select(hi, lo, c <= vec3<f32>(0.04045));
}

fn rgb_to_ycocg(c: vec3<f32>) -> vec3<f32> {
  return vec3<f32>(
    0.25 * c.r + 0.5 * c.g + 0.25 * c.b,
    0.5 * c.r - 0.5 * c.b,
    -0.25 * c.r + 0.5 * c.g - 0.25 * c.b,
  );
}

fn ycocg_to_rgb(c: vec3<f32>) -> vec3<f32> {
  return vec3<f32>(c.x + c.y - c.z, c.x + c.z, c.x - c.y - c.z);
}

/* ---------------------------------------------------- tone mapping --- */

fn apply_exposure(c: vec3<f32>, ev: f32) -> vec3<f32> {
  return c * exp2(ev);
}

/** AgX — Blender/Filament reference approximation (highlight hue hold). */
fn agx_contrast(x: vec3<f32>) -> vec3<f32> {
  let x2 = x * x;
  let x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}

fn agx(c_in: vec3<f32>) -> vec3<f32> {
  let agx_mat = mat3x3<f32>(
    vec3<f32>(0.842479062253094, 0.0423282422610123, 0.0423756549057051),
    vec3<f32>(0.0784335999999992, 0.878468636469772, 0.0784336),
    vec3<f32>(0.0792237451477643, 0.0791661274605434, 0.879142973793104),
  );
  let min_ev = -12.47393;
  let max_ev = 4.026069;
  let v = max(c_in, vec3<f32>(0.0)) * agx_mat;
  let v2 = clamp(log2(max(v, vec3<f32>(1e-10))), vec3<f32>(min_ev), vec3<f32>(max_ev));
  let norm = (v2 - min_ev) / (max_ev - min_ev);
  return max(agx_contrast(norm), vec3<f32>(0.0));
}

/** ACES fitted (Stephen Hill) — RRT + ODT approximation. */
fn aces_fitted(c: vec3<f32>) -> vec3<f32> {
  let input_mat = mat3x3<f32>(
    vec3<f32>(0.59719, 0.07600, 0.02840),
    vec3<f32>(0.35458, 0.90834, 0.13383),
    vec3<f32>(0.04823, 0.01566, 0.83777),
  );
  let output_mat = mat3x3<f32>(
    vec3<f32>(1.60475, -0.10208, -0.00327),
    vec3<f32>(-0.53108, 1.10813, -0.07276),
    vec3<f32>(-0.07367, -0.00605, 1.07602),
  );
  let v = c * input_mat;
  let a = v * (v + 0.0245786) - 0.000090537;
  let b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return clamp((a / b) * output_mat, vec3<f32>(0.0), vec3<f32>(1.0));
}

/** Khronos PBR Neutral — hue-accurate display transform. */
fn neutral_khronos(c_in: vec3<f32>) -> vec3<f32> {
  let start_compression = 0.76;
  let desaturation = 0.15;
  let c = max(c_in, vec3<f32>(0.0));
  let x = min(c.r, min(c.g, c.b));
  let offset = select(0.04, x - 6.25 * x * x, x < 0.08);
  let shifted = c - offset;
  let peak = max(shifted.r, max(shifted.g, shifted.b));
  if (peak < start_compression) {
    return shifted;
  }
  let d = 1.0 - start_compression;
  let new_peak = 1.0 - d * d / (peak + d - start_compression);
  let compressed = shifted * (new_peak / peak);
  let g = 1.0 - 1.0 / (desaturation * (peak - new_peak) + 1.0);
  return mix(compressed, vec3<f32>(new_peak), g);
}

/** Hejl-Burgess-Dawson filmic with a gentle white point. */
fn filmic(c: vec3<f32>) -> vec3<f32> {
  let x = max(vec3<f32>(0.0), c - 0.004);
  return (x * (6.2 * x + 0.5)) / (x * (6.2 * x + 1.7) + 0.06);
}

fn reinhard_extended(c: vec3<f32>) -> vec3<f32> {
  let white = 4.0;
  return (c * (1.0 + c / (white * white))) / (1.0 + c);
}

/**
 * Operator dispatcher — must stay in sync with ToneMapOperator in
 * src/lib/renderEngine/types.ts (0 agx, 1 aces, 2 neutral, 3 filmic,
 * 4 reinhard, 5 linear).
 */
fn tone_map(op: u32, c: vec3<f32>) -> vec3<f32> {
  switch op {
    case 0u: { return agx(c); }
    case 1u: { return aces_fitted(c); }
    case 2u: { return neutral_khronos(c); }
    case 3u: { return filmic(c); }
    case 4u: { return reinhard_extended(c); }
    default: { return clamp(c, vec3<f32>(0.0), vec3<f32>(1.0)); }
  }
}

/* ------------------------------------------------------------- misc --- */

/** Triangular PDF dither — breaks 8-bit banding in dark gradients. */
fn dither(pixel: vec2<f32>, frame: f32, strength: f32) -> f32 {
  let r = frame_random(pixel, frame);
  return (r - 0.5) * strength;
}

fn luma_ycocg(c: vec3<f32>) -> f32 {
  return rgb_to_ycocg(c).x;
}
`;
