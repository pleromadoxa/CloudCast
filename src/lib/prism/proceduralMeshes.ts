import * as THREE from 'three';
import { pbrFromTexture, pbrSolid } from './pbrMaterials';

export type MeshBuilder = (variant: number) => THREE.Group;

const PALETTES = [
  { primary: '#3f3f46', accent: '#71717a', wood: '#78350f', fabric: '#44403c', metal: '#a1a1aa' },
  { primary: '#1e3a5f', accent: '#3b82f6', wood: '#92400e', fabric: '#1e40af', metal: '#94a3b8' },
  { primary: '#14532d', accent: '#22c55e', wood: '#713f12', fabric: '#166534', metal: '#86efac' },
  { primary: '#4c1d95', accent: '#a855f7', wood: '#5c4033', fabric: '#581c87', metal: '#c4b5fd' },
  { primary: '#7f1d1d', accent: '#ef4444', wood: '#6b4423', fabric: '#991b1b', metal: '#fca5a5' },
  { primary: '#134e4a', accent: '#14b8a6', wood: '#854d0e', fabric: '#115e59', metal: '#5eead4' },
  { primary: '#312e81', accent: '#6366f1', wood: '#44403c', fabric: '#3730a3', metal: '#a5b4fc' },
  { primary: '#422006', accent: '#f59e0b', wood: '#92400e', fabric: '#78350f', metal: '#fcd34d' },
];

function pal(variant: number) {
  return PALETTES[variant % PALETTES.length];
}

function mat(
  color: string,
  opts: {
    metalness?: number;
    roughness?: number;
    emissive?: string;
    emissiveIntensity?: number;
    transparent?: boolean;
    opacity?: number;
    side?: THREE.Side;
    envMapIntensity?: number;
  } = {},
) {
  return pbrSolid(color, opts);
}

function fabricMat(v: number) {
  const kinds = ['fabric_linen', 'fabric_velvet', 'leather'] as const;
  return pbrFromTexture(kinds[v % kinds.length], v, { roughness: 0.88, envMapIntensity: 0.6 });
}

function woodMat(v: number) {
  return pbrFromTexture(v % 2 === 0 ? 'wood_oak' : 'wood_walnut', v, { roughness: 0.42, envMapIntensity: 0.8 });
}

function metalMat(color: string, v = 0) {
  const brushed = pbrFromTexture('metal_brushed', v, { metalness: 0.92, roughness: 0.22 });
  brushed.color = new THREE.Color(color);
  return brushed;
}

function box(w: number, h: number, d: number, material: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cyl(rt: number, rb: number, h: number, material: THREE.Material, x = 0, y = 0, z = 0, seg = 16) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildCouch(v: number): THREE.Group {
  const g = new THREE.Group();
  const w = 2.0 + (v % 4) * 0.12;
  const d = 0.92 + (v % 3) * 0.04;
  const fabric = fabricMat(v);
  const leg = metalMat('#71717a', v);
  const cushionH = 0.22;
  const seatY = 0.38;
  g.add(box(w, 0.14, d, woodMat(v), 0, 0.07, 0));
  g.add(box(w - 0.08, cushionH, d - 0.06, fabric, 0, seatY, 0.02));
  g.add(box(w - 0.06, 0.38, 0.16, fabric, 0, seatY + cushionH + 0.08, -d / 2 + 0.1));
  g.add(box(0.18, 0.52, d - 0.04, fabric, -w / 2 + 0.1, seatY + 0.06, 0));
  g.add(box(0.18, 0.52, d - 0.04, fabric, w / 2 - 0.1, seatY + 0.06, 0));
  for (let i = 0; i < 3 + (v % 2); i++) {
    const cx = -w / 2 + 0.35 + i * ((w - 0.5) / (2 + (v % 2)));
    g.add(box(0.38, 0.06, 0.38, fabric, cx, seatY + cushionH + 0.02, 0.05));
  }
  for (const x of [-w / 2 + 0.14, w / 2 - 0.14]) {
    for (const z of [-d / 2 + 0.12, d / 2 - 0.12]) {
      g.add(cyl(0.025, 0.022, 0.26, leg, x, 0, z));
      g.add(cyl(0.035, 0.035, 0.008, metalMat('#a8a29e', v), x, 0.26, z));
    }
  }
  g.add(box(w - 0.04, 0.04, d, pbrFromTexture('leather', v + 1, { roughness: 0.75 }), 0, seatY - 0.02, 0));
  return g;
}

function buildArmchair(v: number): THREE.Group {
  const g = new THREE.Group();
  const fabric = fabricMat(v + 2);
  const leg = metalMat('#78716c', v);
  g.add(box(0.82, 0.16, 0.82, woodMat(v), 0, 0.08, 0));
  g.add(box(0.78, 0.24, 0.78, fabric, 0, 0.28, 0.02));
  g.add(box(0.78, 0.42, 0.16, fabric, 0, 0.5, -0.33));
  g.add(box(0.14, 0.48, 0.78, fabric, -0.34, 0.28, 0));
  g.add(box(0.14, 0.48, 0.78, fabric, 0.34, 0.28, 0));
  for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
    g.add(cyl(0.022, 0.02, 0.24, leg, x, 0, z));
  }
  return g;
}

function buildCoffeeTable(v: number): THREE.Group {
  const g = new THREE.Group();
  const w = 1.1 + (v % 3) * 0.15;
  const top = woodMat(v);
  const leg = metalMat('#a1a1aa', v);
  g.add(box(w, 0.04, w * 0.58, top, 0, 0.44, 0));
  g.add(box(w - 0.06, 0.012, w * 0.52, pbrSolid('#292524', { roughness: 0.3 }), 0, 0.462, 0));
  for (const [x, z] of [[-w / 2 + 0.08, -w * 0.24], [w / 2 - 0.08, -w * 0.24], [-w / 2 + 0.08, w * 0.24], [w / 2 - 0.08, w * 0.24]]) {
    g.add(cyl(0.022, 0.018, 0.44, leg, x, 0, z));
  }
  return g;
}

function buildDiningTable(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  const w = 1.4 + (v % 4) * 0.2;
  g.add(box(w, 0.06, w * 0.55, mat(p.wood), 0, 0.74, 0));
  for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) {
    for (const z of [-w * 0.2, w * 0.2]) {
      g.add(box(0.06, 0.74, 0.06, mat(p.wood), x, 0, z));
    }
  }
  return g;
}

function buildDesk(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  const w = 1.2 + (v % 3) * 0.2;
  g.add(box(w, 0.05, 0.65, mat(p.wood), 0, 0.72, 0));
  g.add(box(w, 0.02, 0.65, mat(p.accent, { emissive: p.accent, emissiveIntensity: 0.15 }), 0, 0.745, 0));
  g.add(box(0.05, 0.72, 0.5, mat(p.metal, { metalness: 0.6 }), -w / 2 + 0.15, 0, 0));
  g.add(box(0.05, 0.72, 0.5, mat(p.metal, { metalness: 0.6 }), w / 2 - 0.15, 0, 0));
  return g;
}

function buildBed(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  g.add(box(1.6, 0.35, 2.0, mat(p.fabric, { roughness: 0.9 }), 0, 0.175, 0));
  g.add(box(1.6, 0.12, 2.0, mat(p.wood), 0, 0.06, 0));
  g.add(box(1.6, 0.55, 0.12, mat(p.fabric), 0, 0.52, -0.94));
  g.add(box(0.5, 0.12, 0.35, mat('#f8fafc'), 0, 0.47, -0.75));
  return g;
}

function buildBookshelf(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  const h = 1.6 + (v % 3) * 0.2;
  g.add(box(0.9, h, 0.35, mat(p.wood), 0, 0, 0));
  for (let i = 1; i <= 4; i++) {
    g.add(box(0.86, 0.03, 0.31, mat(p.wood), 0, (h / 5) * i, 0));
    g.add(box(0.08, 0.22, 0.25, mat(p.accent), -0.25 + (i % 3) * 0.15, (h / 5) * i + 0.12, 0));
  }
  return g;
}

function buildWardrobe(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  g.add(box(1.2, 2.0, 0.55, mat(p.wood), 0, 0, 0));
  g.add(box(0.02, 1.9, 0.52, mat(p.metal, { metalness: 0.5 }), 0, 1.0, 0.26));
  g.add(cyl(0.02, 0.02, 0.08, mat(p.metal, { metalness: 0.9 }), 0.15, 1.0, 0.3));
  return g;
}

function buildWallPanel(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  const w = 2.5 + (v % 4) * 0.5;
  const h = 2.8 + (v % 3) * 0.4;
  g.add(box(w, h, 0.12, mat(p.primary), 0, h / 2, 0));
  if (v % 2 === 0) {
    g.add(box(w - 0.2, h - 0.2, 0.02, mat(p.accent, { emissive: p.accent, emissiveIntensity: 0.08 }), 0, h / 2, 0.07));
  }
  return g;
}

function buildWallCorner(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  g.add(box(0.12, 2.8, 2.5, mat(p.primary), -1.19, 1.4, 0));
  g.add(box(2.5, 2.8, 0.12, mat(p.primary), 0, 1.4, -1.19));
  return g;
}

function buildDoor(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  g.add(box(1.0, 2.1, 0.08, mat(p.wood), 0, 1.05, 0));
  g.add(cyl(0.03, 0.03, 0.04, mat(p.metal, { metalness: 0.85 }), 0.35, 1.0, 0.05, 8));
  g.add(box(1.15, 2.25, 0.06, mat(p.primary), 0, 1.125, -0.02));
  return g;
}

function buildWindow(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  g.add(box(1.4, 1.2, 0.06, mat(p.primary), 0, 1.5, 0));
  g.add(box(1.2, 1.0, 0.02, mat('#93c5fd', { emissive: '#60a5fa', emissiveIntensity: 0.25 }), 0, 1.5, 0.04));
  g.add(box(0.04, 1.0, 0.03, mat(p.metal), 0, 1.5, 0.045));
  g.add(box(1.2, 0.04, 0.03, mat(p.metal), 0, 1.5, 0.045));
  return g;
}

function buildPillar(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  const h = 2.8 + (v % 3) * 0.5;
  g.add(cyl(0.18, 0.22, h, mat(p.primary, { metalness: 0.4, roughness: 0.35 }), 0, 0, 0));
  g.add(cyl(0.28, 0.28, 0.12, mat(p.accent), 0, h, 0));
  g.add(cyl(0.32, 0.32, 0.08, mat(p.primary), 0, 0, 0));
  return g;
}

function buildStairs(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  const steps = 5 + (v % 3);
  for (let i = 0; i < steps; i++) {
    g.add(box(0.35, 0.18, 0.35 + i * 0.35, mat(p.primary), 0, i * 0.18, -i * 0.175));
  }
  return g;
}

function buildHouseShell(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  g.add(box(4.5, 2.8, 3.5, mat(p.primary), 0, 1.4, -1.5));
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(3.4, 1.4, 4),
    mat(p.accent, { roughness: 0.5 }),
  );
  roof.position.set(0, 3.2, -1.5);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);
  g.add(box(0.9, 1.8, 0.08, mat(p.wood), 0.8, 0.9, 0.26));
  g.add(buildWindow(v).clone().translateX(-1.2).translateY(0).translateZ(0.3));
  return g;
}

function buildStagePlatform(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  const w = 3.5 + (v % 3);
  g.add(box(w, 0.35, 2.0, mat('#18181b'), 0, 0.175, -0.5));
  g.add(box(w + 0.1, 0.05, 2.1, mat(p.accent, { emissive: p.accent, emissiveIntensity: 0.35 }), 0, 0.355, -0.5));
  return g;
}

function buildTruss(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  const w = 3.0 + (v % 2);
  const m = mat(p.metal, { metalness: 0.85, roughness: 0.25 });
  g.add(box(w, 0.08, 0.08, m, 0, 3.2, -2));
  g.add(box(0.08, 3.2, 0.08, m, -w / 2, 1.6, -2));
  g.add(box(0.08, 3.2, 0.08, m, w / 2, 1.6, -2));
  for (let i = 0; i < 4; i++) {
    const x = -w / 2 + (w / 3) * i;
    g.add(box(0.04, 2.8, 0.04, m, x, 1.6, -2));
  }
  return g;
}

function buildSpotlight(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  g.add(cyl(0.04, 0.04, 2.5, mat(p.metal, { metalness: 0.7 }), 0, 2.5, -1.5));
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.35, 12), mat('#27272a', { metalness: 0.6 }));
  head.position.set(0, 3.6, -1.5);
  head.rotation.x = Math.PI;
  g.add(head);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 1.2, 12, 1, true),
    mat('#fbbf24', { emissive: '#fbbf24', emissiveIntensity: 0.6, transparent: true, opacity: 0.15 }),
  );
  beam.position.set(0, 3.2, -1.2);
  beam.rotation.x = Math.PI;
  g.add(beam);
  return g;
}

function buildCurtain(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  const w = 3.0 + (v % 2) * 0.5;
  g.add(box(w, 0.08, 0.08, mat(p.metal, { metalness: 0.7 }), 0, 2.8, -2.5));
  for (let i = 0; i < 6; i++) {
    g.add(box(w / 6 - 0.02, 2.6, 0.06, mat(p.fabric, { roughness: 0.95 }), -w / 2 + (w / 6) * (i + 0.5), 1.4, -2.48));
  }
  return g;
}

function buildNewsDesk(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  const w = 2.2 + (v % 3) * 0.3;
  g.add(box(w, 0.12, 0.7, mat(p.primary, { metalness: 0.5, roughness: 0.35 }), 0, 0.72, 0));
  g.add(box(w, 0.04, 0.72, mat(p.accent, { emissive: p.accent, emissiveIntensity: 0.2 }), 0, 0.78, 0));
  g.add(box(0.35, 0.55, 0.35, mat(p.primary), -w / 2 + 0.25, 0.275, 0));
  g.add(box(0.35, 0.55, 0.35, mat(p.primary), w / 2 - 0.25, 0.275, 0));
  return g;
}

function buildMonitorWall(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  const cols = 2 + (v % 3);
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < 2; r++) {
      g.add(box(0.55, 0.35, 0.04, mat('#0a0a0a'), -0.55 + c * 0.6, 1.6 + r * 0.4, -2.8));
      g.add(box(0.48, 0.28, 0.01, mat(p.accent, { emissive: p.accent, emissiveIntensity: 0.45 }), -0.55 + c * 0.6, 1.6 + r * 0.4, -2.76));
    }
  }
  return g;
}

function buildNewsChair(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  g.add(box(0.5, 0.08, 0.5, mat(p.primary), 0, 0.45, 0));
  g.add(box(0.5, 0.55, 0.08, mat(p.primary), 0, 0.72, -0.21));
  g.add(cyl(0.03, 0.03, 0.45, mat(p.metal, { metalness: 0.8 }), 0, 0, 0));
  return g;
}

function buildTeleprompter(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  g.add(box(0.6, 0.35, 0.04, mat('#0a0a0a'), 0, 1.1, -0.35));
  g.add(box(0.52, 0.28, 0.01, mat('#22c55e', { emissive: '#22c55e', emissiveIntensity: 0.3 }), 0, 1.1, -0.32));
  g.add(cyl(0.02, 0.02, 1.0, mat(p.metal, { metalness: 0.7 }), 0, 0.5, -0.35));
  return g;
}

function buildChurchPulpit(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  g.add(box(0.9, 1.0, 0.55, mat(p.wood, { roughness: 0.4 }), 0, 0.5, -0.3));
  g.add(box(0.95, 0.08, 0.6, mat(p.wood), 0, 1.0, -0.3));
  g.add(box(0.15, 0.6, 0.08, mat(p.accent, { emissive: p.accent, emissiveIntensity: 0.15 }), 0, 0.7, -0.55));
  return g;
}

function buildChurchPew(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  g.add(box(2.0, 0.45, 0.55, mat(p.wood), 0, 0.225, 0));
  g.add(box(2.0, 0.55, 0.08, mat(p.wood), 0, 0.55, -0.235));
  for (const x of [-0.85, 0.85]) {
    g.add(box(0.08, 0.45, 0.55, mat(p.wood), x, 0.225, 0));
  }
  return g;
}

function buildCross(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  const m = mat(p.accent, { emissive: p.accent, emissiveIntensity: 0.2, metalness: 0.6 });
  g.add(box(0.12, 1.4, 0.12, m, 0, 1.5, -2.5));
  g.add(box(0.8, 0.12, 0.12, m, 0, 1.85, -2.5));
  return g;
}

function buildAltar(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  g.add(box(1.6, 0.9, 0.8, mat(p.wood, { roughness: 0.35 }), 0, 0.45, -0.8));
  g.add(box(1.7, 0.06, 0.85, mat(p.accent, { metalness: 0.7 }), 0, 0.9, -0.8));
  return g;
}

function buildChoirRiser(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  for (let i = 0; i < 3; i++) {
    g.add(box(3.5, 0.25 + i * 0.15, 1.2, mat(p.primary), 0, (0.25 + i * 0.15) / 2 + i * 0.15, -2.5 - i * 0.6));
  }
  return g;
}

function buildKitchenCounter(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  const w = 2.0 + (v % 3) * 0.4;
  g.add(box(w, 0.9, 0.65, mat(p.primary), 0, 0.45, 0));
  g.add(box(w, 0.04, 0.68, mat('#e7e5e4', { roughness: 0.2, metalness: 0.1 }), 0, 0.92, 0));
  g.add(box(0.55, 0.02, 0.4, mat(p.metal, { metalness: 0.5 }), -w / 4, 0.945, 0.05));
  return g;
}

function buildKitchenIsland(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  g.add(box(1.4, 0.9, 0.85, mat(p.primary), 0, 0.45, 0));
  g.add(box(1.42, 0.05, 0.87, mat('#f5f5f4'), 0, 0.925, 0));
  return g;
}

function buildKitchenCabinet(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  g.add(box(0.6, 0.85, 0.55, mat(p.primary), 0, 0.425, 0));
  g.add(cyl(0.015, 0.015, 0.06, mat(p.metal, { metalness: 0.9 }), 0.15, 0.5, 0.28));
  return g;
}

function buildFridge(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  g.add(box(0.75, 1.8, 0.7, mat('#e5e7eb', { metalness: 0.3, roughness: 0.25 }), 0, 0.9, 0));
  g.add(box(0.76, 0.02, 0.71, mat(p.metal, { metalness: 0.8 }), 0, 1.15, 0.35));
  return g;
}

function buildStove(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  g.add(box(0.65, 0.9, 0.6, mat(p.primary), 0, 0.45, 0));
  for (const [x, z] of [[-0.15, -0.1], [0.15, -0.1], [-0.15, 0.15], [0.15, 0.15]]) {
    g.add(cyl(0.08, 0.08, 0.02, mat('#27272a', { metalness: 0.9 }), x, 0.915, z));
  }
  return g;
}

function buildSink(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  g.add(box(0.55, 0.85, 0.55, mat(p.primary), 0, 0.425, 0));
  g.add(box(0.35, 0.18, 0.35, mat(p.metal, { metalness: 0.85, roughness: 0.15 }), 0, 0.88, 0));
  g.add(cyl(0.025, 0.025, 0.25, mat(p.metal, { metalness: 0.9 }), 0, 1.05, -0.15));
  return g;
}

function buildPlant(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  g.add(cyl(0.15, 0.12, 0.25, mat('#78716c'), 0, 0.125, 0));
  for (let i = 0; i < 5 + (v % 4); i++) {
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.12 + (i % 2) * 0.04, 8, 8),
      mat(p.accent, { roughness: 0.8 }),
    );
    leaf.position.set(Math.sin(i) * 0.15, 0.35 + i * 0.08, Math.cos(i) * 0.15);
    leaf.castShadow = true;
    g.add(leaf);
  }
  return g;
}

function buildFloorLamp(v: number): THREE.Group {
  const g = new THREE.Group();
  const pole = metalMat('#78716c', v);
  g.add(cyl(0.028, 0.035, 1.55, pole, 0, 0.775, 0));
  g.add(cyl(0.14, 0.14, 0.015, metalMat('#52525b', v), 0, 0.008, 0));
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.26, 0.32, 24, 1, true),
    pbrSolid('#fef3c7', { emissive: '#fbbf24', emissiveIntensity: 0.45, roughness: 0.6, side: THREE.DoubleSide }),
  );
  shade.position.set(0, 1.58, 0);
  shade.castShadow = true;
  g.add(shade);
  g.add(box(0.32, 0.02, 0.32, woodMat(v), 0, 1.42, 0));
  const bulb = new THREE.PointLight('#fde68a', 0.35, 4);
  bulb.position.set(0, 1.5, 0);
  g.add(bulb);
  return g;
}

function buildRug(v: number): THREE.Group {
  const g = new THREE.Group();
  const w = 2.0 + (v % 3) * 0.35;
  const carpet = pbrFromTexture('carpet', v, { roughness: 0.95, envMapIntensity: 0.35 });
  g.add(box(w, 0.018, w * 0.68, carpet, 0, 0.009, 0));
  g.add(box(w - 0.12, 0.006, w * 0.56, pbrFromTexture('carpet', v + 5, { roughness: 0.98 }), 0, 0.016, 0));
  return g;
}

function buildTvScreen(v: number): THREE.Group {
  const g = new THREE.Group();
  const sz = 0.85 + (v % 3) * 0.18;
  const frameW = sz * 1.65;
  const frameH = sz * 1.02;
  const y = sz / 2 + 0.55;
  const z = -2.48;
  const bezel = pbrSolid('#18181b', { metalness: 0.55, roughness: 0.28, envMapIntensity: 1.2 });
  const screen = pbrFromTexture('screen_glow', v, {
    emissive: v % 2 === 0 ? '#38bdf8' : '#6366f1',
    emissiveIntensity: 0.55,
    roughness: 0.15,
    metalness: 0.05,
  });
  g.add(box(frameW, frameH, 0.045, bezel, 0, y, z));
  g.add(box(frameW - 0.06, frameH - 0.06, 0.008, screen, 0, y, z + 0.024));
  g.add(box(0.06, 0.04, frameW * 0.7, pbrSolid('#27272a', { metalness: 0.7, roughness: 0.2 }), 0, y + frameH / 2 - 0.02, z + 0.02));
  if (v % 3 === 0) {
    g.add(box(0.12, 0.35, 0.1, metalMat('#52525b', v), 0, 0.175, z + 0.05));
    g.add(box(0.5, 0.025, 0.22, metalMat('#3f3f46', v), 0, 0.012, z + 0.12));
  } else {
    g.add(box(0.04, 0.25, 0.04, metalMat('#71717a', v), -0.15, y - frameH / 2 - 0.125, z + 0.04));
    g.add(box(0.04, 0.25, 0.04, metalMat('#71717a', v), 0.15, y - frameH / 2 - 0.125, z + 0.04));
    g.add(box(0.35, 0.025, 0.08, metalMat('#52525b', v), 0, y - frameH / 2 - 0.24, z + 0.04));
  }
  const led = pbrSolid('#ef4444', { emissive: '#ef4444', emissiveIntensity: 0.8 });
  g.add(box(0.008, 0.008, 0.008, led, frameW / 2 - 0.04, y - frameH / 2 + 0.04, z + 0.03));
  return g;
}

function buildPodium(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  g.add(cyl(0.25, 0.3, 1.0, mat(p.primary), 0, 0.5, 0));
  g.add(box(0.55, 0.08, 0.45, mat(p.accent, { metalness: 0.4 }), 0, 1.04, 0));
  return g;
}

function buildConferenceTable(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  g.add(box(2.8, 0.08, 1.2, mat(p.wood), 0, 0.74, 0));
  for (const x of [-1.2, 1.2]) {
    g.add(box(0.08, 0.74, 1.0, mat(p.metal, { metalness: 0.6 }), x, 0, 0));
  }
  return g;
}

function buildOfficeChair(v: number): THREE.Group {
  const g = new THREE.Group();
  const fabric = fabricMat(v + 4);
  const frame = metalMat('#52525b', v);
  g.add(box(0.52, 0.1, 0.52, fabric, 0, 0.48, 0));
  g.add(box(0.52, 0.58, 0.08, fabric, 0, 0.76, -0.22));
  g.add(cyl(0.035, 0.035, 0.48, frame, 0, 0, 0));
  g.add(cyl(0.22, 0.22, 0.04, frame, 0, 0.02, 0));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.add(box(0.04, 0.04, 0.22, frame, Math.sin(a) * 0.2, 0.02, Math.cos(a) * 0.2));
  }
  g.add(box(0.48, 0.04, 0.48, pbrSolid('#27272a', { roughness: 0.4 }), 0, 0.44, 0));
  return g;
}

function buildWhiteboard(_v: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.8, 1.0, 0.04, mat('#fafafa'), 0, 1.5, -2.6));
  g.add(box(1.82, 1.02, 0.02, mat('#71717a', { metalness: 0.5 }), 0, 1.5, -2.62));
  return g;
}

function buildLedPanel(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  g.add(box(3.5, 2.0, 0.08, mat('#0a0a0a'), 0, 1.8, -3));
  g.add(box(3.4, 1.9, 0.02, mat(p.accent, { emissive: p.accent, emissiveIntensity: 0.55 }), 0, 1.8, -2.95));
  return g;
}

function buildCyclorama(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  g.add(box(8, 4, 0.15, mat(p.primary), 0, 2, -4));
  const curve = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 4, 8, 32, 1, true, 0, Math.PI / 2),
    mat(p.primary),
  );
  curve.rotation.z = Math.PI / 2;
  curve.position.set(-4, 0, -4);
  g.add(curve);
  return g;
}

function buildFence(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  for (let i = 0; i < 5; i++) {
    g.add(box(0.08, 1.0, 0.08, mat(p.wood), -1.0 + i * 0.5, 0.5, 0));
    g.add(box(0.08, 1.0, 0.08, mat(p.wood), -1.0 + i * 0.5, 0.5, 0.5));
  }
  g.add(box(2.0, 0.06, 0.06, mat(p.wood), 0, 0.7, 0.25));
  g.add(box(2.0, 0.06, 0.06, mat(p.wood), 0, 0.35, 0.25));
  return g;
}

function buildTree(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  g.add(cyl(0.12, 0.18, 1.2, mat('#78350f'), 0, 0.6, -3));
  const foliage = new THREE.Mesh(
    new THREE.ConeGeometry(0.7 + (v % 3) * 0.15, 1.8, 8),
    mat(p.accent, { roughness: 0.85 }),
  );
  foliage.position.set(0, 1.8, -3);
  foliage.castShadow = true;
  g.add(foliage);
  return g;
}

function buildBarStool(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  g.add(cyl(0.02, 0.02, 0.65, mat(p.metal, { metalness: 0.85 }), 0, 0.325, 0));
  g.add(cyl(0.18, 0.18, 0.06, mat(p.primary), 0, 0.68, 0));
  return g;
}

function buildMicStand(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  g.add(cyl(0.025, 0.035, 1.4, mat(p.metal, { metalness: 0.8 }), 0, 0.7, 0));
  g.add(cyl(0.06, 0.06, 0.12, mat('#27272a', { metalness: 0.9 }), 0, 1.45, 0));
  return g;
}

function buildCameraTripod(v: number): THREE.Group {
  const g = new THREE.Group();
  const p = pal(v);
  for (let i = 0; i < 3; i++) {
    const leg = cyl(0.02, 0.025, 0.9, mat(p.metal, { metalness: 0.7 }), 0, 0.45, 0);
    leg.rotation.z = 0.35;
    leg.rotation.y = (i * Math.PI * 2) / 3;
    g.add(leg);
  }
  g.add(box(0.15, 0.1, 0.12, mat('#27272a'), 0, 0.95, 0));
  return g;
}

function buildPlaceholder(v: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.5, 0.5, 0.5, mat(pal(v).accent, { emissive: pal(v).accent, emissiveIntensity: 0.2 }), 0, 0.25, 0));
  return g;
}

function buildCeilingFan(v: number): THREE.Group {
  const g = new THREE.Group();
  const rod = metalMat('#71717a', v);
  g.add(cyl(0.025, 0.025, 0.55, rod, 0, 2.85, -1.5));
  g.add(cyl(0.12, 0.12, 0.08, pbrSolid('#fafafa', { roughness: 0.35 }), 0, 2.52, -1.5));
  const motor = pbrSolid('#27272a', { metalness: 0.65, roughness: 0.3 });
  g.add(cyl(0.14, 0.14, 0.12, motor, 0, 2.46, -1.5));
  const bladeMat = pbrSolid(v % 2 === 0 ? '#e7e5e4' : '#44403c', { roughness: 0.55 });
  for (let i = 0; i < 4 + (v % 2); i++) {
    const a = (i / (4 + (v % 2))) * Math.PI * 2;
    const blade = box(0.75, 0.015, 0.14, bladeMat, 0, 2.42, 0);
    blade.rotation.y = a;
    blade.position.x = Math.sin(a) * 0.35;
    blade.position.z = -1.5 + Math.cos(a) * 0.35;
    g.add(blade);
  }
  const light = pbrSolid('#fef9c3', { emissive: '#fde047', emissiveIntensity: 0.6 });
  g.add(cyl(0.08, 0.1, 0.06, light, 0, 2.38, -1.5));
  return g;
}

function buildWallDecal(v: number): THREE.Group {
  const g = new THREE.Group();
  const w = 1.2 + (v % 4) * 0.25;
  const h = 0.8 + (v % 3) * 0.2;
  const decal = pbrFromTexture('wall_decal', v, { transparent: true, opacity: 0.92, roughness: 0.9 });
  g.add(box(w, h, 0.008, decal, 0, 1.6 + (v % 2) * 0.3, -2.88));
  return g;
}

function buildPendantLight(v: number): THREE.Group {
  const g = new THREE.Group();
  const cord = pbrSolid('#292524', { roughness: 0.8 });
  g.add(cyl(0.008, 0.008, 0.8, cord, 0, 2.6, -1.2));
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.28, 0.35, 24, 1, true),
    pbrSolid(v % 2 === 0 ? '#fafafa' : '#44403c', { emissive: '#fbbf24', emissiveIntensity: 0.25, side: THREE.DoubleSide }),
  );
  shade.position.set(0, 2.15, -1.2);
  g.add(shade);
  const bulb = new THREE.PointLight('#fde68a', 0.4, 5);
  bulb.position.set(0, 2.1, -1.2);
  g.add(bulb);
  return g;
}

function buildTrackLight(v: number): THREE.Group {
  const g = new THREE.Group();
  const track = metalMat('#52525b', v);
  g.add(box(2.5, 0.04, 0.06, track, 0, 2.85, -2));
  for (let i = 0; i < 3 + (v % 2); i++) {
    const x = -0.9 + i * 0.7;
    g.add(cyl(0.015, 0.015, 0.18, track, x, 2.72, -2));
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 12), pbrSolid('#27272a', { metalness: 0.7 }));
    head.position.set(x, 2.62, -2);
    head.rotation.x = Math.PI;
    g.add(head);
    const spot = new THREE.SpotLight('#fff7ed', 0.25, 6, 0.6, 0.5);
    spot.position.set(x, 2.6, -1.85);
    spot.target.position.set(x, 0, 0);
    g.add(spot);
    g.add(spot.target);
  }
  return g;
}

function buildCeilingLight(_v: number): THREE.Group {
  const g = new THREE.Group();
  const trim = pbrSolid('#fafafa', { roughness: 0.35 });
  g.add(cyl(0.35, 0.35, 0.04, trim, 0, 2.88, -1.5));
  g.add(cyl(0.28, 0.28, 0.02, pbrSolid('#fef9c3', { emissive: '#fde047', emissiveIntensity: 0.7 }), 0, 2.86, -1.5));
  const light = new THREE.PointLight('#fffbeb', 0.45, 8);
  light.position.set(0, 2.82, -1.5);
  g.add(light);
  return g;
}

function buildAreaMat(v: number): THREE.Group {
  const g = new THREE.Group();
  const w = 1.5 + (v % 3) * 0.4;
  g.add(box(w, 0.012, w * 0.55, pbrFromTexture('carpet', v + 2, { roughness: 0.98 }), 0, 0.006, 0));
  g.add(box(w * 0.85, 0.008, w * 0.45, pbrFromTexture('fabric_linen', v, { roughness: 0.92 }), 0, 0.012, 0));
  return g;
}

function buildWallShelf(v: number): THREE.Group {
  const g = new THREE.Group();
  const w = 1.0 + (v % 3) * 0.3;
  g.add(box(w, 0.035, 0.28, woodMat(v), 0, 1.5, -2.82));
  g.add(box(0.04, 0.04, 0.28, metalMat('#71717a', v), -w / 2 + 0.04, 1.48, -2.82));
  g.add(box(0.04, 0.04, 0.28, metalMat('#71717a', v), w / 2 - 0.04, 1.48, -2.82));
  for (let i = 0; i < 2 + (v % 3); i++) {
    g.add(box(0.06, 0.22, 0.14, pbrSolid('#6366f1', { roughness: 0.7 }), -w / 2 + 0.2 + i * 0.25, 1.62, -2.78));
  }
  return g;
}

export const PROCEDURAL_BUILDERS: Record<string, MeshBuilder> = {
  couch: buildCouch,
  armchair: buildArmchair,
  coffee_table: buildCoffeeTable,
  dining_table: buildDiningTable,
  desk: buildDesk,
  bed: buildBed,
  bookshelf: buildBookshelf,
  wardrobe: buildWardrobe,
  wall_panel: buildWallPanel,
  wall_corner: buildWallCorner,
  door: buildDoor,
  window: buildWindow,
  pillar: buildPillar,
  stairs: buildStairs,
  house_shell: buildHouseShell,
  stage_platform: buildStagePlatform,
  truss: buildTruss,
  spotlight: buildSpotlight,
  curtain: buildCurtain,
  news_desk: buildNewsDesk,
  monitor_wall: buildMonitorWall,
  news_chair: buildNewsChair,
  teleprompter: buildTeleprompter,
  church_pulpit: buildChurchPulpit,
  church_pew: buildChurchPew,
  cross: buildCross,
  altar: buildAltar,
  choir_riser: buildChoirRiser,
  kitchen_counter: buildKitchenCounter,
  kitchen_island: buildKitchenIsland,
  kitchen_cabinet: buildKitchenCabinet,
  fridge: buildFridge,
  stove: buildStove,
  sink: buildSink,
  plant: buildPlant,
  floor_lamp: buildFloorLamp,
  rug: buildRug,
  tv_screen: buildTvScreen,
  podium: buildPodium,
  conference_table: buildConferenceTable,
  office_chair: buildOfficeChair,
  whiteboard: buildWhiteboard,
  led_panel: buildLedPanel,
  cyclorama: buildCyclorama,
  fence: buildFence,
  tree: buildTree,
  bar_stool: buildBarStool,
  mic_stand: buildMicStand,
  camera_tripod: buildCameraTripod,
  ceiling_fan: buildCeilingFan,
  wall_decal: buildWallDecal,
  pendant_light: buildPendantLight,
  track_light: buildTrackLight,
  ceiling_light: buildCeilingLight,
  area_mat: buildAreaMat,
  wall_shelf: buildWallShelf,
};

export function buildProceduralMesh(generatorId: string, variant = 0): THREE.Group {
  const builder = PROCEDURAL_BUILDERS[generatorId] ?? buildPlaceholder;
  const group = builder(variant);
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return group;
}

export function listProceduralGenerators(): string[] {
  return Object.keys(PROCEDURAL_BUILDERS);
}
