import { memo, useCallback, useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { StudioScreenSource } from '../../lib/virtualStudio/types';
import {
  clampElementPosition,
  getStudioElement,
  normalizeElementScale,
} from '../../lib/virtualStudio/elementCatalog';
import { StudioElementRenderer } from './elements/StudioElements';

/**
 * Drag-and-drop layer for placed set elements. Every element sits on the
 * studio floor and can be dragged anywhere with the pointer (raycast onto the
 * floor plane — not just the object), with direct-manipulation transforms:
 *
 *   drag            move along the floor (grid-snapped when enabled)
 *   shift + drag    spin around its own yaw axis
 *   alt  + drag     raise / lower (elevation)
 *   handle drag     resize (uniform; shift = vertical stretch only)
 *
 * The operator panel exposes the same transforms as precise sliders.
 */

export interface PlacedElementLike {
  id: string;
  elementId: string;
  /** Floor position [x, z] — elements always stay grounded. */
  position: [number, number];
  /** Yaw in radians. */
  rotation: number;
  /** Uniform size (legacy) or per-axis stretch [x, y, z]. */
  scale: number | [number, number, number];
  /** Height above the floor in metres. */
  elevation?: number;
  /** Bound source for screen elements. */
  source?: StudioScreenSource;
}

export interface ElementsLayerProps {
  elements: PlacedElementLike[];
  selectedId?: string | null;
  /** Snap drags to a 0.25 m floor grid. */
  snapToGrid?: boolean;
  onSelect: (id: string | null) => void;
  onMove: (id: string, position: [number, number]) => void;
  onRotate: (id: string, rotation: number) => void;
  onScale: (id: string, scale: [number, number, number]) => void;
  onElevate: (id: string, elevation: number) => void;
}

const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const SNAP_GRID = 0.25;

/** Soft radial falloff used for contact-shadow decals under placed elements. */
let contactShadowTexture: THREE.CanvasTexture | null = null;
function getContactShadowTexture(): THREE.CanvasTexture {
  if (contactShadowTexture) return contactShadowTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.62)');
  grad.addColorStop(0.45, 'rgba(0,0,0,0.32)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  contactShadowTexture = new THREE.CanvasTexture(canvas);
  contactShadowTexture.colorSpace = THREE.SRGBColorSpace;
  return contactShadowTexture;
}
const SCALE_DRAG_SENSITIVITY = 0.0045;
const ELEVATION_DRAG_SENSITIVITY = 0.012;

function DraggableElement({
  element,
  selected,
  snapToGrid,
  onSelect,
  onMove,
  onRotate,
  onScale,
  onElevate,
}: {
  element: PlacedElementLike;
  selected: boolean;
  snapToGrid?: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, position: [number, number]) => void;
  onRotate: (id: string, rotation: number) => void;
  onScale: (id: string, scale: [number, number, number]) => void;
  onElevate: (id: string, elevation: number) => void;
}) {
  const { camera, gl } = useThree();
  const mode = useRef<'none' | 'move' | 'rotate' | 'elevate' | 'scale'>('none');
  const grabOffset = useRef(new THREE.Vector2(0, 0));
  const lastX = useRef(0);
  const lastY = useRef(0);
  const gestureStart = useRef({ rotation: 0, elevation: 0, scale: [1, 1, 1] as [number, number, number] });
  const rotation = useRef(element.rotation);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const def = getStudioElement(element.elementId);
  const defElevation = def?.elevation ?? 0;
  const footprint = def?.footprint ?? 0.7;
  const scaleVec = normalizeElementScale(element.scale);
  const [sx, sy, sz] = scaleVec;
  const elevation = defElevation + (element.elevation ?? 0);
  const planarScale = Math.max(sx, sz);

  const projectToFloor = useCallback(
    (clientX: number, clientY: number, out: THREE.Vector3) => {
      const rect = gl.domElement.getBoundingClientRect();
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return raycaster.ray.intersectPlane(floorPlane, out);
    },
    [camera, gl, ndc, raycaster],
  );

  const attachGestures = useCallback(
    (e: ThreeEvent<PointerEvent>, gesture: 'body' | 'scale') => {
      e.stopPropagation();
      onSelect(element.id);
      lastX.current = e.clientX;
      lastY.current = e.clientY;
      gestureStart.current = {
        rotation: element.rotation,
        elevation: element.elevation ?? 0,
        scale: normalizeElementScale(element.scale),
      };
      rotation.current = element.rotation;

      if (gesture === 'scale') {
        mode.current = 'scale';
      } else if (e.nativeEvent.shiftKey) {
        mode.current = 'rotate';
      } else if (e.nativeEvent.altKey) {
        mode.current = 'elevate';
      } else if (projectToFloor(e.clientX, e.clientY, hit)) {
        mode.current = 'move';
        grabOffset.current.set(hit.x - element.position[0], hit.z - element.position[1]);
      } else {
        mode.current = 'none';
      }
      gl.domElement.setPointerCapture(e.pointerId);

      const move = (ev: PointerEvent) => {
        const dy = ev.clientY - lastY.current;
        switch (mode.current) {
          case 'rotate': {
            // Shift-drag spins the element around its own yaw axis.
            rotation.current += (ev.clientX - lastX.current) * 0.012;
            onRotate(element.id, rotation.current);
            break;
          }
          case 'elevate': {
            // Alt-drag raises / lowers the element off the floor.
            const next = gestureStart.current.elevation - dy * ELEVATION_DRAG_SENSITIVITY;
            onElevate(element.id, next);
            break;
          }
          case 'scale': {
            // Handle drag resizes — shift keeps the vertical axis independent.
            const factor = Math.exp(-dy * SCALE_DRAG_SENSITIVITY);
            const [gx, gy, gz] = gestureStart.current.scale;
            if (ev.shiftKey) {
              onScale(element.id, [gx, gy * factor, gz]);
            } else {
              onScale(element.id, [gx * factor, gy * factor, gz * factor]);
            }
            break;
          }
          case 'move': {
            if (!projectToFloor(ev.clientX, ev.clientY, hit)) break;
            let x = hit.x - grabOffset.current.x;
            let z = hit.z - grabOffset.current.y;
            if (snapToGrid) {
              x = Math.round(x / SNAP_GRID) * SNAP_GRID;
              z = Math.round(z / SNAP_GRID) * SNAP_GRID;
            }
            onMove(element.id, clampElementPosition(x, z));
            break;
          }
          default:
            break;
        }
        lastX.current = ev.clientX;
        lastY.current = ev.clientY;
      };
      const up = (ev: PointerEvent) => {
        mode.current = 'none';
        gl.domElement.releasePointerCapture(ev.pointerId);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [element.id, element.position, element.rotation, element.elevation, element.scale, gl, hit, onElevate, onMove, onRotate, onScale, onSelect, projectToFloor, snapToGrid],
  );

  const onBodyPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => attachGestures(e, 'body'),
    [attachGestures],
  );
  const onHandlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => attachGestures(e, 'scale'),
    [attachGestures],
  );

  // World-space height of the resize handle above the element base —
  // divided by sy so the group's scale doesn't push it around.
  const handleY = 1.95 / Math.max(0.2, sy);

  return (
    <group
      position={[element.position[0], elevation, element.position[1]]}
      rotation={[0, element.rotation, 0]}
      scale={scaleVec}
      onPointerDown={onBodyPointerDown}
    >
      <StudioElementRenderer elementId={element.elementId} source={element.source} />
      {/* soft contact shadow grounding the element on the floor */}
      {elevation < 2.8 && (
        <mesh position={[0, -elevation + 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
          <planeGeometry args={[footprint * planarScale * 2.7, footprint * planarScale * 2.7]} />
          <meshBasicMaterial
            map={getContactShadowTexture()}
            transparent
            opacity={0.8 - Math.min(0.55, elevation * 0.22)}
            blending={THREE.MultiplyBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
      {/* invisible click/drag collider sized to the element footprint */}
      <mesh visible={false} position={[0, 0.75 / Math.max(0.2, sy), 0]}>
        <cylinderGeometry args={[footprint, footprint, 1.5, 12]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      {selected && (
        <>
          <mesh position={[0, -elevation + 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[footprint * planarScale * 0.92, footprint * planarScale * 1.08, 48]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.85} depthWrite={false} toneMapped={false} />
          </mesh>
          {/* stem from the element to the resize handle */}
          <mesh position={[0, handleY / 2, 0]}>
            <cylinderGeometry args={[0.008, 0.008, handleY, 6]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.5} depthWrite={false} toneMapped={false} />
          </mesh>
          {/* resize handle — drag up/down to scale (shift = vertical only) */}
          <group position={[0, handleY, 0]} onPointerDown={onHandlePointerDown}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.11, 0.028, 10, 28]} />
              <meshBasicMaterial color="#f59e0b" depthWrite={false} toneMapped={false} />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.055, 16, 12]} />
              <meshBasicMaterial color="#fcd34d" depthWrite={false} toneMapped={false} />
            </mesh>
            {/* generous invisible grab target */}
            <mesh visible={false}>
              <sphereGeometry args={[0.3, 8, 6]} />
              <meshBasicMaterial transparent opacity={0} />
            </mesh>
          </group>
        </>
      )}
    </group>
  );
}

export const ElementsLayer = memo(function ElementsLayer({
  elements,
  selectedId,
  snapToGrid,
  onSelect,
  onMove,
  onRotate,
  onScale,
  onElevate,
}: ElementsLayerProps) {
  return (
    <>
      {elements.map((element) => (
        <DraggableElement
          key={element.id}
          element={element}
          selected={element.id === selectedId}
          snapToGrid={snapToGrid}
          onSelect={onSelect}
          onMove={onMove}
          onRotate={onRotate}
          onScale={onScale}
          onElevate={onElevate}
        />
      ))}
    </>
  );
});
