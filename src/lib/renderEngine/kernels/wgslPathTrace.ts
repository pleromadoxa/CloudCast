/**
 * WGSL progressive path tracer kernel.
 *
 * The engine's cinematic tier: unbiased-ish global illumination computed with
 * a compute-shader path tracer (no hardware ray tracing required — works on
 * every WebGPU device). Feature set follows the current state of the web art
 * (C2-Renderer, webgpu-doom-pathtracer, ReSTIR-style pipelines):
 *
 * - SAH BVH traversal (CPU-built, flattened GPU buffers)
 * - GGX microfacet + Lambertian metallic/roughness BRDF
 * - next-event estimation with multiple importance sampling (triangle lights
 *   AND luminance-CDF importance-sampled HDRI environments)
 * - Russian roulette path termination
 * - R2 low-discrepancy jittered sampling with progressive accumulation
 * - second-moment tracking for variance-guided denoising
 *
 * One sample per pixel per dispatch — accumulation converges over frames, so
 * the render is always live and interruptible.
 */
import { WGSL_COMMON } from './wgslCommon';

export const PATH_TRACE_WGSL = /* wgsl */ `
${WGSL_COMMON}

struct PathUniforms {
  cam_pos: vec3<f32>, tan_half_fov: f32,
  cam_right: vec3<f32>, width: f32,
  cam_up: vec3<f32>, height: f32,
  cam_forward: vec3<f32>, frame: f32,
  env_intensity: f32,
  bounces: u32,
  samples_per_frame: u32,
  tri_count: u32,
  emissive_count: u32,
  env_width: u32,
  env_height: u32,
  reset: u32,
}

struct Material {
  base_color: vec4<f32>,   // rgb + unused
  params: vec4<f32>,       // metallic, roughness, ior, unused
  emissive: vec4<f32>,     // rgb + unused
}

struct BvhNode {
  bmin: vec4<f32>,         // xyz + left_first
  bmax: vec4<f32>,         // xyz + count (0 = inner node)
}

@group(0) @binding(0) var<uniform> u: PathUniforms;
@group(0) @binding(1) var<storage, read> tri_vertices: array<vec4<f32>>;  // 3/tri: xyz + materialId
@group(0) @binding(2) var<storage, read> tri_edges: array<vec4<f32>>;     // 2/tri: e1.xyz+area, e2.xyz+pad
@group(0) @binding(3) var<storage, read> tri_normals: array<vec4<f32>>;   // 3/tri: xyz
@group(0) @binding(4) var<storage, read> materials: array<Material>;
@group(0) @binding(5) var<storage, read> bvh_nodes: array<BvhNode>;
@group(0) @binding(6) var<storage, read> tri_indices: array<u32>;         // BVH leaves + emissive list appended
@group(0) @binding(7) var env_tex: texture_2d<f32>;
@group(0) @binding(8) var env_sampler: sampler;
// Luminance CDF: rows texture (env_height x env_width), marginal (env_height x 1),
// per-texel pdf (env_height x env_width) — all r32float, loaded without sampling.
@group(0) @binding(9) var env_cdf_rows: texture_2d<f32>;
@group(0) @binding(10) var env_cdf_marg: texture_2d<f32>;
@group(0) @binding(11) var env_pdf: texture_2d<f32>;
@group(0) @binding(12) var<storage, read_write> accum: array<vec4<f32>>;  // 2/pixel: rgb+samples, lum²+pad
@group(0) @binding(13) var<storage, read_write> gbuffer: array<vec4<f32>>; // normal.xyz + view depth

struct Hit {
  t: f32,
  tri: u32,
  u: f32,
  v: f32,
  valid: bool,
}

fn hit_valid(h: Hit) -> bool { return h.valid; }

fn make_miss() -> Hit {
  var h: Hit;
  h.t = 1e30;
  h.tri = 0u;
  h.u = 0.0;
  h.v = 0.0;
  h.valid = false;
  return h;
}

fn intersect_tri(ro: vec3<f32>, rd: vec3<f32>, tri: u32, best_t: f32) -> Hit {
  let i0 = tri * 3u;
  let p0 = tri_vertices[i0].xyz;
  let e1 = tri_edges[tri * 2u].xyz;
  let e2 = tri_edges[tri * 2u + 1u].xyz;
  let pv = cross(rd, e2);
  let det = dot(e1, pv);
  if (abs(det) < 1e-9) { return make_miss(); }
  let inv_det = 1.0 / det;
  let tv = ro - p0;
  let uu = dot(tv, pv) * inv_det;
  if (uu < 0.0 || uu > 1.0) { return make_miss(); }
  let qv = cross(tv, e1);
  let vv = dot(rd, qv) * inv_det;
  if (vv < 0.0 || uu + vv > 1.0) { return make_miss(); }
  let t = dot(e2, qv) * inv_det;
  if (t <= 1e-4 || t >= best_t) { return make_miss(); }
  var h: Hit;
  h.t = t;
  h.tri = tri;
  h.u = uu;
  h.v = vv;
  h.valid = true;
  return h;
}

fn intersect_bvh(ro: vec3<f32>, rd: vec3<f32>) -> Hit {
  let inv_rd = 1.0 / rd;
  var hit = make_miss();
  var stack: array<u32, 32>;
  var sp = 0;
  stack[0] = 0u;
  sp = 1;

  while (sp > 0) {
    sp -= 1;
    let node = bvh_nodes[stack[sp]];
    let t0 = (node.bmin.xyz - ro) * inv_rd;
    let t1 = (node.bmax.xyz - ro) * inv_rd;
    let tmin3 = min(t0, t1);
    let tmax3 = max(t0, t1);
    let tmin = max(max(tmin3.x, tmin3.y), max(tmin3.z, 1e-4));
    let tmax = min(min(tmax3.x, tmax3.y), min(tmax3.z, hit.t));
    if (tmin > tmax) { continue; }

    let count = node.bmax.w;
    if (count > 0.0) {
      let first = u32(node.bmin.w);
      for (var i = 0u; i < u32(count); i++) {
        let tri = tri_indices[first + i];
        let h = intersect_tri(ro, rd, tri, hit.t);
        if (h.valid) { hit = h; }
      }
    } else {
      let left = u32(node.bmin.w);
      if (sp < 30) {
        stack[sp] = left;
        stack[sp + 1] = left + 1u;
        sp += 2;
      }
    }
  }
  return hit;
}

fn hit_shading_frame(h: Hit, rd: vec3<f32>) -> vec3<f32> {
  let i0 = h.tri * 3u;
  let n0 = tri_normals[i0].xyz;
  let n1 = tri_normals[i0 + 1u].xyz;
  let n2 = tri_normals[i0 + 2u].xyz;
  var n = normalize(n0 * (1.0 - h.u - h.v) + n1 * h.u + n2 * h.v);
  if (dot(n, rd) > 0.0) { n = -n; }
  return n;
}

/* ------------------------------------------------------------ BRDF ------ */

fn onb(n: vec3<f32>) -> mat3x3<f32> {
  let up = select(vec3<f32>(1.0, 0.0, 0.0), vec3<f32>(0.0, 1.0, 0.0), abs(n.z) < 0.999);
  let t = normalize(cross(up, n));
  let b = cross(n, t);
  return mat3x3<f32>(t, b, n);
}

fn cosine_hemisphere(u1: f32, u2: f32) -> vec3<f32> {
  let r = sqrt(u1);
  let phi = 2.0 * PI * u2;
  return vec3<f32>(r * cos(phi), r * sin(phi), sqrt(max(0.0, 1.0 - u1)));
}

fn ggx_half_vector(u1: f32, u2: f32, alpha: f32) -> vec3<f32> {
  let phi = 2.0 * PI * u1;
  let cos_theta = sqrt((1.0 - u2) / (1.0 + (alpha * alpha - 1.0) * u2));
  let sin_theta = sqrt(max(0.0, 1.0 - cos_theta * cos_theta));
  return vec3<f32>(sin_theta * cos(phi), sin_theta * sin(phi), cos_theta);
}

fn d_ggx(n_dot_h: f32, alpha: f32) -> f32 {
  let a2 = alpha * alpha;
  let d = n_dot_h * n_dot_h * (a2 - 1.0) + 1.0;
  return a2 / max(PI * d * d, 1e-8);
}

fn g_smith(n_dot_v: f32, n_dot_l: f32, alpha: f32) -> f32 {
  let k = alpha * 0.5;
  let gv = n_dot_v / (n_dot_v * (1.0 - k) + k);
  let gl = n_dot_l / (n_dot_l * (1.0 - k) + k);
  return gv * gl;
}

fn fresnel_schlick(cos_theta: f32, f0: vec3<f32>) -> vec3<f32> {
  return f0 + (vec3<f32>(1.0) - f0) * pow(clamp(1.0 - cos_theta, 0.0, 1.0), 5.0);
}

struct BsdfSample {
  dir: vec3<f32>,
  f: vec3<f32>,
  pdf: f32,
  specular: bool,
}

fn eval_bsdf(n: vec3<f32>, v: vec3<f32>, l: vec3<f32>, mat: Material) -> vec4<f32> {
  // returns rgb = f * cos, a = pdf
  let n_dot_l = dot(n, l);
  let n_dot_v = dot(n, v);
  if (n_dot_l <= 0.0 || n_dot_v <= 0.0) { return vec4<f32>(0.0); }
  let metallic = clamp(mat.params.x, 0.0, 1.0);
  let alpha = max(clamp(mat.params.y, 0.02, 1.0) * clamp(mat.params.y, 0.02, 1.0), 0.002);
  let f0 = mix(vec3<f32>(0.04), mat.base_color.rgb, metallic);

  let h = normalize(v + l);
  let n_dot_h = max(dot(n, h), 0.0);
  let v_dot_h = max(dot(v, h), 0.0);
  let d = d_ggx(n_dot_h, alpha);
  let g = g_smith(n_dot_v, n_dot_l, alpha);
  let f = fresnel_schlick(v_dot_h, f0);
  let spec = d * g * f / max(4.0 * n_dot_v * n_dot_l, 1e-6);
  let diffuse = (vec3<f32>(1.0) - f) * (1.0 - metallic) * mat.base_color.rgb / PI;

  let f_total = (diffuse + spec) * n_dot_l;
  // Mixture pdf: 50/50 cosine vs GGX lobe.
  let pdf_diffuse = n_dot_l / PI;
  let pdf_spec = d * n_dot_h / max(4.0 * v_dot_h, 1e-6);
  let pdf = max(0.5 * pdf_diffuse + 0.5 * pdf_spec, 1e-6);
  return vec4<f32>(f_total, pdf);
}

fn sample_bsdf(n: vec3<f32>, v: vec3<f32>, mat: Material, u1: f32, u2: f32, u3: f32) -> BsdfSample {
  var out: BsdfSample;
  let metallic = clamp(mat.params.x, 0.0, 1.0);
  let alpha = max(clamp(mat.params.y, 0.02, 1.0) * clamp(mat.params.y, 0.02, 1.0), 0.002);
  let basis = onb(n);

  if (u3 < 0.5) {
    let local = cosine_hemisphere(u1, u2);
    out.dir = normalize(basis * local);
    out.specular = false;
  } else {
    let h_local = ggx_half_vector(u1, u2, alpha);
    let h = normalize(basis * h_local);
    out.dir = normalize(reflect(-v, h));
    out.specular = metallic > 0.9 && alpha < 0.05;
  }
  let ev = eval_bsdf(n, v, out.dir, mat);
  out.f = ev.rgb;
  out.pdf = ev.a;
  return out;
}

/* ------------------------------------------------------- environment --- */

fn env_dir_to_uv(dir: vec3<f32>) -> vec2<f32> {
  let u = atan2(dir.z, dir.x) / (2.0 * PI) + 0.5;
  let v = acos(clamp(dir.y, -1.0, 1.0)) / PI;
  return vec2<f32>(u, v);
}

fn env_radiance(dir: vec3<f32>) -> vec3<f32> {
  if (u.env_width == 0u) {
    // Procedural fallback sky — keeps renders lit with no HDRI loaded.
    let t = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
    return mix(vec3<f32>(0.06, 0.07, 0.10), vec3<f32>(0.55, 0.62, 0.75), t) * u.env_intensity;
  }
  let uv = env_dir_to_uv(dir);
  return textureSampleLevel(env_tex, env_sampler, uv, 0.0).rgb * u.env_intensity;
}

fn env_pdf_for_dir(dir: vec3<f32>) -> f32 {
  if (u.env_width == 0u) { return 1.0 / (4.0 * PI); }
  let uv = env_dir_to_uv(dir);
  let px = min(i32(uv.x * f32(u.env_width)), i32(u.env_width) - 1);
  let py = min(i32(uv.y * f32(u.env_height)), i32(u.env_height) - 1);
  let pdf_texel = textureLoad(env_pdf, vec2<i32>(px, py), 0).r;
  let sin_theta = max(sin(uv.y * PI), 1e-4);
  // Map texel probability density to solid-angle density.
  return pdf_texel * f32(u.env_width) * f32(u.env_height) / (2.0 * PI * PI * sin_theta);
}

struct EnvSample {
  dir: vec3<f32>,
  radiance: vec3<f32>,
  pdf: f32,
}

fn sample_environment(u1: f32, u2: f32) -> EnvSample {
  var out: EnvSample;
  if (u.env_width == 0u) {
    let phi = 2.0 * PI * u1;
    let cos_theta = 2.0 * u2 - 1.0;
    let sin_theta = sqrt(max(0.0, 1.0 - cos_theta * cos_theta));
    out.dir = vec3<f32>(sin_theta * cos(phi), cos_theta, sin_theta * sin(phi));
    out.radiance = env_radiance(out.dir);
    out.pdf = 1.0 / (4.0 * PI);
    return out;
  }

  // Inverse-transform sample the marginal CDF, then the row CDF.
  var lo = 0;
  var hi = i32(u.env_height) - 1;
  while (lo < hi) {
    let mid = (lo + hi) / 2;
    if (textureLoad(env_cdf_marg, vec2<i32>(mid, 0), 0).r < u2) { lo = mid + 1; } else { hi = mid; }
  }
  let row = lo;
  let row_cdf_prev = select(0.0, textureLoad(env_cdf_marg, vec2<i32>(max(row - 1, 0), 0), 0).r, row > 0);

  var l2 = 0;
  var h2 = i32(u.env_width) - 1;
  while (l2 < h2) {
    let mid = (l2 + h2) / 2;
    if (textureLoad(env_cdf_rows, vec2<i32>(mid, row), 0).r < u1) { l2 = mid + 1; } else { h2 = mid; }
  }
  let col = l2;

  let uv = (vec2<f32>(f32(col), f32(row)) + 0.5) / vec2<f32>(f32(u.env_width), f32(u.env_height));
  let phi = (uv.x - 0.5) * 2.0 * PI;
  let theta = uv.y * PI;
  let sin_theta = max(sin(theta), 1e-4);
  out.dir = vec3<f32>(sin_theta * cos(phi), cos(theta), sin_theta * sin(phi));
  out.radiance = textureLoad(env_tex, vec2<i32>(col, row), 0).rgb * u.env_intensity;
  let pdf_texel = textureLoad(env_pdf, vec2<i32>(col, row), 0).r;
  out.pdf = max(pdf_texel * f32(u.env_width) * f32(u.env_height) / (2.0 * PI * PI * sin_theta), 1e-6);
  return out;
}

/* ----------------------------------------------------------- lights ---- */

fn sample_triangle_light(u1: f32, u2: f32, tri: u32) -> vec3<f32> {
  // Uniform barycentric sample.
  let su = sqrt(u1);
  let b0 = 1.0 - su;
  let b1 = u2 * su;
  let i0 = tri * 3u;
  return tri_vertices[i0].xyz * b0 + tri_vertices[i0 + 1u].xyz * b1 + tri_vertices[i0 + 2u].xyz * (1.0 - b0 - b1);
}

fn mis_power_heuristic(pdf_a: f32, pdf_b: f32) -> f32 {
  let a2 = pdf_a * pdf_a;
  return a2 / max(a2 + pdf_b * pdf_b, 1e-9);
}

/* -------------------------------------------------------------- main --- */

@compute @workgroup_size(8, 8, 1)
fn cs_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(u.width);
  let height = u32(u.height);
  if (gid.x >= width || gid.y >= height) { return; }
  let pixel_index = gid.y * width + gid.x;

  var acc = vec4<f32>(0.0);
  var lum2 = 0.0;
  if (u.reset == 0u) {
    acc = accum[pixel_index * 2u];
    lum2 = accum[pixel_index * 2u + 1u].x;
  }

  var radiance_total = vec3<f32>(0.0);

  for (var s = 0u; s < u.samples_per_frame; s++) {
    let sample_seed = u32(u.frame) * u.samples_per_frame + s;
    let jitter = r2_sequence(sample_seed * 4096u + pixel_index);
    let uv = (vec2<f32>(gid.xy) + jitter) / vec2<f32>(u.width, u.height);
    let ndc = uv * 2.0 - 1.0;

    let aspect = u.width / u.height;
    var ro = u.cam_pos;
    var rd = normalize(
      u.cam_right * (ndc.x * u.tan_half_fov * aspect) +
      u.cam_up * (ndc.y * u.tan_half_fov) +
      u.cam_forward,
    );

    var throughput = vec3<f32>(1.0);
    var radiance = vec3<f32>(0.0);
    var pdf_prev = 0.0;
    var specular_bounce = true;

    for (var bounce = 0u; bounce <= u.bounces; bounce++) {
      let hit = intersect_bvh(ro, rd);
      if (!hit_valid(hit)) {
        let env = env_radiance(rd);
        if (bounce == 0u || specular_bounce) {
          radiance += throughput * env;
        } else {
          let pdf_env = env_pdf_for_dir(rd);
          radiance += throughput * env * mis_power_heuristic(pdf_prev, pdf_env);
        }
        break;
      }

      let p = ro + rd * hit.t;
      let n = hit_shading_frame(hit, rd);
      let mat_id = u32(tri_vertices[hit.tri * 3u].w);
      let mat = materials[mat_id];
      let v = -rd;

      // Emissive surfaces (triangle lights).
      if (any(mat.emissive.rgb > vec3<f32>(0.0))) {
        if (bounce == 0u || specular_bounce) {
          radiance += throughput * mat.emissive.rgb;
        } else {
          let area = max(tri_edges[hit.tri * 2u].w, 1e-6);
          let pdf_light = hit.t * hit.t / max(area * max(dot(n, v), 1e-4), 1e-6) / max(f32(u.emissive_count), 1.0);
          radiance += throughput * mat.emissive.rgb * mis_power_heuristic(pdf_prev, pdf_light);
        }
      }

      // ---- Next-event estimation: one triangle light + environment --------
      if (u.emissive_count > 0u) {
        let li_index = min(u32(frame_random(vec2<f32>(gid.xy) + f32(bounce) * 17.0, u.frame + f32(s) * 31.0) * f32(u.emissive_count)), u.emissive_count - 1u);
        let tri = tri_indices[u.tri_count + li_index];
        let light_p = sample_triangle_light(
          frame_random(vec2<f32>(gid.xy) + 3.7, u.frame + f32(s) * 7.0 + f32(bounce)),
          frame_random(vec2<f32>(gid.xy) + 9.1, u.frame + f32(s) * 7.0 + f32(bounce) + 5.0),
          tri,
        );
        let light_mat = materials[u32(tri_vertices[tri * 3u].w)];
        let to_light = light_p - p;
        let dist2 = dot(to_light, to_light);
        let dist = sqrt(max(dist2, 1e-8));
        let l_dir = to_light / dist;
        let light_i0 = tri * 3u;
        var light_n = normalize(cross(
          tri_vertices[light_i0 + 1u].xyz - tri_vertices[light_i0].xyz,
          tri_vertices[light_i0 + 2u].xyz - tri_vertices[light_i0].xyz,
        ));
        if (dot(light_n, l_dir) > 0.0) { light_n = -light_n; }
        let cos_light = max(dot(light_n, -l_dir), 1e-4);
        let area = max(tri_edges[tri * 2u].w, 1e-6);

        if (cos_light > 0.0 && any(light_mat.emissive.rgb > vec3<f32>(0.0))) {
          let shadow = intersect_bvh(p + n * 1e-3, l_dir);
          if (!hit_valid(shadow) || shadow.t > dist - 1e-3) {
            let ev = eval_bsdf(n, v, l_dir, mat);
            if (ev.a > 0.0) {
              let pdf_light = dist2 / (cos_light * area) / max(f32(u.emissive_count), 1.0);
              let w = mis_power_heuristic(pdf_light, ev.a);
              radiance += throughput * ev.rgb * light_mat.emissive.rgb * w / max(pdf_light, 1e-6);
            }
          }
        }
      }

      // Environment NEE.
      {
        let env_s = sample_environment(
          frame_random(vec2<f32>(gid.xy) + 13.0, u.frame + f32(s) * 5.0 + f32(bounce) * 2.0),
          frame_random(vec2<f32>(gid.xy) + 23.0, u.frame + f32(s) * 5.0 + f32(bounce) * 2.0 + 11.0),
        );
        let cos_l = dot(n, env_s.dir);
        if (cos_l > 0.0 && env_s.pdf > 0.0) {
          let shadow = intersect_bvh(p + n * 1e-3, env_s.dir);
          if (!hit_valid(shadow)) {
            let ev = eval_bsdf(n, v, env_s.dir, mat);
            if (ev.a > 0.0) {
              let w = mis_power_heuristic(env_s.pdf, ev.a);
              radiance += throughput * ev.rgb * env_s.radiance * w / max(env_s.pdf, 1e-6);
            }
          }
        }
      }

      // ---- BSDF sampling -------------------------------------------------
      let u1 = frame_random(vec2<f32>(gid.xy) + 31.0, u.frame + f32(s) * 11.0 + f32(bounce) * 3.0);
      let u2 = frame_random(vec2<f32>(gid.xy) + 41.0, u.frame + f32(s) * 11.0 + f32(bounce) * 3.0 + 7.0);
      let u3 = frame_random(vec2<f32>(gid.xy) + 51.0, u.frame + f32(s) * 11.0 + f32(bounce) * 3.0 + 13.0);
      let bs = sample_bsdf(n, v, mat, u1, u2, u3);
      if (bs.pdf <= 0.0 || !any(bs.f > vec3<f32>(0.0))) { break; }

      throughput *= bs.f / bs.pdf;
      pdf_prev = bs.pdf;
      specular_bounce = bs.specular;
      ro = p + n * 1e-3 * select(-1.0, 1.0, dot(bs.dir, n) > 0.0);
      rd = bs.dir;

      // Russian roulette after two bounces.
      if (bounce >= 2u) {
        let q = clamp(max(throughput.r, max(throughput.g, throughput.b)), 0.05, 0.95);
        if (frame_random(vec2<f32>(gid.xy) + 61.0, u.frame + f32(s) + f32(bounce)) > q) { break; }
        throughput /= q;
      }
    }

    radiance_total += radiance;
  }

  let n_samples = f32(u.samples_per_frame);
  let sample_avg = radiance_total / n_samples;
  let lum = luminance(sample_avg);
  acc = vec4<f32>(acc.rgb + radiance_total, acc.a + n_samples);
  lum2 += lum * lum * n_samples;
  accum[pixel_index * 2u] = acc;
  accum[pixel_index * 2u + 1u] = vec4<f32>(lum2, 0.0, 0.0, 0.0);

  // Primary-hit G-buffer for the denoiser.
  if (u.frame < 1.0) {
    let uv = (vec2<f32>(gid.xy) + 0.5) / vec2<f32>(u.width, u.height);
    let ndc = uv * 2.0 - 1.0;
    let aspect = u.width / u.height;
    let rd = normalize(
      u.cam_right * (ndc.x * u.tan_half_fov * aspect) +
      u.cam_up * (ndc.y * u.tan_half_fov) +
      u.cam_forward,
    );
    let hit = intersect_bvh(u.cam_pos, rd);
    if (hit_valid(hit)) {
      gbuffer[pixel_index] = vec4<f32>(hit_shading_frame(hit, rd), hit.t);
    } else {
      gbuffer[pixel_index] = vec4<f32>(0.0, 1.0, 0.0, 1e6);
    }
  }
}
`;
