import { memo, useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useStudioMaterials } from './materials';

/**
 * Designer navy kitchen set modelled on premium cooking-show interiors:
 * shaker cabinetry with brass bar pulls, marble counters, plaster-finish
 * island, black-framed bar stools and open shelving.
 */

export interface PlaceProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
}

function GoldPull({ position, vertical = true }: { position: [number, number, number]; vertical?: boolean }) {
  const m = useStudioMaterials();
  return (
    <group position={position}>
      <mesh rotation={vertical ? [0, 0, 0] : [0, 0, Math.PI / 2]} material={m.brass}>
        <cylinderGeometry args={[0.011, 0.011, vertical ? 0.24 : 0.2, 10]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={vertical ? [0, s * 0.1, 0.017] : [s * 0.08, 0, 0.017]} rotation={[Math.PI / 2, 0, 0]} material={m.brass}>
          <cylinderGeometry args={[0.007, 0.007, 0.034, 8]} />
        </mesh>
      ))}
    </group>
  );
}

/** Shaker door/drawer face: recessed centre panel with a bevelled frame. */
function ShakerFace({
  width,
  height,
  color,
  horizontalPull = false,
}: {
  width: number;
  height: number;
  color: THREE.Color;
  horizontalPull?: boolean;
}) {
  const panelMat = useMemo(() => new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.92), roughness: 0.42, metalness: 0.06 }), [color]);
  return (
    <group>
      <mesh position={[0, 0, 0.012]}>
        <boxGeometry args={[width, height, 0.024]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.06} />
      </mesh>
      <mesh position={[0, 0, 0.028]} material={panelMat}>
        <boxGeometry args={[width - 0.09, height - 0.09, 0.012]} />
      </mesh>
      {/* one pull per face: doors get a vertical pull near the opening edge,
          drawers a centred horizontal pull */}
      <GoldPull
        position={horizontalPull ? [0, 0, 0.045] : [width / 2 - 0.1, 0, 0.045]}
        vertical={!horizontalPull}
      />
    </group>
  );
}

/** Base cabinet run with shaker doors/drawers and a counter slab. */
export const CabinetRun = memo(function CabinetRun({
  position,
  rotation,
  scale = 1,
  width = 4,
  depth = 0.65,
  height = 0.92,
  color = '#2b3444',
  counter = true,
  uppers = false,
}: PlaceProps & { width?: number; depth?: number; height?: number; color?: string; counter?: boolean; uppers?: boolean }) {
  const m = useStudioMaterials();
  const navy = useMemo(() => new THREE.Color(color), [color]);
  const bays = Math.max(2, Math.round(width / 0.8));
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* carcass */}
      <RoundedBox args={[width, height, depth]} radius={0.012} smoothness={2} position={[0, height / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={navy} roughness={0.42} metalness={0.06} />
      </RoundedBox>
      {/* shaker fronts */}
      {Array.from({ length: bays }, (_, i) => {
        const bw = (width - 0.04) / bays;
        const x = -width / 2 + 0.02 + bw * (i + 0.5);
        return (
          <group key={i} position={[x, height * 0.46, depth / 2 + 0.002]}>
            <ShakerFace width={bw - 0.03} height={height * 0.62} color={navy}/>
            <group position={[0, height * 0.36, 0]}>
              <ShakerFace width={bw - 0.03} height={height * 0.2} color={navy}horizontalPull />
            </group>
          </group>
        );
      })}
      {/* marble counter */}
      {counter && (
        <RoundedBox args={[width + 0.05, 0.045, depth + 0.05]} radius={0.012} smoothness={3} position={[0, height + 0.022, 0.01]} material={m.marble} castShadow />
      )}
      {/* toe kick */}
      <mesh position={[0, 0.055, -0.02]}>
        <boxGeometry args={[width - 0.02, 0.11, depth - 0.09]} />
        <meshStandardMaterial color={navy.clone().multiplyScalar(0.55)} roughness={0.6} />
      </mesh>
      {/* upper cabinets */}
      {uppers && (
        <group position={[0, height + 1.05, -depth / 2 + 0.34]}>
          <RoundedBox args={[width, 0.75, 0.36]} radius={0.012} smoothness={2} castShadow>
            <meshStandardMaterial color={navy} roughness={0.42} metalness={0.06} />
          </RoundedBox>
          {Array.from({ length: bays }, (_, i) => {
            const bw = (width - 0.04) / bays;
            const x = -width / 2 + 0.02 + bw * (i + 0.5);
            return (
              <group key={i} position={[x, -0.05, 0.185]}>
                <ShakerFace width={bw - 0.03} height={0.62} color={navy}/>
              </group>
            );
          })}
        </group>
      )}
    </group>
  );
});

/** Kitchen island — travertine/plaster base with a marble waterfall top. */
export const KitchenIsland = memo(function KitchenIsland({
  position,
  rotation,
  scale = 1,
  width = 2.4,
  depth = 1.15,
  height = 0.94,
  baseColor = '#c9bda9',
}: PlaceProps & { width?: number; depth?: number; height?: number; baseColor?: string }) {
  const m = useStudioMaterials();
  const plaster = useMemo(
    () => new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.82, metalness: 0.02 }),
    [baseColor],
  );
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* plaster base with panel reveals */}
      <RoundedBox args={[width - 0.16, height, depth - 0.16]} radius={0.015} smoothness={2} position={[0, height / 2, 0]} material={plaster} castShadow receiveShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * width * 0.24, height * 0.52, depth / 2 - 0.075]}>
          <boxGeometry args={[width * 0.36, height * 0.68, 0.012]} />
          <meshStandardMaterial color={new THREE.Color(baseColor).multiplyScalar(0.9)} roughness={0.85} />
        </mesh>
      ))}
      {/* marble top with waterfall ends */}
      <RoundedBox args={[width, 0.05, depth]} radius={0.014} smoothness={3} position={[0, height + 0.025, 0]} material={m.marble} castShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (width / 2 - 0.025), height / 2 + 0.025, 0]} material={m.marble} castShadow>
          <boxGeometry args={[0.05, height, depth]} />
        </mesh>
      ))}
    </group>
  );
});

/** Built-in black oven column. */
export const OvenStack = memo(function OvenStack({
  position,
  rotation,
  scale = 1,
}: PlaceProps) {
  const m = useStudioMaterials();
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <RoundedBox args={[0.75, 2.25, 0.66]} radius={0.015} smoothness={2} position={[0, 1.125, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#23272e" roughness={0.4} metalness={0.2} />
      </RoundedBox>
      {[0.72, 1.42].map((y, i) => (
        <group key={i}>
          {/* black glass door */}
          <mesh position={[0, y, 0.342]}>
            <boxGeometry args={[0.62, 0.52, 0.012]} />
            <meshPhysicalMaterial color="#0a0a0d" roughness={0.12} metalness={0.5} clearcoat={1} envMapIntensity={1.4} />
          </mesh>
          {/* handle bar */}
          <mesh position={[0, y + 0.3, 0.37]} rotation={[0, 0, Math.PI / 2]} material={m.brass}>
            <cylinderGeometry args={[0.013, 0.013, 0.58, 10]} />
          </mesh>
          {/* control strip */}
          <mesh position={[0, y + 0.335, 0.345]}>
            <boxGeometry args={[0.62, 0.055, 0.01]} />
            <meshStandardMaterial color="#14161a" roughness={0.35} metalness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
});

/** Open wood shelving with dish stacks and glassware. */
export const OpenShelving = memo(function OpenShelving({
  position,
  rotation,
  scale = 1,
  width = 2.2,
  color = '#b98d5f',
}: PlaceProps & { width?: number; color?: string }) {
  const m = useStudioMaterials();
  const wood = useMemo(() => new THREE.Color(color), [color]);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {[1.28, 1.72].map((y, si) => (
        <group key={si}>
          <mesh position={[0, y, 0]} material={m.oak} castShadow>
            <boxGeometry args={[width, 0.038, 0.24]} />
          </mesh>
          {/* dishes + glasses */}
          {[-0.72, -0.18, 0.42].map((x, i) => (
            <group key={i} position={[x, y + 0.04, 0]}>
              {(i + si) % 2 === 0 ? (
                // stacked bowls
                [0, 1, 2].map((k) => (
                  <mesh key={k} position={[0, 0.022 + k * 0.042, 0]} castShadow>
                    <cylinderGeometry args={[0.085 - k * 0.004, 0.065, 0.04, 18]} />
                    <meshStandardMaterial color="#f3ede4" roughness={0.35} />
                  </mesh>
                ))
              ) : (
                // glass carafe
                <mesh position={[0, 0.11, 0]} castShadow>
                  <cylinderGeometry args={[0.05, 0.065, 0.22, 14]} />
                  <meshPhysicalMaterial color="#e8f2f6" transparent opacity={0.32} roughness={0.08} clearcoat={1} envMapIntensity={1.5} />
                </mesh>
              )}
            </group>
          ))}
          {/* small plant */}
          <group position={[width / 2 - 0.18, y + 0.04, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.055, 0.045, 0.09, 14]} />
              <meshStandardMaterial color={wood} roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.1, 0]}>
              <sphereGeometry args={[0.075, 10, 8]} />
              <meshStandardMaterial color="#3f7d4e" roughness={0.6} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
});

/** Black-frame bar stool with a slim dark seat. */
export const KitchenBarStool = memo(function KitchenBarStool({
  position,
  rotation,
  scale = 1,
  seatHeight = 0.72,
}: PlaceProps & { seatHeight?: number }) {
  const frameMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#141414', metalness: 0.75, roughness: 0.38 }),
    [],
  );
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* four slim legs + footrest */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 0.19, seatHeight / 2, sz * 0.19]} rotation={[sz * -0.05, 0, sx * 0.05]} material={frameMat} castShadow>
            <cylinderGeometry args={[0.012, 0.012, seatHeight, 8]} />
          </mesh>
        )),
      )}
      <mesh position={[0, seatHeight * 0.3, 0.19]} rotation={[0, 0, Math.PI / 2]} material={frameMat}>
        <cylinderGeometry args={[0.011, 0.011, 0.42, 8]} />
      </mesh>
      {/* seat */}
      <RoundedBox args={[0.42, 0.055, 0.4]} radius={0.024} smoothness={3} position={[0, seatHeight + 0.028, 0]} castShadow>
        <meshStandardMaterial color="#1c1c1e" roughness={0.55} />
      </RoundedBox>
    </group>
  );
});
