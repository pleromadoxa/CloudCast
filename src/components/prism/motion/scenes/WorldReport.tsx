import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { shiftAccent } from '../../../../lib/prism/motionGraphics';
import { MOTION_EQUIRECT } from '../../../../lib/prism/motionBackgrounds';
import {
  AmbientDust,
  GlowCore,
  LoopFade,
  MetalText,
  MotionEnvironment,
  MotionPostFx,
  MotionShaft,
  ParticleBurst,
  RuleLine,
  SpecSweep,
  VoidBackdrop,
  useMotionClock,
  type MotionSceneProps,
} from '../kit';
import { clamp01, easeInOutCubic, easeOutCubic, easeOutExpo, seg } from '../motionMath';

/**
 * WORLD REPORT — 9s open built around a photoreal 3D globe.
 *
 * The globe is a real sphere textured with the NASA equirectangular world map
 * (fetched by tools/generate-motion-backgrounds.mjs), wrapped in a graticule
 * and an atmosphere rim, with arcs drawing between correspondent cities before
 * the title locks up.
 *
 * Timeline:
 *   0.0 – 2.0  globe rises out of the dark, graticule glows on
 *   0.8 – 4.6  city arcs draw across the surface, pins ignite
 *   4.2        impact burst under the globe
 *   4.4 – 6.0  headline reveals, specular sweep crosses it
 *   6.2 – 7.4  sub-line + rule line
 *   7.4 – 9.0  hold (loops through a fade)
 */

const DEG = Math.PI / 180;

/** Position for a lat/lon pair on a sphere of radius `r`. */
function latLon(lat: number, lon: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * DEG;
  const theta = (lon + 180) * DEG;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

interface ArcSpec {
  from: [number, number];
  to: [number, number];
  /** [draw start, draw end] seconds. */
  window: [number, number];
}

const ARCS: ArcSpec[] = [
  { from: [5.6, -0.19], to: [51.5, -0.13], window: [0.8, 2.1] },
  { from: [51.5, -0.13], to: [40.7, -74], window: [1.5, 3] },
  { from: [40.7, -74], to: [-23.5, -46.6], window: [2.2, 3.6] },
  { from: [5.6, -0.19], to: [35.7, 139.7], window: [2.6, 4.4] },
  { from: [-33.9, 151.2], to: [35.7, 139.7], window: [3.2, 4.6] },
];

/** Correspondent arcs: drawn curves, endpoint pins and a packet riding each line. */
function GlobeArcs({ color, radius }: { color: string; radius: number }) {
  const clock = useMotionClock();
  const packetRefs = useRef<(THREE.Mesh | null)[]>([]);

  const arcs = useMemo(
    () =>
      ARCS.map((spec) => {
        const a = latLon(spec.from[0], spec.from[1], radius);
        const b = latLon(spec.to[0], spec.to[1], radius);
        const mid = a.clone().add(b).multiplyScalar(0.5);
        const lift = radius * (1.16 + a.distanceTo(b) * 0.1);
        mid.normalize().multiplyScalar(lift);
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(72));
        const material = new THREE.LineBasicMaterial({
          color: new THREE.Color(color),
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          toneMapped: false,
        });
        const line = new THREE.Line(geometry, material);
        line.visible = false;
        const pinGeometry = new THREE.SphereGeometry(0.032, 12, 12);
        const pinMaterial = new THREE.MeshBasicMaterial({
          color: new THREE.Color(color),
          toneMapped: false,
        });
        const pin = new THREE.Mesh(pinGeometry, pinMaterial);
        pin.position.copy(a);
        return { spec, curve, geometry, material, line, pin, pinGeometry, pinMaterial };
      }),
    [color, radius],
  );

  useEffect(
    () => () => {
      for (const arc of arcs) {
        arc.geometry.dispose();
        arc.material.dispose();
        arc.pinGeometry.dispose();
        arc.pinMaterial.dispose();
      }
    },
    [arcs],
  );

  useFrame(() => {
    const t = clock.t;
    arcs.forEach((arc, i) => {
      const p = seg(t, arc.spec.window[0], arc.spec.window[1], easeOutCubic);
      const total = arc.geometry.attributes.position.count;
      const draw = Math.max(0, Math.min(total, Math.round(p * total)));
      arc.line.visible = p > 0.002;
      arc.geometry.setDrawRange(0, draw);
      arc.material.opacity = 0.25 + 0.65 * p;

      const packet = packetRefs.current[i];
      if (packet) {
        const riding = p > 0.02 && p < 1;
        packet.visible = riding;
        if (riding) {
          packet.position.copy(arc.curve.getPoint(clamp01(p)));
          packet.scale.setScalar(1 + 0.4 * Math.sin(t * 9 + i));
        }
      }
      arc.pin.visible = p > 0.5;
      arc.pin.scale.setScalar(Math.max(0.001, seg(t, arc.spec.window[1] - 0.35, arc.spec.window[1] + 0.35, easeOutExpo)));
    });
  });

  return (
    <group>
      {arcs.map((arc, i) => (
        <primitive key={`arc-${i}`} object={arc.line} />
      ))}
      {arcs.map((arc, i) => (
        <primitive key={`pin-${i}`} object={arc.pin} />
      ))}
      {arcs.map((_arc, i) => (
        <mesh
          key={`packet-${i}`}
          ref={(node) => {
            packetRefs.current[i] = node;
          }}
          visible={false}
        >
          <sphereGeometry args={[0.05, 10, 10]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} transparent opacity={0.95} />
        </mesh>
      ))}
    </group>
  );
}

/** Loads the NASA world map once per session (null while loading / on 404). */
function useEarthTexture(): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!MOTION_EQUIRECT) return;
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.load(
      MOTION_EQUIRECT,
      (loaded) => {
        if (cancelled) {
          loaded.dispose();
          return;
        }
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.wrapS = THREE.RepeatWrapping;
        loaded.anisotropy = 8;
        setTexture(loaded);
      },
      undefined,
      () => {
        /* map unavailable — the graticule-only globe still reads */
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);
  return texture;
}

export function WorldReport({ headline, subline, accent }: MotionSceneProps) {
  const clock = useMotionClock();
  const globeRef = useRef<THREE.Group>(null);
  const globeMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const texture = useEarthTexture();
  const radius = 1.5;

  useFrame(() => {
    const t = clock.t;
    const group = globeRef.current;
    if (group) {
      group.rotation.y = -0.9 + t * 0.16;
      const rise = seg(t, 0, 1.6, easeOutExpo);
      group.scale.setScalar(0.72 + 0.28 * rise);
      group.position.y = 0.62 - (1 - rise) * 0.5;
      group.visible = rise > 0.005;
    }
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.14 + 0.05 * Math.sin(t * 1.6);
    }
    if (globeMatRef.current) {
      // Before the map decodes, fall back to a dark ocean tint so the
      // silhouette still reads as a planet.
      globeMatRef.current.color.set(texture ? '#ffffff' : '#0d2540');
    }
  });

  return (
    <>
      <VoidBackdrop />
      <MotionEnvironment accent={accent} intensity={1} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[-5, 2.5, 4]} intensity={2.4} color="#eaf2ff" />
      <directionalLight position={[5, -1, -3]} intensity={0.7} color={accent} />

      <MotionShaft position={[-4.6, 3.8, -3.4]} rotation={[0.28, 0, 0.46]} height={11} radius={2.6} color="#eaf2ff" opacity={0.1} ignite={[0.3, 1.8]} />
      <MotionShaft position={[4.6, 3.6, -3.4]} rotation={[0.28, 0, -0.46]} height={11} radius={2.4} color={shiftAccent(accent, 0.35)} opacity={0.09} ignite={[0.6, 2.2]} />
      <GlowCore position={[0, 0.7, -3.4]} scale={13} color={accent} intensity={0.3} reveal={[0.2, 1.6]} boostAt={4.2} boost={2.2} />

      <group ref={globeRef} position={[0, 0.62, 0]} scale={0.72}>
        <mesh>
          <sphereGeometry args={[radius, 96, 64]} />
          <meshStandardMaterial
            ref={globeMatRef}
            map={texture ?? undefined}
            color="#0d2540"
            roughness={0.82}
            metalness={0.08}
            emissive="#05101f"
            emissiveIntensity={0.9}
          />
        </mesh>
        {/* Atmosphere rim — a larger back-side shell visible past the silhouette. */}
        <mesh ref={glowRef}>
          <sphereGeometry args={[radius * 1.09, 64, 48]} />
          <meshBasicMaterial
            color={accent}
            transparent
            opacity={0.14}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
            fog={false}
          />
        </mesh>
        {/* Graticule */}
        <mesh>
          <sphereGeometry args={[radius * 1.004, 36, 18]} />
          <meshBasicMaterial
            color={accent}
            wireframe
            transparent
            opacity={0.16}
            depthWrite={false}
            toneMapped={false}
            fog={false}
          />
        </mesh>
        <GlobeArcs color={shiftAccent(accent, 0.35)} radius={radius * 1.01} />
      </group>

      <AmbientDust count={520} radius={13} color={accent} size={0.048} drift={0.04} opacity={0.6} reveal={[0.4, 2.4]} />
      <ParticleBurst count={700} color={accent} size={0.085} seed={17} spread={6.5} origin={[0, -1.1, 0]} window={[4.2, 5.6]} fadeOut={1.8} />

      <MetalText
        text={headline}
        accent={accent}
        size={0.62}
        position={[0, -1.7, 0]}
        letterSpacing={0.08}
        reveal={[4.4, 5.9]}
      />
      <SpecSweep window={[5.4, 6.5]} width={10} height={1.05} position={[0, -1.7, 0.4]} intensity={0.9} />
      <RuleLine y={-2.12} color={accent} from={4.9} to={5.9} width={5.6} />

      <MetalText
        text={subline}
        accent={shiftAccent(accent, 0.75)}
        size={0.17}
        position={[0, -2.42, 0]}
        letterSpacing={0.32}
        reveal={[6.2, 7.4]}
        rise={0.1}
        metalness={0.25}
        roughness={0.5}
      />

      <WorldCamera />
      <LoopFade from={8.2} to={8.95} />
      <MotionPostFx
        bloomIntensity={0.9}
        pulse={{ at: 4.2, width: 0.34, boost: 1.3 }}
        chroma={0.0008}
        grain={0.05}
        vignette={0.72}
      />
    </>
  );
}

/** Gentle push-in that keeps the globe centred above the title. */
function WorldCamera() {
  const clock = useMotionClock();
  const lookAt = useMemo(() => new THREE.Vector3(0, 0.1, 0), []);
  const desired = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }, dt) => {
    const t = clock.t;
    const push = seg(t, 0, 3.4, easeInOutCubic);
    const settle = seg(t, 3.4, 6.6, easeOutExpo);
    const z = 5.6 + push * 0.5 + settle * 1.1;
    const y = 0.15 + Math.sin(t * 0.4) * 0.05;
    const x = Math.sin(t * 0.2) * 0.35;
    desired.set(x, y, z);
    const perspective = camera as THREE.PerspectiveCamera;
    if (t < 0.12 || dt <= 0) {
      camera.position.copy(desired);
    } else {
      camera.position.lerp(desired, 1 - Math.exp(-4.5 * dt));
    }
    camera.lookAt(lookAt);
    const fov = 46 - settle * 2.5;
    if (Math.abs(perspective.fov - fov) > 0.01) {
      perspective.fov = fov;
      perspective.updateProjectionMatrix();
    }
  });

  return null;
}
