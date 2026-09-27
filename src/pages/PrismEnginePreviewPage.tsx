import { lazy, Suspense, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DEFAULT_BABYLON_SETTINGS, DEFAULT_UNREAL_SETTINGS } from '../lib/stageEngines/settings';

// The Babylon kit and the Unreal pixel-streaming client are large, engine-
// specific chunks — load only the engine the preview actually mounts.
const BabylonStudioStage = lazy(() =>
  import('../components/virtualStudio/babylon/BabylonStudioStage').then((m) => ({
    default: m.BabylonStudioStage,
  })),
);
const UnrealPixelStreamStage = lazy(() =>
  import('../components/virtualStudio/unreal/UnrealPixelStreamStage').then((m) => ({
    default: m.UnrealPixelStreamStage,
  })),
);

type PreviewEngine = 'babylon' | 'unreal';

function EngineHud({ engine, backend }: { engine: PreviewEngine; backend: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 p-4">
      <div className="rounded border border-white/15 bg-black/70 px-3 py-2 backdrop-blur">
        <p className="text-[10px] font-bold tracking-[0.3em] text-amber-400">
          REGAL PRISM · ENGINE PREVIEW
        </p>
        <p className="mt-1 text-[11px] tracking-wider text-white/80">
          {engine === 'babylon' ? 'Babylon.js Studio Stage' : 'Unreal Pixel Streaming'} · {backend}
        </p>
      </div>
      <nav className="pointer-events-auto flex gap-2 text-[10px] font-bold tracking-wider">
        {(
          [
            ['three.js', '/prism/scene-preview'],
            ['Babylon', '/prism/engine-preview?engine=babylon'],
            ['Unreal', '/prism/engine-preview?engine=unreal'],
          ] as const
        ).map(([label, href]) => (
          <Link
            key={label}
            to={href}
            className="rounded border border-white/15 bg-black/70 px-3 py-2 text-white/80 backdrop-blur transition hover:border-amber-400/60 hover:text-amber-300"
          >
            {label.toUpperCase()}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/**
 * One engine at a time. Keyed by engine so a switch remounts the stage and
 * the status readout starts from a fresh "starting…" without clobbering the
 * ready callback of the incoming stage.
 */
function StagePanel({ engine, sceneId }: { engine: PreviewEngine; sceneId: string }) {
  const [backend, setBackend] = useState<string>('starting…');

  return (
    <>
      <EngineHud engine={engine} backend={backend} />
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center bg-black text-[11px] tracking-[0.3em] text-white/50">
            LOADING ENGINE…
          </div>
        }
      >
        {engine === 'babylon' ? (
          <BabylonStudioStage
            sceneId={sceneId}
            shadows
            interactive
            settings={DEFAULT_BABYLON_SETTINGS}
            onEngineReady={(info) => setBackend(`${info.backend} · ${info.renderer}`)}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <UnrealPixelStreamStage
            settings={DEFAULT_UNREAL_SETTINGS}
            interactive
            onEngineReady={(info) => setBackend(`${info.backend} · ${info.renderer}`)}
            style={{ width: '100%', height: '100%' }}
          />
        )}
      </Suspense>
    </>
  );
}

/**
 * Visual harness for the Regal Prism render engines.
 *
 * Mounts the Babylon.js studio stage or the Unreal pixel-streaming stage
 * without an authenticated studio session so engine start-up, lighting, PBR
 * materials and tone mapping can be reviewed in any build at
 * `/prism/engine-preview?engine=babylon&scene=cyclorama`.
 */
export function PrismEnginePreviewPage() {
  const [params] = useSearchParams();
  const requested = params.get('engine');
  const engine: PreviewEngine = requested === 'unreal' ? 'unreal' : 'babylon';
  const sceneId = params.get('scene') ?? 'cyclorama';

  return (
    <div className="relative h-[100dvh] w-full bg-black">
      <StagePanel key={`${engine}:${sceneId}`} engine={engine} sceneId={sceneId} />
    </div>
  );
}
