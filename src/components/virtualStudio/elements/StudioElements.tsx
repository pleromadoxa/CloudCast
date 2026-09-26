import { memo, useMemo, type ReactElement } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { StudioScreenSource } from '../../../lib/virtualStudio/types';
import { STUDIO_ELEMENTS } from '../../../lib/virtualStudio/elementCatalog';
import { GltfModelElement } from './GltfModelElement';
import { useStudioMaterials } from '../fixtures/materials';
import {
  ceramicMaterial,
  glassMaterial,
  lacqueredWoodMaterial,
  leatherMaterial,
  upholsteryMaterial,
} from '../../../lib/prism/pbrMaterials';
import { LightBeam } from '../fixtures/LightBeam';
import {
  AnchorDesk,
  AreaRug,
  Bed,
  Bookshelf,
  CoffeeTable,
  CurtainPanel,
  FloorLamp,
  LeatherDiningChair,
  Lectern,
  MediaConsole,
  PendantLight,
  SportsDesk,
  StageDeck,
  StudioArmchair,
  StudioChair,
  StudioSofa,
  TubChair,
} from '../fixtures/furniture';
import { GlassPendantCluster, SwirlLedDisc, TieredPlatform } from '../fixtures/stagecraft';
import { CabinetRun, KitchenIsland, OpenShelving, OvenStack } from '../fixtures/kitchen';
import {
  FramedMonitor,
  StandingBanner,
  Television,
  RibbonBanner,
  VideoWall,
} from '../fixtures/screens';

/**
 * Photoreal element library — the drop-in set dressing operators can place
 * anywhere in a virtual production set. Every piece uses the shared PBR
 * palette (real wood, fabric, leather, marble with bump relief) and physical
 * scale so talent and cameras read correctly.
 *
 * All components accept the standard placement props so the drag layer can
 * position, rotate and scale them uniformly.
 */

export interface StudioElementProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  /** Live source for screen elements. */
  source?: StudioScreenSource;
}

type ElementComponent = (props: StudioElementProps) => ReactElement;

/* -------------------------------------------------------------- seating */

function SofaTwoSeat(p: StudioElementProps) {
  return <StudioSofa {...p} width={1.8} />;
}
function SofaSectional(p: StudioElementProps) {
  const m = useStudioMaterials();
  return (
    <group position={p.position} rotation={p.rotation} scale={p.scale}>
      <StudioSofa width={2.6} fabric="linen" color="#57534e" />
      <StudioSofa width={1.7} fabric="linen" color="#57534e" position={[1.65, 0, -0.7]} rotation={[0, -Math.PI / 2, 0]} />
      <RoundedBox args={[0.62, 0.12, 0.62]} radius={0.05} smoothness={3} position={[1.65, 0.52, 0.2]} material={m.walnut} castShadow />
    </group>
  );
}
function LoungeChair(p: StudioElementProps) {
  const m = useStudioMaterials();
  const leather = useMemo(() => leatherMaterial('#6b4a35', 7), []);
  const leatherDark = useMemo(() => leatherMaterial('#543827', 8), []);
  const seam = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3a2517', roughness: 0.9 }), []);
  return (
    <group position={p.position} rotation={p.rotation} scale={p.scale}>
      {/* seat base + shadow gap + cushion */}
      <RoundedBox args={[0.92, 0.28, 0.9]} radius={0.09} smoothness={4} position={[0, 0.3, 0]} material={leatherDark} castShadow receiveShadow />
      <mesh position={[0, 0.452, 0.01]}>
        <boxGeometry args={[0.76, 0.025, 0.76]} />
        <meshStandardMaterial color="#0b0b0d" roughness={1} />
      </mesh>
      <RoundedBox args={[0.82, 0.14, 0.82]} radius={0.055} smoothness={4} position={[0, 0.5, 0.03]} material={leather} castShadow />
      <mesh position={[0, 0.573, 0.03]} rotation={[-Math.PI / 2, 0, 0]} material={seam}>
        <torusGeometry args={[0.27, 0.007, 6, 40]} />
      </mesh>
      {/* back cushion with piping along the top */}
      <RoundedBox args={[0.9, 0.58, 0.17]} radius={0.08} smoothness={4} position={[0, 0.63, -0.385]} rotation={[-0.16, 0, 0]} material={leather} castShadow />
      <mesh position={[0, 0.905, -0.43]} rotation={[-0.16, 0, 0]} material={seam}>
        <torusGeometry args={[0.1, 0.008, 6, 24, Math.PI]} />
      </mesh>
      {/* arms */}
      {[-1, 1].map((side) => (
        <RoundedBox key={side} args={[0.16, 0.3, 0.84]} radius={0.07} smoothness={3} position={[side * 0.38, 0.48, 0]} material={leatherDark} castShadow />
      ))}
      {/* splayed tapered walnut legs with brass ferrules */}
      {[
        [-0.33, 0.31],
        [0.33, 0.31],
        [-0.33, -0.31],
        [0.33, -0.31],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.15, 0]} rotation={[Math.sign(z) * -0.18, 0, Math.sign(x) * 0.18]} material={m.walnut} castShadow>
            <cylinderGeometry args={[0.028, 0.018, 0.3, 12]} />
          </mesh>
          <mesh position={[Math.sign(x) * 0.027, 0.3, Math.sign(z) * 0.027]} material={m.brass} castShadow>
            <cylinderGeometry args={[0.03, 0.032, 0.045, 12]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
function BarStool(p: StudioElementProps) {
  const m = useStudioMaterials();
  const seat = useMemo(() => leatherMaterial('#7a4a2c', 9), []);
  const seam = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a2c17', roughness: 0.9 }), []);
  return (
    <group position={p.position} rotation={p.rotation} scale={p.scale}>
      {/* contoured saddle seat with piping + swivel collar */}
      <mesh position={[0, 0.72, 0]} scale={[1, 0.55, 1]} material={seat} castShadow>
        <sphereGeometry args={[0.21, 28, 18]} />
      </mesh>
      <mesh position={[0, 0.755, 0]} rotation={[-Math.PI / 2, 0, 0]} material={seam}>
        <torusGeometry args={[0.165, 0.006, 6, 36]} />
      </mesh>
      <mesh position={[0, 0.655, 0]} material={m.dark} castShadow>
        <cylinderGeometry args={[0.13, 0.115, 0.05, 20]} />
      </mesh>
      {/* tapered chrome column + memory-ring collar */}
      <mesh position={[0, 0.36, 0]} material={m.chrome} castShadow>
        <cylinderGeometry args={[0.026, 0.036, 0.62, 16]} />
      </mesh>
      <mesh position={[0, 0.5, 0]} material={m.dark}>
        <cylinderGeometry args={[0.032, 0.032, 0.035, 16]} />
      </mesh>
      {/* weighted disc base + bevel */}
      <mesh position={[0, 0.022, 0]} material={m.chrome} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.25, 0.045, 32]} />
      </mesh>
      {/* welded footrest ring with mounting brackets */}
      <mesh position={[0, 0.27, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.chrome} castShadow>
        <torusGeometry args={[0.16, 0.014, 12, 32]} />
      </mesh>
      {Array.from({ length: 4 }, (_, i) => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.08, 0.27, Math.sin(a) * 0.08]} rotation={[0, -a, 0]} material={m.chrome}>
            <boxGeometry args={[0.16, 0.02, 0.012]} />
          </mesh>
        );
      })}
    </group>
  );
}
function OfficeChair(p: StudioElementProps) {
  const m = useStudioMaterials();
  const seat = useMemo(() => upholsteryMaterial('#2e3440', { sheen: 0.75, sheenColor: '#556072' }), []);
  const shell = useMemo(() => new THREE.MeshStandardMaterial({ color: '#171b22', roughness: 0.5, metalness: 0.14 }), []);
  return (
    <group position={p.position} rotation={p.rotation} scale={p.scale}>
      {/* seat cushion on a shell */}
      <RoundedBox args={[0.53, 0.06, 0.51]} radius={0.028} smoothness={3} position={[0, 0.475, 0]} material={shell} castShadow />
      <RoundedBox args={[0.51, 0.1, 0.49]} radius={0.045} smoothness={4} position={[0, 0.55, 0.01]} material={seat} castShadow />
      <mesh position={[0, 0.603, 0.01]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.175, 0.006, 6, 36]} />
        <meshStandardMaterial color="#1b212b" roughness={0.95} />
      </mesh>
      {/* back with lumbar contour + headband */}
      <RoundedBox args={[0.49, 0.6, 0.09]} radius={0.042} smoothness={4} position={[0, 0.88, -0.235]} rotation={[-0.12, 0, 0]} material={seat} castShadow />
      <RoundedBox args={[0.45, 0.14, 0.05]} radius={0.024} smoothness={3} position={[0, 0.73, -0.185]} rotation={[-0.12, 0, 0]} material={shell} castShadow />
      {/* armrests */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.31, 0, 0]}>
          <mesh position={[0, 0.61, -0.04]} material={shell} castShadow>
            <boxGeometry args={[0.04, 0.14, 0.04]} />
          </mesh>
          <RoundedBox args={[0.065, 0.032, 0.25]} radius={0.016} smoothness={3} position={[0, 0.7, -0.02]} material={shell} castShadow />
        </group>
      ))}
      {/* gas lift */}
      <mesh position={[0, 0.3, 0]} material={m.dark} castShadow>
        <cylinderGeometry args={[0.035, 0.042, 0.42, 16]} />
      </mesh>
      <mesh position={[0, 0.44, 0]} material={m.chrome}>
        <cylinderGeometry args={[0.03, 0.03, 0.1, 16]} />
      </mesh>
      {/* five-star base with twin-wheel casters */}
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, a, 0]}>
            <RoundedBox args={[0.3, 0.038, 0.052]} radius={0.016} smoothness={3} position={[0.15, 0.085, 0]} rotation={[0, 0, -0.1]} material={shell} castShadow />
            <mesh position={[0.285, 0.05, 0]} material={shell} castShadow>
              <boxGeometry args={[0.032, 0.07, 0.048]} />
            </mesh>
            {[-0.02, 0.02].map((z) => (
              <mesh key={z} position={[0.285, 0.03, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
                <torusGeometry args={[0.026, 0.011, 8, 16]} />
                <meshStandardMaterial color="#0c0d10" roughness={0.45} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}
function Bench(p: StudioElementProps) {
  const m = useStudioMaterials();
  const cushion = useMemo(() => upholsteryMaterial('#4b5563', { sheen: 0.9 }), []);
  const seam = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2b313a', roughness: 0.95 }), []);
  return (
    <group position={p.position} rotation={p.rotation} scale={p.scale}>
      {/* upholstered top with piping + subtle button line */}
      <RoundedBox args={[1.7, 0.15, 0.5]} radius={0.055} smoothness={4} position={[0, 0.46, 0]} material={cushion} castShadow receiveShadow />
      <mesh position={[0, 0.538, 0]} rotation={[-Math.PI / 2, 0, 0]} material={seam}>
        <torusGeometry args={[0.19, 0.007, 6, 44]} />
      </mesh>
      {[-0.55, 0, 0.55].map((x) => (
        <mesh key={x} position={[x, 0.536, 0]} scale={[1, 0.3, 1]} material={seam}>
          <sphereGeometry args={[0.02, 10, 8]} />
        </mesh>
      ))}
      {/* tapered walnut legs with brass ferrules */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <RoundedBox args={[0.09, 0.38, 0.42]} radius={0.028} smoothness={3} position={[side * 0.7, 0.19, 0]} rotation={[0, 0, side * 0.07]} material={m.walnut} castShadow />
          <mesh position={[side * 0.727, 0.028, 0]} material={m.brass} castShadow>
            <boxGeometry args={[0.095, 0.03, 0.43]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
function Ottoman(p: StudioElementProps) {
  const m = useStudioMaterials();
  const cushion = useMemo(() => upholsteryMaterial('#57534e', { sheen: 0.9 }), []);
  const seam = useMemo(() => new THREE.MeshStandardMaterial({ color: '#322f2b', roughness: 0.95 }), []);
  return (
    <group position={p.position} rotation={p.rotation} scale={p.scale}>
      {/* drum body with a seam ring and button top */}
      <RoundedBox args={[0.8, 0.34, 0.62]} radius={0.13} smoothness={5} position={[0, 0.17, 0]} material={cushion} castShadow receiveShadow />
      <mesh position={[0, 0.342, 0]} rotation={[-Math.PI / 2, 0, 0]} material={seam}>
        <torusGeometry args={[0.24, 0.007, 6, 40]} />
      </mesh>
      <mesh position={[0, 0.345, 0]} scale={[1, 0.32, 1]} material={seam}>
        <sphereGeometry args={[0.024, 12, 10]} />
      </mesh>
      {/* shadow base + tiny feet */}
      <mesh position={[0, 0.022, 0]}>
        <boxGeometry args={[0.62, 0.04, 0.46]} />
        <meshStandardMaterial color="#111113" roughness={1} />
      </mesh>
      {[
        [-0.28, 0.2],
        [0.28, 0.2],
        [-0.28, -0.2],
        [0.28, -0.2],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.018, z]} material={m.brass} castShadow>
          <cylinderGeometry args={[0.02, 0.017, 0.036, 10]} />
        </mesh>
      ))}
    </group>
  );
}
function AccentChairPair(p: StudioElementProps) {
  return (
    <group position={p.position} rotation={p.rotation} scale={p.scale}>
      <StudioArmchair position={[-0.75, 0, 0]} rotation={[0, 0.5, 0]} />
      <StudioArmchair position={[0.75, 0, 0]} rotation={[0, -0.5, 0]} />
    </group>
  );
}

/* --------------------------------------------------------------- tables */

function SideTable(p: StudioElementProps) {
  const m = useStudioMaterials();
  return (
    <group position={p.position} rotation={p.rotation} scale={p.scale}>
      {/* eased marble top + edge shadow line */}
      <mesh position={[0, 0.565, 0]} material={m.marble} castShadow receiveShadow>
        <cylinderGeometry args={[0.32, 0.315, 0.03, 40]} />
      </mesh>
      <mesh position={[0, 0.543, 0]}>
        <cylinderGeometry args={[0.305, 0.295, 0.016, 40]} />
        <meshStandardMaterial color="#0e0e10" roughness={0.7} metalness={0.3} />
      </mesh>
      {/* turned brass stem with knuckles */}
      <mesh position={[0, 0.3, 0]} material={m.brass} castShadow>
        <cylinderGeometry args={[0.032, 0.042, 0.52, 20]} />
      </mesh>
      <mesh position={[0, 0.42, 0]} material={m.brass} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.028, 20]} />
      </mesh>
      {/* weighted disc foot with bevel */}
      <mesh position={[0, 0.017, 0]} material={m.brass} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.25, 0.034, 32]} />
      </mesh>
    </group>
  );
}
function DiningTable(p: StudioElementProps) {
  const top = useMemo(() => lacqueredWoodMaterial('wood_walnut', 4, { gloss: 0.55 }), []);
  return (
    <group position={p.position} rotation={p.rotation} scale={p.scale}>
      {/* thick eased top with a shadow reveal underneath */}
      <RoundedBox args={[2.1, 0.055, 1.05]} radius={0.022} smoothness={4} position={[0, 0.74, 0]} material={top} castShadow receiveShadow />
      <mesh position={[0, 0.705, 0]}>
        <boxGeometry args={[1.86, 0.012, 0.84]} />
        <meshStandardMaterial color="#0e0e10" roughness={0.9} />
      </mesh>
      {/* apron rails */}
      {[-1, 1].map((side) => (
        <mesh key={`ap${side}`} position={[side * 0.86, 0.665, 0]} material={top} castShadow>
          <boxGeometry args={[0.035, 0.09, 0.86]} />
        </mesh>
      ))}
      <mesh position={[0, 0.665, 0.42]} material={top} castShadow>
        <boxGeometry args={[1.72, 0.09, 0.03]} />
      </mesh>
      <mesh position={[0, 0.665, -0.42]} material={top} castShadow>
        <boxGeometry args={[1.72, 0.09, 0.03]} />
      </mesh>
      {/* tapered legs with a gentle splay */}
      {[
        [-0.88, 0.4],
        [0.88, 0.4],
        [-0.88, -0.4],
        [0.88, -0.4],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.335, z]} rotation={[Math.sign(z) * -0.045, 0, Math.sign(x) * 0.045]} material={top} castShadow>
          <cylinderGeometry args={[0.042, 0.03, 0.67, 12]} />
        </mesh>
      ))}
    </group>
  );
}
function Desk(p: StudioElementProps) {
  const m = useStudioMaterials();
  const top = useMemo(() => lacqueredWoodMaterial('wood_oak', 2, { gloss: 0.45 }), []);
  const carcass = useMemo(() => lacqueredWoodMaterial('wood_walnut', 5, { gloss: 0.35 }), []);
  return (
    <group position={p.position} rotation={p.rotation} scale={p.scale}>
      {/* eased top with cable grommet */}
      <RoundedBox args={[2.0, 0.05, 0.9]} radius={0.02} smoothness={4} position={[0, 0.75, 0]} material={top} castShadow receiveShadow />
      <mesh position={[-0.62, 0.777, -0.28]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.012, 20]} />
        <meshStandardMaterial color="#101014" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* pedestal with drawer reveals + pulls */}
      <RoundedBox args={[0.62, 0.72, 0.82]} radius={0.025} smoothness={3} position={[-0.62, 0.37, 0]} material={carcass} castShadow />
      {[0.22, 0.38, 0.54].map((y) => (
        <group key={y}>
          <mesh position={[-0.62, y, 0.415]}>
            <boxGeometry args={[0.56, 0.012, 0.012]} />
            <meshStandardMaterial color="#0c0c0e" roughness={0.9} />
          </mesh>
          <mesh position={[-0.62, y + 0.055, 0.422]} material={m.brass}>
            <boxGeometry args={[0.22, 0.018, 0.018]} />
          </mesh>
        </group>
      ))}
      {/* metal end frame */}
      <RoundedBox args={[0.06, 0.72, 0.82]} radius={0.02} smoothness={3} position={[0.92, 0.37, 0]} material={carcass} castShadow />
      <mesh position={[0.93, 0.36, 0]} material={m.metal} castShadow>
        <boxGeometry args={[0.02, 0.68, 0.78]} />
      </mesh>
    </group>
  );
}
function ConsoleTable(p: StudioElementProps) {
  const m = useStudioMaterials();
  const shelf = useMemo(() => lacqueredWoodMaterial('wood_walnut', 6, { gloss: 0.4 }), []);
  return (
    <group position={p.position} rotation={p.rotation} scale={p.scale}>
      {/* marble top with eased edge + dark reveal */}
      <RoundedBox args={[1.8, 0.048, 0.42]} radius={0.018} smoothness={4} position={[0, 0.82, 0]} material={m.marble} castShadow receiveShadow />
      <mesh position={[0, 0.792, 0]}>
        <boxGeometry args={[1.68, 0.014, 0.32]} />
        <meshStandardMaterial color="#0e0e10" roughness={0.8} metalness={0.25} />
      </mesh>
      {/* walnut shelf */}
      <RoundedBox args={[1.7, 0.055, 0.34]} radius={0.018} smoothness={3} position={[0, 0.42, 0]} material={shelf} castShadow receiveShadow />
      {/* slim metal frame with a cross-brace */}
      {[-0.78, 0.78].map((x) => (
        <group key={x}>
          <RoundedBox args={[0.05, 0.82, 0.36]} radius={0.018} smoothness={3} position={[x, 0.41, 0]} material={m.metal} castShadow />
          <mesh position={[x, 0.012, 0]} material={m.brass}>
            <boxGeometry args={[0.075, 0.024, 0.38]} />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0.6, 0]} rotation={[0, 0, s * 0.62]} material={m.metal} castShadow>
          <boxGeometry args={[1.0, 0.016, 0.016]} />
        </mesh>
      ))}
    </group>
  );
}
function BarCounter(p: StudioElementProps) {
  const m = useStudioMaterials();
  return (
    <group position={p.position} rotation={p.rotation} scale={p.scale}>
      {/* paneled carcass with vertical reveals */}
      <RoundedBox args={[2.8, 1.05, 0.72]} radius={0.04} smoothness={4} position={[0, 0.525, 0]} material={m.dark} castShadow receiveShadow />
      {[-0.92, -0.3, 0.3, 0.92].map((x) => (
        <mesh key={x} position={[x, 0.55, 0.362]}>
          <boxGeometry args={[0.015, 0.86, 0.012]} />
          <meshStandardMaterial color="#08080a" roughness={0.85} />
        </mesh>
      ))}
      {/* waterfall marble top with eased edge + under-shadow */}
      <RoundedBox args={[2.95, 0.06, 0.92]} radius={0.025} smoothness={4} position={[0, 1.08, 0]} material={m.marble} castShadow />
      <mesh position={[0, 1.042, 0]}>
        <boxGeometry args={[2.82, 0.012, 0.78]} />
        <meshStandardMaterial color="#0b0b0d" roughness={0.85} />
      </mesh>
      {/* brass foot rail */}
      <mesh position={[0, 0.17, 0.44]} rotation={[0, 0, Math.PI / 2]} material={m.brass} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 2.5, 14]} />
      </mesh>
      {[-1.15, 1.15].map((x) => (
        <mesh key={x} position={[x, 0.17, 0.4]} rotation={[Math.PI / 2, 0, 0]} material={m.brass} castShadow>
          <cylinderGeometry args={[0.018, 0.018, 0.1, 12]} />
        </mesh>
      ))}
      {/* under-counter light cove */}
      <mesh position={[0, 1.0, 0.345]}>
        <planeGeometry args={[2.6, 0.05]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* --------------------------------------------------------------- plants */

/**
 * Parametric leaf blade — pointed silhouette, raised midrib crease and a
 * natural droop curve, so foliage reads as real leaves instead of blobs.
 */
const leafGeometryCache = new Map<string, THREE.BufferGeometry>();
function createLeafGeometry(length: number, width: number, droop = 0.3, crease = 0.12) {
  const key = `${length.toFixed(2)}:${width.toFixed(2)}:${droop}:${crease}`;
  const hit = leafGeometryCache.get(key);
  if (hit) return hit;

  const segsZ = 10;
  const segsX = 6;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let iz = 0; iz <= segsZ; iz += 1) {
    const t = iz / segsZ;
    // leaf silhouette: widest at ~40% length, pointed at tip and base
    const taper = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.12)), 0.75);
    for (let ix = 0; ix <= segsX; ix += 1) {
      const u = ix / segsX;
      const halfW = (width * taper) / 2;
      const x = (u - 0.5) * 2 * halfW;
      const ridge = crease * (1 - Math.abs(u - 0.5) * 2) * taper;
      const y = -droop * t * t * length + ridge;
      const z = t * length;
      positions.push(x, y, z);
      uvs.push(u, t);
    }
  }
  for (let iz = 0; iz < segsZ; iz += 1) {
    for (let ix = 0; ix < segsX; ix += 1) {
      const a = iz * (segsX + 1) + ix;
      const b = a + segsX + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  leafGeometryCache.set(key, geo);
  return geo;
}

/** Leaf material — waxy cuticle sheen + faint translucency glow (cached per tone). */
const leafMaterialCache = new Map<string, THREE.MeshPhysicalMaterial>();
function makeLeafMaterial(color: THREE.Color | string): THREE.MeshPhysicalMaterial {
  const c = color instanceof THREE.Color ? color.clone() : new THREE.Color(color);
  const key = `#${c.getHexString()}`;
  const hit = leafMaterialCache.get(key);
  if (hit) return hit;
  const mat = new THREE.MeshPhysicalMaterial({
    color: c,
    roughness: 0.5,
    metalness: 0,
    side: THREE.DoubleSide,
    sheen: 0.9,
    sheenRoughness: 0.42,
    sheenColor: c.clone().lerp(new THREE.Color('#d9f2c2'), 0.5),
    emissive: c.clone().multiplyScalar(0.3),
    emissiveIntensity: 0.22,
    envMapIntensity: 1.1,
  });
  leafMaterialCache.set(key, mat);
  return mat;
}

/** Glazed pot with rim, soil mound and moss collar — the base of every plant. */
function PotAssembly({ pot, radius = 0.19, height = 0.32, saucer = false }: { pot: string; radius?: number; height?: number; saucer?: boolean }) {
  const glaze = useMemo(() => ceramicMaterial(pot), [pot]);
  return (
    <group>
      {saucer && (
        <mesh position={[0, 0.012, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[radius * 1.18, radius * 1.22, 0.024, 28]} />
          <meshStandardMaterial color={pot} roughness={0.5} />
        </mesh>
      )}
      <mesh position={[0, height / 2 + 0.01, 0]} material={glaze} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius * 0.82, height, 28]} />
      </mesh>
      {/* rolled rim */}
      <mesh position={[0, height + 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]} material={glaze} castShadow>
        <torusGeometry args={[radius * 0.985, 0.014, 10, 28]} />
      </mesh>
      {/* soil mound + moss collar */}
      <mesh position={[0, height - 0.008, 0]}>
        <sphereGeometry args={[radius * 0.88, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.6]} />
        <meshStandardMaterial color="#2b211a" roughness={1} />
      </mesh>
      <mesh position={[0, height - 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.6, radius * 0.86, 24]} />
        <meshStandardMaterial color="#3d4a2c" roughness={1} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Monstera — fenestrated split leaves on curving stems from the soil. */
function Monstera(p: StudioElementProps) {
  const stemMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a6b3c', roughness: 0.7 }), []);
  const leafGeo = useMemo(() => createLeafGeometry(1, 0.4, 0.28, 0.14), []);
  const leaves = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2 + (i % 2) * 0.4;
        return {
          a,
          r: 0.12 + (i % 3) * 0.07,
          y: 0.62 + (i % 4) * 0.17,
          tilt: 0.5 + (i % 3) * 0.18,
          len: 0.62 + (i % 4) * 0.1,
          shade: 0.8 + ((i * 53) % 13) * 0.03,
        };
      }),
    [],
  );
  return (
    <group position={p.position} rotation={p.rotation} scale={p.scale}>
      <PotAssembly pot="#b45309" radius={0.2} height={0.34} saucer />
      {leaves.map((leaf, i) => {
        const x = Math.sin(leaf.a) * leaf.r;
        const z = Math.cos(leaf.a) * leaf.r;
        const top = new THREE.Vector3(Math.sin(leaf.a) * (leaf.r + leaf.len * 0.32), leaf.y, Math.cos(leaf.a) * (leaf.r + leaf.len * 0.32));
        return (
          <group key={i}>
            {/* arcing stem */}
            <mesh
              position={[(x + top.x) / 2, (0.32 + top.y) / 2, (z + top.z) / 2]}
              rotation={[Math.cos(leaf.a) * -0.5, -leaf.a, Math.sin(leaf.a) * 0.5]}
              material={stemMat}
              castShadow
            >
              <cylinderGeometry args={[0.012, 0.018, leaf.y - 0.24, 8]} />
            </mesh>
            {/* fenestrated blade: rachis + lateral lobes with real gaps */}
            <group position={[top.x, top.y, top.z]} rotation={[Math.cos(leaf.a) * leaf.tilt, -leaf.a + Math.PI / 2, Math.sin(leaf.a) * leaf.tilt]}>
              <mesh position={[0, 0.012, leaf.len * 0.5]} rotation={[Math.PI / 2, 0, 0]} material={stemMat} castShadow>
                <cylinderGeometry args={[0.008, 0.011, leaf.len, 8]} />
              </mesh>
              {[-1, 1].map((side) =>
                [0.18, 0.34, 0.5, 0.66, 0.8].map((t, k) => (
                  <mesh
                    key={`${side}${t}`}
                    geometry={leafGeo}
                    position={[side * 0.02, 0.006, leaf.len * t]}
                    rotation={[-0.12 - k * 0.06, side * (0.95 - k * 0.11), side * (0.12 + k * 0.05)]}
                    scale={[leaf.len * (0.3 - k * 0.035), 1, leaf.len * (0.42 - k * 0.05)]}
                    castShadow
                  >
                    <primitive object={makeLeafMaterial(new THREE.Color('#245c34').multiplyScalar(leaf.shade + k * 0.012))} attach="material" />
                  </mesh>
                )),
              )}
              {/* terminal lobe */}
              <mesh geometry={leafGeo} position={[0, 0, leaf.len * 0.82]} rotation={[-0.18, 0, 0]} scale={[leaf.len * 0.3, 1, leaf.len * 0.36]} castShadow>
                <primitive object={makeLeafMaterial(new THREE.Color('#245c34').multiplyScalar(leaf.shade))} attach="material" />
              </mesh>
            </group>
          </group>
        );
      })}
    </group>
  );
}
function Palm(p: StudioElementProps) {
  const trunkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7a6248', roughness: 0.92 }), []);
  const leafGeo = useMemo(() => createLeafGeometry(1, 0.09, 0.42, 0.06), []);
  const fronds = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        a: (i / 10) * Math.PI * 2 + (i % 2) * 0.3,
        tier: i % 2,
        len: 1.05 + (i % 3) * 0.12,
        shade: 0.82 + ((i * 41) % 9) * 0.03,
      })),
    [],
  );
  return (
    <group position={p.position} rotation={p.rotation} scale={p.scale}>
      <PotAssembly pot="#8d8578" radius={0.22} height={0.36} />
      {/* ringed trunk */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[Math.sin(i * 0.5) * 0.02 * i, 0.36 + i * 0.24 + 0.11, Math.cos(i * 0.5) * 0.012 * i]} material={trunkMat} castShadow>
          <cylinderGeometry args={[0.052 - i * 0.006, 0.062 - i * 0.006, 0.235, 12]} />
        </mesh>
      ))}
      {/* crown of pinnate fronds */}
      {fronds.map((f, i) => {
        const y = 1.78 + f.tier * 0.16;
        return (
          <group key={i} position={[0, y, 0]} rotation={[0, -f.a, 0]}>
            {/* arching rachis */}
            <mesh position={[Math.sin(0.55) * f.len * 0.45, Math.sin(0.42) * f.len * 0.34, 0]} rotation={[0, 0, -0.72]} material={trunkMat} castShadow>
              <cylinderGeometry args={[0.008, 0.016, f.len * 0.92, 8]} />
            </mesh>
            {/* leaflet pairs drooping off the rachis */}
            {Array.from({ length: 11 }, (_, k) => {
              const t = 0.16 + k * 0.075;
              const lx = Math.sin(0.55) * f.len * t * 1.15;
              const ly = Math.sin(0.42) * f.len * t * 0.9 - k * 0.012;
              return [-1, 1].map((side) => (
                <mesh
                  key={`${k}${side}`}
                  geometry={leafGeo}
                  position={[lx, ly, side * 0.012]}
                  rotation={[-side * (1.05 + k * 0.03), side * 0.18, -0.35 - k * 0.06]}
                  scale={[0.34 - k * 0.012, 1, f.len * 0.38 - k * 0.014]}
                  castShadow
                >
                  <primitive object={makeLeafMaterial(new THREE.Color('#2d7a46').multiplyScalar(f.shade))} attach="material" />
                </mesh>
              ));
            })}
          </group>
        );
      })}
    </group>
  );
}
function Ficus(p: StudioElementProps) {
  const trunkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6b5b47', roughness: 0.9 }), []);
  const leafGeo = useMemo(() => createLeafGeometry(1, 0.42, 0.24, 0.1), []);
  const clusters = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + (i % 3) * 0.5;
        return {
          a,
          r: 0.16 + (i % 3) * 0.14,
          y: 1.02 + (i % 4) * 0.2,
          shade: 0.8 + ((i * 29) % 12) * 0.032,
        };
      }),
    [],
  );
  return (
    <group position={p.position} rotation={p.rotation} scale={p.scale}>
      <PotAssembly pot="#78716c" radius={0.2} height={0.34} saucer />
      {/* trunk + three main branches */}
      <mesh position={[0, 0.72, 0]} material={trunkMat} castShadow>
        <cylinderGeometry args={[0.035, 0.055, 0.85, 12]} />
      </mesh>
      {clusters.slice(0, 3).map((c, i) => (
        <mesh key={i} position={[Math.sin(c.a) * 0.12, 1.12 + i * 0.1, Math.cos(c.a) * 0.12]} rotation={[Math.cos(c.a) * -0.55, -c.a, Math.sin(c.a) * 0.55]} material={trunkMat} castShadow>
          <cylinderGeometry args={[0.016, 0.028, 0.55, 8]} />
        </mesh>
      ))}
      {/* leaf clusters with inner depth mass */}
      {clusters.map((c, i) => {
        const cx = Math.sin(c.a) * c.r;
        const cz = Math.cos(c.a) * c.r;
        return (
          <group key={i} position={[cx, c.y, cz]}>
            <mesh castShadow>
              <sphereGeometry args={[0.13, 10, 8]} />
              <meshStandardMaterial color={new THREE.Color('#1f4d2d').multiplyScalar(0.5)} roughness={0.8} />
            </mesh>
            {Array.from({ length: 7 }, (_, k) => {
              const la = (k / 7) * Math.PI * 2 + i * 0.7;
              return (
                <mesh
                  key={k}
                  geometry={leafGeo}
                  position={[Math.sin(la) * 0.1, (k % 3) * 0.05 - 0.02, Math.cos(la) * 0.1]}
                  rotation={[Math.cos(la) * 0.7, -la + Math.PI / 2, Math.sin(la) * 0.7]}
                  scale={[0.17, 1, 0.2]}
                  castShadow
                >
                  <primitive object={makeLeafMaterial(new THREE.Color('#1f4d2d').multiplyScalar(c.shade))} attach="material" />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}
function Fern(p: StudioElementProps) {
  const stemMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4c7a3a', roughness: 0.75 }), []);
  const pinnaGeo = useMemo(() => createLeafGeometry(1, 0.3, 0.2, 0.05), []);
  const fronds = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        a: (i / 9) * Math.PI * 2 + (i % 3) * 0.35,
        tilt: 0.5 + (i % 4) * 0.12,
        len: 0.55 + (i % 3) * 0.1,
        shade: 0.82 + ((i * 31) % 10) * 0.03,
      })),
    [],
  );
  return (
    <group position={p.position} rotation={p.rotation} scale={p.scale}>
      <PotAssembly pot="#57534e" radius={0.17} height={0.28} />
      {fronds.map((f, i) => (
        <group key={i} rotation={[0, -f.a, 0]}>
          {/* arching rachis in two segments */}
          <mesh position={[Math.sin(f.tilt) * f.len * 0.28, 0.32 + Math.cos(f.tilt) * f.len * 0.32, 0]} rotation={[0, 0, -f.tilt]} material={stemMat} castShadow>
            <cylinderGeometry args={[0.006, 0.01, f.len * 0.62, 6]} />
          </mesh>
          <mesh position={[Math.sin(f.tilt + 0.62) * f.len * 0.62, 0.32 + Math.cos(f.tilt) * f.len * 0.5 - 0.06, 0]} rotation={[0, 0, -f.tilt - 0.62]} material={stemMat} castShadow>
            <cylinderGeometry args={[0.004, 0.006, f.len * 0.5, 6]} />
          </mesh>
          {/* pinnae pairs shrinking toward the tip */}
          {Array.from({ length: 9 }, (_, k) => {
            const t = k / 9;
            const ang = f.tilt + t * 0.75;
            const px = Math.sin(ang) * f.len * (0.3 + t * 0.55);
            const py = 0.32 + Math.cos(f.tilt) * f.len * (0.3 + t * 0.38) - t * t * 0.12;
            return [-1, 1].map((side) => (
              <mesh
                key={`${k}${side}`}
                geometry={pinnaGeo}
                position={[px, py, side * 0.008]}
                rotation={[-side * 1.15, side * 0.22, -ang + 0.4]}
                scale={[0.09 - k * 0.006, 1, 0.16 - k * 0.011]}
                castShadow
              >
                <primitive object={makeLeafMaterial(new THREE.Color('#3f8f4f').multiplyScalar(f.shade))} attach="material" />
              </mesh>
            ));
          })}
        </group>
      ))}
    </group>
  );
}
function Succulent(p: StudioElementProps) {
  const leafGeo = useMemo(() => createLeafGeometry(1, 0.52, 0.1, 0.3), []);
  const rings = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => {
        const ring = i < 6 ? 0 : i < 11 ? 1 : 2;
        const golden = i * 2.399;
        return {
          a: golden,
          ring,
          tilt: 0.95 - ring * 0.24,
          len: 0.15 - ring * 0.038,
          shade: 0.86 + ring * 0.06,
        };
      }),
    [],
  );
  return (
    <group position={p.position} rotation={p.rotation} scale={p.scale}>
      <PotAssembly pot="#d6d3d1" radius={0.12} height={0.17} />
      <group position={[0, 0.17, 0]}>
        {/* fleshy rosette — golden-angle spiral, thick leaves */}
        {rings.map((leaf, i) => (
          <mesh
            key={i}
            geometry={leafGeo}
            position={[Math.sin(leaf.a) * leaf.len * 0.3, leaf.ring * 0.028, Math.cos(leaf.a) * leaf.len * 0.3]}
            rotation={[Math.cos(leaf.a) * leaf.tilt, -leaf.a + Math.PI / 2, Math.sin(leaf.a) * leaf.tilt]}
            scale={[leaf.len * 0.9, 1, leaf.len]}
            castShadow
          >
            <primitive object={makeLeafMaterial(new THREE.Color('#5c8a68').multiplyScalar(leaf.shade))} attach="material" />
          </mesh>
        ))}
        {/* tight centre bud */}
        <mesh position={[0, 0.075, 0]} castShadow>
          <sphereGeometry args={[0.032, 12, 10]} />
          <meshStandardMaterial color="#7fae86" roughness={0.42} />
        </mesh>
      </group>
    </group>
  );
}
function HedgePlanter(p: StudioElementProps) {
  const m = useStudioMaterials();
  return (
    <group position={p.position} rotation={p.rotation} scale={p.scale}>
      <RoundedBox args={[1.9, 0.42, 0.55]} radius={0.03} smoothness={3} position={[0, 0.21, 0]} material={m.concrete} castShadow receiveShadow />
      <RoundedBox args={[1.82, 0.75, 0.48]} radius={0.12} smoothness={4} position={[0, 0.82, 0]} castShadow>
        <meshStandardMaterial color="#2c6e3f" roughness={0.68} />
      </RoundedBox>
    </group>
  );
}
function FlowerVase(p: StudioElementProps) {
  const glass = useMemo(() => glassMaterial('#e8f4f8', 0.14), []);
  const water = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#bfe3ea', transparent: true, opacity: 0.42, roughness: 0.08, metalness: 0, clearcoat: 1 }), []);
  const stemMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a7a3c', roughness: 0.7 }), []);
  const vaseGeo = useMemo(() => {
    // lathe profile: heavy base, belly, narrow neck, flared lip
    const pts: THREE.Vector2[] = [
      new THREE.Vector2(0.001, 0),
      new THREE.Vector2(0.105, 0),
      new THREE.Vector2(0.115, 0.015),
      new THREE.Vector2(0.125, 0.1),
      new THREE.Vector2(0.118, 0.2),
      new THREE.Vector2(0.088, 0.28),
      new THREE.Vector2(0.075, 0.31),
      new THREE.Vector2(0.082, 0.34),
    ];
    return new THREE.LatheGeometry(pts, 28);
  }, []);
  const stems = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2;
        return {
          a,
          tilt: 0.32 + (i % 3) * 0.16,
          headY: 0.5 + (i % 3) * 0.07,
          petal: ['#e11d48', '#f59e0b', '#f43f5e'][i % 3],
        };
      }),
    [],
  );
  return (
    <group position={p.position} rotation={p.rotation} scale={p.scale}>
      {/* blown-glass vase + water line */}
      <mesh geometry={vaseGeo} material={glass} castShadow />
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.108, 0.122, 0.26, 24]} />
        <primitive object={water} attach="material" />
      </mesh>
      {stems.map((s, i) => {
        const topX = Math.sin(s.a) * 0.13;
        const topZ = Math.cos(s.a) * 0.13;
        return (
          <group key={i}>
            {/* stem rising from the vase mouth */}
            <mesh position={[topX * 0.55, 0.38 + s.headY * 0.22, topZ * 0.55]} rotation={[Math.cos(s.a) * s.tilt * 0.4, -s.a, Math.sin(s.a) * -s.tilt * 0.4]} material={stemMat} castShadow>
              <cylinderGeometry args={[0.005, 0.007, 0.42, 6]} />
            </mesh>
            {/* stem leaf */}
            <mesh geometry={createLeafGeometry(1, 0.42, 0.2, 0.1)} position={[topX * 0.9, 0.42, topZ * 0.9]} rotation={[Math.cos(s.a) * 0.9, -s.a + Math.PI / 2, 0]} scale={[0.1, 1, 0.16]} castShadow>
              <primitive object={makeLeafMaterial('#4d8a44')} attach="material" />
            </mesh>
            {/* petal rosette head */}
            <group position={[topX * 1.25, s.headY, topZ * 1.25]}>
              {Array.from({ length: 7 }, (_, k) => {
                const pa = (k / 7) * Math.PI * 2;
                return (
                  <mesh key={k} position={[Math.cos(pa) * 0.042, 0, Math.sin(pa) * 0.042]} rotation={[Math.sin(pa) * 0.7, -pa, Math.cos(pa) * -0.7]} castShadow>
                    <sphereGeometry args={[0.036, 10, 8]} />
                    <meshStandardMaterial color={s.petal} roughness={0.52} side={THREE.DoubleSide} />
                  </mesh>
                );
              })}
              <mesh castShadow>
                <sphereGeometry args={[0.024, 12, 10]} />
                <meshStandardMaterial color="#fbbf24" roughness={0.65} />
              </mesh>
            </group>
          </group>
        );
      })}
    </group>
  );
}

/* ------------------------------------------------------------- lighting */

function UplightCan(p: StudioElementProps) {
  const m = useStudioMaterials();
  return (
    <group position={p.position} rotation={p.rotation} scale={p.scale}>
      <mesh position={[0, 0.16, 0]} material={m.dark} castShadow>
        <cylinderGeometry args={[0.11, 0.13, 0.32, 20]} />
      </mesh>
      <mesh position={[0, 0.335, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.11, 0.12, 20, 1, true]} />
        <meshStandardMaterial color="#fef3c7" emissive="#fde68a" emissiveIntensity={2.4} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <spotLight position={[0, 1.3, 0]} angle={0.5} penumbra={0.9} intensity={7} distance={5} decay={2} color="#fde68a" />
      {/* upward wash visible in studio haze */}
      <LightBeam position={[0, 1.75, 0]} height={2.8} radius={0.9} color="#fde68a" opacity={0.1} direction="up" />
    </group>
  );
}
function StudioSoftbox(p: StudioElementProps) {
  const m = useStudioMaterials();
  return (
    <group position={p.position} rotation={p.rotation} scale={p.scale}>
      <RoundedBox args={[0.72, 0.72, 0.16]} radius={0.02} smoothness={3} position={[0, 1.75, 0]} rotation={[-0.35, 0, 0]} material={m.dark} castShadow />
      <mesh position={[0, 1.75, 0.095]} rotation={[-0.35, 0, 0]}>
        <planeGeometry args={[0.62, 0.62]} />
        <meshStandardMaterial color="#ffffff" emissive="#fff7ed" emissiveIntensity={1.9} toneMapped={false} />
      </mesh>
      {/* key-light shaft from the diffuser face */}
      <group position={[0, 1.75, 0.095]} rotation={[-0.35, 0, 0]}>
        <LightBeam position={[0, 0, 1.15]} rotation={[-Math.PI / 2, 0, 0]} height={2.3} radius={0.6} color="#fff7ed" opacity={0.1} />
      </group>
      <mesh position={[0, 0.875, 0]} material={m.metal} castShadow>
        <cylinderGeometry args={[0.028, 0.035, 1.75, 12]} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[Math.sin((i / 3) * Math.PI * 2) * 0.3, 0.02, Math.cos((i / 3) * Math.PI * 2) * 0.3]} rotation={[0, 0, Math.PI / 2]} material={m.metal}>
          <cylinderGeometry args={[0.016, 0.016, 0.6, 8]} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------------------------------------------------------- decor */

function ArtworkFrame(p: StudioElementProps) {
  const m = useStudioMaterials();
  return (
    <group position={p.position} rotation={p.rotation} scale={p.scale}>
      <RoundedBox args={[1.15, 0.85, 0.045]} radius={0.012} smoothness={3} material={m.walnut} castShadow />
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[0.98, 0.68]} />
        <meshStandardMaterial color="#0ea5e9" roughness={0.35} metalness={0.15} />
      </mesh>
    </group>
  );
}
function FloorMirror(p: StudioElementProps) {
  const m = useStudioMaterials();
  return (
    <group position={p.position} rotation={p.rotation} scale={p.scale}>
      <RoundedBox args={[0.86, 1.72, 0.05]} radius={0.015} smoothness={3} position={[0, 0.86, 0]} material={m.walnut} castShadow />
      <mesh position={[0, 0.86, 0.032]}>
        <planeGeometry args={[0.72, 1.56]} />
        <meshStandardMaterial color="#c7d2fe" metalness={0.95} roughness={0.06} envMapIntensity={1.8} />
      </mesh>
    </group>
  );
}
function Sideboard(p: StudioElementProps) {
  return <MediaConsole {...p} width={1.9} />;
}
function CoffeeBooks(p: StudioElementProps) {
  const m = useStudioMaterials();
  return (
    <group position={p.position} rotation={p.rotation} scale={p.scale}>
      {[
        { y: 0.018, w: 0.42, d: 0.3, c: '#7c2d12' },
        { y: 0.052, w: 0.38, d: 0.27, c: '#1e3a5f' },
        { y: 0.084, w: 0.33, d: 0.24, c: '#3f3f46' },
      ].map((b, i) => (
        <RoundedBox key={i} args={[b.w, 0.032, b.d]} radius={0.008} smoothness={2} position={[0, b.y, 0]} rotation={[0, i * 0.16, 0]} castShadow>
          <meshStandardMaterial color={b.c} roughness={0.7} />
        </RoundedBox>
      ))}
      <mesh position={[0.26, 0.03, 0.1]} material={m.marble} castShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.06, 16]} />
      </mesh>
    </group>
  );
}
function WallClock(p: StudioElementProps) {
  const m = useStudioMaterials();
  return (
    <group position={p.position} rotation={p.rotation} scale={p.scale}>
      <mesh material={m.dark} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.05, 32]} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <circleGeometry args={[0.245, 32]} />
        <meshStandardMaterial color="#f5f5f4" roughness={0.5} />
      </mesh>
      {[
        { len: 0.14, w: 0.016, rot: 1.1 },
        { len: 0.19, w: 0.011, rot: -0.5 },
      ].map((hand, i) => (
        <mesh key={i} position={[Math.sin(hand.rot) * hand.len * 0.5, Math.cos(hand.rot) * hand.len * 0.5, 0.045]} rotation={[0, 0, -hand.rot]}>
          <boxGeometry args={[hand.w, hand.len, 0.008]} />
          <meshStandardMaterial color="#1c1917" />
        </mesh>
      ))}
    </group>
  );
}
function RoomDivider(p: StudioElementProps) {
  const m = useStudioMaterials();
  return (
    <group position={p.position} rotation={p.rotation} scale={p.scale}>
      {[-0.62, 0, 0.62].map((x, i) => (
        <group key={i} position={[x, 0, i === 1 ? -0.12 : 0]}>
          <RoundedBox args={[0.58, 1.9, 0.06]} radius={0.02} smoothness={3} position={[0, 0.95, 0]} material={m.oak} castShadow receiveShadow />
          <mesh position={[0, 0.95, 0.035]}>
            <planeGeometry args={[0.42, 1.6]} />
            <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.25} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ---------------------------------------------------------------- table */

const BASE_COMPONENTS: Record<string, ElementComponent> = {
  // seating
  sofa_three_seat: (p) => <StudioSofa {...p} width={2.4} />,
  sofa_two_seat: SofaTwoSeat,
  sofa_sectional: SofaSectional,
  armchair: (p) => <StudioArmchair {...p} />,
  lounge_chair: LoungeChair,
  dining_chair: (p) => <StudioChair {...p} />,
  bar_stool: BarStool,
  office_chair: OfficeChair,
  bench: Bench,
  ottoman: Ottoman,
  accent_chair_pair: AccentChairPair,
  barrel_chair: (p) => <TubChair {...p} color="#3d4c6f" legColor="#d9c19a" backHeight={0.52} />,
  scoop_lounge_chair: (p) => <TubChair {...p} color="#7b7f87" legColor="#c9a877" backHeight={0.44} radius={0.46} />,
  leather_dining_chair: (p) => <LeatherDiningChair {...p} />,
  // tables
  coffee_table: (p) => <CoffeeTable {...p} />,
  side_table: SideTable,
  dining_table: DiningTable,
  desk: Desk,
  console_table: ConsoleTable,
  bar_counter: BarCounter,
  // plants
  monstera: Monstera,
  palm_plant: Palm,
  ficus_tree: Ficus,
  fern_pot: Fern,
  succulent_pot: Succulent,
  hedge_planter: HedgePlanter,
  flower_vase: FlowerVase,
  // screens
  tv_stand: (p) => <Television {...p} stand width={1.8} />,
  tv_wall_mount: (p) => <Television {...p} stand={false} width={1.8} />,
  led_wall: (p) => <VideoWall {...p} width={5.2} height={2.9} cols={4} rows={2} />,
  led_wall_dual: (p) => <VideoWall {...p} width={7.2} height={2.9} cols={6} rows={2} />,
  monitor_desk: (p) => <FramedMonitor {...p} width={1.1} />,
  standing_banner: (p) => <StandingBanner {...p} />,
  ribbon_banner: (p) => <RibbonBanner {...p} width={4} />,
  presentation_screen: (p) => <VideoWall {...p} width={3.4} height={2} cols={2} rows={1} seams={false} />,
  // lighting
  floor_lamp: (p) => <FloorLamp {...p} />,
  pendant_lamp: (p) => (
    <PendantLight position={p.position} scale={typeof p.scale === 'number' ? p.scale : undefined} />
  ),
  uplight_can: UplightCan,
  studio_softbox: StudioSoftbox,
  // decor
  area_rug: (p) => <AreaRug {...p} />,
  bookshelf: (p) => <Bookshelf {...p} />,
  artwork_frame: ArtworkFrame,
  floor_mirror: FloorMirror,
  sideboard: Sideboard,
  coffee_table_books: CoffeeBooks,
  wall_clock: WallClock,
  room_divider: RoomDivider,
  // stage
  lectern: (p) => <Lectern {...p} />,
  stage_deck: (p) => <StageDeck {...p} />,
  anchor_desk: (p) => <AnchorDesk {...p} />,
  sports_desk: (p) => <SportsDesk {...p} />,
  led_floor_disc: (p) => <SwirlLedDisc {...p} radius={2.2} />,
  tiered_platform: (p) => <TieredPlatform {...p} tiers={2} radius={5} arc={Math.PI} />,
  // signature sets
  glass_pendants: (p) => <GlassPendantCluster {...p} count={3} />,
  kitchen_island: (p) => <KitchenIsland {...p} />,
  kitchen_cabinets: (p) => <CabinetRun {...p} width={4.4} uppers />,
  oven_stack: (p) => <OvenStack {...p} />,
  open_shelving: (p) => <OpenShelving {...p} />,
  curtain_panel: (p) => <CurtainPanel {...p} />,
  bed: (p) => <Bed {...p} />,
};

/** Photoreal scanned glTF models (Poly Haven CC0) registered in the catalog. */
const MODEL_COMPONENTS: Record<string, ElementComponent> = Object.fromEntries(
  STUDIO_ELEMENTS.flatMap((def) => {
    const model = def.model;
    if (!model) return [];
    const Comp: ElementComponent = (p) => (
      <GltfModelElement
        position={p.position}
        rotation={p.rotation}
        scale={p.scale}
        url={`/models/${model.folder}/${model.folder}_1k.gltf`}
        height={model.height}
        rotationY={model.rotationY}
      />
    );
    return [[def.id, Comp] as [string, ElementComponent]];
  }),
);

const ELEMENT_COMPONENTS: Record<string, ElementComponent> = { ...BASE_COMPONENTS, ...MODEL_COMPONENTS };

/** Renders any catalog element by id — unknown ids fall back to a plain ottoman. */
export const StudioElementRenderer = memo(function StudioElementRenderer({
  elementId,
  source,
  position,
  rotation,
  scale,
}: StudioElementProps & { elementId: string }) {
  const Comp = ELEMENT_COMPONENTS[elementId] ?? Ottoman;
  return <Comp source={source} position={position} rotation={rotation} scale={scale} />;
});
