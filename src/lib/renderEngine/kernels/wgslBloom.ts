/**
 * WGSL bloom kernel — physically-plausible progressive mip bloom.
 *
 * Pipeline (Jimenez, "Next Generation Post Processing in Call of Duty: AW"):
 * threshold prefilter with Karis firefly clamp → 6-level 13-tap downsample →
 * 3x3 tent upsample chain that adds each level back. The result is a wide,
 * stable glow around emissive LED walls and practicals without the veiling
 * flare of single-pass blur.
 */
import { WGSL_COMMON } from './wgslCommon';

const BLOOM_BINDINGS = /* wgsl */ `
struct BloomParams {
  texel_size: vec2<f32>,
  threshold: f32,
  knee: f32,
  intensity: f32,
  level: f32,
  pad0: f32,
  pad1: f32,
}

@group(0) @binding(0) var<uniform> params: BloomParams;
@group(0) @binding(1) var src_tex: texture_2d<f32>;
@group(0) @binding(2) var src_sampler: sampler;
@group(0) @binding(3) var dst_tex: texture_storage_2d<rgba16float, write>;
`;

export const BLOOM_PREFILTER = /* wgsl */ `
${WGSL_COMMON}
${BLOOM_BINDINGS}

fn karis_average(c: vec3<f32>) -> f32 {
  return 1.0 / (1.0 + luminance(c));
}

@compute @workgroup_size(8, 8, 1)
fn cs_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dims = textureDimensions(dst_tex);
  if (gid.x >= dims.x || gid.y >= dims.y) { return; }
  let uv = (vec2<f32>(gid.xy) + 0.5) * params.texel_size;
  let t = params.texel_size;

  // 4-tap box with Karis weighting — kills single-pixel fireflies before they
  // smear across the whole mip chain.
  var acc = vec3<f32>(0.0);
  var wsum = 0.0;
  for (var i = 0; i < 4; i++) {
    let offset = vec2<f32>(f32(i & 1) - 0.5, f32(i >> 1) - 0.5) * 2.0 * t;
    let c = textureSampleLevel(src_tex, src_sampler, uv + offset, 0.0).rgb;
    let w = karis_average(c);
    acc += c * w;
    wsum += w;
  }
  var color = acc / max(wsum, EPS);

  // Soft-knee threshold (Unity/URP formulation).
  let br = max(color.r, max(color.g, color.b));
  let soft = br - params.threshold + params.knee;
  let contribution = clamp(soft * soft / (4.0 * params.knee + EPS), 0.0, max(br - params.threshold, 0.0));
  color *= contribution / max(br, EPS);

  textureStore(dst_tex, vec2<i32>(gid.xy), vec4<f32>(color, 1.0));
}
`;

export const BLOOM_DOWNSAMPLE = /* wgsl */ `
${WGSL_COMMON}
${BLOOM_BINDINGS}

@compute @workgroup_size(8, 8, 1)
fn cs_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dims = textureDimensions(dst_tex);
  if (gid.x >= dims.x || gid.y >= dims.y) { return; }
  let uv = (vec2<f32>(gid.xy) + 0.5) * params.texel_size;
  let t = params.texel_size;

  // 13-tap downsample — a b c / j k / d e f / l m / g h i.
  let a = textureSampleLevel(src_tex, src_sampler, uv + vec2<f32>(-2.0, 2.0) * t, 0.0).rgb;
  let b = textureSampleLevel(src_tex, src_sampler, uv + vec2<f32>(0.0, 2.0) * t, 0.0).rgb;
  let c = textureSampleLevel(src_tex, src_sampler, uv + vec2<f32>(2.0, 2.0) * t, 0.0).rgb;
  let d = textureSampleLevel(src_tex, src_sampler, uv + vec2<f32>(-2.0, 0.0) * t, 0.0).rgb;
  let e = textureSampleLevel(src_tex, src_sampler, uv, 0.0).rgb;
  let f = textureSampleLevel(src_tex, src_sampler, uv + vec2<f32>(2.0, 0.0) * t, 0.0).rgb;
  let g = textureSampleLevel(src_tex, src_sampler, uv + vec2<f32>(-2.0, -2.0) * t, 0.0).rgb;
  let h = textureSampleLevel(src_tex, src_sampler, uv + vec2<f32>(0.0, -2.0) * t, 0.0).rgb;
  let i = textureSampleLevel(src_tex, src_sampler, uv + vec2<f32>(2.0, -2.0) * t, 0.0).rgb;
  let j = textureSampleLevel(src_tex, src_sampler, uv + vec2<f32>(-1.0, 1.0) * t, 0.0).rgb;
  let k = textureSampleLevel(src_tex, src_sampler, uv + vec2<f32>(1.0, 1.0) * t, 0.0).rgb;
  let l = textureSampleLevel(src_tex, src_sampler, uv + vec2<f32>(-1.0, -1.0) * t, 0.0).rgb;
  let m = textureSampleLevel(src_tex, src_sampler, uv + vec2<f32>(1.0, -1.0) * t, 0.0).rgb;

  var color = e * 0.125;
  color += (a + c + g + i) * 0.03125;
  color += (b + d + f + h) * 0.0625;
  color += (j + k + l + m) * 0.125;

  textureStore(dst_tex, vec2<i32>(gid.xy), vec4<f32>(color, 1.0));
}
`;

export const BLOOM_UPSAMPLE = /* wgsl */ `
${WGSL_COMMON}
${BLOOM_BINDINGS}

@group(0) @binding(4) var add_tex: texture_2d<f32>;

@compute @workgroup_size(8, 8, 1)
fn cs_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dims = textureDimensions(dst_tex);
  if (gid.x >= dims.x || gid.y >= dims.y) { return; }
  let uv = (vec2<f32>(gid.xy) + 0.5) * params.texel_size;
  let t = params.texel_size;

  // 3x3 tent filter on the smaller level.
  var up = textureSampleLevel(src_tex, src_sampler, uv + vec2<f32>(-1.0, 1.0) * t, 0.0).rgb;
  up += textureSampleLevel(src_tex, src_sampler, uv + vec2<f32>(0.0, 1.0) * t, 0.0).rgb * 2.0;
  up += textureSampleLevel(src_tex, src_sampler, uv + vec2<f32>(1.0, 1.0) * t, 0.0).rgb;
  up += textureSampleLevel(src_tex, src_sampler, uv + vec2<f32>(-1.0, 0.0) * t, 0.0).rgb * 2.0;
  up += textureSampleLevel(src_tex, src_sampler, uv, 0.0).rgb * 4.0;
  up += textureSampleLevel(src_tex, src_sampler, uv + vec2<f32>(1.0, 0.0) * t, 0.0).rgb * 2.0;
  up += textureSampleLevel(src_tex, src_sampler, uv + vec2<f32>(-1.0, -1.0) * t, 0.0).rgb;
  up += textureSampleLevel(src_tex, src_sampler, uv + vec2<f32>(0.0, -1.0) * t, 0.0).rgb * 2.0;
  up += textureSampleLevel(src_tex, src_sampler, uv + vec2<f32>(1.0, -1.0) * t, 0.0).rgb;
  up *= 1.0 / 16.0;

  // Additive blend back into the larger level.
  let base = textureSampleLevel(add_tex, src_sampler, uv, 0.0).rgb;
  textureStore(dst_tex, vec2<i32>(gid.xy), vec4<f32>(base + up, 1.0));
}
`;
