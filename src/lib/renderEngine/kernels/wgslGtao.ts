/**
 * WGSL ground-truth ambient occlusion (GTAO) kernel.
 *
 * Horizon-search screen-space AO with the arc-integration visibility term
 * from Jimenez et al. "Practical Realtime Strategies for Accurate Indirect
 * Occlusion" — the math shipped in XeGTAO/RTXGI, trimmed for the web. Works
 * from the depth buffer alone (normals reconstructed from depth derivatives),
 * so any WebGPU surface with a depth attachment can use it. A bilateral
 * cross-blur follows to remove the sampling noise. Output packs
 * (ao, view depth) so the blur can reject across depth discontinuities.
 */
import { WGSL_COMMON } from './wgslCommon';

const GTAO_BINDINGS = /* wgsl */ `
struct GtaoParams {
  resolution: vec2<f32>,
  inv_view_proj: mat4x4<f32>,
  view_proj: mat4x4<f32>,
  camera_pos: vec3<f32>,
  radius: f32,
  intensity: f32,
  frame: f32,
  proj_scale: f32,
  thickness_heuristic: f32,
}

@group(0) @binding(0) var<uniform> params: GtaoParams;
@group(0) @binding(1) var depth_tex: texture_depth_2d;
@group(0) @binding(2) var ao_out: texture_storage_2d<rgba16float, write>;
`;

export const GTAO_WGSL = /* wgsl */ `
${WGSL_COMMON}
${GTAO_BINDINGS}

const GTAO_DIRECTIONS: u32 = 4u;
const GTAO_STEPS: u32 = 6u;

fn sign_f_safe(v: f32) -> f32 {
  return select(-1.0, 1.0, v >= 0.0);
}

fn view_position(uv: vec2<f32>) -> vec3<f32> {
  let pixel = vec2<i32>(uv * params.resolution);
  let d = textureLoad(depth_tex, pixel, 0);
  let clip = vec4<f32>(uv * 2.0 - 1.0, d, 1.0);
  let world = params.inv_view_proj * clip;
  return world.xyz / world.w - params.camera_pos;
}

@compute @workgroup_size(8, 8, 1)
fn cs_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dims = vec2<u32>(params.resolution);
  if (gid.x >= dims.x || gid.y >= dims.y) { return; }
  let uv = (vec2<f32>(gid.xy) + 0.5) / params.resolution;

  let depth = textureLoad(depth_tex, vec2<i32>(gid.xy), 0);
  if (depth >= 1.0) {
    // Sky / far plane — no occlusion.
    textureStore(ao_out, vec2<i32>(gid.xy), vec4<f32>(1.0, 1e6, 0.0, 1.0));
    return;
  }

  let p = view_position(uv);
  let px = view_position(uv + vec2<f32>(1.0, 0.0) / params.resolution);
  let py = view_position(uv + vec2<f32>(0.0, 1.0) / params.resolution);
  var normal = normalize(cross(px - p, py - p));
  if (dot(normal, -normalize(p)) < 0.0) { normal = -normal; }
  let view_dir = normalize(-p);

  // Slice rotation and step offsets — R2 sequence + per-pixel jitter.
  let noise = frame_random(vec2<f32>(gid.xy), params.frame);
  let r2 = r2_sequence(u32(params.frame) * 256u + gid.x + gid.y * 8192u);

  var visibility = 0.0;
  let radius_px = clamp(
    params.radius * params.proj_scale / max(-p.z, 0.1),
    4.0,
    128.0,
  );

  for (var d_i = 0u; d_i < GTAO_DIRECTIONS; d_i++) {
    let angle = (f32(d_i) + noise) * PI / f32(GTAO_DIRECTIONS);
    let dir = vec2<f32>(cos(angle), sin(angle));

    var horizon_cos_neg = -1.0;
    var horizon_cos_pos = -1.0;

    for (var s_i = 1u; s_i <= GTAO_STEPS; s_i++) {
      let t = (f32(s_i) - 0.5 + r2.x) / f32(GTAO_STEPS);
      let offset_px = dir * t * radius_px;

      for (var side = 0; side < 2; side++) {
        let sign_f = select(1.0, -1.0, side == 0);
        let sample_uv = uv + sign_f * offset_px / params.resolution;
        if (any(sample_uv < vec2<f32>(0.0)) || any(sample_uv > vec2<f32>(1.0))) {
          continue;
        }
        let s = view_position(sample_uv);
        let delta = s - p;
        let dist2 = dot(delta, delta);
        if (dist2 < EPS) { continue; }
        let dist = sqrt(dist2);
        let falloff = clamp(1.0 - dist / (params.radius * 4.0), 0.0, 1.0);
        let cos_h = dot(delta / dist, view_dir) * falloff;
        if (side == 0) {
          horizon_cos_neg = max(horizon_cos_neg, cos_h);
        } else {
          horizon_cos_pos = max(horizon_cos_pos, cos_h);
        }
      }
    }

    // Project the normal into the slice plane and integrate the visible arc.
    let slice_dir = vec3<f32>(dir, 0.0);
    let ortho_dir = slice_dir - dot(slice_dir, view_dir) * view_dir;
    let axis = normalize(cross(view_dir, ortho_dir));
    let proj_normal = normal - axis * dot(normal, axis);
    let proj_len = length(proj_normal);
    if (proj_len < EPS) { continue; }
    let proj_n = proj_normal / proj_len;
    let cos_n = clamp(dot(proj_n, view_dir), -1.0, 1.0);
    let n_angle = sign_f_safe(dot(proj_n, cross(view_dir, axis))) * acos(cos_n);

    let h_neg = -acos(clamp(horizon_cos_neg, -1.0, 1.0));
    let h_pos = acos(clamp(horizon_cos_pos, -1.0, 1.0));
    let h1 = clamp(h_neg + n_angle, -PI * 0.5, PI * 0.5);
    let h2 = clamp(h_pos + n_angle, -PI * 0.5, PI * 0.5);

    // GTAO arc integral over the visible horizon arc.
    let a = 0.25 * (-cos(2.0 * h1 - n_angle) + cos(n_angle) + 2.0 * h1 * sin(n_angle));
    let b = 0.25 * (-cos(2.0 * h2 - n_angle) + cos(n_angle) + 2.0 * h2 * sin(n_angle));
    visibility += proj_len * (a + b);
  }

  visibility /= f32(GTAO_DIRECTIONS);
  let ao = clamp(pow(clamp(visibility, 0.0, 1.0), params.intensity), 0.0, 1.0);
  textureStore(ao_out, vec2<i32>(gid.xy), vec4<f32>(ao, -p.z, 0.0, 1.0));
}
`;

export const GTAO_BLUR_WGSL = /* wgsl */ `
${WGSL_COMMON}

struct BlurParams {
  resolution: vec2<f32>,
  direction: vec2<f32>,
  depth_sigma: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
}

@group(0) @binding(0) var<uniform> params: BlurParams;
@group(0) @binding(1) var ao_tex: texture_2d<f32>;
@group(0) @binding(2) var ao_sampler: sampler;
@group(0) @binding(3) var ao_out: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8, 1)
fn cs_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dims = vec2<u32>(params.resolution);
  if (gid.x >= dims.x || gid.y >= dims.y) { return; }
  let uv = (vec2<f32>(gid.xy) + 0.5) / params.resolution;
  let center = textureSampleLevel(ao_tex, ao_sampler, uv, 0.0);

  var acc = center.r;
  var wsum = 1.0;
  for (var i = 1; i <= 3; i++) {
    let fi = f32(i);
    for (var side = 0; side < 2; side++) {
      let sign_f = select(1.0, -1.0, side == 0);
      let sample_uv = uv + sign_f * params.direction * fi / params.resolution;
      let s = textureSampleLevel(ao_tex, ao_sampler, sample_uv, 0.0);
      let w_depth = exp(-abs(s.g - center.g) / max(params.depth_sigma, EPS));
      let w = w_depth * exp(-fi * fi * 0.25);
      acc += s.r * w;
      wsum += w;
    }
  }
  textureStore(ao_out, vec2<i32>(gid.xy), vec4<f32>(acc / wsum, center.g, 0.0, 1.0));
}
`;
