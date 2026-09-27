import { memo, useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useStudioMaterials } from './materials';
import { PbrSurface } from './PbrSurface';
import { LightBeam } from './LightBeam';
import { useLightSlot, usePracticalLightScale, useVolumetrics } from './fidelityLighting';
import {
  PLANT_SPECIES,
  pickPlantSpecies,
  plantModelUrl,
  plantSeed,
  preparePlantInstance,
  usePlantModel,
  type PlantSpecies,
} from './plantModels';
import {
  carpetPbrOptions,
  lacqueredWoodMaterial,
  leatherMaterial,
  upholsteryMaterial,
} from '../../../lib/prism/pbrMaterials';

/**
 * High-fidelity set furniture for the virtual studio. Every piece uses rounded
 * geometry (no hard CG corners), real PBR materials from the procedural texture
 * library, and physical scale so talent and cameras read correctly.
 *
 * Materials are shared instances handed to meshes through the `material` prop,
 * which keeps draw-call state simple and avoids primitive reuse.
 */

type PlaceProps = {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
};


export type StudioMaterials = ReturnType<typeof useStudioMaterials>;

/* ------------------------------------------------------------------ desks */

/** Curved anchor desk with glass top and a lit front fascia. */
export const AnchorDesk = memo(function AnchorDesk({
  position,
  rotation,
  scale = 1,
  accent = '#e11d48',
  width = 3.4,
  body = '#18181b',
}: PlaceProps & { accent?: string; width?: number; body?: string }) {
  const m = useStudioMaterials();
  const bodyMat = useMemo(
    () =>
      body === '#18181b'
        ? m.dark
        : new THREE.MeshStandardMaterial({ color: body, roughness: 0.42, metalness: 0.12 }),
    [body, m.dark],
  );
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <RoundedBox args={[width, 0.78, 1.1]} radius={0.06} smoothness={4} position={[0, 0.39, 0]} material={bodyMat} castShadow receiveShadow />
      <RoundedBox args={[width + 0.14, 0.05, 1.24]} radius={0.02} smoothness={4} position={[0, 0.805, 0]} castShadow>
        <PbrSurface physical
          color="#0d0d12"
          metalness={0.2}
          roughness={0.06}
          clearcoat={1}
          clearcoatRoughness={0.03}
          envMapIntensity={1.6}
        />
      </RoundedBox>
      <mesh position={[0, 0.5, 0.56]}>
        <planeGeometry args={[width - 0.3, 0.16]} />
        <PbrSurface color={accent} emissive={accent} emissiveIntensity={2.4} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.16, 0.56]}>
        <planeGeometry args={[width - 0.3, 0.05]} />
        <PbrSurface color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
      <RoundedBox args={[width - 0.3, 0.12, 0.9]} radius={0.03} smoothness={3} position={[0, 0.06, 0]} material={m.blackGlass} receiveShadow />
      {/* cable grommet in the glass top */}
      <mesh position={[width / 2 - 0.42, 0.832, -0.34]}>
        <cylinderGeometry args={[0.055, 0.055, 0.012, 20]} />
        <PbrSurface color="#101014" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
});

/** Angular analysis desk used on sports sets. */
export const SportsDesk = memo(function SportsDesk({
  position,
  rotation,
  scale = 1,
  accent = '#f97316',
}: PlaceProps & { accent?: string }) {
  const m = useStudioMaterials();
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <RoundedBox args={[3.2, 0.8, 1.3]} radius={0.1} smoothness={4} position={[0, 0.4, 0]} material={m.metal} castShadow receiveShadow />
      <RoundedBox args={[3.3, 0.06, 1.4]} radius={0.025} smoothness={4} position={[0, 0.83, 0]} material={m.marble} castShadow />
      <mesh position={[0, 0.42, 0.66]}>
        <planeGeometry args={[2.6, 0.3]} />
        <PbrSurface color={accent} emissive={accent} emissiveIntensity={2.2} toneMapped={false} />
      </mesh>
    </group>
  );
});

/* --------------------------------------------------------------- seating */

/** Broadcast sofa — deep cushions, seam gaps, piping and tapered legs. */
export const StudioSofa = memo(function StudioSofa({
  position,
  rotation,
  scale = 1,
  fabric = 'velvet',
  color = '#3f3f46',
  width = 2.4,
}: PlaceProps & { fabric?: 'velvet' | 'linen'; color?: string; width?: number }) {
  const m = useStudioMaterials();
  const cloth = useMemo(
    () => upholsteryMaterial(color, fabric === 'linen' ? { kind: 'fabric_linen', seed: 2, sheen: 0.45, roughness: 0.94 } : {}),
    [color, fabric],
  );
  const clothDark = useMemo(() => {
    const c = new THREE.Color(color).multiplyScalar(0.78);
    return upholsteryMaterial(`#${c.getHexString()}`, { sheen: 0.8 });
  }, [color]);
  const pillow = useMemo(() => {
    const c = new THREE.Color(color).lerp(new THREE.Color('#e7e2da'), 0.32);
    return upholsteryMaterial(`#${c.getHexString()}`, { kind: 'fabric_linen', seed: 2, sheen: 0.5 });
  }, [color]);
  const seam = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.55), roughness: 0.95 }), [color]);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* base + shadow gap under the seat cushions */}
      <RoundedBox args={[width, 0.3, 1.0]} radius={0.07} smoothness={4} position={[0, 0.25, 0]} material={clothDark} castShadow receiveShadow />
      <mesh position={[0, 0.425, 0.02]}>
        <boxGeometry args={[width - 0.18, 0.03, 0.9]} />
        <PbrSurface color="#0b0b0d" roughness={1} />
      </mesh>
      {/* back */}
      <RoundedBox args={[width, 0.62, 0.24]} radius={0.09} smoothness={4} position={[0, 0.66, -0.4]} material={cloth} castShadow />
      {[-1, 1].map((side) => (
        <RoundedBox
          key={side}
          args={[width / 2 - 0.08, 0.18, 0.92]}
          radius={0.07}
          smoothness={4}
          position={[side * (width / 4 - 0.02), 0.48, 0.02]}
          material={cloth}
          castShadow
        />
      ))}
      {/* seat-cushion piping + crease lines + tuft buttons */}
      {[-1, 1].map((side) => (
        <group key={`seam${side}`} position={[side * (width / 4 - 0.02), 0.48, 0.02]}>
          <mesh position={[0, 0.092, 0]} rotation={[-Math.PI / 2, 0, 0]} material={seam}>
            <torusGeometry args={[0.3, 0.006, 6, 40]} />
          </mesh>
          {/* front crease where the cushion body rolls over */}
          <mesh position={[0, 0.045, 0.445]} material={seam}>
            <boxGeometry args={[width / 2 - 0.14, 0.012, 0.012]} />
          </mesh>
          {[-0.14, 0.14].map((x) =>
            [-0.14, 0.14].map((z) => (
              <mesh key={`${x}${z}`} position={[x, 0.088, z]} scale={[1, 0.35, 1]} material={seam}>
                <sphereGeometry args={[0.022, 10, 8]} />
              </mesh>
            )),
          )}
        </group>
      ))}
      {/* back-cushion piping */}
      {[-1, 1].map((side) => (
        <mesh key={`pipe${side}`} position={[side * (width / 4 - 0.02), 0.6, -0.275]} material={seam}>
          <torusGeometry args={[0.24, 0.008, 6, 36]} />
        </mesh>
      ))}
      {/* rolled arms with piping along the top */}
      {[-1, 1].map((side) => (
        <group key={`arm${side}`}>
          <RoundedBox
            args={[0.22, 0.42, 1.0]}
            radius={0.09}
            smoothness={4}
            position={[(side * width) / 2 - side * 0.11, 0.5, 0]}
            material={cloth}
            castShadow
          />
          <mesh position={[(side * width) / 2 - side * 0.11, 0.71, 0]} rotation={[0, 0, Math.PI / 2]} material={seam}>
            <torusGeometry args={[0.1, 0.008, 6, 24, Math.PI]} />
          </mesh>
        </group>
      ))}
      {/* tapered walnut legs with brass ferrules */}
      {[
        [-width / 2 + 0.18, 0.4],
        [width / 2 - 0.18, 0.4],
        [-width / 2 + 0.18, -0.4],
        [width / 2 - 0.18, -0.4],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.1, 0]} material={m.brass} castShadow>
            <cylinderGeometry args={[0.028, 0.03, 0.05, 12]} />
          </mesh>
          <mesh position={[0, 0.055, 0]} rotation={[0.05 * Math.sign(x), 0, 0.05 * Math.sign(z)]} material={m.walnut} castShadow>
            <cylinderGeometry args={[0.024, 0.017, 0.12, 12]} />
          </mesh>
        </group>
      ))}
      {/* throw pillows in the lighter tone */}
      <RoundedBox args={[0.36, 0.36, 0.12]} radius={0.06} smoothness={4} position={[-width / 2 + 0.42, 0.66, -0.24]} rotation={[0.2, 0.3, 0.12]} material={pillow} castShadow />
      <RoundedBox args={[0.36, 0.36, 0.12]} radius={0.06} smoothness={4} position={[width / 2 - 0.42, 0.66, -0.24]} rotation={[0.15, -0.25, -0.1]} material={pillow} castShadow />
    </group>
  );
});

export const StudioArmchair = memo(function StudioArmchair({
  position,
  rotation,
  scale = 1,
  color = '#44403c',
}: PlaceProps & { color?: string }) {
  const m = useStudioMaterials();
  const cloth = useMemo(() => upholsteryMaterial(color), [color]);
  const clothDark = useMemo(() => {
    const c = new THREE.Color(color).multiplyScalar(0.72);
    return upholsteryMaterial(`#${c.getHexString()}`, { sheen: 0.8 });
  }, [color]);
  const seam = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.52), roughness: 0.95 }), [color]);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* outer shell (slightly darker, reads as the chair's structure) */}
      <RoundedBox args={[0.92, 0.62, 0.22]} radius={0.1} smoothness={5} position={[0, 0.65, -0.385]} rotation={[-0.16, 0, 0]} material={clothDark} castShadow />
      {/* seat base with shadow gap */}
      <RoundedBox args={[0.88, 0.24, 0.88]} radius={0.08} smoothness={4} position={[0, 0.3, 0]} material={clothDark} castShadow receiveShadow />
      <mesh position={[0, 0.435, 0.02]}>
        <boxGeometry args={[0.72, 0.025, 0.72]} />
        <PbrSurface color="#0b0b0d" roughness={1} />
      </mesh>
      {/* back cushion with top-edge piping */}
      <RoundedBox args={[0.82, 0.56, 0.17]} radius={0.08} smoothness={4} position={[0, 0.68, -0.315]} rotation={[-0.16, 0, 0]} material={cloth} castShadow />
      <mesh position={[0, 0.945, -0.36]} rotation={[-0.16, 0, 0]} material={seam}>
        <torusGeometry args={[0.1, 0.008, 6, 24, Math.PI]} />
      </mesh>
      {/* seat cushion + piping ring + front crease */}
      <RoundedBox args={[0.8, 0.15, 0.8]} radius={0.055} smoothness={4} position={[0, 0.52, 0.03]} material={cloth} castShadow />
      <mesh position={[0, 0.598, 0.03]} rotation={[-Math.PI / 2, 0, 0]} material={seam}>
        <torusGeometry args={[0.28, 0.007, 6, 40]} />
      </mesh>
      <mesh position={[0, 0.485, 0.418]} material={seam}>
        <boxGeometry args={[0.66, 0.012, 0.012]} />
      </mesh>
      {/* curved arms: angled elbow + rounded cap */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <RoundedBox args={[0.15, 0.3, 0.82]} radius={0.07} smoothness={4} position={[side * 0.42, 0.52, -0.02]} rotation={[0, 0, side * -0.1]} material={clothDark} castShadow />
          <mesh position={[side * 0.42, 0.685, -0.02]} rotation={[0, 0, Math.PI / 2]} material={seam}>
            <torusGeometry args={[0.075, 0.008, 6, 20, Math.PI]} />
          </mesh>
        </group>
      ))}
      {/* splayed tapered walnut legs with brass ferrules */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx}${sz}`} position={[sx * 0.33, 0, sz * 0.33]}>
            <mesh position={[0, 0.21, 0]} rotation={[sz * -0.16, 0, sx * 0.16]} material={m.walnut} castShadow>
              <cylinderGeometry args={[0.028, 0.018, 0.24, 12]} />
            </mesh>
            <mesh position={[sx * 0.02, 0.325, sz * 0.02]} material={m.brass} castShadow>
              <cylinderGeometry args={[0.03, 0.032, 0.045, 12]} />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
});

/** Anchor task chair — contoured cushions, armrests, five-star caster base. */
export const StudioChair = memo(function StudioChair({
  position,
  rotation,
  scale = 1,
}: PlaceProps) {
  const m = useStudioMaterials();
  const seatMat = useMemo(() => upholsteryMaterial('#252b36', { sheen: 0.7, sheenColor: '#4a5566' }), []);
  const shellMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.55, metalness: 0.12 }), []);
  const legs = useMemo(() => Array.from({ length: 5 }, (_, i) => (i / 5) * Math.PI * 2), []);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* seat cushion with piping + shell under it */}
      <RoundedBox args={[0.52, 0.07, 0.5]} radius={0.03} smoothness={3} position={[0, 0.485, 0]} material={shellMat} castShadow />
      <RoundedBox args={[0.5, 0.1, 0.48]} radius={0.045} smoothness={4} position={[0, 0.555, 0.01]} material={seatMat} castShadow receiveShadow />
      <mesh position={[0, 0.608, 0.01]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.17, 0.006, 6, 36]} />
        <PbrSurface color="#161b24" roughness={0.95} />
      </mesh>
      {/* contoured back with lumbar curve */}
      <RoundedBox args={[0.48, 0.58, 0.08]} radius={0.038} smoothness={4} position={[0, 0.86, -0.235]} rotation={[-0.14, 0, 0]} material={seatMat} castShadow />
      <RoundedBox args={[0.44, 0.16, 0.05]} radius={0.025} smoothness={3} position={[0, 0.72, -0.19]} rotation={[-0.14, 0, 0]} material={shellMat} castShadow />
      {/* armrests */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.3, 0, 0]}>
          <mesh position={[0, 0.62, -0.05]} rotation={[0, 0, 0]} material={shellMat} castShadow>
            <boxGeometry args={[0.045, 0.16, 0.045]} />
          </mesh>
          <RoundedBox args={[0.07, 0.035, 0.26]} radius={0.017} smoothness={3} position={[0, 0.715, -0.02]} material={shellMat} castShadow />
        </group>
      ))}
      {/* gas lift */}
      <mesh position={[0, 0.32, 0]} material={m.chrome} castShadow>
        <cylinderGeometry args={[0.032, 0.042, 0.32, 16]} />
      </mesh>
      <mesh position={[0, 0.475, 0]} material={shellMat}>
        <cylinderGeometry args={[0.05, 0.05, 0.06, 16]} />
      </mesh>
      {/* five-star base with twin-wheel casters */}
      {legs.map((angle, i) => (
        <group key={i} rotation={[0, angle, 0]}>
          <mesh position={[0, 0.095, 0.22]} rotation={[Math.PI / 2 - 0.12, 0, 0]} material={shellMat} castShadow>
            <boxGeometry args={[0.055, 0.045, 0.46]} />
          </mesh>
          {/* caster fork + wheels */}
          <mesh position={[0, 0.055, 0.43]} material={shellMat} castShadow>
            <boxGeometry args={[0.035, 0.075, 0.05]} />
          </mesh>
          {[-0.022, 0.022].map((x) => (
            <mesh key={x} position={[x, 0.032, 0.43]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <torusGeometry args={[0.028, 0.012, 8, 16]} />
              <PbrSurface color="#0c0d10" roughness={0.45} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
});

/* ----------------------------------------------- designer lounge chairs */

/**
 * Tub / barrel chair (Fusion style) — continuous wraparound shell with a
 * padded rim roll, segmented inner cushions, deep seat and splayed legs.
 */
export const TubChair = memo(function TubChair({
  position,
  rotation,
  scale = 1,
  color = '#3d4c6f',
  legColor = '#d9c19a',
  backHeight = 0.52,
  radius = 0.42,
}: PlaceProps & { color?: string; legColor?: string; backHeight?: number; radius?: number }) {
  const cloth = useMemo(() => upholsteryMaterial(color), [color]);
  const clothDark = useMemo(() => {
    const c = new THREE.Color(color).multiplyScalar(0.72);
    return upholsteryMaterial(`#${c.getHexString()}`, { sheen: 0.85 });
  }, [color]);
  const seam = useMemo(
    () => new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.5), roughness: 0.95 }),
    [color],
  );
  const legMat = useMemo(() => new THREE.MeshStandardMaterial({ color: legColor, roughness: 0.5, metalness: 0.02 }), [legColor]);

  // the shell wraps ~245°, opening toward +z
  const gap = 1.95;
  const thetaStart = gap / 2;
  const thetaLen = Math.PI * 2 - gap;
  const rOut = radius;
  const rIn = radius - 0.15;
  const wallBase = 0.22;

  // rim roll + arm roll + inner cushion panel placements along the arc
  const rimSegs = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => {
        const t = thetaStart + (i + 0.5) * (thetaLen / 16);
        return { t, r: (rOut + rIn) / 2 };
      }),
    [rOut, rIn, thetaStart, thetaLen],
  );
  const panels = useMemo(
    () =>
      [-1, 0, 1].map((k) => ({
        t: Math.PI + k * 0.82,
        w: 0.72,
      })),
    [],
  );

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* outer shell wall (curved cylinder segments) */}
      <mesh position={[0, wallBase + backHeight / 2, 0]} material={clothDark} castShadow receiveShadow>
        <cylinderGeometry args={[rOut, rOut * 1.03, backHeight, 48, 1, true, thetaStart, thetaLen]} />
      </mesh>
      <mesh position={[0, wallBase + backHeight / 2, 0]} material={cloth}>
        <cylinderGeometry args={[rIn, rIn, backHeight - 0.02, 48, 1, true, thetaStart, thetaLen]} />
      </mesh>
      {/* padded rim roll along the shell top */}
      {rimSegs.map((seg, i) => (
        <mesh key={i} position={[Math.sin(seg.t) * seg.r, wallBase + backHeight, Math.cos(seg.t) * seg.r]} rotation={[0, -seg.t, Math.PI / 2]} material={cloth} castShadow>
          <capsuleGeometry args={[0.032, (thetaLen / 16) * seg.r * 0.9, 6, 10]} />
        </mesh>
      ))}
      {/* segmented inner back cushions with seam gaps */}
      {panels.map((panel, i) => (
        <mesh key={i} position={[Math.sin(panel.t) * (rIn - 0.02), wallBase + backHeight * 0.52, Math.cos(panel.t) * (rIn - 0.02)]} rotation={[0, Math.PI - panel.t, 0]} material={cloth} castShadow>
          <boxGeometry args={[panel.w, backHeight * 0.72, 0.07]} />
        </mesh>
      ))}
      {/* arm rolls at the shell ends */}
      {[-1, 1].map((side) => {
        const t = Math.PI + side * (thetaLen / 2 - 0.28);
        return (
          <mesh key={side} position={[Math.sin(t) * (rIn + 0.02), wallBase + backHeight * 0.42, Math.cos(t) * (rIn + 0.02)]} rotation={[0, -t, Math.PI / 2]} material={cloth} castShadow>
            <capsuleGeometry args={[0.065, 0.2, 8, 14]} />
          </mesh>
        );
      })}
      {/* seat base with shadow gap + deep cushion */}
      <RoundedBox args={[0.72, 0.17, 0.66]} radius={0.07} smoothness={4} position={[0, 0.32, 0.02]} material={clothDark} castShadow receiveShadow />
      <mesh position={[0, 0.415, 0.02]}>
        <boxGeometry args={[0.6, 0.025, 0.55]} />
        <PbrSurface color="#0b0b0d" roughness={1} />
      </mesh>
      <RoundedBox args={[0.68, 0.16, 0.62]} radius={0.075} smoothness={5} position={[0, 0.5, 0.03]} material={cloth} castShadow />
      <mesh position={[0, 0.583, 0.03]} rotation={[-Math.PI / 2, 0, 0]} material={seam}>
        <torusGeometry args={[0.22, 0.007, 6, 40]} />
      </mesh>
      {/* seat centre seam */}
      <mesh position={[0, 0.578, 0.03]} material={seam}>
        <boxGeometry args={[0.008, 0.012, 0.52]} />
      </mesh>
      {/* splayed tapered legs */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 0.3, 0.125, sz * 0.27 + 0.02]} rotation={[sz * -0.16, 0, sx * 0.16]} material={legMat} castShadow>
            <cylinderGeometry args={[0.026, 0.017, 0.26, 12]} />
          </mesh>
        )),
      )}
    </group>
  );
});

/** Leather-and-oak dining armchair — wraparound leather shell on a wood frame. */
export const LeatherDiningChair = memo(function LeatherDiningChair({
  position,
  rotation,
  scale = 1,
  leather = '#41543f',
  wood = '#c9a06a',
}: PlaceProps & { leather?: string; wood?: string }) {
  const hide = useMemo(() => leatherMaterial(leather, 11), [leather]);
  const hideDark = useMemo(() => {
    const c = new THREE.Color(leather).multiplyScalar(0.74);
    return leatherMaterial(`#${c.getHexString()}`, 12);
  }, [leather]);
  const seam = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(leather).multiplyScalar(0.5), roughness: 0.85 }), [leather]);
  const oak = useMemo(() => lacqueredWoodMaterial('wood_oak', 3, { gloss: 0.35, color: wood }), [wood]);

  const gap = 2.35;
  const thetaStart = gap / 2;
  const thetaLen = Math.PI * 2 - gap;

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* wraparound leather back + arms (thin curved wall) */}
      <mesh position={[0, 0.68, -0.02]} material={hide} castShadow receiveShadow>
        <cylinderGeometry args={[0.31, 0.31, 0.5, 40, 1, true, thetaStart, thetaLen]} />
      </mesh>
      <mesh position={[0, 0.68, -0.02]} material={hideDark}>
        <cylinderGeometry args={[0.285, 0.285, 0.5, 40, 1, true, thetaStart, thetaLen]} />
      </mesh>
      {/* top roll of the back */}
      {Array.from({ length: 14 }, (_, i) => {
        const t = thetaStart + (i + 0.5) * (thetaLen / 14);
        return (
          <mesh key={i} position={[Math.sin(t) * 0.298, 0.93, Math.cos(t) * 0.298 - 0.02]} rotation={[0, -t, Math.PI / 2]} material={hide} castShadow>
            <capsuleGeometry args={[0.026, (thetaLen / 14) * 0.298 * 0.85, 6, 10]} />
          </mesh>
        );
      })}
      {/* vertical seam lines on the inner back */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[Math.sin(Math.PI + side * 0.62) * 0.29, 0.7, Math.cos(Math.PI + side * 0.62) * 0.29 - 0.02]} rotation={[0, side * -0.62, 0]} material={seam}>
          <boxGeometry args={[0.008, 0.42, 0.012]} />
        </mesh>
      ))}
      {/* leather seat cushion with piping */}
      <RoundedBox args={[0.56, 0.11, 0.52]} radius={0.05} smoothness={4} position={[0, 0.475, 0.02]} material={hide} castShadow />
      <mesh position={[0, 0.532, 0.02]} rotation={[-Math.PI / 2, 0, 0]} material={seam}>
        <torusGeometry args={[0.185, 0.006, 6, 36]} />
      </mesh>
      {/* oak seat frame band */}
      {[-1, 1].map((side) => (
        <mesh key={`band${side}`} position={[side * 0.27, 0.4, 0.02]} material={oak} castShadow>
          <boxGeometry args={[0.035, 0.05, 0.5]} />
        </mesh>
      ))}
      {[0.24, -0.24].map((z) => (
        <mesh key={z} position={[0, 0.4, z + 0.02]} material={oak} castShadow>
          <boxGeometry args={[0.52, 0.05, 0.03]} />
        </mesh>
      ))}
      {/* splayed tapered oak legs with brass ferrules */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx}${sz}`} position={[sx * 0.245, 0, sz * 0.21 + 0.02]}>
            <mesh position={[0, 0.2, 0]} rotation={[sz * -0.11, 0, sx * 0.11]} material={oak} castShadow>
              <cylinderGeometry args={[0.022, 0.014, 0.4, 12]} />
            </mesh>
            <mesh position={[sx * 0.02, 0.395, sz * 0.018]} material={oak} castShadow>
              <cylinderGeometry args={[0.024, 0.024, 0.045, 12]} />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
});

/* --------------------------------------------------------------- tables */

export const CoffeeTable = memo(function CoffeeTable({
  position,
  rotation,
  scale = 1,
  width = 1.3,
  depth = 0.7,
}: PlaceProps & { width?: number; depth?: number }) {
  const m = useStudioMaterials();
  const top = useMemo(() => lacqueredWoodMaterial('wood_walnut', 3, { gloss: 0.62 }), []);
  const shelf = useMemo(() => lacqueredWoodMaterial('wood_oak', 1, { gloss: 0.4 }), []);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* eased walnut top with a brass inlay line */}
      <RoundedBox args={[width, 0.055, depth]} radius={0.022} smoothness={4} position={[0, 0.42, 0]} material={top} castShadow receiveShadow />
      <mesh position={[0, 0.4485, 0]}>
        <boxGeometry args={[width * 0.995, 0.0025, 0.012]} />
        <PbrSurface color="#b08d4f" metalness={1} roughness={0.3} envMapIntensity={1.5} />
      </mesh>
      {/* sculptural trestle: two angled slab legs + centre stretcher */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * width * 0.3, 0.215, 0]} rotation={[0, 0, side * -0.16]} material={top} castShadow receiveShadow>
            <boxGeometry args={[0.06, 0.42, depth * 0.72]} />
          </mesh>
          {/* foot chamfer accent */}
          <mesh position={[side * width * 0.325, 0.022, 0]} material={m.brass} castShadow>
            <boxGeometry args={[0.062, 0.028, depth * 0.5]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.26, 0]} rotation={[0, 0, Math.PI / 2]} material={m.dark} castShadow>
        <cylinderGeometry args={[0.024, 0.024, width * 0.58, 12]} />
      </mesh>
      {/* floating oak shelf */}
      <RoundedBox args={[width * 0.66, 0.035, depth * 0.58]} radius={0.015} smoothness={3} position={[0, 0.175, 0]} material={shelf} castShadow receiveShadow />
    </group>
  );
});

export const MediaConsole = memo(function MediaConsole({
  position,
  rotation,
  scale = 1,
  width = 2.0,
}: PlaceProps & { width?: number }) {
  const m = useStudioMaterials();
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <RoundedBox args={[width, 0.45, 0.42]} radius={0.03} smoothness={4} position={[0, 0.3, 0]} material={m.walnut} castShadow receiveShadow />
      <mesh position={[0, 0.3, 0.215]}>
        <planeGeometry args={[width - 0.1, 0.3]} />
        <PbrSurface color="#0d0d10" roughness={0.4} metalness={0.3} />
      </mesh>
      {[-width / 4, width / 4].map((x) => (
        <mesh key={x} position={[x, 0.05, 0]} material={m.chrome} castShadow>
          <cylinderGeometry args={[0.02, 0.02, 0.1, 10]} />
        </mesh>
      ))}
      {/* vent grille + standby LED on the recessed fascia */}
      {[-0.06, 0, 0.06].map((y) => (
        <mesh key={y} position={[-width / 6, 0.3 + y, 0.22]}>
          <planeGeometry args={[width * 0.42, 0.018]} />
          <PbrSurface color="#26262b" roughness={0.6} metalness={0.4} />
        </mesh>
      ))}
      <mesh position={[width / 2 - 0.14, 0.3, 0.222]}>
        <circleGeometry args={[0.012, 12]} />
        <PbrSurface color="#22c55e" emissive="#22c55e" emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
    </group>
  );
});

/* ------------------------------------------------------------- soft goods */

export const AreaRug = memo(function AreaRug({
  position,
  rotation,
  scale = 1,
  width = 3.4,
  depth = 2.4,
  color = '#7c2d12',
}: PlaceProps & { width?: number; depth?: number; color?: string }) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Subdivided so the tuft displacement genuinely lifts the pile. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow>
        <planeGeometry args={[width, depth, 40, 30]} />
        <PbrSurface color={color} {...carpetPbrOptions()} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <planeGeometry args={[width + 0.1, depth + 0.1]} />
        <PbrSurface color="#292524" roughness={1} />
      </mesh>
    </group>
  );
});

export const Bookshelf = memo(function Bookshelf({
  position,
  rotation,
  scale = 1,
  width = 1.4,
  height = 2.0,
}: PlaceProps & { width?: number; height?: number }) {
  const m = useStudioMaterials();
  const shelves = Math.max(3, Math.round(height / 0.5));
  const bookColors = ['#b91c1c', '#1d4ed8', '#15803d', '#a16207', '#5b21b6', '#0f766e', '#374151'];
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <RoundedBox args={[width, height, 0.36]} radius={0.02} smoothness={3} position={[0, height / 2, 0]} material={m.oak} castShadow receiveShadow />
      {Array.from({ length: shelves - 1 }, (_, s) => {
        const y = 0.16 + ((s + 1) * (height - 0.2)) / shelves;
        return (
          <group key={s}>
            <mesh position={[0, y, 0.03]} material={m.walnut}>
              <boxGeometry args={[width - 0.1, 0.03, 0.3]} />
            </mesh>
            <group position={[0, y + 0.02, 0.06]}>
              {Array.from({ length: 9 }, (_, b) => {
                const bw = 0.045 + ((b * 37 + s * 11) % 5) * 0.012;
                const bh = 0.24 + ((b * 17 + s * 7) % 4) * 0.02;
                const x = -width / 2 + 0.1 + b * 0.11;
                return (
                  <mesh key={b} position={[x, bh / 2, 0]} castShadow>
                    <boxGeometry args={[bw, bh, 0.18]} />
                    <PbrSurface color={bookColors[(b + s) % bookColors.length]} roughness={0.8} />
                  </mesh>
                );
              })}
            </group>
          </group>
        );
      })}
    </group>
  );
});

/* --------------------------------------------------------------- plants */

/** Granular soil surface — dark earth with fine noise for the pot interior. */
let soilTexture: THREE.CanvasTexture | null = null;
function getSoilTexture(): THREE.CanvasTexture {
  if (soilTexture) return soilTexture;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#241a12';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i += 1) {
    const v = Math.random();
    ctx.fillStyle = `rgba(${40 + v * 60},${28 + v * 42},${18 + v * 28},${0.25 + v * 0.5})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  soilTexture = new THREE.CanvasTexture(canvas);
  soilTexture.colorSpace = THREE.SRGBColorSpace;
  soilTexture.wrapS = soilTexture.wrapT = THREE.RepeatWrapping;
  return soilTexture;
}

const POT_PALETTES: Record<string, { body: string; roughness: number; clearcoat: number }> = {
  terracotta: { body: '#a75f42', roughness: 0.62, clearcoat: 0.12 },
  charcoal: { body: '#3b3b40', roughness: 0.38, clearcoat: 0.4 },
  cream: { body: '#d8d0c1', roughness: 0.34, clearcoat: 0.45 },
  sage: { body: '#7e8b74', roughness: 0.42, clearcoat: 0.35 },
};

/**
 * Glazed ceramic planter — lathed profile with a real rim lip, domed soil,
 * pebble mulch and moss. Carries the foliage-only scans (fern, calathea,
 * anthurium, pachira) the way a real planter would.
 */
const CeramicPot = memo(function CeramicPot({
  height = 0.32,
  radius = 0.24,
  style = 'terracotta',
  seed = 0,
}: {
  height?: number;
  radius?: number;
  style?: PlantSpecies['potStyle'];
  seed?: number;
}) {
  const palette = POT_PALETTES[style ?? 'terracotta'];
  const geometry = useMemo(() => {
    const r = radius;
    const h = height;
    // profile: tapered belly -> shoulder -> overhanging rim lip -> inner wall
    const pts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(r * 0.66, 0),
      new THREE.Vector2(r * 0.78, h * 0.1),
      new THREE.Vector2(r * 0.9, h * 0.55),
      new THREE.Vector2(r * 0.97, h * 0.82),
      new THREE.Vector2(r * 1.05, h * 0.86),
      new THREE.Vector2(r * 1.05, h),
      new THREE.Vector2(r * 0.96, h),
      new THREE.Vector2(r * 0.92, h * 0.88),
    ];
    return new THREE.LatheGeometry(pts, 36);
  }, [radius, height]);

  const pebbles = useMemo(() => {
    const rand = (n: number) => {
      const v = Math.sin((seed + 1) * 12.9898 + n * 78.233) * 43758.5453;
      return v - Math.floor(v);
    };
    return Array.from({ length: 14 }, (_, i) => ({
      x: (rand(i * 3) - 0.5) * radius * 1.5,
      z: (rand(i * 3 + 1) - 0.5) * radius * 1.5,
      s: radius * (0.06 + rand(i * 3 + 2) * 0.07),
      tone: 0.4 + rand(i * 7) * 0.45,
    }));
  }, [radius, seed]);

  return (
    <group>
      {/* glazed body */}
      <mesh geometry={geometry} castShadow receiveShadow>
        <PbrSurface physical
          color={palette.body}
          roughness={palette.roughness}
          clearcoat={palette.clearcoat}
          clearcoatRoughness={0.35}
          envMapIntensity={1.15}
        />
      </mesh>
      {/* domed soil */}
      <mesh position={[0, height * 0.84, 0]} scale={[1, 0.22, 1]} receiveShadow>
        <sphereGeometry args={[radius * 0.93, 22, 10]} />
        <PbrSurface map={getSoilTexture()} color="#8a7562" roughness={1} />
      </mesh>
      {/* pebble mulch ring */}
      {pebbles.map((p, i) => (
        <mesh key={i} position={[p.x, height * 0.88, p.z]} scale={[1, 0.55, 1]} rotation={[0, i * 1.7, 0]} castShadow>
          <sphereGeometry args={[p.s, 8, 6]} />
          <PbrSurface color={new THREE.Color(0.55, 0.5, 0.44).multiplyScalar(p.tone)} roughness={0.82} />
        </mesh>
      ))}
    </group>
  );
});

/** Procedural fallback — shown while a scan loads or if one is missing. */
const ProceduralPlant = memo(function ProceduralPlant({ height = 1.5 }: { height?: number }) {
  const m = useStudioMaterials();
  const leaves = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        angle: (i / 14) * Math.PI * 2,
        lift: 0.35 + ((i * 53) % 7) * 0.07,
        tilt: 0.5 + ((i * 29) % 5) * 0.08,
        len: 0.5 + ((i * 13) % 4) * 0.09,
      })),
    [],
  );
  return (
    <group>
      <mesh position={[0, 0.24, 0]} material={m.concrete} castShadow receiveShadow>
        <cylinderGeometry args={[0.26, 0.2, 0.48, 24]} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.23, 0.23, 0.06, 24]} />
        <PbrSurface color="#292524" roughness={1} />
      </mesh>
      <mesh position={[0, 0.5 + height * 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.05, height * 0.5, 10]} />
        <PbrSurface color="#3f6212" roughness={0.85} />
      </mesh>
      {leaves.map((leaf, i) => (
        <mesh
          key={i}
          position={[
            Math.cos(leaf.angle) * 0.18,
            0.5 + height * (0.3 + leaf.lift * 0.5),
            Math.sin(leaf.angle) * 0.18,
          ]}
          rotation={[leaf.tilt * Math.sin(leaf.angle), -leaf.angle, leaf.tilt * Math.cos(leaf.angle)]}
          castShadow
        >
          <sphereGeometry args={[leaf.len, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <PbrSurface
            color={i % 3 === 0 ? '#3f6212' : '#4d7c0f'}
            roughness={0.75}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
});

/**
 * Set plant — a real Poly Haven photogrammetry scan (fern, calathea, anthurium,
 * pachira, potted broadleaf…) in a glazed ceramic planter. The species is
 * picked deterministically per placement so dressed sets show natural variety.
 * Degrades to the procedural plant only while loading or if an asset is absent.
 */
export const PottedPlant = memo(function PottedPlant({
  position,
  rotation,
  scale = 1,
  height = 1.5,
  species: speciesKey,
}: PlaceProps & { height?: number; species?: keyof typeof PLANT_SPECIES }) {
  const [px, py, pz] = position ?? [0, 0, 0];
  const species = useMemo(() => {
    if (speciesKey && PLANT_SPECIES[speciesKey]) return PLANT_SPECIES[speciesKey];
    return pickPlantSpecies(height, plantSeed(px, py, pz));
  }, [speciesKey, height, px, py, pz]);

  const url = useMemo(() => plantModelUrl(species), [species]);
  const loaded = usePlantModel(url);

  const plant = useMemo(() => {
    if (!loaded) return null;
    // Foliage-only scans sit in a planter; self-contained scans carry their own.
    const plantHeight = species.hasPot ? height : Math.max(0.25, height * 0.68);
    return preparePlantInstance(loaded, plantHeight);
  }, [loaded, height, species.hasPot]);

  const potHeight = species.hasPot ? 0 : Math.min(0.42, height * 0.32);
  const seed = plantSeed(px, py, pz);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {!plant ? (
        <ProceduralPlant height={height} />
      ) : (
        <>
          {potHeight > 0 && (
            <CeramicPot height={potHeight} radius={Math.min(0.3, height * 0.19)} style={species.potStyle} seed={seed} />
          )}
          <primitive object={plant} position={[0, potHeight * 0.86, 0]} />
        </>
      )}
    </group>
  );
});

/* --------------------------------------------------------------- lighting */

/** Practical fixtures sit just under screens in the light-slot ranking. */
const PRACTICAL_LIGHT_PRIORITY = 70;

export const FloorLamp = memo(function FloorLamp({
  position,
  rotation,
  scale = 1,
  glow = '#fde68a',
  height = 1.6,
}: PlaceProps & { glow?: string; height?: number }) {
  const m = useStudioMaterials();
  const lit = useLightSlot(PRACTICAL_LIGHT_PRIORITY);
  const lightScale = usePracticalLightScale();
  const volumetrics = useVolumetrics();
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh position={[0, 0.03, 0]} material={m.dark} castShadow>
        <cylinderGeometry args={[0.2, 0.22, 0.06, 24]} />
      </mesh>
      <mesh position={[0, height / 2, 0]} material={m.chrome} castShadow>
        <cylinderGeometry args={[0.02, 0.02, height, 12]} />
      </mesh>
      <mesh position={[0, height, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.26, 0.34, 24, 1, true]} />
        <PbrSurface
          color="#fef3c7"
          emissive={glow}
          emissiveIntensity={1.4}
          side={THREE.DoubleSide}
          roughness={0.7}
          toneMapped={false}
        />
      </mesh>
      {/* The shade's glow and the light it throws are one physical quantity —
          when the budget is spent the emissive still reads, it just stops
          costing a dynamic light. */}
      {lit && (
        <pointLight position={[0, height - 0.1, 0]} intensity={4.5 * lightScale} distance={7} decay={2} color={glow} />
      )}
      {/* open shade spills light up and down through the haze */}
      {volumetrics && (
        <>
          <LightBeam
            position={[0, height + 0.77, 0]}
            height={1.2}
            radius={0.5}
            color={glow}
            opacity={volumetrics.beamIntensity * 1.2}
            direction="up"
            segments={volumetrics.beamSegments}
            animated={volumetrics.animated}
          />
          <LightBeam
            position={[0, height - 0.77, 0]}
            height={1.2}
            radius={0.55}
            color={glow}
            opacity={volumetrics.beamIntensity * 1.2}
            segments={volumetrics.beamSegments}
            animated={volumetrics.animated}
          />
        </>
      )}
    </group>
  );
});

export const PendantLight = memo(function PendantLight({
  position,
  scale = 1,
  glow = '#fff7ed',
  drop = 1.4,
}: { position?: [number, number, number]; scale?: number; glow?: string; drop?: number }) {
  const m = useStudioMaterials();
  const lit = useLightSlot(PRACTICAL_LIGHT_PRIORITY);
  const lightScale = usePracticalLightScale();
  const volumetrics = useVolumetrics();
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, drop / 2, 0]}>
        <cylinderGeometry args={[0.006, 0.006, drop, 6]} />
        <PbrSurface color="#27272a" metalness={0.8} roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.08, 0]} material={m.dark} castShadow>
        <cylinderGeometry args={[0.16, 0.24, 0.24, 24, 1, true]} />
      </mesh>
      <mesh position={[0, -0.14, 0]}>
        <sphereGeometry args={[0.07, 16, 12]} />
        <PbrSurface color={glow} emissive={glow} emissiveIntensity={3} toneMapped={false} />
      </mesh>
      {lit && <pointLight position={[0, -0.2, 0]} intensity={6 * lightScale} distance={8} decay={2} color={glow} />}
      {/* soft pool of light in the air below the shade */}
      {volumetrics && (
        <LightBeam
          position={[0, -0.2 - 0.85, 0]}
          height={1.7}
          radius={0.62}
          color={glow}
          opacity={volumetrics.beamIntensity * 1.4}
          segments={volumetrics.beamSegments}
          animated={volumetrics.animated}
        />
      )}
    </group>
  );
});

/** Truss segment with hanging profile spots — the overhead rig of a TV set. */
export const OverheadTruss = memo(function OverheadTruss({
  position,
  rotation,
  scale = 1,
  length = 8,
  spots = 5,
  accent = '#e11d48',
}: PlaceProps & { length?: number; spots?: number; accent?: string }) {
  const m = useStudioMaterials();
  const chords = useMemo(
    () =>
      [
        [0.16, 0.16],
        [-0.16, 0.16],
        [0.16, -0.16],
        [-0.16, -0.16],
      ] as const,
    [],
  );
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {chords.map(([cy, cz], i) => (
        <mesh key={`chord${i}`} position={[0, cy, cz]} rotation={[0, 0, Math.PI / 2]} material={m.metal} castShadow>
          <cylinderGeometry args={[0.03, 0.03, length, 10]} />
        </mesh>
      ))}
      {Array.from({ length: 11 }, (_, i) => {
        const x = -length / 2 + (i * length) / 10;
        return (
          <group key={`brace${i}`} position={[x, 0, 0]}>
            {chords.map(([cy, cz], j) => (
              <mesh
                key={j}
                position={[0, cy / 2, cz / 2]}
                rotation={[Math.atan2(cz, cy), 0, 0]}
                material={m.metal}
              >
                <cylinderGeometry args={[0.014, 0.014, Math.hypot(cy, cz), 6]} />
              </mesh>
            ))}
            <mesh position={[0, 0.16, 0]} rotation={[0, 0, Math.PI / 2]} material={m.metal}>
              <cylinderGeometry args={[0.012, 0.012, 0.32, 6]} />
            </mesh>
            <mesh position={[0, -0.16, 0]} rotation={[0, 0, Math.PI / 2]} material={m.metal}>
              <cylinderGeometry args={[0.012, 0.012, 0.32, 6]} />
            </mesh>
          </group>
        );
      })}
      {Array.from({ length: spots }, (_, i) => {
        const x = -length / 2 + ((i + 0.5) * length) / spots;
        return (
          <group key={`s${i}`} position={[x, -0.2, 0]}>
            <mesh position={[0, -0.06, 0]} material={m.dark}>
              <cylinderGeometry args={[0.04, 0.04, 0.12, 10]} />
            </mesh>
            <mesh position={[0, -0.18, 0]} rotation={[Math.PI, 0, 0]} material={m.dark} castShadow>
              <cylinderGeometry args={[0.1, 0.14, 0.22, 16, 1, true]} />
            </mesh>
            <mesh position={[0, -0.28, 0]} rotation={[Math.PI, 0, 0]}>
              <circleGeometry args={[0.11, 16]} />
              <PbrSurface
                color={i % 2 === 0 ? '#fff7ed' : accent}
                emissive={i % 2 === 0 ? '#fff7ed' : accent}
                emissiveIntensity={2.6}
                toneMapped={false}
              />
            </mesh>
            {/* haze beam from the lens to the floor */}
            <LightBeam
              position={[0, -0.28 - 1.55, 0]}
              height={3.1}
              radius={0.82}
              color={i % 2 === 0 ? '#fff7ed' : accent}
              opacity={0.1}
            />
          </group>
        );
      })}
    </group>
  );
});

/** Low stage deck with a skirt and edge strip lighting. */
export const StageDeck = memo(function StageDeck({
  position,
  rotation,
  scale = 1,
  width = 7,
  depth = 4,
  height = 0.3,
  accent = '#38bdf8',
}: PlaceProps & { width?: number; depth?: number; height?: number; accent?: string }) {
  const m = useStudioMaterials();
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <RoundedBox args={[width, height, depth]} radius={0.02} smoothness={3} position={[0, height / 2, 0]} material={m.dark} castShadow receiveShadow />
      {/* Deck carpet — subdivided for the pile relief. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, height + 0.005, 0]} receiveShadow>
        <planeGeometry args={[width, depth, 40, 24]} />
        <PbrSurface color="#ffffff" {...carpetPbrOptions()} />
      </mesh>
      <mesh position={[0, height * 0.35, depth / 2 + 0.005]}>
        <planeGeometry args={[width - 0.2, 0.04]} />
        <PbrSurface color={accent} emissive={accent} emissiveIntensity={2.2} toneMapped={false} />
      </mesh>
    </group>
  );
});

/** Simple wooden lectern/pulpit for worship and keynote sets. */
export const Lectern = memo(function Lectern({
  position,
  rotation,
  scale = 1,
}: PlaceProps) {
  const m = useStudioMaterials();
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <RoundedBox args={[0.7, 1.05, 0.45]} radius={0.03} smoothness={4} position={[0, 0.525, 0]} material={m.walnut} castShadow receiveShadow />
      <RoundedBox args={[0.8, 0.06, 0.55]} radius={0.02} smoothness={4} position={[0, 1.08, 0.03]} rotation={[-0.18, 0, 0]} material={m.oak} castShadow />
      <mesh position={[0, 0.6, 0.24]}>
        <planeGeometry args={[0.4, 0.5]} />
        <PbrSurface color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.9} roughness={0.5} toneMapped={false} />
      </mesh>
    </group>
  );
});

/**
 * Gathered curtain panel — vertical folds on a brass rod with finials and a
 * weighted hem, so windows read as a dressed interior rather than a hole.
 */
export const CurtainPanel = memo(function CurtainPanel({
  position,
  rotation,
  scale = 1,
  width = 1.4,
  height = 2.5,
  color = '#8d7b6c',
}: PlaceProps & { width?: number; height?: number; color?: string }) {
  const m = useStudioMaterials();
  const folds = Math.max(4, Math.round(width / 0.16));
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* brass rod + finials */}
      <mesh position={[0, height + 0.12, 0]} rotation={[0, 0, Math.PI / 2]} material={m.brass} castShadow>
        <cylinderGeometry args={[0.018, 0.018, width + 0.24, 12]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * (width + 0.24)) / 2, height + 0.12, 0]} material={m.brass}>
          <sphereGeometry args={[0.038, 12, 10]} />
        </mesh>
      ))}
      {/* gathered folds */}
      {Array.from({ length: folds }, (_, i) => {
        const x = -width / 2 + ((i + 0.5) * width) / folds;
        const zig = i % 2 === 0 ? 0.035 : -0.035;
        const shade = new THREE.Color(color).multiplyScalar(i % 2 === 0 ? 1.08 : 0.86);
        return (
          <mesh key={i} position={[x, height / 2 + 0.05, zig]} castShadow receiveShadow>
            <cylinderGeometry args={[width / folds / 2.1, width / folds / 1.7, height, 10]} />
            <PbrSurface color={shade} roughness={0.92} metalness={0} />
          </mesh>
        );
      })}
      {/* weighted hem */}
      <mesh position={[0, 0.045, 0]} receiveShadow>
        <boxGeometry args={[width * 0.99, 0.05, 0.11]} />
        <PbrSurface color={new THREE.Color(color).multiplyScalar(0.72)} roughness={0.9} />
      </mesh>
    </group>
  );
});

/**
 * Upholstered bed — tufted headboard with button grid, draped duvet with a
 * turned-down fold and piped pillows.
 */
export const Bed = memo(function Bed({
  position,
  rotation,
  scale = 1,
  width = 2.0,
  color = '#7d6b5d',
}: PlaceProps & { width?: number; color?: string }) {
  const m = useStudioMaterials();
  const headColor = useMemo(() => new THREE.Color(color), [color]);
  const tuftCols = 5;
  const tuftRows = 3;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* low walnut plinth */}
      <RoundedBox args={[width + 0.14, 0.22, 2.24]} radius={0.04} smoothness={3} position={[0, 0.13, 0.1]} material={m.walnut} castShadow receiveShadow />
      {/* tufted headboard */}
      <RoundedBox args={[width + 0.24, 1.15, 0.16]} radius={0.06} smoothness={4} position={[0, 0.85, -1.02]} castShadow receiveShadow>
        <PbrSurface color={headColor} roughness={0.86} metalness={0} />
      </RoundedBox>
      {Array.from({ length: tuftCols * tuftRows }, (_, i) => {
        const col = i % tuftCols;
        const row = Math.floor(i / tuftCols);
        const x = ((col + 0.5) / tuftCols - 0.5) * width * 0.86;
        const y = 0.55 + row * 0.3;
        return (
          <mesh key={i} position={[x, y, -0.925]} scale={[1, 1, 0.5]}>
            <sphereGeometry args={[0.045, 10, 8]} />
            <PbrSurface color={headColor.clone().multiplyScalar(0.62)} roughness={0.7} />
          </mesh>
        );
      })}
      {/* mattress */}
      <RoundedBox args={[width, 0.3, 2.1]} radius={0.09} smoothness={4} position={[0, 0.43, 0.1]} material={m.linen} castShadow receiveShadow />
      {/* duvet + turned-down fold */}
      <RoundedBox args={[width + 0.12, 0.16, 1.5]} radius={0.08} smoothness={4} position={[0, 0.63, 0.42]} material={m.fabric} castShadow receiveShadow />
      <RoundedBox args={[width + 0.1, 0.1, 0.34]} radius={0.05} smoothness={4} position={[0, 0.7, -0.32]} rotation={[0.12, 0, 0]} material={m.linen} castShadow />
      {/* piped pillows */}
      {[-0.52, 0.52].map((x) => (
        <group key={x} position={[x * (width / 2.0), 0.72, -0.68]} rotation={[-0.32, 0, 0]}>
          <RoundedBox args={[0.86, 0.16, 0.5]} radius={0.07} smoothness={4} material={m.linen} castShadow />
          <mesh position={[0, -0.055, 0]} scale={[1, 0.32, 1]}>
            <boxGeometry args={[0.83, 0.16, 0.47]} />
            <PbrSurface color="#8d8377" roughness={0.95} />
          </mesh>
        </group>
      ))}
    </group>
  );
});
