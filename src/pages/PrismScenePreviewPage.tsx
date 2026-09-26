import { useMemo } from 'react';
import { VirtualScene } from '../components/prism/VirtualScene';
import { VIRTUAL_SETS } from '../lib/prism/virtualSets';
import type { ImportedModelEntry } from '../components/prism/ImportedModelGroup';
import type { PrismSceneObject } from '../types/prismFeed';

/**
 * Dev-only visual harness for the classic virtual scene renderer.
 *
 * Renders a representative set with sample placed props and library scans so
 * lighting, IBL, materials and tone mapping can be reviewed in the browser
 * without an authenticated studio session. Reachable at
 * `/prism/scene-preview?set=furnished_living&yaw=0&pitch=0.14&zoom=1.05`.
 */

function sceneObject(id: string, catalogId: string, position: [number, number, number], rotation: [number, number, number] = [0, 0, 0], scale = 1): PrismSceneObject {
  return { id, catalogId, position, rotation, scale };
}

export default function PrismScenePreviewPage() {
  const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const setId = params.get('set') ?? 'furnished_living';
  const virtualSet = VIRTUAL_SETS.find((s) => s.id === setId) ?? VIRTUAL_SETS[0];
  const yaw = Number(params.get('yaw') ?? '0');
  const pitch = Number(params.get('pitch') ?? '0.14');
  const zoom = Number(params.get('zoom') ?? '1.05');

  const sceneObjects = useMemo<PrismSceneObject[]>(
    () => [
      sceneObject('pv-coffee', 'coffee_table_03', [0, 0, 0.55]),
      sceneObject('pv-rug', 'rug_01', [0, 0, 0.35]),
      sceneObject('pv-decal-l', 'wall_decal_01', [-2.6, 0, -2.4], [0, 0.35, 0]),
      sceneObject('pv-decal-r', 'wall_decal_03', [2.6, 0, -2.4], [0, -0.35, 0]),
      sceneObject('pv-shelf', 'wall_shelf_01', [2.4, 0, -2.55], [0, -0.35, 0]),
      sceneObject('pv-tv', 'tv_02', [-2.2, 0, -2.5], [0, 0.35, 0]),
      sceneObject('pv-lamp', 'lamp_01', [-2.35, 0, -0.4]),
      sceneObject('pv-plant', 'plant_03', [2.75, 0, -1.7]),
      sceneObject('pv-pendant', 'pendant_01', [0, 0, -0.7]),
    ],
    [],
  );

  const importedModels = useMemo<ImportedModelEntry[]>(
    () => [
      {
        id: 'pv-scan-sofa',
        name: 'Sofa',
        url: '/models/Sofa_01/Sofa_01_1k.gltf',
        position: [-0.15, 0, -1.15],
        rotation: [0, 0, 0],
        scale: 1,
      },
      {
        id: 'pv-scan-table',
        name: 'Wooden Table',
        url: '/models/WoodenTable_02/WoodenTable_02_1k.gltf',
        position: [0, 0, 0.55],
        rotation: [0, 0, 0],
        scale: 1,
      },
      {
        id: 'pv-scan-armchair',
        name: 'Armchair',
        url: '/models/ArmChair_01/ArmChair_01_1k.gltf',
        position: [2.1, 0, -0.45],
        rotation: [0, -0.6, 0],
        scale: 1,
      },
    ],
    [],
  );

  return (
    <div className="h-[100dvh] w-full bg-black">
      <VirtualScene
        virtualSet={virtualSet}
        keyedCanvas={null}
        rawVideo={null}
        mode="virtual_studio"
        cameraYaw={yaw}
        cameraPitch={pitch}
        cameraZoom={zoom}
        showShadows
        showReflections
        sceneObjects={sceneObjects}
        importedModels={importedModels}
      />
    </div>
  );
}
