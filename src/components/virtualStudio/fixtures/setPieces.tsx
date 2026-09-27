import { memo, useEffect, useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useStudioMaterials } from './materials';
import { PbrSurface } from './PbrSurface';
import { useLightSlot, usePracticalLightScale } from './fidelityLighting';

/**
 * Premium set pieces for the photoreal scene library — the architectural and
 * performance fixtures the core kit doesn't cover: sanctuary pews and leaded
 * glass, ballroom chandeliers, auction vitrines and the auctioneer's block,
 * podcast booms and acoustic walls, rooftop string lights, noir venetian
 * windows, library bookcase walls, gym racks and stage instrumentation.
 *
 * Same conventions as the rest of the fixture kit: rounded geometry (no hard
 * CG corners), full PBR micro-surfaces through `PbrSurface`, honest metre
 * scale with legs on the floor, cast/receive shadows, and practicals that
 * claim a slot against the stage's dynamic-light budget so a dressed set
 * never blows the frame budget.
 */

type PlaceProps = {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
};

/** Practical fixtures sit just under screens in the light-slot ranking. */
const PRACTICAL_LIGHT_PRIORITY = 70;
const ACCENT_LIGHT_PRIORITY = 62;

/* ------------------------------------------------------------------ pew */

/** Church pew — solid timber ends, reclined back, rolled top rail and kneeler. */
export const Pew = memo(function Pew({
  position,
  rotation,
  scale = 1,
  width = 2.4,
}: PlaceProps & { width?: number }) {
  const m = useStudioMaterials();
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* solid end panels — the pew's structure */}
      {[-1, 1].map((side) => (
        <RoundedBox
          key={side}
          args={[0.07, 0.9, 0.66]}
          radius={0.018}
          smoothness={3}
          position={[(side * (width - 0.07)) / 2, 0.45, -0.02]}
          material={m.walnut}
          castShadow
          receiveShadow
        />
      ))}
      {/* seat slab with an eased front edge over a shadow reveal */}
      <RoundedBox
        args={[width - 0.14, 0.075, 0.5]}
        radius={0.028}
        smoothness={3}
        position={[0, 0.47, 0.04]}
        material={m.oak}
        castShadow
        receiveShadow
      />
      <mesh position={[0, 0.425, 0.04]}>
        <boxGeometry args={[width - 0.2, 0.02, 0.44]} />
        <PbrSurface color="#150f0a" roughness={0.9} />
      </mesh>
      {/* reclined backrest with a rolled top rail */}
      <group position={[0, 0, -0.25]} rotation={[-0.06, 0, 0]}>
        <RoundedBox
          args={[width - 0.14, 0.62, 0.055]}
          radius={0.022}
          smoothness={3}
          position={[0, 0.79, 0]}
          material={m.walnut}
          castShadow
        />
        <mesh position={[0, 1.11, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.034, 0.034, width - 0.14, 14]} />
          <PbrSurface color="#7a5330" roughness={0.42} />
        </mesh>
      </group>
      {/* hymn-board ledge on the back */}
      <mesh position={[0, 0.7, -0.33]} rotation={[-0.5, 0, 0]} castShadow>
        <boxGeometry args={[width - 0.44, 0.14, 0.016]} />
        <PbrSurface color="#54381f" roughness={0.55} />
      </mesh>
      {/* kneeler */}
      <RoundedBox
        args={[width - 0.34, 0.06, 0.2]}
        radius={0.02}
        smoothness={3}
        position={[0, 0.2, 0.44]}
        material={m.oak}
        castShadow
      />
      {[-1, 1].map((side) => (
        <mesh key={`k${side}`} position={[side * (width / 2 - 0.24), 0.1, 0.44]} material={m.dark} castShadow>
          <boxGeometry args={[0.05, 0.2, 0.16]} />
        </mesh>
      ))}
      {/* recessed plinth — carries the seat and leaves a shadow gap under it */}
      <mesh position={[0, 0.21, -0.03]} material={m.dark} castShadow receiveShadow>
        <boxGeometry args={[width - 0.34, 0.42, 0.36]} />
      </mesh>
    </group>
  );
});

/* -------------------------------------------------------- stained glass */

const STAINED_COLORS = ['#c0392b', '#d99b26', '#2f6fb0', '#3d8b5f', '#8a4b9c'];

/**
 * Leaded stained-glass window — a grid of backlit coloured panes under a
 * radial tracery arch, set into a stone reveal. The panes are translucent so
 * the window's own view plate (or daylight) reads through them the way real
 * daylight reads through glass.
 */
export const StainedGlassWindow = memo(function StainedGlassWindow({
  position,
  rotation,
  scale = 1,
  width = 4.4,
  height = 5.2,
  glow = '#ffd9a0',
}: PlaceProps & { width?: number; height?: number; glow?: string }) {
  const lit = useLightSlot(ACCENT_LIGHT_PRIORITY);
  const lightScale = usePracticalLightScale();
  const cols = 5;
  const rows = 6;
  const archH = width * 0.46;
  const bodyH = height - archH;
  const pw = width / cols;
  const ph = bodyH / rows;
  const springY = -height / 2 + bodyH;
  const paneAt = (color: string) => (
    <PbrSurface
      color={color}
      emissive={color}
      emissiveIntensity={0.85}
      transparent
      opacity={0.74}
      roughness={0.24}
      metalness={0}
    />
  );
  const lead = <PbrSurface color="#141110" roughness={0.55} metalness={0.5} />;
  const stone = <PbrSurface color="#37312b" roughness={0.86} normalScale={1.2} />;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* stone jambs, lintel and sill — open in the middle for the view */}
      {[-1, 1].map((side) => (
        <RoundedBox
          key={side}
          args={[0.22, height + 0.3, 0.26]}
          radius={0.03}
          smoothness={3}
          position={[(side * (width + 0.22)) / 2, 0, -0.07]}
          castShadow
          receiveShadow
        >
          {stone}
        </RoundedBox>
      ))}
      <RoundedBox args={[width + 0.66, 0.24, 0.26]} radius={0.03} smoothness={3} position={[0, height / 2 + 0.1, -0.07]} castShadow receiveShadow>
        {stone}
      </RoundedBox>
      <RoundedBox args={[width + 0.54, 0.17, 0.36]} radius={0.03} smoothness={3} position={[0, -height / 2 - 0.08, -0.03]} castShadow receiveShadow>
        {stone}
      </RoundedBox>

      {/* leaded body panes */}
      {Array.from({ length: rows }, (_, j) =>
        Array.from({ length: cols }, (_, i) => {
          const color = STAINED_COLORS[(i * 2 + j * 3) % STAINED_COLORS.length];
          return (
            <mesh key={`${i}-${j}`} position={[-width / 2 + pw * (i + 0.5), -height / 2 + ph * (j + 0.5), 0.03]}>
              <planeGeometry args={[pw - 0.05, ph - 0.05]} />
              {paneAt(color)}
            </mesh>
          );
        }),
      )}
      {/* horizontal + vertical cames */}
      {Array.from({ length: cols - 1 }, (_, i) => (
        <mesh key={`v${i}`} position={[-width / 2 + pw * (i + 1), -height / 2 + bodyH / 2, 0.045]}>
          <boxGeometry args={[0.045, bodyH, 0.02]} />
          {lead}
        </mesh>
      ))}
      {Array.from({ length: rows - 1 }, (_, j) => (
        <mesh key={`h${j}`} position={[0, -height / 2 + ph * (j + 1), 0.045]}>
          <boxGeometry args={[width, 0.045, 0.02]} />
          {lead}
        </mesh>
      ))}

      {/* radial tracery arch */}
      {Array.from({ length: 5 }, (_, i) => {
        const seg = Math.PI / 5;
        const color = STAINED_COLORS[(i * 3 + 1) % STAINED_COLORS.length];
        return (
          <mesh key={`a${i}`} position={[0, springY, 0.03]}>
            <circleGeometry args={[width / 2 - 0.02, 14, i * seg, seg]} />
            {paneAt(color)}
          </mesh>
        );
      })}
      {Array.from({ length: 4 }, (_, i) => (
        <group key={`s${i}`} position={[0, springY, 0.045]} rotation={[0, 0, (i + 1) * (Math.PI / 5)]}>
          <mesh position={[width / 4, 0, 0]}>
            <boxGeometry args={[width / 2 - 0.04, 0.05, 0.02]} />
            {lead}
          </mesh>
        </group>
      ))}
      {/* springing bar + arch ring */}
      <mesh position={[0, springY, 0.05]}>
        <boxGeometry args={[width + 0.04, 0.05, 0.025]} />
        {lead}
      </mesh>
      <mesh position={[0, springY, 0.05]}>
        <torusGeometry args={[width / 2, 0.03, 8, 48, Math.PI]} />
        {lead}
      </mesh>

      {/* daylight the window throws into the room */}
      {lit && <pointLight position={[0, 0.2, 1.6]} intensity={5 * lightScale} distance={11} decay={2} color={glow} />}
    </group>
  );
});

/* ----------------------------------------------------------- chandelier */

/**
 * Tiered crystal chandelier — brass chain and column, ring tiers carrying
 * candle bulbs and hanging prisms, and a warm practical at its heart.
 */
export const Chandelier = memo(function Chandelier({
  position,
  rotation,
  scale = 1,
  radius = 0.62,
  tiers = 2,
  drop = 1.4,
  glow = '#ffd9a0',
}: PlaceProps & { radius?: number; tiers?: number; drop?: number; glow?: string }) {
  const lit = useLightSlot(PRACTICAL_LIGHT_PRIORITY);
  const lightScale = usePracticalLightScale();
  const rings = useMemo(
    () =>
      Array.from({ length: tiers }, (_, t) => ({
        y: -drop - 0.18 - t * 0.36,
        r: radius * (1 - t * 0.34),
        candles: Math.max(6, Math.round(10 - t * 2)),
      })),
    [tiers, drop, radius],
  );
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* ceiling rose + chain + brass column */}
      <mesh position={[0, -0.02, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.13, 0.05, 20]} />
        <PbrSurface color="#b08d4f" metalness={1} roughness={0.32} envMapIntensity={1.5} />
      </mesh>
      <mesh position={[0, -drop / 2, 0]}>
        <cylinderGeometry args={[0.012, 0.012, drop, 8]} />
        <PbrSurface color="#b08d4f" metalness={1} roughness={0.36} />
      </mesh>
      <mesh position={[0, -drop - 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.05, 0.2, 16]} />
        <PbrSurface color="#b08d4f" metalness={1} roughness={0.3} envMapIntensity={1.5} />
      </mesh>

      {rings.map((ring, t) => (
        <group key={t} position={[0, ring.y, 0]}>
          {/* brass ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[ring.r, 0.016, 8, 48]} />
            <PbrSurface color="#b08d4f" metalness={1} roughness={0.3} envMapIntensity={1.6} />
          </mesh>
          {/* spokes back to the column */}
          {Array.from({ length: 6 }, (_, i) => (
            <group key={i} rotation={[0, (i / 6) * Math.PI * 2, 0]}>
              <mesh position={[ring.r / 2, 0.03, 0]} rotation={[0, 0, 0.12]}>
                <boxGeometry args={[ring.r, 0.014, 0.014]} />
                <PbrSurface color="#b08d4f" metalness={1} roughness={0.34} />
              </mesh>
            </group>
          ))}
          {/* candle bulbs around the ring */}
          {Array.from({ length: ring.candles }, (_, i) => {
            const a = (i / ring.candles) * Math.PI * 2;
            const x = Math.sin(a) * ring.r;
            const z = Math.cos(a) * ring.r;
            return (
              <group key={`c${i}`} position={[x, 0, z]}>
                <mesh position={[0, 0.05, 0]}>
                  <cylinderGeometry args={[0.016, 0.02, 0.1, 10]} />
                  <PbrSurface color="#f6efe0" roughness={0.6} />
                </mesh>
                <mesh position={[0, 0.13, 0]} scale={[1, 1.6, 1]}>
                  <sphereGeometry args={[0.026, 10, 8]} />
                  <meshBasicMaterial color={glow} toneMapped={false} />
                </mesh>
              </group>
            );
          })}
          {/* hanging prisms under the ring */}
          {Array.from({ length: ring.candles * 2 }, (_, i) => {
            const a = ((i + 0.5) / (ring.candles * 2)) * Math.PI * 2;
            const x = Math.sin(a) * ring.r * 0.94;
            const z = Math.cos(a) * ring.r * 0.94;
            return (
              <group key={`p${i}`} position={[x, -0.05, z]}>
                <mesh position={[0, -0.05, 0]} scale={[1, 1.7, 1]}>
                  <octahedronGeometry args={[0.03, 0]} />
                  <PbrSurface physical color="#f2f7ff" transparent opacity={0.42} roughness={0.04} metalness={0} clearcoat={1} envMapIntensity={2} />
                </mesh>
                <mesh position={[0, -0.15, 0]} scale={[0.8, 2.4, 0.8]}>
                  <octahedronGeometry args={[0.03, 0]} />
                  <PbrSurface physical color="#f2f7ff" transparent opacity={0.42} roughness={0.04} metalness={0} clearcoat={1} envMapIntensity={2} />
                </mesh>
              </group>
            );
          })}
        </group>
      ))}

      {/* central glow + crystal finial */}
      <mesh position={[0, -drop - 0.34, 0]}>
        <sphereGeometry args={[0.09, 16, 12]} />
        <meshBasicMaterial color={glow} toneMapped={false} />
      </mesh>
      <mesh position={[0, -drop - 0.36 - radius * 0.5, 0]} scale={[1, 1.5, 1]}>
        <octahedronGeometry args={[0.07, 0]} />
        <PbrSurface physical color="#f2f7ff" transparent opacity={0.45} roughness={0.04} clearcoat={1} envMapIntensity={2} />
      </mesh>
      {lit && <pointLight position={[0, -drop - 0.3, 0]} intensity={6.5 * lightScale} distance={12} decay={2} color={glow} />}
    </group>
  );
});

/* --------------------------------------------------------- display case */

/** Museum vitrine — marble plinth, glass lantern case, lit lot on a velvet pad. */
export const DisplayCase = memo(function DisplayCase({
  position,
  rotation,
  scale = 1,
  width = 0.74,
  depth = 0.74,
  height = 1.7,
  glow = '#ffe2b0',
}: PlaceProps & { width?: number; depth?: number; height?: number; glow?: string }) {
  const m = useStudioMaterials();
  const lit = useLightSlot(ACCENT_LIGHT_PRIORITY);
  const lightScale = usePracticalLightScale();
  const caseH = height - 0.94;
  const pane = (
    <PbrSurface
      physical
      color="#eaf4f8"
      transparent
      opacity={0.14}
      roughness={0.03}
      metalness={0}
      clearcoat={1}
      clearcoatRoughness={0.03}
      ior={1.5}
      side={THREE.DoubleSide}
      depthWrite={false}
      envMapIntensity={2}
    />
  );
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* plinth with a marble cap */}
      <RoundedBox args={[width, 0.86, depth]} radius={0.02} smoothness={3} position={[0, 0.43, 0]} material={m.walnut} castShadow receiveShadow />
      <RoundedBox args={[width + 0.07, 0.05, depth + 0.07]} radius={0.014} smoothness={3} position={[0, 0.885, 0]} material={m.marble} castShadow />
      <mesh position={[0, 0.5, depth / 2 + 0.005]}>
        <planeGeometry args={[width - 0.2, 0.5]} />
        <PbrSurface color="#b08d4f" metalness={1} roughness={0.34} envMapIntensity={1.4} />
      </mesh>

      {/* glass lantern */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (width / 2 - 0.012), 0.91 + caseH / 2, sz * (depth / 2 - 0.012)]} material={m.brass} castShadow>
            <boxGeometry args={[0.024, caseH, 0.024]} />
          </mesh>
        )),
      )}
      <mesh position={[0, 0.91 + caseH / 2, depth / 2]}>
        <planeGeometry args={[width - 0.04, caseH]} />
        {pane}
      </mesh>
      <mesh position={[0, 0.91 + caseH / 2, -depth / 2]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[width - 0.04, caseH]} />
        {pane}
      </mesh>
      <mesh position={[width / 2, 0.91 + caseH / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[depth - 0.04, caseH]} />
        {pane}
      </mesh>
      <mesh position={[-width / 2, 0.91 + caseH / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[depth - 0.04, caseH]} />
        {pane}
      </mesh>

      {/* lit lot: velvet pad + cut stone under the case light */}
      <RoundedBox args={[width * 0.5, 0.07, depth * 0.5]} radius={0.015} smoothness={3} position={[0, 0.95, 0]} castShadow>
        <PbrSurface color="#5d1622" roughness={0.92} sheen={0.5} sheenColor="#c98a95" />
      </RoundedBox>
      <mesh position={[0, 1.12, 0]} rotation={[0, 0.5, 0]} castShadow>
        <octahedronGeometry args={[0.13, 0]} />
        <PbrSurface physical color="#dff3ff" transparent opacity={0.66} transmission={0.92} thickness={0.06} ior={2.2} roughness={0.02} clearcoat={1} envMapIntensity={2.4} />
      </mesh>

      {/* cap with the downlight strip inside */}
      <RoundedBox args={[width + 0.06, 0.07, depth + 0.06]} radius={0.02} smoothness={3} position={[0, 0.91 + caseH + 0.03, 0]} material={m.walnut} castShadow />
      <mesh position={[0, 0.91 + caseH - 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width - 0.16, depth - 0.16]} />
        <meshBasicMaterial color={glow} toneMapped={false} />
      </mesh>
      {lit && <pointLight position={[0, 0.91 + caseH - 0.16, 0]} intensity={2.4 * lightScale} distance={2.6} decay={2} color={glow} />}
    </group>
  );
});

/* --------------------------------------------------------------- podium */

/** Auctioneer's block — sloped counter, brass plate, gavel and gooseneck mic. */
export const Podium = memo(function Podium({
  position,
  rotation,
  scale = 1,
  accent = '#b45309',
}: PlaceProps & { accent?: string }) {
  const m = useStudioMaterials();
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* cabinet */}
      <RoundedBox args={[0.72, 0.96, 0.52]} radius={0.025} smoothness={4} position={[0, 0.48, 0]} material={m.walnut} castShadow receiveShadow />
      <mesh position={[0, 0.5, 0.265]}>
        <planeGeometry args={[0.5, 0.66]} />
        <PbrSurface color="#3a2717" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.24, 0.272]}>
        <planeGeometry args={[0.44, 0.04]} />
        <PbrSurface color={accent} emissive={accent} emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
      {/* sloped counter with an eased edge */}
      <RoundedBox args={[0.84, 0.05, 0.6]} radius={0.02} smoothness={4} position={[0, 0.995, 0.01]} rotation={[-0.11, 0, 0]} material={m.oak} castShadow />
      <mesh position={[0, 1.028, -0.04]} rotation={[-0.11, 0, 0]}>
        <planeGeometry args={[0.5, 0.3]} />
        <PbrSurface color="#0f0d0b" roughness={0.85} />
      </mesh>
      {/* brass nameplate */}
      <mesh position={[0, 0.72, 0.272]}>
        <planeGeometry args={[0.34, 0.11]} />
        <PbrSurface color="#b08d4f" metalness={1} roughness={0.28} envMapIntensity={1.6} />
      </mesh>

      {/* gavel on its block */}
      <group position={[0.24, 1.06, 0.06]} rotation={[0, -0.5, 0]}>
        <RoundedBox args={[0.17, 0.03, 0.12]} radius={0.01} smoothness={3} position={[0, 0, 0]} material={m.dark} castShadow />
        <group position={[0, 0.05, 0]} rotation={[0, 0.3, Math.PI / 2 - 0.18]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.014, 0.016, 0.22, 12]} />
            <PbrSurface color="#6b4a2e" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.14, 0]} castShadow>
            <cylinderGeometry args={[0.038, 0.038, 0.1, 14]} />
            <PbrSurface color="#6b4a2e" roughness={0.5} />
          </mesh>
        </group>
      </group>
      {/* gooseneck microphone */}
      <group position={[-0.24, 1.03, 0.02]}>
        <mesh rotation={[0.9, 0, 0]} position={[0, 0.1, 0.04]}>
          <cylinderGeometry args={[0.007, 0.007, 0.3, 8]} />
          <PbrSurface color="#232327" metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.22, 0.13]} rotation={[1.25, 0, 0]} castShadow>
          <capsuleGeometry args={[0.017, 0.05, 6, 12]} />
          <PbrSurface color="#17171b" metalness={0.5} roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.005, 0]}>
          <cylinderGeometry args={[0.045, 0.05, 0.02, 16]} />
          <PbrSurface color="#232327" metalness={0.7} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
});

/* ---------------------------------------------------------- boom mic */

/**
 * Broadcast boom microphone — desk clamp or tripod base, counterweighted
 * boom arm, shock mount and grille capsule. The origin sits on the surface
 * the stand is mounted to (desk top or stage floor).
 */
export const BoomMicStand = memo(function BoomMicStand({
  position,
  rotation,
  scale = 1,
  mount = 'clamp',
}: PlaceProps & { mount?: 'clamp' | 'tripod' }) {
  const m = useStudioMaterials();
  const post = <PbrSurface color="#1c1c20" metalness={0.72} roughness={0.34} envMapIntensity={1.3} />;
  const postH = mount === 'clamp' ? 0.48 : 0.7;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {mount === 'clamp' ? (
        <group position={[0, -0.05, 0]}>
          <RoundedBox args={[0.07, 0.1, 0.16]} radius={0.012} smoothness={3} material={m.dark} castShadow />
          <mesh position={[0, -0.07, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.014, 0.014, 0.06, 10]} />
            <PbrSurface color="#b08d4f" metalness={1} roughness={0.3} />
          </mesh>
        </group>
      ) : (
        <group>
          <mesh position={[0, 0.02, 0]} material={m.dark} castShadow receiveShadow>
            <cylinderGeometry args={[0.11, 0.13, 0.04, 20]} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <group key={i} rotation={[0, (i / 3) * Math.PI * 2, 0]}>
              <mesh position={[0, 0.05, 0.14]} rotation={[0.35, 0, 0]}>
                <cylinderGeometry args={[0.011, 0.011, 0.3, 8]} />
                {post}
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* vertical post */}
      <mesh position={[0, mount === 'clamp' ? 0.24 : 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.014, 0.016, postH, 12]} />
        {post}
      </mesh>
      <mesh position={[0, mount === 'clamp' ? 0.44 : 0.66, 0]} material={m.brass} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.04, 12]} />
      </mesh>

      {/* boom arm rising toward the talent */}
      <group position={[0, mount === 'clamp' ? 0.48 : 0.7, 0]} rotation={[-0.34, 0, 0]}>
        <mesh position={[0, 0, 0.3]} castShadow>
          <boxGeometry args={[0.028, 0.028, 0.62]} />
          {post}
        </mesh>
        {/* counterweight at the tail */}
        <mesh position={[0, 0, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.08, 14]} />
          {post}
        </mesh>
        {/* shock mount + capsule */}
        <group position={[0, 0, 0.62]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.055, 0.007, 8, 24]} />
            {post}
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[Math.cos((i / 4) * Math.PI * 2) * 0.04, Math.sin((i / 4) * Math.PI * 2) * 0.04, 0]} rotation={[0, 0, (i / 4) * Math.PI * 2]}>
              <boxGeometry args={[0.01, 0.05, 0.008]} />
              <PbrSurface color="#3f3f46" roughness={0.8} />
            </mesh>
          ))}
          <group position={[0, -0.02, 0.06]} rotation={[1.15, 0, 0]}>
            <mesh castShadow>
              <capsuleGeometry args={[0.024, 0.075, 6, 14]} />
              <PbrSurface color="#141417" metalness={0.55} roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.06, 0]} castShadow>
              <sphereGeometry args={[0.032, 14, 12]} />
              <PbrSurface color="#101013" roughness={0.92} />
            </mesh>
            <mesh position={[0, -0.03, 0.022]}>
              <circleGeometry args={[0.012, 12]} />
              <meshBasicMaterial color="#ef4444" toneMapped={false} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
});

/* ----------------------------------------------------- acoustic wall */

/**
 * Fabric acoustic panel wall — a grid of foam-filled panels in two tones over
 * a dark backing, with an LED wash channel along the base. The back wall of a
 * podcast booth in one piece.
 */
export const AcousticPanelWall = memo(function AcousticPanelWall({
  position,
  rotation,
  scale = 1,
  width = 8,
  height = 2.6,
  color = '#2b3138',
  accent = '#10b981',
}: PlaceProps & { width?: number; height?: number; color?: string; accent?: string }) {
  const cols = Math.max(3, Math.round(width / 0.72));
  const rows = Math.max(2, Math.round(height / 0.72));
  const pw = width / cols;
  const ph = height / rows;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh position={[0, 0, -0.05]} receiveShadow>
        <boxGeometry args={[width, height, 0.08]} />
        <PbrSurface color="#131519" roughness={0.92} />
      </mesh>
      {Array.from({ length: rows }, (_, j) =>
        Array.from({ length: cols }, (_, i) => {
          const tone = (i + j) % 3 === 0 ? '#3c444e' : (i * 2 + j) % 4 === 0 ? '#22272e' : color;
          return (
            <RoundedBox
              key={`${i}-${j}`}
              args={[pw - 0.06, ph - 0.06, 0.06]}
              radius={0.014}
              smoothness={3}
              position={[-width / 2 + pw * (i + 0.5), -height / 2 + ph * (j + 0.5), 0.01]}
              castShadow
              receiveShadow
            >
              <PbrSurface color={tone} roughness={0.96} normalScale={1.5} sheen={0.35} sheenColor="#9aa4b2" envMapIntensity={0.6} />
            </RoundedBox>
          );
        }),
      )}
      {/* LED wash channel at the base */}
      <mesh position={[0, -height / 2 + 0.05, 0.055]}>
        <boxGeometry args={[width - 0.3, 0.03, 0.02]} />
        <PbrSurface color={accent} emissive={accent} emissiveIntensity={2.4} toneMapped={false} />
      </mesh>
      <mesh position={[0, -height / 2 + 0.16, 0.05]}>
        <planeGeometry args={[width - 0.3, 0.28]} />
        <meshBasicMaterial color={accent} transparent opacity={0.12} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
});

/* -------------------------------------------------------- string lights */

/** Festoon string lights — bulbs on a real catenary with a warm practical. */
export const StringLights = memo(function StringLights({
  position,
  rotation,
  scale = 1,
  span = 8,
  sag = 0.6,
  bulbs = 16,
  glow = '#ffd9a0',
}: PlaceProps & { span?: number; sag?: number; bulbs?: number; glow?: string }) {
  const m = useStudioMaterials();
  const lit = useLightSlot(ACCENT_LIGHT_PRIORITY);
  const lightScale = usePracticalLightScale();
  const { wire, points } = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      Array.from({ length: 21 }, (_, i) => {
        const t = i / 20;
        const x = (t - 0.5) * span;
        const k = (x / (span / 2)) ** 2;
        return new THREE.Vector3(x, -sag * (1 - k), 0);
      }),
    );
    const geo = new THREE.TubeGeometry(curve, 48, 0.007, 5, false);
    const pts = Array.from({ length: bulbs }, (_, i) => {
      const t = (i + 0.5) / bulbs;
      const x = (t - 0.5) * span;
      const k = (x / (span / 2)) ** 2;
      return { x, y: -sag * (1 - k) };
    });
    return { wire: geo, points: pts };
  }, [span, sag, bulbs]);
  useEffect(() => () => wire.dispose(), [wire]);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={wire} castShadow>
        <PbrSurface color="#17171b" roughness={0.7} metalness={0.4} />
      </mesh>
      {points.map((p, i) => (
        <group key={i} position={[p.x, p.y, 0]}>
          <mesh position={[0, -0.02, 0]}>
            <cylinderGeometry args={[0.014, 0.011, 0.04, 8]} />
            <PbrSurface color="#1c1c20" roughness={0.6} metalness={0.5} />
          </mesh>
          <mesh position={[0, -0.06, 0]} scale={[1, 1.25, 1]}>
            <sphereGeometry args={[0.027, 10, 8]} />
            <meshBasicMaterial color={i % 3 === 0 ? '#fff3dd' : glow} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {lit && <pointLight position={[0, -sag - 0.4, 0]} intensity={4 * lightScale} distance={7} decay={2} color={glow} />}
      {/* end hooks */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * span) / 2, 0.03, 0]} material={m.dark} castShadow>
          <cylinderGeometry args={[0.02, 0.02, 0.07, 8]} />
        </mesh>
      ))}
    </group>
  );
});

/* ------------------------------------------------------- venetian window */

/**
 * Venetian-blind window — tilted slats in a timber frame with a cord and
 * tassel. `cast` adds the moonlight spot behind the slats so the blinds throw
 * their signature striped light across the set.
 */
export const VenetianWindow = memo(function VenetianWindow({
  position,
  rotation,
  scale = 1,
  width = 2.8,
  height = 2.5,
  slats = 13,
  tilt = 0.55,
  cast = true,
  beam = '#cfe0ff',
}: PlaceProps & {
  width?: number;
  height?: number;
  slats?: number;
  tilt?: number;
  cast?: boolean;
  beam?: string;
}) {
  const m = useStudioMaterials();
  const usable = height - 0.34;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* timber frame */}
      {[-1, 1].map((side) => (
        <RoundedBox key={side} args={[0.1, height, 0.14]} radius={0.02} smoothness={3} position={[(side * (width + 0.1)) / 2, 0, 0]} material={m.walnut} castShadow receiveShadow />
      ))}
      <RoundedBox args={[width + 0.24, 0.14, 0.18]} radius={0.025} smoothness={3} position={[0, height / 2 + 0.05, 0]} material={m.walnut} castShadow />
      <RoundedBox args={[width + 0.3, 0.09, 0.3]} radius={0.025} smoothness={3} position={[0, -height / 2 - 0.04, 0.05]} material={m.walnut} castShadow receiveShadow />
      {/* head rail */}
      <mesh position={[0, height / 2 - 0.1, 0.03]} material={m.dark} castShadow>
        <boxGeometry args={[width, 0.1, 0.1]} />
      </mesh>
      {/* glass */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[width, height - 0.06]} />
        <PbrSurface physical color="#cfe4f2" transparent opacity={0.07} roughness={0.03} metalness={0} clearcoat={1} depthWrite={false} />
      </mesh>

      {/* slats */}
      {Array.from({ length: slats }, (_, i) => {
        const y = -height / 2 + 0.2 + (i * (usable - 0.1)) / Math.max(1, slats - 1);
        return (
          <mesh key={i} position={[0, y, 0.03]} rotation={[tilt, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[width - 0.06, 0.008, 0.06]} />
            <PbrSurface color="#dcd7cd" roughness={0.55} normalScale={0.7} />
          </mesh>
        );
      })}
      {/* ladder tape + pull cord */}
      {[-0.32, 0.32].map((fx) => (
        <mesh key={fx} position={[fx * width, 0, 0.045]}>
          <boxGeometry args={[0.02, height - 0.24, 0.006]} />
          <PbrSurface color="#c9c3b6" roughness={0.9} />
        </mesh>
      ))}
      <group position={[width / 2 - 0.24, -0.1, 0.06]}>
        <mesh position={[0, -0.3, 0]}>
          <cylinderGeometry args={[0.005, 0.005, 0.9, 6]} />
          <PbrSurface color="#cfc9bc" roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.78, 0]} scale={[1, 1.5, 1]}>
          <cylinderGeometry args={[0.016, 0.02, 0.06, 10]} />
          <PbrSurface color="#b08d4f" metalness={1} roughness={0.34} />
        </mesh>
      </group>

      {/* moonlight raking through the slats */}
      {cast && (
        <spotLight
          position={[0, 0.1, -2.7]}
          angle={0.62}
          penumbra={0.35}
          intensity={52}
          distance={20}
          decay={2}
          color={beam}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-0.0004}
          shadow-normalBias={0.014}
          shadow-camera-near={0.5}
          shadow-camera-far={20}
        />
      )}
    </group>
  );
});

/* ------------------------------------------------------- bookcase wall */

const BOOK_COLORS = ['#8f2f2c', '#28447a', '#2f6141', '#a3762a', '#4a3b7c', '#1f5f66', '#6b5b4a', '#7a3a24'];

/** Floor-to-ceiling bookcase run — cornice, plinth, shelves packed with books. */
export const BookcaseWall = memo(function BookcaseWall({
  position,
  rotation,
  scale = 1,
  width = 4.4,
  height = 3.4,
  depth = 0.34,
}: PlaceProps & { width?: number; height?: number; depth?: number }) {
  const m = useStudioMaterials();
  const shelfCount = Math.max(4, Math.round(height / 0.62));
  const shelfGap = (height - 0.34) / shelfCount;
  const books = useMemo(() => {
    const rows: { x: number; w: number; h: number; c: string; flat: boolean }[][] = [];
    for (let s = 0; s < shelfCount; s += 1) {
      const row: { x: number; w: number; h: number; c: string; flat: boolean }[] = [];
      let x = -width / 2 + 0.1;
      let i = 0;
      while (x < width / 2 - 0.14 && i < 40) {
        const seed = s * 41 + i * 17;
        const flat = seed % 11 === 0;
        const w = flat ? 0.19 : 0.035 + (seed % 5) * 0.011;
        const h = flat ? 0.055 : 0.21 + (seed % 7) * 0.014;
        if (seed % 13 !== 0) {
          row.push({ x: x + w / 2, w, h, c: BOOK_COLORS[seed % BOOK_COLORS.length], flat });
        }
        x += w + 0.006;
        i += 1;
      }
      rows.push(row);
    }
    return rows;
  }, [shelfCount, width]);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* carcass */}
      <mesh position={[0, height / 2, -depth / 2 + 0.02]} receiveShadow material={m.walnut}>
        <boxGeometry args={[width, height, 0.04]} />
      </mesh>
      <mesh position={[0, 0.1, 0]} material={m.dark} castShadow receiveShadow>
        <boxGeometry args={[width, 0.2, depth]} />
      </mesh>
      <RoundedBox args={[width + 0.14, 0.11, depth + 0.07]} radius={0.02} smoothness={3} position={[0, height - 0.05, 0.01]} material={m.walnut} castShadow />
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * (width - 0.06)) / 2, height / 2, 0]} material={m.walnut} castShadow receiveShadow>
          <boxGeometry args={[0.06, height, depth]} />
        </mesh>
      ))}
      {Array.from({ length: shelfCount }, (_, s) => {
        const y = 0.2 + shelfGap * (s + 1);
        return (
          <group key={s}>
            <mesh position={[0, y, 0]} material={m.walnut} castShadow>
              <boxGeometry args={[width - 0.1, 0.035, depth - 0.05]} />
            </mesh>
            {books[s]?.map((b, i) => (
              <mesh key={i} position={[b.x, y + 0.018 + b.h / 2, 0.02]} rotation={[0, 0, b.flat ? 0 : ((i % 3) - 1) * 0.012]} castShadow>
                <boxGeometry args={[b.w, b.h, 0.17]} />
                <PbrSurface color={b.c} roughness={0.78} normalScale={0.9} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
});

/* ------------------------------------------------------- dumbbell rack */

/** Three-tier dumbbell rack with rubber-hex weights on chrome rails. */
export const DumbbellRack = memo(function DumbbellRack({
  position,
  rotation,
  scale = 1,
  width = 1.6,
  tiers = 3,
}: PlaceProps & { width?: number; tiers?: number }) {
  const m = useStudioMaterials();
  const heights = [0.32, 0.56, 0.8];
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* uprights + feet */}
      {[-1, 1].map((side) => (
        <group key={side} position={[(side * (width + 0.16)) / 2, 0, 0]}>
          <mesh position={[0, 0.48, 0]} rotation={[0, 0, side * -0.05]} material={m.metal} castShadow receiveShadow>
            <boxGeometry args={[0.07, 0.96, 0.3]} />
          </mesh>
          <RoundedBox args={[0.1, 0.05, 0.52]} radius={0.015} smoothness={3} position={[0, 0.025, 0]} material={m.dark} castShadow receiveShadow />
        </group>
      ))}
      {/* rails + dumbbells */}
      {heights.slice(0, tiers).map((y, ti) => (
        <group key={y}>
          {[-0.12, 0.12].map((z) => (
            <mesh key={z} position={[0, y, z]} rotation={[0, 0, Math.PI / 2]} material={m.chrome} castShadow>
              <cylinderGeometry args={[0.016, 0.016, width + 0.1, 12]} />
            </mesh>
          ))}
          {[-1, 0, 1].map((slot) => {
            const r = 0.05 + (tiers - ti - 1) * 0.008;
            return (
              <group key={slot} position={[slot * (width / 3.1), y + r + 0.03, 0]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.016, 0.016, 0.13, 10]} />
                  <PbrSurface color="#9ca3af" metalness={1} roughness={0.28} envMapIntensity={1.5} />
                </mesh>
                {[-1, 1].map((s) => (
                  <group key={s} position={[0, 0, s * 0.085]}>
                    <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                      <cylinderGeometry args={[r, r, 0.055, 18]} />
                      <PbrSurface color="#1b1b1f" roughness={0.68} metalness={0.18} />
                    </mesh>
                    <mesh position={[0, 0, s * 0.03]} rotation={[Math.PI / 2, 0, 0]}>
                      <torusGeometry args={[r * 0.82, 0.008, 6, 20]} />
                      <PbrSurface color="#6b7280" metalness={1} roughness={0.35} />
                    </mesh>
                  </group>
                ))}
              </group>
            );
          })}
        </group>
      ))}
    </group>
  );
});

/* ------------------------------------------------------------- drums */

/** Five-piece drum kit with chrome hardware, cymbals and throne. */
export const DrumKit = memo(function DrumKit({
  position,
  rotation,
  scale = 1,
  shell = '#7c2230',
}: PlaceProps & { shell?: string }) {
  const m = useStudioMaterials();
  const shellFace = <PbrSurface color={shell} physical clearcoat={0.75} clearcoatRoughness={0.2} roughness={0.32} metalness={0.3} />;
  const head = <PbrSurface color="#ece7dd" roughness={0.62} />;
  const chrome = <PbrSurface color="#c3c8d0" metalness={1} roughness={0.16} envMapIntensity={1.7} />;
  const brass = <PbrSurface color="#c9a44a" metalness={1} roughness={0.26} anisotropy={0.6} envMapIntensity={1.6} />;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* kick drum */}
      <group position={[0, 0.3, 0.04]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.29, 0.29, 0.4, 32]} />
          {shellFace}
        </mesh>
        {[0.2, -0.2].map((z) => (
          <mesh key={z} position={[0, 0, z]} castShadow>
            <torusGeometry args={[0.29, 0.017, 8, 40]} />
            {chrome}
          </mesh>
        ))}
        <mesh position={[0, 0, 0.205]}>
          <circleGeometry args={[0.275, 32]} />
          {head}
        </mesh>
        <mesh position={[0, 0, -0.205]} rotation={[0, Math.PI, 0]}>
          <circleGeometry args={[0.275, 32]} />
          {head}
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.24, -0.14, 0.1]} rotation={[0.2, 0, s * 0.3]} castShadow>
            <cylinderGeometry args={[0.012, 0.012, 0.34, 8]} />
            {chrome}
          </mesh>
        ))}
      </group>
      {/* mounted toms */}
      {[-0.18, 0.18].map((x) => (
        <group key={x} position={[x, 0.75, -0.04]} rotation={[0.38, 0, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.16, 0.16, 28]} />
            {shellFace}
          </mesh>
          <mesh position={[0, 0, 0.085]}>
            <circleGeometry args={[0.155, 28]} />
            {head}
          </mesh>
          <mesh position={[0, 0, 0.085]} castShadow>
            <torusGeometry args={[0.16, 0.013, 8, 32]} />
            {chrome}
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.58, -0.02]} castShadow>
        <cylinderGeometry args={[0.016, 0.016, 0.3, 10]} />
        {chrome}
      </mesh>
      {/* snare on its stand */}
      <group position={[-0.62, 0.58, 0.14]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.19, 0.19, 0.13, 28]} />
          {shellFace}
        </mesh>
        <mesh position={[0, 0.068, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.185, 28]} />
          {head}
        </mesh>
        <mesh position={[0, 0.068, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.19, 0.012, 8, 32]} />
          {chrome}
        </mesh>
        <mesh position={[0, -0.28, 0]} castShadow>
          <cylinderGeometry args={[0.014, 0.014, 0.56, 10]} />
          {chrome}
        </mesh>
        {[0, 1, 2].map((i) => (
          <group key={i} rotation={[0, (i / 3) * Math.PI * 2, 0]}>
            <mesh position={[0, -0.5, 0.16]} rotation={[0.5, 0, 0]} castShadow>
              <cylinderGeometry args={[0.01, 0.01, 0.34, 8]} />
              {chrome}
            </mesh>
          </group>
        ))}
      </group>
      {/* floor tom */}
      <group position={[0.64, 0.4, 0.12]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.22, 0.22, 0.36, 30]} />
          {shellFace}
        </mesh>
        <mesh position={[0, 0.185, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.215, 30]} />
          {head}
        </mesh>
        <mesh position={[0, 0.185, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.22, 0.014, 8, 34]} />
          {chrome}
        </mesh>
        {[0, 1, 2].map((i) => (
          <group key={i} rotation={[0, (i / 3) * Math.PI * 2, 0]}>
            <mesh position={[0.19, -0.2, 0]} rotation={[0, 0, 0.24]} castShadow>
              <cylinderGeometry args={[0.011, 0.011, 0.4, 8]} />
              {chrome}
            </mesh>
          </group>
        ))}
      </group>
      {/* hi-hat */}
      <group position={[-0.9, 0, 0.1]}>
        <mesh position={[0, 0.36, 0]} castShadow>
          <cylinderGeometry args={[0.013, 0.013, 0.72, 10]} />
          {chrome}
        </mesh>
        {[0, 1, 2].map((i) => (
          <group key={i} rotation={[0, (i / 3) * Math.PI * 2, 0]}>
            <mesh position={[0, 0.03, 0.13]} rotation={[0.4, 0, 0]} castShadow>
              <cylinderGeometry args={[0.01, 0.01, 0.28, 8]} />
              {chrome}
            </mesh>
          </group>
        ))}
        {[0.7, 0.715].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.17, 0.17, 0.007, 28]} />
            {brass}
          </mesh>
        ))}
      </group>
      {/* crash + ride */}
      {[
        { x: -0.48, y: 1.0, r: 0.19, tilt: 0.3 },
        { x: 0.78, y: 0.95, r: 0.21, tilt: -0.24 },
      ].map((c) => (
        <group key={c.x} position={[c.x, 0, -0.1]}>
          <mesh position={[0, c.y / 2, 0]} castShadow>
            <cylinderGeometry args={[0.012, 0.012, c.y, 10]} />
            {chrome}
          </mesh>
          <mesh position={[0, c.y, 0]} rotation={[Math.PI / 2 - c.tilt, 0, 0]} castShadow>
            <cylinderGeometry args={[c.r, c.r * 0.86, 0.008, 30]} />
            {brass}
          </mesh>
          {[0, 1, 2].map((i) => (
            <group key={i} rotation={[0, (i / 3) * Math.PI * 2, 0]}>
              <mesh position={[0, 0.06, 0.14]} rotation={[0.42, 0, 0]} castShadow>
                <cylinderGeometry args={[0.01, 0.01, 0.3, 8]} />
                {chrome}
              </mesh>
            </group>
          ))}
        </group>
      ))}
      {/* throne */}
      <group position={[0, 0, -0.62]}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.17, 0.17, 0.09, 22]} />
          <PbrSurface color="#16161a" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.26, 0]} castShadow>
          <cylinderGeometry args={[0.02, 0.02, 0.42, 10]} />
          {chrome}
        </mesh>
        {[0, 1, 2].map((i) => (
          <group key={i} rotation={[0, (i / 3) * Math.PI * 2, 0]}>
            <mesh position={[0, 0.05, 0.15]} rotation={[0.5, 0, 0]} castShadow>
              <cylinderGeometry args={[0.011, 0.011, 0.3, 8]} />
              {chrome}
            </mesh>
          </group>
        ))}
      </group>
      {/* pedal */}
      <group position={[0, 0, 0.4]}>
        <mesh position={[0, 0.02, 0]} rotation={[-0.1, 0, 0]} material={m.dark} castShadow>
          <boxGeometry args={[0.1, 0.02, 0.28]} />
        </mesh>
        <mesh position={[0, 0.08, -0.06]} rotation={[0.5, 0, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 0.14, 8]} />
          {chrome}
        </mesh>
      </group>
    </group>
  );
});

/* ------------------------------------------------------------ keyboard */

/** Stage keyboard on a folding X-stand. */
export const KeyboardStand = memo(function KeyboardStand({
  position,
  rotation,
  scale = 1,
}: PlaceProps) {
  const m = useStudioMaterials();
  const keys = useMemo(() => {
    const pattern = [1, 1, 0, 1, 1, 1, 0]; // white, white, black, white…
    return Array.from({ length: 21 }, (_, i) => ({
      x: -0.66 + i * 0.066,
      black: pattern[i % 7] === 0,
    }));
  }, []);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* X frame */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[0, 0.36, 0]} rotation={[0, 0, s * 0.6]} material={m.metal} castShadow>
          <boxGeometry args={[1.05, 0.05, 0.05]} />
        </mesh>
      ))}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <mesh position={[sx * 0.44, 0.02, 0]} material={m.dark} castShadow receiveShadow>
            <boxGeometry args={[0.1, 0.04, 0.42]} />
          </mesh>
          <mesh position={[sx * 0.42, 0.71, 0]} rotation={[0, 0, -sx * 0.06]} material={m.dark} castShadow>
            <boxGeometry args={[0.14, 0.05, 0.34]} />
          </mesh>
        </group>
      ))}
      {/* keyboard body + keybed */}
      <RoundedBox args={[1.44, 0.09, 0.38]} radius={0.02} smoothness={3} position={[0, 0.77, 0]} material={m.dark} castShadow receiveShadow />
      <mesh position={[0, 0.817, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.3, 0.17]} />
        <PbrSurface color="#f4f1ea" roughness={0.42} />
      </mesh>
      {keys
        .filter((k) => !k.black)
        .map((k, i) => (
          <mesh key={`w${i}`} position={[k.x + 0.033, 0.82, 0.1]}>
            <boxGeometry args={[0.055, 0.012, 0.16]} />
            <PbrSurface color="#f7f5ef" roughness={0.4} />
          </mesh>
        ))}
      {keys
        .filter((k) => k.black)
        .map((k, i) => (
          <mesh key={`b${i}`} position={[k.x + 0.05, 0.828, 0.06]}>
            <boxGeometry args={[0.03, 0.014, 0.1]} />
            <PbrSurface color="#141416" roughness={0.35} />
          </mesh>
        ))}
      {/* control strip + status LEDs */}
      <mesh position={[0, 0.822, -0.11]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.3, 0.09]} />
        <PbrSurface color="#202026" roughness={0.5} metalness={0.4} />
      </mesh>
      {[-0.5, -0.42, -0.34].map((x) => (
        <mesh key={x} position={[x, 0.83, -0.1]}>
          <circleGeometry args={[0.011, 10]} />
          <meshBasicMaterial color="#22d3ee" toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0.4, 0.83, -0.1]}>
        <planeGeometry args={[0.2, 0.05]} />
        <meshBasicMaterial color="#0f1b2a" toneMapped={false} />
      </mesh>
    </group>
  );
});

/* ------------------------------------------------------------ seating */

/**
 * Row of audience seats (plus optional tier riser) — the dark seat-back
 * silhouette that reads a hall full of people at the frame edge.
 */
export const SeatRow = memo(function SeatRow({
  position,
  rotation,
  scale = 1,
  width = 10,
  seats = 10,
  color = '#171a21',
  riser = 0,
}: PlaceProps & { width?: number; seats?: number; color?: string; riser?: number }) {
  const seatPitch = width / seats;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {riser > 0 && (
        <RoundedBox args={[width + 0.4, riser, 1.5]} radius={0.02} smoothness={2} position={[0, riser / 2, 0]} receiveShadow castShadow>
          <PbrSurface color="#101216" roughness={0.9} />
        </RoundedBox>
      )}
      {Array.from({ length: seats }, (_, i) => {
        const x = -width / 2 + seatPitch * (i + 0.5);
        return (
          <group key={i} position={[x, riser, 0]}>
            <mesh position={[0, 0.24, 0]}>
              <boxGeometry args={[0.06, 0.48, 0.06]} />
              <PbrSurface color="#0d0f13" roughness={0.7} metalness={0.3} />
            </mesh>
            <RoundedBox args={[seatPitch - 0.07, 0.09, 0.42]} radius={0.03} smoothness={3} position={[0, 0.47, 0.04]} castShadow receiveShadow>
              <PbrSurface color={color} roughness={0.94} normalScale={1.3} sheen={0.4} sheenColor="#6b7280" />
            </RoundedBox>
            <RoundedBox args={[seatPitch - 0.07, 0.5, 0.1]} radius={0.04} smoothness={3} position={[0, 0.74, -0.16]} rotation={[-0.1, 0, 0]} castShadow>
              <PbrSurface color={color} roughness={0.94} normalScale={1.3} sheen={0.4} sheenColor="#6b7280" />
            </RoundedBox>
          </group>
        );
      })}
    </group>
  );
});

/* ---------------------------------------------------------- desk lamp */

/** Brass desk lamp with a glowing glass shade — banker's-lamp practical. */
export const DeskLamp = memo(function DeskLamp({
  position,
  rotation,
  scale = 1,
  glow = '#ffd9a0',
  shade = '#f3ead6',
}: PlaceProps & { glow?: string; shade?: string }) {
  const lit = useLightSlot(PRACTICAL_LIGHT_PRIORITY);
  const lightScale = usePracticalLightScale();
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh position={[0, 0.012, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.085, 0.095, 0.024, 24]} />
        <PbrSurface color="#b08d4f" metalness={1} roughness={0.3} envMapIntensity={1.6} />
      </mesh>
      <mesh position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.06, 0.04, 20]} />
        <PbrSurface color="#b08d4f" metalness={1} roughness={0.32} envMapIntensity={1.5} />
      </mesh>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.011, 0.013, 0.3, 14]} />
        <PbrSurface color="#b08d4f" metalness={1} roughness={0.3} envMapIntensity={1.6} />
      </mesh>
      <mesh position={[0.03, 0.37, 0]} rotation={[0, 0, -0.35]} castShadow>
        <cylinderGeometry args={[0.01, 0.01, 0.16, 12]} />
        <PbrSurface color="#b08d4f" metalness={1} roughness={0.3} envMapIntensity={1.6} />
      </mesh>
      {/* shade + bulb */}
      <mesh position={[0.055, 0.46, 0]}>
        <cylinderGeometry args={[0.05, 0.12, 0.14, 24, 1, true]} />
        <PbrSurface color={shade} emissive={glow} emissiveIntensity={1.5} side={THREE.DoubleSide} roughness={0.6} toneMapped={false} />
      </mesh>
      <mesh position={[0.055, 0.43, 0]}>
        <sphereGeometry args={[0.036, 12, 10]} />
        <meshBasicMaterial color={glow} toneMapped={false} />
      </mesh>
      {lit && <pointLight position={[0.055, 0.4, 0]} intensity={3.4 * lightScale} distance={4.6} decay={2} color={glow} />}
    </group>
  );
});

/* ------------------------------------------------------------ holo desk */

/**
 * Floating glass anchor desk — a thick transmission-glass top hovering over a
 * black-glass plinth, lit by an accent channel along the fascia. The hero
 * furniture of the premium holographic news set.
 */
export const HoloDesk = memo(function HoloDesk({
  position,
  rotation,
  scale = 1,
  width = 3.8,
  accent = '#06b6d4',
}: PlaceProps & { width?: number; accent?: string }) {
  const m = useStudioMaterials();
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* floating glass top */}
      <RoundedBox args={[width, 0.055, 1.16]} radius={0.022} smoothness={4} position={[0, 0.775, 0]} castShadow receiveShadow>
        <PbrSurface
          physical
          color="#e4f6ff"
          transmission={0.92}
          thickness={0.06}
          ior={1.46}
          roughness={0.04}
          clearcoat={1}
          clearcoatRoughness={0.03}
          envMapIntensity={1.6}
        />
      </RoundedBox>
      {/* metal sub-frame tucked under the slab */}
      <RoundedBox args={[width - 0.5, 0.07, 0.94]} radius={0.02} smoothness={3} position={[0, 0.71, 0]} material={m.dark} castShadow />
      {/* recessed plinth the desk floats over */}
      <RoundedBox args={[width * 0.5, 0.62, 0.66]} radius={0.035} smoothness={4} position={[0, 0.31, -0.06]} material={m.blackGlass} castShadow receiveShadow />
      {/* accent channel along the fascia + light line on the plinth */}
      <mesh position={[0, 0.655, 0.485]}>
        <planeGeometry args={[width - 0.34, 0.07]} />
        <PbrSurface color={accent} emissive={accent} emissiveIntensity={2.6} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.34, 0.28]}>
        <planeGeometry args={[width * 0.42, 0.035]} />
        <PbrSurface color={accent} emissive={accent} emissiveIntensity={2.2} toneMapped={false} />
      </mesh>
      {/* pool of accent light on the floor under the plinth */}
      <mesh position={[0, 0.008, -0.04]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[width * 0.34, 48]} />
        <meshBasicMaterial color={accent} transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* cable grommet in the glass */}
      <mesh position={[width / 2 - 0.5, 0.806, -0.36]}>
        <cylinderGeometry args={[0.05, 0.05, 0.012, 20]} />
        <PbrSurface color="#101014" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* brushed foot rail */}
      <mesh position={[0, 0.1, 0.3]} rotation={[0, 0, Math.PI / 2]} material={m.chrome} castShadow>
        <cylinderGeometry args={[0.02, 0.02, width * 0.44, 14]} />
      </mesh>
    </group>
  );
});
