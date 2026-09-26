/**
 * WGSL source for the WebGPU motion-graphics backdrop.
 *
 * One fullscreen-triangle pipeline draws every plate: real footage/photo
 * plates (sampled from a video or image texture), plus procedural fields —
 * galaxy, nebula, star field, lit 3D globe, data grid, aurora and smoke.
 *
 * Uniforms are packed as four `vec4`s (64 bytes, a multiple of the 16-byte
 * uniform alignment rule) so the JS side can write them with one Float32Array:
 *   v0 = (width, height, time, mode)
 *   v1 = (accent.r, accent.g, accent.b, intensity)
 *   v2 = (reserved, saturation, parallax, vignette)
 *   v3 = (grain, hasTexture, textureAspect, zoom)
 */
export const BACKDROP_WGSL = /* wgsl */ `
struct U { v: array<vec4<f32>, 4> };

@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var tex: texture_2d<f32>;

struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VSOut {
  var pts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  let p = pts[vi];
  var out: VSOut;
  out.pos = vec4<f32>(p, 0.0, 1.0);
  out.uv = vec2<f32>((p.x + 1.0) * 0.5, 1.0 - (p.y + 1.0) * 0.5);
  return out;
}

fn hash21(p: vec2<f32>) -> f32 {
  var q = fract(vec2<f32>(p.x * 123.34, p.y * 456.21));
  q = q + dot(q, q + 45.32);
  return fract(q.x * q.y);
}

fn valueNoise(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let s = f * f * (3.0 - 2.0 * f);
  let a = hash21(i);
  let b = hash21(i + vec2<f32>(1.0, 0.0));
  let c = hash21(i + vec2<f32>(0.0, 1.0));
  let d = hash21(i + vec2<f32>(1.0, 1.0));
  return mix(mix(a, b, s.x), mix(c, d, s.x), s.y);
}

fn fbm(p0: vec2<f32>) -> f32 {
  var p = p0;
  var amp = 0.5;
  var sum = 0.0;
  for (var i = 0; i < 5; i = i + 1) {
    sum = sum + amp * valueNoise(p);
    p = p * 2.03 + vec2<f32>(1.7, 9.2);
    amp = amp * 0.5;
  }
  return sum;
}

fn rotY(v: vec3<f32>, a: f32) -> vec3<f32> {
  let c = cos(a);
  let s = sin(a);
  return vec3<f32>(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
}

/** Three parallax layers of twinkling point stars. */
fn starField(uv: vec2<f32>, aspect: f32, t: f32, density: f32) -> f32 {
  var acc = 0.0;
  let q = (uv - 0.5) * vec2<f32>(aspect, 1.0);
  for (var k = 0; k < 3; k = k + 1) {
    let fk = f32(k);
    let scale = 46.0 + fk * 58.0;
    let drift = vec2<f32>(t * (0.006 + fk * 0.006), t * 0.003 * (fk + 1.0));
    let g = q * scale + drift + vec2<f32>(fk * 23.7, fk * 11.3);
    let id = floor(g);
    let f = fract(g) - 0.5;
    let h = hash21(id);
    if (h > 1.0 - density * (0.05 - fk * 0.012)) {
      let jitter = (vec2<f32>(hash21(id + 7.1), hash21(id + 3.7)) - 0.5) * 0.7;
      let d = length(f + jitter);
      let tw = 0.55 + 0.45 * sin(t * 2.4 + h * 60.0);
      acc = acc + (1.0 - smoothstep(0.0, 0.14, d)) * tw * (1.0 - fk * 0.28);
    }
  }
  return acc;
}

/** Cover-fit UV for a source texture aspect, with zoom + drift. */
fn coverUv(uv: vec2<f32>, aspect: f32, texAspect: f32, zoom: f32, offset: vec2<f32>) -> vec2<f32> {
  var s = uv - 0.5;
  let ta = max(texAspect, 0.0001);
  if (aspect > ta) {
    s.y = s.y * ta / aspect;
  } else {
    s.x = s.x * aspect / ta;
  }
  s = s / max(zoom, 0.0001) + offset;
  return s + 0.5;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4<f32> {
  let res = u.v[0].xy;
  let t = u.v[0].z;
  let mode = u.v[0].w;
  let accent = u.v[1].xyz;
  let intensity = u.v[1].w;
  let saturation = u.v[2].y;
  let parallax = u.v[2].z;
  let vignette = u.v[2].w;
  let grain = u.v[3].x;
  let hasTex = u.v[3].y;
  let texAspect = u.v[3].z;
  let zoom = u.v[3].w;

  let uv = in.uv;
  let aspect = res.x / max(res.y, 1.0);
  var col = vec3<f32>(0.0, 0.0, 0.0);

  if (mode < 0.5) {
    // ---- real footage / photo plate ------------------------------------
    let off = vec2<f32>(sin(t * 0.031), cos(t * 0.024)) * 0.014 * parallax;
    let breathe = zoom * (1.0 + 0.05 * sin(t * 0.06) * parallax);
    let uvm = coverUv(uv, aspect, texAspect, breathe, off);
    if (hasTex > 0.5) {
      col = textureSampleLevel(tex, samp, uvm, 0.0).rgb;
    }
  } else if (mode < 1.5) {
    // ---- spiral galaxy --------------------------------------------------
    let q = (uv - vec2<f32>(0.5, 0.48)) * vec2<f32>(aspect, 1.0) * 1.35;
    let a0 = t * 0.035;
    let ca = cos(a0);
    let sa = sin(a0);
    let r2 = vec2<f32>(ca * q.x - sa * q.y, sa * q.x + ca * q.y);
    let r = length(r2);
    let ang = atan2(r2.y, r2.x);
    let armBase = max(0.5 + 0.5 * sin(ang * 3.0 - log(max(r, 0.0006)) * 6.5 + t * 0.05), 0.001);
    let arm = pow(armBase, 2.4);
    let falloff = exp(-r * 3.0);
    let core = exp(-r * 13.0);
    let dust = fbm(r2 * 5.0 + vec2<f32>(t * 0.02, 0.0));
    var g = accent * arm * falloff * (0.55 + 0.7 * dust);
    g = g + vec3<f32>(1.0, 0.93, 0.8) * core * 1.5;
    g = g + accent * exp(-r * 6.0) * 0.35;
    g = g + starField(uv, aspect, t, 1.0) * vec3<f32>(0.9, 0.95, 1.0);
    col = g;
  } else if (mode < 2.5) {
    // ---- volumetric nebula ---------------------------------------------
    let p = (uv - 0.5) * vec2<f32>(aspect, 1.0) * 2.4 + vec2<f32>(t * 0.016, -t * 0.011);
    let w = vec2<f32>(fbm(p + 1.7), fbm(p + 8.3));
    let n = fbm(p + w * 1.7 + vec2<f32>(t * 0.01, 0.0));
    let n2 = fbm(p * 2.1 + w * 2.4 - vec2<f32>(t * 0.02, 0.0));
    var c = mix(vec3<f32>(0.012, 0.016, 0.045), accent * 0.95, pow(max(n, 0.001), 1.7));
    c = c + vec3<f32>(0.42, 0.16, 0.55) * pow(max(n2, 0.001), 3.2) * 0.8;
    c = c + vec3<f32>(1.0, 0.88, 0.72) * pow(max(n * n2 - 0.22, 0.001), 2.0) * 1.5;
    c = c + starField(uv, aspect, t, 0.9) * vec3<f32>(0.85, 0.9, 1.0);
    col = c * 1.25;
  } else if (mode < 3.5) {
    // ---- drifting star field -------------------------------------------
    let q = (uv - 0.5) * vec2<f32>(aspect, 1.0);
    let depth = 1.0 + length(q) * 1.7;
    var c = vec3<f32>(0.012, 0.014, 0.034) * max(1.0 - length(q) * 0.4, 0.0);
    c = c + starField(uv, aspect, t, 1.2) * depth * vec3<f32>(0.92, 0.95, 1.0);
    c = c + accent * 0.12 * exp(-abs(q.y + 0.34) * 3.2);
    col = c;
  } else if (mode < 4.5) {
    // ---- lit 3D globe over space ---------------------------------------
    let q = (uv - 0.5) * vec2<f32>(aspect, 1.0) * 2.0;
    let R = 0.74;
    let d2 = dot(q, q);
    if (d2 <= R * R) {
      let nz = sqrt(max(R * R - d2, 0.0));
      let n = vec3<f32>(q.x, q.y, nz) / R;
      let rot = rotY(n, -t * 0.09);
      let lat = asin(clamp(rot.y, -1.0, 1.0));
      let lon = atan2(rot.z, rot.x);
      let st = vec2<f32>(lon * 0.15915494 + 0.5, 0.5 - lat * 0.31830989);
      var land = vec3<f32>(0.035, 0.06, 0.12);
      if (hasTex > 0.5) {
        land = textureSampleLevel(tex, samp, st, 0.0).rgb;
      }
      let fx = fract(st.x * 18.0);
      let fy = fract(st.y * 9.0);
      let lx = min(fx, 1.0 - fx);
      let ly = min(fy, 1.0 - fy);
      let grat = 1.0 - smoothstep(0.0, 0.03, min(lx, ly));
      let L = normalize(vec3<f32>(-0.55, 0.35, 0.75));
      let lam = clamp(dot(n, L), 0.0, 1.0);
      var c = land * (0.05 + 1.2 * pow(lam + 0.001, 0.85));
      c = c + vec3<f32>(0.45, 0.62, 0.95) * pow(lam + 0.001, 28.0) * 0.5;
      let rim = pow(max(1.0 - nz / R, 0.001), 2.4);
      c = c + vec3<f32>(0.3, 0.55, 1.0) * rim * (0.35 + 0.65 * lam) * 0.95;
      c = c + accent * grat * (0.08 + 0.3 * lam);
      col = c;
    } else {
      let r = sqrt(max(d2, 0.0001));
      let halo = exp(-max(r - R, 0.0) * 7.0);
      var c = vec3<f32>(0.008, 0.01, 0.03);
      c = c + vec3<f32>(0.25, 0.5, 1.0) * halo * 0.5;
      c = c + accent * halo * 0.18;
      c = c + starField(uv, aspect, t, 1.0) * vec3<f32>(0.9, 0.95, 1.0);
      col = c;
    }
  } else if (mode < 5.5) {
    // ---- perspective data grid -----------------------------------------
    let horizon = 0.46;
    var c = mix(vec3<f32>(0.016, 0.024, 0.05), vec3<f32>(0.004, 0.007, 0.018), smoothstep(horizon, 1.0, uv.y));
    c = c + accent * exp(-abs(uv.y - horizon) * 15.0) * 0.32;
    if (uv.y < horizon) {
      let d = max(horizon - uv.y, 0.0015);
      let z = 0.32 / d;
      let x = (uv.x - 0.5) * aspect * z;
      let lx = abs(fract(x * 0.6) - 0.5);
      let lz = abs(fract((z + t * 0.55) * 0.5) - 0.5);
      let lineX = 1.0 - smoothstep(0.0, 0.045, lx);
      let lineZ = 1.0 - smoothstep(0.0, 0.045, lz);
      let fade = smoothstep(0.0, 0.1, d) * exp(-z * 0.045);
      let lines = clamp(lineX + lineZ, 0.0, 1.0);
      c = c + accent * lines * fade * 0.95;
      c = c + vec3<f32>(0.15, 0.5, 0.95) * lines * fade * 0.3;
    } else {
      c = c + starField(uv, aspect, t, 0.7) * 0.85;
      let tick = step(0.99, fract(uv.x * 140.0)) * step(0.99, fract(uv.y * 70.0));
      c = c + accent * tick * 0.5;
    }
    col = c;
  } else if (mode < 6.5) {
    // ---- aurora curtains -------------------------------------------------
    let q = (uv - 0.5) * vec2<f32>(aspect, 1.0);
    var c = mix(vec3<f32>(0.02, 0.03, 0.07), vec3<f32>(0.008, 0.012, 0.032), smoothstep(-0.3, 0.7, q.y));
    for (var k = 0; k < 3; k = k + 1) {
      let fk = f32(k);
      let n = fbm(vec2<f32>(q.x * 1.8 + fk * 5.3 + t * 0.05, fk * 4.1 + t * 0.02));
      let cent = 0.02 + 0.3 * n + fk * 0.09;
      let w = 0.15 + 0.24 * n;
      let dz = (q.y - cent) / w;
      let band = exp(-dz * dz);
      let streak = 0.55 + 0.45 * sin(q.x * 9.0 + fk * 2.0 + t * 0.35 + n * 6.0);
      let tint = mix(vec3<f32>(0.05, 0.95, 0.45), accent, fk * 0.45);
      c = c + tint * band * streak * (0.36 - fk * 0.07);
    }
    c = c + starField(uv, aspect, t, 0.9) * vec3<f32>(0.9, 0.95, 1.0);
    col = c;
  } else {
    // ---- ink / plasma smoke ---------------------------------------------
    let p = (uv - 0.5) * vec2<f32>(aspect, 1.0) * 2.0;
    let w = vec2<f32>(fbm(p * 1.3 + vec2<f32>(t * 0.03, 0.0)), fbm(p * 1.3 + vec2<f32>(4.7, -t * 0.025)));
    let n = fbm(p * 1.6 + w * 2.2 + vec2<f32>(0.0, -t * 0.04));
    let n2 = fbm(p * 3.1 + w * 1.4 + vec2<f32>(t * 0.02, 0.0));
    var c = mix(vec3<f32>(0.01, 0.011, 0.02), vec3<f32>(0.15, 0.16, 0.21), max(n, 0.0));
    c = c + accent * pow(max(n * 1.25, 0.001), 2.6) * 0.9;
    c = c + vec3<f32>(1.0, 0.95, 0.85) * pow(max(n2 - 0.55, 0.001), 2.0) * 1.7;
    col = c;
  }

  // ---- grade -----------------------------------------------------------
  col = col * intensity;
  let lum = dot(col, vec3<f32>(0.2126, 0.7152, 0.0722));
  col = mix(vec3<f32>(lum), col, saturation);
  col = mix(col, col * (accent * 0.4 + 0.7), 0.16);

  let vd = length((uv - 0.5) * 2.0);
  col = col * (1.0 - vignette * smoothstep(0.5, 1.45, vd));

  if (grain > 0.0) {
    let g = hash21(uv * res + vec2<f32>(fract(t) * 43.0, fract(t * 0.7) * 17.0)) - 0.5;
    col = col + g * grain;
  }

  return vec4<f32>(max(col, vec3<f32>(0.0)), 1.0);
}
`;
