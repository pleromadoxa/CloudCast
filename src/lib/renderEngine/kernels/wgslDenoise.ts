/**
 * WGSL path-tracer resolve + denoiser.
 *
 * `RESOLVE_WGSL` unpacks the progressive accumulation buffers into a filterable
 * HDR colour texture with variance and the primary-hit G-buffer.
 *
 * `ATROUS_WGSL` is the edge-stopping à-trous wavelet filter from SVGF
 * (Schied et al., "Spatiotemporal Variance-Guided Filtering") — the same
 * family used by ReSTIR/Denoiser stacks on the web. Weights combine colour
 * similarity (variance-normalised), depth similarity and normal similarity,
 * so edges survive while Monte Carlo noise dissolves.
 */
import { WGSL_COMMON } from './wgslCommon';

export const RESOLVE_WGSL = /* wgsl */ `
${WGSL_COMMON}

struct ResolveParams {
  width: f32,
  height: f32,
  pad0: f32,
  pad1: f32,
}

@group(0) @binding(0) var<uniform> params: ResolveParams;
@group(0) @binding(1) var<storage, read> accum: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> gbuffer: array<vec4<f32>>;
@group(0) @binding(3) var color_out: texture_storage_2d<rgba16float, write>;
@group(0) @binding(4) var aux_out: texture_storage_2d<rgba16float, write>;   // variance, depth
@group(0) @binding(5) var normal_out: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8, 1)
fn cs_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(params.width);
  let height = u32(params.height);
  if (gid.x >= width || gid.y >= height) { return; }
  let index = gid.y * width + gid.x;

  let acc = accum[index * 2u];
  let moments = accum[index * 2u + 1u];
  let n_samples = max(acc.a, 1.0);
  let mean = acc.rgb / n_samples;
  let lum = luminance(mean);
  let lum2_mean = moments.x / n_samples;
  // Unbiased-ish variance of the per-sample luminance estimate.
  let variance = max(lum2_mean - lum * lum, 0.0) / n_samples;

  let gb = gbuffer[index];
  textureStore(color_out, vec2<i32>(gid.xy), vec4<f32>(mean, 1.0));
  textureStore(aux_out, vec2<i32>(gid.xy), vec4<f32>(variance, gb.w, lum, 1.0));
  textureStore(normal_out, vec2<i32>(gid.xy), vec4<f32>(gb.xyz, 1.0));
}
`;

export const ATROUS_WGSL = /* wgsl */ `
${WGSL_COMMON}

struct AtrousParams {
  resolution: vec2<f32>,
  step_size: f32,
  phi_color: f32,
  phi_depth: f32,
  phi_normal: f32,
  pad0: f32,
  pad1: f32,
}

@group(0) @binding(0) var<uniform> params: AtrousParams;
@group(0) @binding(1) var color_in: texture_2d<f32>;
@group(0) @binding(2) var aux_in: texture_2d<f32>;
@group(0) @binding(3) var normal_in: texture_2d<f32>;
@group(0) @binding(4) var tex_sampler: sampler;
@group(0) @binding(5) var color_out: texture_storage_2d<rgba16float, write>;

const KERNEL_TAPS: array<f32, 9> = array<f32, 9>(
  1.0 / 16.0, 2.0 / 16.0, 1.0 / 16.0,
  2.0 / 16.0, 4.0 / 16.0, 2.0 / 16.0,
  1.0 / 16.0, 2.0 / 16.0, 1.0 / 16.0,
);

@compute @workgroup_size(8, 8, 1)
fn cs_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dims = vec2<u32>(params.resolution);
  if (gid.x >= dims.x || gid.y >= dims.y) { return; }

  var kernel_weights = KERNEL_TAPS;

  let pixel = vec2<i32>(gid.xy);
  let center_color = textureLoad(color_in, pixel, 0).rgb;
  let center_aux = textureLoad(aux_in, pixel, 0);
  let center_normal = textureLoad(normal_in, pixel, 0).xyz;

  var sum = vec3<f32>(0.0);
  var wsum = 0.0;

  for (var y = -2; y <= 2; y++) {
    for (var x = -2; x <= 2; x++) {
      let offset = vec2<i32>(x, y) * i32(params.step_size);
      let sample_pixel = pixel + offset;
      if (sample_pixel.x < 0 || sample_pixel.y < 0 ||
          sample_pixel.x >= i32(dims.x) || sample_pixel.y >= i32(dims.y)) {
        continue;
      }
      let c = textureLoad(color_in, sample_pixel, 0).rgb;
      let aux = textureLoad(aux_in, sample_pixel, 0);
      let n = textureLoad(normal_in, sample_pixel, 0).xyz;

      let kernel_w = kernel_weights[(y + 2) * 5 + (x + 2)];
      // Colour weight normalised by variance — flat noisy regions blur hard,
      // detailed regions keep their detail (SVGF edge-stopping function).
      let color_dist = abs(luminance(c) - luminance(center_color));
      let phi_c = max(params.phi_color * sqrt(max(center_aux.x, 1e-8)), 1e-4);
      let w_color = exp(-color_dist / phi_c);
      let w_depth = exp(-abs(aux.y - center_aux.y) / max(params.phi_depth * max(center_aux.y, 1.0), 1e-4));
      let w_normal = pow(max(dot(n, center_normal), 0.0), params.phi_normal);

      let w = kernel_w * w_color * w_depth * w_normal;
      sum += c * w;
      wsum += w;
    }
  }

  let resolved = select(center_color, sum / max(wsum, 1e-6), wsum > 0.0);
  textureStore(color_out, pixel, vec4<f32>(resolved, 1.0));
}
`;
