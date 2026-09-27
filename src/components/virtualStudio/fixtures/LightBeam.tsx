import { memo, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Physically-flavoured volumetric light beam — a shaft of light scattering
 * through studio haze, built the way a real one behaves:
 *
 *   • cross-section   — Gaussian-ish falloff from the beam axis, so the shaft
 *                       has a hot core and dissolving edges (never a hard cone
 *                       silhouette on camera),
 *   • length falloff  — inverse-square-ish decay from the fixture, the same
 *                       curve the point/spot light uses to light the room,
 *   • haze density    — two octaves of drifting value noise, so the air inside
 *                       the beam shimmers like real suspended particulate,
 *   • Mie scatter     — looking down the axis of the beam brightens it (the
 *                       forward-scatter lobe that makes beams pop toward the
 *                       camera), approximated with the Henyey-Greenstein
 *                       asymmetry the fidelity spec uses,
 *   • dust motes      — GPU-animated specks falling through the shaft, each
 *                       twinkling as it crosses the light,
 *   • contact pool    — the elliptical hot spot where a downward beam meets
 *                       the floor,
 *   • lens flare      — a soft bloom right at the fixture's lens.
 *
 * The shaft itself is two nested cones (wide faint scatter + hot core under the
 * fixture) sharing one shader. Everything is additive, depth-write off — the
 * beam reads through haze without ever punching through set geometry.
 */

/* -------------------------------------------------------------- textures */

interface BeamTextures {
  noise: THREE.CanvasTexture;
  pool: THREE.CanvasTexture;
  flare: THREE.CanvasTexture;
  mote: THREE.CanvasTexture;
}

let beamTextures: BeamTextures | null = null;

/** Deterministic tileable value noise — the particulate density field. */
function makeNoiseTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(size, size);
  let seed = 20260927;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  // Two octaves of white noise, then box-blurred into soft billows so the
  // haze reads as drifting smoke rather than television static.
  const field = new Float32Array(size * size);
  for (let i = 0; i < field.length; i += 1) field[i] = rnd() * 0.55;
  for (let i = 0; i < field.length; i += 1) field[i] += rnd() * 0.25;
  const blurred = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          // wrap sampling keeps the texture tileable
          sum += field[(((y + dy + size) % size) * size + ((x + dx + size) % size))];
        }
      }
      blurred[y * size + x] = sum / 9;
    }
  }
  for (let i = 0; i < blurred.length; i += 1) {
    const v = Math.round(255 * Math.min(1, blurred[i] * 1.9));
    image.data[i * 4] = v;
    image.data[i * 4 + 1] = v;
    image.data[i * 4 + 2] = v;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const noise = new THREE.CanvasTexture(canvas);
  noise.wrapS = THREE.RepeatWrapping;
  noise.wrapT = THREE.RepeatWrapping;
  // Noise is data, not colour — sample it linearly.
  noise.colorSpace = THREE.NoColorSpace;
  return noise;
}

/** Elliptical floor hot spot: bright centre, feathered, slightly broken edge. */
function makePoolTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.28, 'rgba(255,255,255,0.42)');
  grad.addColorStop(0.62, 'rgba(255,255,255,0.13)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  // Break the rim with soft speckle so the pool doesn't read as a perfect disc.
  ctx.globalCompositeOperation = 'destination-out';
  let seed = 771103;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 220; i += 1) {
    const a = rnd() * Math.PI * 2;
    const r = (0.35 + rnd() * 0.65) * (size / 2);
    ctx.beginPath();
    ctx.arc(size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r, 6 + rnd() * 22, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,0,0,${0.06 + rnd() * 0.12})`;
    ctx.fill();
  }
  const pool = new THREE.CanvasTexture(canvas);
  pool.colorSpace = THREE.SRGBColorSpace;
  return pool;
}

/** Soft round bloom used at the fixture lens and on dust motes. */
function makeGlowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.16)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const glow = new THREE.CanvasTexture(canvas);
  glow.colorSpace = THREE.SRGBColorSpace;
  return glow;
}

function getBeamTextures(): BeamTextures {
  if (beamTextures) return beamTextures;
  beamTextures = {
    noise: makeNoiseTexture(),
    pool: makePoolTexture(),
    flare: makeGlowTexture(),
    mote: makeGlowTexture(),
  };
  return beamTextures;
}

/* ---------------------------------------------------------------- shader */

const beamVertex = /* glsl */ `
  uniform float uHeight;
  varying float vT;
  varying float vAngle;
  varying vec3 vNormalV;
  varying vec3 vViewV;
  varying vec3 vWorldPos;
  varying vec3 vAxis;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vT = clamp(position.y / uHeight + 0.5, 0.0, 1.0);   // 1 at the fixture
    vAngle = atan(position.x, position.z);
    vNormalV = normalize(normalMatrix * normal);
    vViewV = normalize(-mvPosition.xyz);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vAxis = normalize((modelMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const beamFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uGain;
  uniform float uTime;
  uniform float uFalloff;
  uniform float uEdgePow;
  uniform float uViewBoost;
  uniform vec2 uNoiseShift;
  uniform sampler2D uNoise;

  varying float vT;
  varying float vAngle;
  varying vec3 vNormalV;
  varying vec3 vViewV;
  varying vec3 vWorldPos;
  varying vec3 vAxis;

  void main() {
    // Cross-section: hot core, dissolving rim — the shaft never shows a hard
    // cone silhouette. The surface normal faces camera mid-band, so |N·V|
    // is exactly the radial profile.
    float ndv = abs(dot(normalize(vNormalV), normalize(vViewV)));
    float soft = pow(ndv, uEdgePow);

    // Length falloff: inverse-square-ish decay away from the fixture.
    float d = 1.0 - vT;
    float lenFall = 1.0 / (1.0 + d * d * uFalloff);

    // Drifting haze density (two octaves at different scroll rates).
    vec2 uv1 = vec2(vAngle * 0.1592 + uTime * 0.012, vT * 0.85 - uTime * 0.02) + uNoiseShift;
    float n1 = texture2D(uNoise, uv1).r;
    float n2 = texture2D(uNoise, uv1 * vec2(2.3, 1.7) + vec2(0.31, 0.17) + uTime * vec2(0.008, -0.012)).r;
    float haze = mix(n1, n2, 0.45);

    // Mie forward scatter: the beam glows when sighted along its axis.
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float downAxis = abs(dot(viewDir, normalize(vAxis)));
    float glow = mix(1.0, 0.55 + 1.5 * pow(downAxis, 2.4), uViewBoost);

    float alpha = uOpacity * uGain * lenFall * soft * mix(0.5, 1.2, haze) * glow;
    gl_FragColor = vec4(uColor * (0.8 + 0.55 * haze) * glow, alpha);
  }
`;

const moteVertex = /* glsl */ `
  attribute float aAngle;
  attribute float aRad;
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aSize;
  attribute float aTw;

  uniform float uTime;
  uniform float uHeight;
  uniform float uRadius;
  uniform float uMotion;

  varying float vTw;

  void main() {
    // Each mote falls through the cone and wraps back to the fixture end.
    float halfH = uHeight * 0.5;
    float fall = mod(aPhase * uHeight + uTime * aSpeed * uMotion, uHeight);
    float y = halfH - fall;
    float t = clamp(y / uHeight + 0.5, 0.0, 1.0);       // 1 near the fixture
    float r = uRadius * (1.0 - t) * aRad;
    // Gentle lateral sway — real dust never falls in straight lines.
    float sway = sin(uTime * 0.33 + aPhase * 21.0) * 0.06 * uRadius * uMotion;
    vec3 p = vec3(cos(aAngle) * r + sway, y, sin(aAngle) * r + sway * 0.7);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float twinkle = 0.7 + 0.35 * sin(uTime * aTw + aPhase * 43.0);
    gl_PointSize = aSize * twinkle * (120.0 / max(0.4, -mv.z));
    gl_Position = projectionMatrix * mv;
    vTw = 0.5 + 0.5 * sin(uTime * aTw * 0.8 + aPhase * 61.0);
  }
`;

const moteFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform sampler2D uMap;
  varying float vTw;

  void main() {
    float m = texture2D(uMap, gl_PointCoord).a;
    gl_FragColor = vec4(uColor, m * uOpacity * (0.35 + 0.65 * vTw));
  }
`;

/* ------------------------------------------------------------------ API */

export interface LightBeamProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** Beam length in metres. */
  height?: number;
  /** Radius at the wide end. */
  radius?: number;
  color?: string;
  opacity?: number;
  /**
   * Beam direction: 'down' has the narrow (bright) end at the top,
   * 'up' flips it. Use rotation for sideways beams.
   */
  direction?: 'down' | 'up';
  /** Cone tessellation — the fidelity tier's `beamSegments`. */
  segments?: number;
  /** Drift the noise through the shaft (off on the cheapest tiers). */
  animated?: boolean;
  /** Dust motes in the shaft — count multiplier, 0 disables. Defaults to 1 when animated. */
  dust?: number;
  /** Floor hot spot where a downward beam lands. Defaults on for downward beams. */
  pool?: boolean;
  /** Soft bloom at the fixture lens. Defaults on. */
  flare?: boolean;
  /** Length falloff steepness — higher tightens the lit zone to the fixture. */
  falloff?: number;
  /** Extra brightness when the camera sights along the beam axis. */
  viewBoost?: number;
}

/* ---------------------------------------------------------------- beams */

export const LightBeam = memo(function LightBeam({
  position,
  rotation,
  height = 3,
  radius = 1,
  color = '#fff7ed',
  opacity = 0.13,
  direction = 'down',
  segments = 28,
  animated = true,
  dust,
  pool,
  flare = true,
  falloff = 3.2,
  viewBoost = 0.85,
}: LightBeamProps) {
  const { noise, pool: poolTex, flare: flareTex, mote: moteTex } = useMemo(() => getBeamTextures(), []);
  const colorVec = useMemo(() => new THREE.Color(color), [color]);

  // 'up' flips the cone so the narrow bright end sits at the floor fixture.
  const rot: [number, number, number] = useMemo(
    () =>
      direction === 'up'
        ? [Math.PI + (rotation?.[0] ?? 0), rotation?.[1] ?? 0, rotation?.[2] ?? 0]
        : (rotation ?? [0, 0, 0]),
    [direction, rotation],
  );

  // Does the shaft actually point at the floor in world space? Only then does
  // it earn a contact pool (sideways beams would float a glowing disc).
  const pointsDown = useMemo(() => {
    const dir = new THREE.Vector3(0, -1, 0).applyEuler(new THREE.Euler(rot[0], rot[1], rot[2]));
    return dir.y < -0.7;
  }, [rot]);

  const showPool = (pool ?? true) && direction === 'down' && pointsDown;
  const dustCount = Math.round(90 * (dust ?? (animated ? 1 : 0)));

  // ── shaft materials (outer scatter + hot core) ──────────────────────────
  const makeShaft = useMemo(
    () =>
      (gain: number, edgePow: number, coreFalloff: number, shift: [number, number]) =>
        new THREE.ShaderMaterial({
          vertexShader: beamVertex,
          fragmentShader: beamFragment,
          uniforms: {
            uColor: { value: colorVec },
            uOpacity: { value: opacity },
            uGain: { value: gain },
            uTime: { value: 0 },
            uHeight: { value: height },
            uFalloff: { value: coreFalloff },
            uEdgePow: { value: edgePow },
            uViewBoost: { value: viewBoost },
            uNoiseShift: { value: new THREE.Vector2(shift[0], shift[1]) },
            uNoise: { value: noise },
          },
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
    [colorVec, opacity, height, viewBoost, noise],
  );

  const outerMat = useMemo(() => makeShaft(1.6, 1.35, falloff, [0, 0]), [makeShaft, falloff]);
  const innerMat = useMemo(() => makeShaft(2.6, 2.1, falloff * 1.7, [0.37, 0.19]), [makeShaft, falloff]);

  // ── dust field ─────────────────────────────────────────────────────────
  const dustGeo = useMemo(() => {
    if (dustCount <= 0) return null;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(dustCount * 3);
    const angle = new Float32Array(dustCount);
    const rad = new Float32Array(dustCount);
    const phase = new Float32Array(dustCount);
    const speed = new Float32Array(dustCount);
    const size = new Float32Array(dustCount);
    const tw = new Float32Array(dustCount);
    let seed = 918273;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < dustCount; i += 1) {
      angle[i] = rnd() * Math.PI * 2;
      rad[i] = Math.sqrt(rnd()) * 0.92;
      phase[i] = rnd();
      speed[i] = 0.035 + rnd() * 0.09;
      size[i] = 0.6 + rnd() * 1.6;
      tw[i] = 0.4 + rnd() * 1.1;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aAngle', new THREE.BufferAttribute(angle, 1));
    geo.setAttribute('aRad', new THREE.BufferAttribute(rad, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aTw', new THREE.BufferAttribute(tw, 1));
    return geo;
  }, [dustCount]);

  const dustMat = useMemo(() => {
    if (!dustGeo) return null;
    return new THREE.ShaderMaterial({
      vertexShader: moteVertex,
      fragmentShader: moteFragment,
      uniforms: {
        uColor: { value: colorVec },
        uOpacity: { value: Math.min(0.85, opacity * 4.2) },
        uTime: { value: 0 },
        uHeight: { value: height },
        uRadius: { value: radius },
        uMotion: { value: animated ? 1 : 0 },
        uMap: { value: moteTex },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, [dustGeo, colorVec, opacity, height, radius, animated, moteTex]);

  useEffect(
    () => () => {
      outerMat.dispose();
      innerMat.dispose();
      dustGeo?.dispose();
      dustMat?.dispose();
    },
    [outerMat, innerMat, dustGeo, dustMat],
  );

  // ── animation: haze drift + mote fall + a breath of air in the shaft ────
  const outerRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = animated ? state.clock.elapsedTime : 0;
    outerMat.uniforms.uTime.value = t;
    innerMat.uniforms.uTime.value = t;
    if (dustMat) dustMat.uniforms.uTime.value = t;
    if (animated) {
      const sway = Math.sin(state.clock.elapsedTime * 0.11) * 0.05;
      if (outerRef.current) outerRef.current.rotation.y = sway;
      if (innerRef.current) innerRef.current.rotation.y = -sway;
    }
  });

  return (
    <group position={position} rotation={rot}>
      {/* outer scatter: the wide, faint body of the shaft */}
      <mesh ref={outerRef} renderOrder={3} material={outerMat}>
        <coneGeometry args={[radius, height, segments, 1, true]} />
      </mesh>
      {/* inner core: the hot cone right under the fixture */}
      <mesh ref={innerRef} renderOrder={4} material={innerMat}>
        <coneGeometry args={[radius * 0.42, height * 0.92, segments, 1, true]} />
      </mesh>

      {/* dust motes drifting through the light */}
      {dustGeo && dustMat && <points geometry={dustGeo} material={dustMat} renderOrder={5} />}

      {/* contact pool where the beam lands on the floor */}
      {showPool && (
        <mesh
          position={[0, -height / 2 + 0.012, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={2}
        >
          <planeGeometry args={[radius * 3.1, radius * 3.1]} />
          <meshBasicMaterial
            map={poolTex}
            color={colorVec}
            transparent
            opacity={Math.min(0.55, opacity * 2.6)}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
            fog={false}
          />
        </mesh>
      )}

      {/* lens bloom at the fixture */}
      {flare && (
        <sprite position={[0, height / 2 - radius * 0.12, 0]} renderOrder={6} scale={[radius * 1.1, radius * 1.1, 1]}>
          <spriteMaterial
            map={flareTex}
            color={colorVec}
            transparent
            opacity={Math.min(0.75, opacity * 3.2)}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
            fog={false}
          />
        </sprite>
      )}
    </group>
  );
});
