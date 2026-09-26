/**
 * WGSL grade + display-transform kernel.
 *
 * The final colourist stage of the realtime chain, one compute pass:
 * chromatic aberration (radial RGB split) → AO multiply → bloom add →
 * exposure (EV) → white balance → display transform (AgX / ACES / Neutral /
 * filmic / Reinhard) → contrast, vibrance, saturation → vignette → film
 * grain → triangular dither → sRGB encode.
 *
 * Output is display-referred sRGB written to an 8-bit storage texture; the
 * present pass (CAS sharpen) then feeds the canvas.
 */
import { WGSL_COMMON } from './wgslCommon';

export const GRADE_WGSL = /* wgsl */ `
${WGSL_COMMON}

struct GradeParams {
  resolution: vec2<f32>,
  time: f32,
  frame: f32,
  exposure: f32,
  contrast: f32,
  saturation: f32,
  vibrance: f32,
  temperature: f32,
  vignette_strength: f32,
  grain_amount: f32,
  ca_amount: f32,
  bloom_intensity: f32,
  ao_intensity: f32,
  tone_op: u32,
  flags: u32,
  pad0: f32,
}

// flags bits
const FLAG_USE_AO: u32 = 1u;
const FLAG_USE_BLOOM: u32 = 2u;
const FLAG_USE_CA: u32 = 4u;
const FLAG_USE_GRAIN: u32 = 8u;
const FLAG_USE_VIGNETTE: u32 = 16u;

@group(0) @binding(0) var<uniform> params: GradeParams;
@group(0) @binding(1) var hdr_tex: texture_2d<f32>;
@group(0) @binding(2) var bloom_tex: texture_2d<f32>;
@group(0) @binding(3) var ao_tex: texture_2d<f32>;
@group(0) @binding(4) var color_sampler: sampler;
@group(0) @binding(5) var out_tex: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8, 8, 1)
fn cs_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dims = vec2<u32>(params.resolution);
  if (gid.x >= dims.x || gid.y >= dims.y) { return; }
  let uv = (vec2<f32>(gid.xy) + 0.5) / params.resolution;

  // --- HDR gather (with optional radial chromatic aberration) -------------
  var hdr: vec3<f32>;
  if ((params.flags & FLAG_USE_CA) != 0u && params.ca_amount > 0.0) {
    let centered = uv - 0.5;
    let offset = centered * params.ca_amount * 0.02 * dot(centered, centered) * 4.0;
    hdr.r = textureSampleLevel(hdr_tex, color_sampler, uv + offset, 0.0).r;
    hdr.g = textureSampleLevel(hdr_tex, color_sampler, uv, 0.0).g;
    hdr.b = textureSampleLevel(hdr_tex, color_sampler, uv - offset, 0.0).b;
  } else {
    hdr = textureSampleLevel(hdr_tex, color_sampler, uv, 0.0).rgb;
  }

  // --- Scene-referred corrections ------------------------------------------
  if ((params.flags & FLAG_USE_AO) != 0u) {
    let ao = textureSampleLevel(ao_tex, color_sampler, uv, 0.0).r;
    hdr *= mix(1.0, clamp(ao, 0.0, 1.0), params.ao_intensity);
  }
  if ((params.flags & FLAG_USE_BLOOM) != 0u) {
    hdr += textureSampleLevel(bloom_tex, color_sampler, uv, 0.0).rgb * params.bloom_intensity;
  }

  hdr = apply_exposure(hdr, params.exposure);

  // White balance — temperature shifts along the blue↔amber axis.
  let wb = vec3<f32>(
    1.0 + params.temperature * 0.18,
    1.0,
    1.0 - params.temperature * 0.18,
  );
  hdr *= wb;

  // --- Display transform ----------------------------------------------------
  var ldr = tone_map(params.tone_op, hdr);

  // --- Display-referred grade ----------------------------------------------
  // Contrast around 0.18 mid grey.
  ldr = (ldr - 0.18) * (1.0 + params.contrast) + 0.18;

  // Vibrance (weak chroma boosted more) then straight saturation.
  let luma = luminance(ldr);
  let chroma = ldr - vec3<f32>(luma);
  let sat = length(chroma);
  let vib = params.vibrance * (1.0 - clamp(sat * 2.0, 0.0, 1.0) * 0.6);
  var graded = vec3<f32>(luma) + chroma * vib;
  graded = mix(vec3<f32>(luma), graded, params.saturation);
  ldr = clamp(graded, vec3<f32>(0.0), vec3<f32>(1.0));

  // --- Lens & sensor character ---------------------------------------------
  if ((params.flags & FLAG_USE_VIGNETTE) != 0u && params.vignette_strength > 0.0) {
    let centered = (uv - 0.5) * 2.0;
    let r = length(centered * vec2<f32>(1.0, 0.85));
    let vig = smoothstep(1.45, 0.35, r * params.vignette_strength + (1.0 - params.vignette_strength) * 0.7);
    ldr *= mix(1.0, vig, params.vignette_strength);
  }
  if ((params.flags & FLAG_USE_GRAIN) != 0u && params.grain_amount > 0.0) {
    // Luminance-weighted grain — lives in the mids like real film.
    let g = (frame_random(vec2<f32>(gid.xy), params.frame + floor(params.time * 24.0)) - 0.5);
    let luma_g = luminance(ldr);
    let weight = 4.0 * luma_g * (1.0 - luma_g);
    ldr += vec3<f32>(g * params.grain_amount * 0.25 * weight);
  }

  let d = dither(vec2<f32>(gid.xy), params.frame, 1.5 / 255.0);
  let out = linear_to_srgb(clamp(ldr, vec3<f32>(0.0), vec3<f32>(1.0))) + d;
  textureStore(out_tex, vec2<i32>(gid.xy), vec4<f32>(clamp(out, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0));
}
`;

/** Fullscreen-triangle present shader: contrast-adaptive sharpen → canvas. */
export const CAS_PRESENT_WGSL = /* wgsl */ `
${WGSL_COMMON}

struct PresentParams {
  texel_size: vec2<f32>,
  sharpness: f32,
  frame: f32,
}

@group(0) @binding(0) var<uniform> params: PresentParams;
@group(0) @binding(1) var ldr_tex: texture_2d<f32>;
@group(0) @binding(2) var ldr_sampler: sampler;

struct VsOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> VsOut {
  // Fullscreen triangle.
  var out: VsOut;
  let x = f32((vi << 1u) & 2u);
  let y = f32(vi & 2u);
  out.uv = vec2<f32>(x, 1.0 - y);
  out.position = vec4<f32>(x * 2.0 - 1.0, y * 2.0 - 1.0, 0.0, 1.0);
  return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let t = params.texel_size;
  let e = textureSampleLevel(ldr_tex, ldr_sampler, in.uv, 0.0).rgb;
  let n = textureSampleLevel(ldr_tex, ldr_sampler, in.uv + vec2<f32>(0.0, -t.y), 0.0).rgb;
  let s = textureSampleLevel(ldr_tex, ldr_sampler, in.uv + vec2<f32>(0.0, t.y), 0.0).rgb;
  let w = textureSampleLevel(ldr_tex, ldr_sampler, in.uv + vec2<f32>(-t.x, 0.0), 0.0).rgb;
  let o = textureSampleLevel(ldr_tex, ldr_sampler, in.uv + vec2<f32>(t.x, 0.0), 0.0).rgb;

  // AMD CAS: sharpen where local contrast is high, never amplify noise.
  let mn = min(e, min(min(n, s), min(w, o)));
  let mx = max(e, max(max(n, s), max(w, o)));
  let amp = clamp(min(mn, 1.0 - mx) / max(mx, EPS), 0.0, 1.0);
  let wgt = -amp * params.sharpness * 0.2;
  let sharpened = (e + (n + s + w + o) * wgt) / (1.0 + 4.0 * wgt);

  let d = dither(in.position.xy, params.frame, 1.0 / 255.0);
  return vec4<f32>(clamp(sharpened + d, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}
`;
