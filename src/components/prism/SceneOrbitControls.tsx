import { useRef, useCallback, useEffect, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';

/**
 * Aximetry-style free camera for the 3D stage.
 *
 * • Left-drag        — orbit the camera around the look-at point (any angle)
 * • Right/Shift-drag — pan (truck/pedestal) — move the whole camera anywhere
 * • Middle-drag      — pan as well
 * • Wheel            — dolly zoom
 * • Two-finger drag  — pan on touch; pinch to zoom
 * • WASD / arrows    — fly the camera (W/S forward/back, A/D strafe,
 *                      Q/E down/up, arrows orbit, +/- zoom)
 */
export interface CameraPatch {
  yaw?: number;
  pitch?: number;
  zoom?: number;
  fov?: number;
  /** Look-at point — panning moves this (and the camera rig with it). */
  target?: [number, number, number];
}

interface SceneOrbitControlsProps {
  yaw: number;
  pitch: number;
  zoom: number;
  target?: [number, number, number];
  enabled?: boolean;
  /** Zoom limits (wheel). Virtual sets clamp tighter than open scenes. */
  minZoom?: number;
  maxZoom?: number;
  onChange: (patch: CameraPatch) => void;
}

const PITCH_MIN = -1.25;
const PITCH_MAX = 1.35;
/** Bounds of the free camera target so the operator never flies off the set. */
const TARGET_BOUNDS = {
  x: [-9, 9] as const,
  y: [0.15, 4.5] as const,
  z: [-7, 8] as const,
};

function clampTarget(t: [number, number, number]): [number, number, number] {
  return [
    Math.max(TARGET_BOUNDS.x[0], Math.min(TARGET_BOUNDS.x[1], t[0])),
    Math.max(TARGET_BOUNDS.y[0], Math.min(TARGET_BOUNDS.y[1], t[1])),
    Math.max(TARGET_BOUNDS.z[0], Math.min(TARGET_BOUNDS.z[1], t[2])),
  ];
}

type DragMode = 'orbit' | 'pan';

export function SceneOrbitControls({
  yaw,
  pitch,
  zoom,
  target,
  enabled = true,
  minZoom = 0.4,
  maxZoom = 2.5,
  onChange,
}: SceneOrbitControlsProps) {
  const dragging = useRef<DragMode | null>(null);
  const last = useRef({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDist = useRef<number | null>(null);
  const keys = useRef(new Set<string>());
  const hover = useRef(false);
  const { gl } = useThree();

  const tgt = useMemo<[number, number, number]>(() => target ?? [0, 1.05, 0], [target]);

  /** Pan the camera rig (target) in the camera's ground plane. */
  const panBy = useCallback(
    (dx: number, dy: number) => {
      const radius = 6 / Math.max(0.2, zoom);
      const k = radius * 0.0016;
      // grab-the-world: content follows the cursor
      const rightX = Math.cos(yaw);
      const rightZ = -Math.sin(yaw);
      const next = clampTarget([
        tgt[0] - rightX * dx * k,
        tgt[1] + dy * k,
        tgt[2] - rightZ * dx * k,
      ]);
      onChange({ target: next });
    },
    [yaw, zoom, tgt, onChange],
  );

  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!enabled) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        pinchDist.current = Math.hypot(a.x - b.x, a.y - b.y);
        dragging.current = null;
        return;
      }
      const isPan = e.button === 1 || e.button === 2 || e.shiftKey;
      dragging.current = isPan ? 'pan' : 'orbit';
      last.current = { x: e.clientX, y: e.clientY };
      gl.domElement.setPointerCapture(e.pointerId);
    },
    [enabled, gl],
  );

  const onPointerUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinchDist.current = null;
      if (pointers.current.size === 0) dragging.current = null;
      try {
        gl.domElement.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
    },
    [gl],
  );

  const onPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!enabled) return;
      const prev = pointers.current.get(e.pointerId);
      if (prev) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // two-finger pinch → zoom; two-finger drag → pan
      if (pointers.current.size === 2 && pinchDist.current != null) {
        const [a, b] = [...pointers.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const delta = dist - pinchDist.current;
        pinchDist.current = dist;
        if (Math.abs(delta) > 0.5) {
          onChange({ zoom: Math.max(minZoom, Math.min(maxZoom, zoom + delta * 0.005)) });
        }
        return;
      }

      if (!dragging.current) return;
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };

      if (dragging.current === 'pan') {
        panBy(dx, dy);
      } else {
        onChange({
          yaw: yaw - dx * 0.008,
          pitch: Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch - dy * 0.006)),
        });
      }
    },
    [enabled, yaw, pitch, zoom, onChange, panBy, minZoom, maxZoom],
  );

  const onWheel = useCallback(
    (e: ThreeEvent<WheelEvent>) => {
      if (!enabled) return;
      e.stopPropagation();
      const next = Math.max(minZoom, Math.min(maxZoom, zoom - e.deltaY * 0.001));
      onChange({ zoom: next });
    },
    [enabled, zoom, onChange, minZoom, maxZoom],
  );

  // ── keyboard fly (WASD/QE, arrows, +/-) while the pointer is over the stage ──
  useEffect(() => {
    const el = gl.domElement;
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    const down = (e: KeyboardEvent) => {
      // Fly keys only drive the camera while the pointer is over the stage,
      // so WASD/arrows keep working in panels and inputs elsewhere.
      if (!enabled || !hover.current || isTyping(e.target)) return;
      keys.current.add(e.key.toLowerCase());
      if (['w', 'a', 's', 'd', 'q', 'e', 'r', 'f', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const enter = () => (hover.current = true);
    const leave = () => {
      hover.current = false;
      keys.current.clear();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointerleave', leave);
    };
  }, [enabled, gl]);

  useFrame((_, rawDt) => {
    if (!enabled || keys.current.size === 0 || !hover.current) return;
    const dt = Math.min(0.1, rawDt);
    const k = keys.current;
    const speed = (2.4 / Math.max(0.35, zoom)) * dt;
    const fwdX = Math.sin(yaw);
    const fwdZ = Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    let mx = 0;
    let my = 0;
    let mz = 0;
    let yawDelta = 0;
    let pitchDelta = 0;
    let zoomDelta = 0;

    if (k.has('w')) { mx += fwdX * speed; mz += fwdZ * speed; }
    if (k.has('s')) { mx -= fwdX * speed; mz -= fwdZ * speed; }
    if (k.has('d')) { mx += rightX * speed; mz += rightZ * speed; }
    if (k.has('a')) { mx -= rightX * speed; mz -= rightZ * speed; }
    if (k.has('e') || k.has('r')) my += speed;
    if (k.has('q') || k.has('f')) my -= speed;
    if (k.has('arrowleft')) yawDelta += dt * 1.1;
    if (k.has('arrowright')) yawDelta -= dt * 1.1;
    if (k.has('arrowup')) pitchDelta += dt * 0.8;
    if (k.has('arrowdown')) pitchDelta -= dt * 0.8;
    if (k.has('+') || k.has('=')) zoomDelta += dt * 0.9;
    if (k.has('-') || k.has('_')) zoomDelta -= dt * 0.9;

    const patch: CameraPatch = {};
    if (mx !== 0 || my !== 0 || mz !== 0) {
      patch.target = clampTarget([tgt[0] + mx, tgt[1] + my, tgt[2] + mz]);
    }
    if (yawDelta !== 0) patch.yaw = yaw + yawDelta;
    if (pitchDelta !== 0) patch.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch + pitchDelta));
    if (zoomDelta !== 0) patch.zoom = Math.max(minZoom, Math.min(maxZoom, zoom + zoomDelta));
    if (Object.keys(patch).length > 0) onChange(patch);
  });

  return (
    /* Big invisible capture shell: double-sided so it raycasts from any camera
       position. Element drag handles call stopPropagation() and take priority;
       this shell catches every other pointer interaction on the stage. */
    <mesh
      position={[0, 1, 0]}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onPointerMove={onPointerMove}
      onWheel={onWheel}
      onContextMenu={(e) => {
        e.nativeEvent.preventDefault();
        e.stopPropagation();
      }}
    >
      <sphereGeometry args={[30, 12, 12]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} side={2} />
    </mesh>
  );
}
