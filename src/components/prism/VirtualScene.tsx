import { Suspense, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, ContactShadows, Text, MeshReflectorMaterial } from '@react-three/drei';
import * as THREE from 'three';
import type { VirtualSetDefinition } from '../../lib/prism/virtualSets';
import { ImportedModelGroup, type ImportedModelEntry } from './ImportedModelGroup';
import { ProceduralModelGroup } from './ProceduralModelGroup';
import { PhotorealisticRoomShell, environmentPresetFor } from './PhotorealisticRoomShell';
import { SceneOrbitControls } from './SceneOrbitControls';
import type { PrismSceneObject } from '../../types/prismFeed';

interface VirtualSceneProps {
  virtualSet: VirtualSetDefinition;
  keyedCanvas: HTMLCanvasElement | null;
  rawVideo?: HTMLVideoElement | null;
  mode: 'virtual_studio' | 'augmented_reality' | 'xr_extension';
  cameraYaw: number;
  cameraPitch: number;
  cameraZoom: number;
  showShadows: boolean;
  showReflections: boolean;
  importedModels?: ImportedModelEntry[];
  sceneObjects?: PrismSceneObject[];
  onGlReady?: (canvas: HTMLCanvasElement) => void;
  keyerEnabled?: boolean;
  virtualSetEnabled?: boolean;
  orbitEnabled?: boolean;
  onCameraChange?: (patch: { yaw?: number; pitch?: number; zoom?: number }) => void;
}

function RawTalent({ video }: { video: HTMLVideoElement | null }) {
  const texture = useMemo(() => {
    if (!video) return null;
    const tex = new THREE.VideoTexture(video);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [video]);

  useFrame(() => {
    if (texture) texture.needsUpdate = true;
  });

  if (!texture) return null;

  return (
    <group position={[0, -0.85, 0.5]}>
      <mesh>
        <planeGeometry args={[2.4, 1.35]} />
        <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function KeyedTalent({
  canvas,
  showReflections,
}: {
  canvas: HTMLCanvasElement | null;
  showReflections: boolean;
}) {
  const texture = useMemo(() => {
    if (!canvas) return null;
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [canvas]);

  useFrame(() => {
    if (texture) texture.needsUpdate = true;
  });

  if (!texture) return null;

  return (
    <group position={[0, -0.85, 0.5]}>
      <mesh>
        <planeGeometry args={[2.4, 1.35]} />
        <meshBasicMaterial map={texture} transparent alphaTest={0.02} side={THREE.DoubleSide} />
      </mesh>
      {showReflections && (
        <mesh position={[0, -1.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.4, 0.6]} />
          <meshBasicMaterial map={texture} transparent opacity={0.25} alphaTest={0.02} />
        </mesh>
      )}
    </group>
  );
}

function ArCameraBackground({ video }: { video: HTMLVideoElement | null }) {
  const texture = useMemo(() => {
    if (!video) return null;
    const tex = new THREE.VideoTexture(video);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [video]);

  useFrame(() => {
    if (texture) texture.needsUpdate = true;
  });

  if (!texture) return null;

  return (
    <mesh position={[0, 0, -4]}>
      <planeGeometry args={[16, 9]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

function StudioEnvironment({ environment }: { environment: VirtualSetDefinition['environment'] }) {
  if (environment === 'news_studio') {
    return (
      <>
        <color attach="background" args={['#0a0a12']} />
        <mesh position={[0, 2, -4]}>
          <planeGeometry args={[12, 6]} />
          <meshStandardMaterial color="#1a1a2e" emissive="#e11d48" emissiveIntensity={0.15} />
        </mesh>
        <mesh position={[0, 0, -3.9]}>
          <planeGeometry args={[10, 0.8]} />
          <meshStandardMaterial color="#e11d48" emissive="#e11d48" emissiveIntensity={0.8} />
        </mesh>
        <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[14, 10]} />
          <MeshReflectorMaterial blur={[300, 100]} mixBlur={0.8} mixStrength={0.4} color="#111" />
        </mesh>
        <Text position={[0, 3.2, -3.5]} fontSize={0.35} color="#ffffff" anchorX="center">
          LIVE
        </Text>
      </>
    );
  }

  if (environment === 'newsroom_full') {
    return (
      <>
        <PhotorealisticRoomShell environment="newsroom_full" />
        <mesh position={[0, 0.04, -5.5]}>
          <planeGeometry args={[12, 0.8]} />
          <meshStandardMaterial color="#e11d48" emissive="#e11d48" emissiveIntensity={0.6} />
        </mesh>
        <Text position={[0, 3.5, -5.8]} fontSize={0.4} color="#ffffff" anchorX="center">
          BREAKING NEWS
        </Text>
      </>
    );
  }

  if (environment === 'church_stage') {
    return (
      <>
        <PhotorealisticRoomShell environment="church_stage" />
        <mesh position={[0, 3.2, -6]}>
          <planeGeometry args={[8, 3]} />
          <meshStandardMaterial color="#422006" emissive="#f59e0b" emissiveIntensity={0.15} />
        </mesh>
        <pointLight position={[0, 4, -2]} intensity={0.8} color="#fbbf24" />
      </>
    );
  }

  if (environment === 'kitchen_set') {
    return <PhotorealisticRoomShell environment="kitchen_set" />;
  }

  if (environment === 'furnished_living') {
    return (
      <>
        <PhotorealisticRoomShell environment="furnished_living" />
        <pointLight position={[-3, 3, 1]} intensity={0.5} color="#fef3c7" />
        <pointLight position={[3, 3, 1]} intensity={0.4} color="#fde68a" />
      </>
    );
  }

  if (environment === 'furnished_bedroom') {
    return <PhotorealisticRoomShell environment="furnished_bedroom" />;
  }

  if (environment === 'talk_show') {
    return <PhotorealisticRoomShell environment="talk_show" />;
  }

  if (environment === 'conference_room') {
    return (
      <>
        <PhotorealisticRoomShell environment="conference_room" />
        <mesh position={[0, 1.8, -5.8]}>
          <planeGeometry args={[6, 2.5]} />
          <meshStandardMaterial color="#334155" emissive="#38bdf8" emissiveIntensity={0.12} />
        </mesh>
      </>
    );
  }

  if (environment === 'residential_exterior') {
    return (
      <>
        <color attach="background" args={['#87ceeb']} />
        <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[30, 30]} />
          <meshStandardMaterial color="#4ade80" />
        </mesh>
        <mesh position={[0, 8, -20]}>
          <planeGeometry args={[40, 16]} />
          <meshStandardMaterial color="#93c5fd" />
        </mesh>
      </>
    );
  }

  if (environment === 'corporate') {
    return (
      <>
        <PhotorealisticRoomShell environment="corporate" />
        <mesh position={[-3, 0, -2]} rotation={[0, 0.3, 0]}>
          <boxGeometry args={[0.05, 3, 2]} />
          <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.3} transparent opacity={0.6} metalness={0.4} roughness={0.2} />
        </mesh>
        <mesh position={[3, 0, -2]} rotation={[0, -0.3, 0]}>
          <boxGeometry args={[0.05, 3, 2]} />
          <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.3} transparent opacity={0.6} metalness={0.4} roughness={0.2} />
        </mesh>
      </>
    );
  }

  if (environment === 'outdoor_ar') {
    return null;
  }

  if (environment === 'broadcast_desk') {
    return (
      <>
        <color attach="background" args={['#0c0c0c']} />
        <mesh position={[0, -0.5, -1]}>
          <boxGeometry args={[4, 0.15, 1.2]} />
          <meshStandardMaterial color="#222" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 2, -4]}>
          <planeGeometry args={[12, 5]} />
          <meshStandardMaterial color="#14532d" emissive="#22c55e" emissiveIntensity={0.2} />
        </mesh>
      </>
    );
  }

  if (environment === 'xr_stage') {
    return <XrLedStage accent="#6366f1" />;
  }

  return (
    <>
      <color attach="background" args={['#000']} />
      <mesh position={[0, 2, -6]}>
        <planeGeometry args={[16, 9]} />
        <meshStandardMaterial color="#312e81" emissive="#6366f1" emissiveIntensity={0.4} />
      </mesh>
    </>
  );
}

function XrLedStage({ accent = '#6366f1' }: { accent?: string }) {
  const wallMat = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 0.55,
      metalness: 0.2,
      roughness: 0.4,
    }),
    [accent],
  );

  return (
    <>
      <color attach="background" args={['#030308']} />
      <mesh position={[0, 2.2, -5.5]}>
        <cylinderGeometry args={[7, 7, 4.5, 32, 1, true, Math.PI * 0.65, Math.PI * 0.7]} />
        <primitive object={wallMat} attach="material" />
      </mesh>
      <mesh position={[-5.5, 1.8, -2]} rotation={[0, 0.55, 0]}>
        <planeGeometry args={[3.5, 4]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[5.5, 1.8, -2]} rotation={[0, -0.55, 0]}>
        <planeGeometry args={[3.5, 4]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, -0.86, -1.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 6]} />
        <MeshReflectorMaterial blur={[400, 120]} mixBlur={0.9} mixStrength={0.35} color="#0a0a12" />
      </mesh>
      <mesh position={[0, 4.2, -3]}>
        <boxGeometry args={[8, 0.08, 0.08]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.8} />
      </mesh>
    </>
  );
}

function XrExtensionOverlay() {
  return (
    <>
      <mesh position={[-6, 2, -3]} rotation={[0, 0.65, 0]}>
        <planeGeometry args={[2.5, 4.5]} />
        <meshStandardMaterial color="#4338ca" emissive="#6366f1" emissiveIntensity={0.45} transparent opacity={0.85} />
      </mesh>
      <mesh position={[6, 2, -3]} rotation={[0, -0.65, 0]}>
        <planeGeometry args={[2.5, 4.5]} />
        <meshStandardMaterial color="#4338ca" emissive="#6366f1" emissiveIntensity={0.45} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 3.5, -5]}>
        <planeGeometry args={[14, 2]} />
        <meshStandardMaterial color="#312e81" emissive="#818cf8" emissiveIntensity={0.5} />
      </mesh>
    </>
  );
}

function CameraRig({ yaw, pitch, zoom, wide }: { yaw: number; pitch: number; zoom: number; wide?: boolean }) {
  const { camera } = useThree();
  useFrame(() => {
    const effectiveZoom = wide ? zoom * 0.82 : zoom;
    const radius = 5 / effectiveZoom;
    const y = Math.sin(pitch) * radius + 1.2;
    const xz = Math.cos(pitch) * radius;
    camera.position.set(Math.sin(yaw) * xz, y, Math.cos(yaw) * xz);
    camera.lookAt(0, 0.5, 0);
    if (wide && 'fov' in camera) {
      (camera as THREE.PerspectiveCamera).fov = 58;
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
  });
  return null;
}

function GlCanvasReporter({ onGlReady }: { onGlReady?: (canvas: HTMLCanvasElement) => void }) {
  const { gl } = useThree();
  useEffect(() => {
    onGlReady?.(gl.domElement);
  }, [gl, onGlReady]);
  return null;
}

export function VirtualScene({
  virtualSet,
  keyedCanvas,
  rawVideo,
  mode,
  cameraYaw,
  cameraPitch,
  cameraZoom,
  showShadows,
  showReflections,
  importedModels = [],
  sceneObjects = [],
  onGlReady,
  keyerEnabled = true,
  virtualSetEnabled = true,
  orbitEnabled = true,
  onCameraChange,
}: VirtualSceneProps) {
  const isAr = mode === 'augmented_reality';
  const isXr = mode === 'xr_extension';
  const showSet = virtualSetEnabled && !isAr;
  const envPreset = environmentPresetFor(virtualSet.environment);
  const xrAccent = virtualSet.environment === 'broadcast_desk' ? '#22c55e'
    : virtualSet.environment === 'news_studio' || virtualSet.environment === 'newsroom_full' ? '#e11d48'
    : virtualSet.environment === 'church_stage' ? '#f59e0b'
    : virtualSet.environment === 'kitchen_set' ? '#78716c'
    : virtualSet.environment === 'corporate' || virtualSet.environment === 'conference_room' ? '#38bdf8'
    : '#6366f1';

  return (
    <Canvas
      camera={{ fov: isXr ? 58 : 50, near: 0.1, far: 100, position: [0, 1.2, 5] }}
      gl={{ alpha: isAr, antialias: true, preserveDrawingBuffer: true }}
      style={{ background: isAr ? 'transparent' : undefined }}
    >
      <Suspense fallback={null}>
        <GlCanvasReporter onGlReady={onGlReady} />
        <CameraRig yaw={cameraYaw} pitch={cameraPitch} zoom={cameraZoom} wide={isXr} />
        {onCameraChange && (
          <SceneOrbitControls
            yaw={cameraYaw}
            pitch={cameraPitch}
            zoom={cameraZoom}
            enabled={orbitEnabled}
            onChange={onCameraChange}
          />
        )}
        <ambientLight intensity={isXr ? 0.45 : 0.28} />
        <hemisphereLight args={['#fff7ed', '#1c1917', 0.55]} />
        <directionalLight position={[5, 8, 5]} intensity={1.35} castShadow={showShadows} shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-4, 6, 3]} intensity={0.35} color="#fde68a" />
        <pointLight position={[-3, 4, 2]} intensity={0.45} color="#fbbf24" />
        {isAr && <ArCameraBackground video={rawVideo ?? null} />}
        {showSet && !isXr && <StudioEnvironment environment={virtualSet.environment} />}
        {showSet && isXr && <XrLedStage accent={xrAccent} />}
        {isXr && <XrExtensionOverlay />}
        {!isAr && (
          keyerEnabled ? (
            <KeyedTalent canvas={keyedCanvas} showReflections={showReflections && showSet} />
          ) : (
            <RawTalent video={rawVideo ?? null} />
          )
        )}
        {importedModels.length > 0 && <ImportedModelGroup models={importedModels} />}
        {sceneObjects.length > 0 && <ProceduralModelGroup objects={sceneObjects} />}
        {showShadows && !isAr && (
          <ContactShadows position={[0, -0.85, 0.5]} opacity={0.5} scale={3} blur={2} far={2} />
        )}
        <Environment preset={envPreset} />
      </Suspense>
    </Canvas>
  );
}
