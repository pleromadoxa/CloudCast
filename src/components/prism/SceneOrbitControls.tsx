import { useRef, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';

interface SceneOrbitControlsProps {
  yaw: number;
  pitch: number;
  zoom: number;
  enabled?: boolean;
  onChange: (patch: { yaw?: number; pitch?: number; zoom?: number }) => void;
}

export function SceneOrbitControls({ yaw, pitch, zoom, enabled = true, onChange }: SceneOrbitControlsProps) {
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const { gl } = useThree();

  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!enabled) return;
      dragging.current = true;
      last.current = { x: e.clientX, y: e.clientY };
      gl.domElement.setPointerCapture(e.pointerId);
    },
    [enabled, gl],
  );

  const onPointerUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      dragging.current = false;
      gl.domElement.releasePointerCapture(e.pointerId);
    },
    [gl],
  );

  const onPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!enabled || !dragging.current) return;
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      onChange({
        yaw: yaw - dx * 0.008,
        pitch: Math.max(-0.35, Math.min(0.55, pitch - dy * 0.006)),
      });
    },
    [enabled, yaw, pitch, onChange],
  );

  const onWheel = useCallback(
    (e: ThreeEvent<WheelEvent>) => {
      if (!enabled) return;
      e.stopPropagation();
      const next = Math.max(0.4, Math.min(2.5, zoom - e.deltaY * 0.001));
      onChange({ zoom: next });
    },
    [enabled, zoom, onChange],
  );

  return (
    <mesh
      visible={false}
      position={[0, 1, 0]}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onPointerMove={onPointerMove}
      onWheel={onWheel}
    >
      <sphereGeometry args={[8, 8, 8]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  );
}
