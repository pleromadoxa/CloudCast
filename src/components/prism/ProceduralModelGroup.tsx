import { useMemo } from 'react';
import { buildProceduralMesh } from '../../lib/prism/proceduralMeshes';
import { getCatalogEntry } from '../../lib/prism/modelCatalog';
import type { PrismSceneObject } from '../../types/prismFeed';

function ProceduralModelMesh({ generatorId, variant }: { generatorId: string; variant: number }) {
  const group = useMemo(() => buildProceduralMesh(generatorId, variant), [generatorId, variant]);
  return <primitive object={group} />;
}

function SceneObjectInstance({ object }: { object: PrismSceneObject }) {
  const catalog = getCatalogEntry(object.catalogId);
  if (!catalog) return null;

  return (
    <group
      position={object.position}
      rotation={object.rotation}
      scale={[object.scale, object.scale, object.scale]}
    >
      <ProceduralModelMesh generatorId={catalog.generatorId} variant={catalog.variant} />
    </group>
  );
}

export function ProceduralModelGroup({ objects }: { objects: PrismSceneObject[] }) {
  if (!objects.length) return null;
  return (
    <>
      {objects.map((obj) => (
        <SceneObjectInstance key={obj.id} object={obj} />
      ))}
    </>
  );
}
