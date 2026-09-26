/**
 * WGSL temporal anti-aliasing kernel.
 *
 * Catmull-Rom-free, console-style TAA: jittered current frame is resolved
 * against a reprojected history that is clipped to the YCoCg neighbourhood
 * AABB (Karis' "Temporal AA and the Quest for the Holy Trail", Siggraph
 * 2014). Reprojection uses the depth buffer and the previous view-projection
 * matrix; without depth it degrades to a stable sub-pixel blend.
 */
import { WGSL_COMMON } from './wgslCommon';

export const TAA_WGSL = /* wgsl */ `
${WGSL_COMMON}

struct TaaParams {
  resolution: vec2<f32>,
  history_weight: f32,
  use_reprojection: f32,
  frame: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
  prev_view_proj: mat4x4<f32>,
  inv_view_proj: mat4x4<f32>,
}

@group(0) @binding(0) var<uniform> params: TaaParams;
@group(0) @binding(1) var current_tex: texture_2d<f32>;
@group(0) @binding(2) var history_tex: texture_2d<f32>;
@group(0) @binding(3) var color_sampler: sampler;
@group(0) @binding(4) var out_tex: texture_storage_2d<rgba16float, write>;
@group(0) @binding(5) var depth_tex: texture_depth_2d;

fn sample_current(pixel: vec2<i32>) -> vec3<f32> {
  return textureLoad(current_tex, pixel, 0).rgb;
}

@compute @workgroup_size(8, 8, 1)
fn cs_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dims = vec2<u32>(params.resolution);
  if (gid.x >= dims.x || gid.y >= dims.y) { return; }
  let uv = (vec2<f32>(gid.xy) + 0.5) / params.resolution;

  // Neighbourhood statistics in YCoCg — clamping chroma separately keeps
  // saturated lights from flickering while history settles.
  var m1 = vec3<f32>(0.0);
  var m2 = vec3<f32>(0.0);
  var nmin = vec3<f32>(1e9);
  var nmax = vec3<f32>(-1e9);
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let pixel = vec2<i32>(gid.xy) + vec2<i32>(x, y);
      let c = rgb_to_ycocg(sample_current(clamp(pixel, vec2<i32>(0), vec2<i32>(dims) - 1)));
      m1 += c;
      m2 += c * c;
      nmin = min(nmin, c);
      nmax = max(nmax, c);
    }
  }
  let mean = m1 / 9.0;
  let sigma = sqrt(max(m2 / 9.0 - mean * mean, vec3<f32>(0.0)));
  // Soften the clip box by one standard deviation to avoid ghosting halos.
  let clip_min = nmin; // keep tight — variance weights handle noise
  let clip_max = nmax;

  // Reproject history through world space when depth is available.
  var history_uv = uv;
  if (params.use_reprojection > 0.5) {
    let d = textureLoad(depth_tex, vec2<i32>(gid.xy), 0);
    let clip = vec4<f32>(uv * 2.0 - 1.0, d, 1.0);
    let world = params.inv_view_proj * clip;
    let world_h = world / world.w;
    let prev = params.prev_view_proj * world_h;
    let prev_ndc = prev.xy / prev.w;
    history_uv = prev_ndc * 0.5 + 0.5;
    if (any(history_uv < vec2<f32>(0.0)) || any(history_uv > vec2<f32>(1.0))) {
      history_uv = uv;
    }
  }

  let current = sample_current(vec2<i32>(gid.xy));
  let history = textureSampleLevel(history_tex, color_sampler, history_uv, 0.0).rgb;
  let history_ycocg = clamp(rgb_to_ycocg(history), clip_min, clip_max);
  let history_clamped = ycocg_to_rgb(history_ycocg);

  // Variance-aware blend: more history where the neighbourhood is stable.
  let variance = luminance(sigma);
  let stability = 1.0 / (1.0 + variance * 12.0);
  let weight = clamp(params.history_weight * stability, 0.55, 0.97);
  let resolved = mix(current, history_clamped, weight);

  textureStore(out_tex, vec2<i32>(gid.xy), vec4<f32>(resolved, 1.0));
}
`;
