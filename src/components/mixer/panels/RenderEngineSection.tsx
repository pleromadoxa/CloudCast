/**
 * Render Engine — the Settings panel control surface for the background GPU
 * kernel. Mirrors the mixer's setup-section patterns (segmented pads,
 * checkbox rows, compact selects) and talks straight to the engine singleton,
 * so it works anywhere in the deck tree.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Gauge, Play, Square } from 'lucide-react';
import {
  usePatchRenderEngineSettings,
  useRenderEngine,
  useRenderEngineSettings,
  useRenderEngineStatus,
} from '../../../context/RenderEngineContext';
import { applyPresetToSettings, derivePresetFromSettings } from '../../../lib/renderEngine/quality';
import { formatBytes } from '../../../lib/renderEngine/metrics';
import type {
  AntiAliasingMode,
  BackgroundRenderMode,
  DenoiserMode,
  EngineBackendPreference,
  PowerProfile,
  RenderQualityPreset,
  ToneMapOperator,
} from '../../../lib/renderEngine/types';
import { cn } from '../../../lib/utils';

function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="deck-duration-row">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.id)}
          className={cn('deck-pad-btn flex-1 px-1 py-1 text-[8px] uppercase', value === option.id && 'atem-toggle-on')}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded border border-white/10 bg-black/30 px-2 py-1.5">
      <span>
        <span className="block text-[10px] font-bold tracking-wider text-white">{label}</span>
        <span className="text-[8px] text-mixer-muted">{hint}</span>
      </span>
      <input
        type="checkbox"
        className="h-4 w-4 accent-mixer-red"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 flex items-center justify-between text-[8px] font-bold tracking-wider text-mixer-muted">
        <span>{label}</span>
        <span className="text-white">{format ? format(value) : value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-mixer-red"
      />
    </label>
  );
}

const QUALITY_OPTIONS: Array<{ id: RenderQualityPreset; label: string }> = [
  { id: 'performance', label: 'PERF' },
  { id: 'balanced', label: 'BAL' },
  { id: 'quality', label: 'QUAL' },
  { id: 'cinematic', label: 'CINE' },
];

const TONE_OPTIONS: Array<{ id: ToneMapOperator; label: string }> = [
  { id: 'agx', label: 'AgX' },
  { id: 'aces', label: 'ACES' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'filmic', label: 'Filmic' },
  { id: 'reinhard', label: 'Reinhard' },
  { id: 'linear', label: 'Linear' },
];

const AA_OPTIONS: Array<{ id: AntiAliasingMode; label: string }> = [
  { id: 'off', label: 'OFF' },
  { id: 'fxaa', label: 'FXAA' },
  { id: 'smaa', label: 'SMAA' },
  { id: 'msaa', label: 'MSAA' },
  { id: 'taa', label: 'TAA' },
];

export function RenderEngineSection() {
  const engine = useRenderEngine();
  const settings = useRenderEngineSettings();
  const status = useRenderEngineStatus();
  const patch = usePatchRenderEngineSettings();
  const resolvedPreset = derivePresetFromSettings(settings);

  const [renderState, setRenderState] = useState<{
    phase: 'idle' | 'running' | 'done' | 'error';
    progress: number;
    url: string | null;
    error: string | null;
  }>({ phase: 'idle', progress: 0, url: null, error: null });
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });

  useEffect(
    () => () => {
      abortRef.current.aborted = true;
    },
    [],
  );

  const applyPreset = useCallback(
    (preset: RenderQualityPreset) => {
      engine.settings.replace(applyPresetToSettings(settings, preset));
    },
    [engine, settings],
  );

  const runCinematic = useCallback(async () => {
    if (renderState.phase === 'running') {
      abortRef.current.aborted = true;
      return;
    }
    abortRef.current = { aborted: false };
    setRenderState({ phase: 'running', progress: 0, url: null, error: null });
    try {
      const blob = await engine.renderCalibrationStill({
        width: 960,
        height: 540,
        abortSignal: abortRef.current,
        onProgress: (done, target) =>
          setRenderState((prev) => ({ ...prev, progress: target > 0 ? done / target : 0 })),
      });
      const url = URL.createObjectURL(blob);
      setRenderState({ phase: 'done', progress: 1, url, error: null });
    } catch (err) {
      setRenderState({
        phase: 'error',
        progress: 0,
        url: null,
        error: err instanceof Error ? err.message : 'Render failed',
      });
    }
  }, [engine, renderState.phase]);

  const running = renderState.phase === 'running';

  return (
    <section className="setup-section setup-render-engine">
      <div className="flex items-center justify-between gap-2">
        <p className="setup-section-title">Render Engine</p>
        <label className="flex cursor-pointer items-center gap-1.5 text-[9px] font-bold tracking-wider text-mixer-muted">
          <input
            type="checkbox"
            className="h-4 w-4 accent-mixer-red"
            checked={settings.enabled}
            onChange={(e) => patch({ enabled: e.target.checked })}
          />
          {settings.enabled ? 'ENGINE ON' : 'ENGINE OFF'}
        </label>
      </div>
      <p className="mb-2 text-[9px] leading-snug text-mixer-muted">
        The CloudCast Render Engine is the GPU kernel behind every studio, motion graphic and
        artifact — WebGPU-first with WebGL2 fallback, running in the background and graded here.
      </p>

      {/* ---- Live status ------------------------------------------------- */}
      <div className="mb-2 rounded border border-white/10 bg-black/30 px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[9px]">
          <span
            className={cn(
              'font-bold tracking-wider',
              status.phase === 'ready'
                ? 'text-emerald-400'
                : status.phase === 'probing'
                  ? 'text-amber-300'
                  : 'text-mixer-red',
            )}
          >
            {status.phase.toUpperCase()}
          </span>
          <span className="text-mixer-muted">
            {status.backend.toUpperCase()}
            {status.webgpuAvailable && status.features.length > 0 ? ` · ${status.features.length} GPU FEATURES` : ''}
          </span>
          <span className="text-mixer-muted">{status.fps.toFixed(0)} FPS</span>
          <span className="text-mixer-muted">{status.frameMs.toFixed(1)} MS</span>
          {status.gpuMs !== null && <span className="text-mixer-muted">GPU {status.gpuMs.toFixed(2)} MS</span>}
          <span className="text-mixer-muted">{formatBytes(status.vramEstimateBytes)} VRAM</span>
        </div>
        <p className="mt-1 truncate text-[8px] text-mixer-muted">
          {status.adapterLabel}
          {status.vendor !== 'unknown' ? ` · ${status.vendor}` : ''}
        </p>
        {status.error && (
          <p className="mt-1 rounded border border-mixer-red/30 bg-mixer-red/10 px-2 py-1 text-[8px] leading-snug text-mixer-red">
            {status.error}
          </p>
        )}
      </div>

      {/* ---- Backend & quality ------------------------------------------- */}
      <div className="space-y-2">
        <div>
          <p className="atem-group-label mb-1.5">GPU backend</p>
          <Segmented
            options={[
              { id: 'auto' as EngineBackendPreference, label: 'AUTO' },
              { id: 'webgpu' as EngineBackendPreference, label: 'WEBGPU' },
              { id: 'webgl2' as EngineBackendPreference, label: 'WEBGL2' },
            ]}
            value={settings.backend}
            onChange={(backend) => patch({ backend })}
          />
        </div>

        <div>
          <p className="atem-group-label mb-1.5">
            Quality preset{resolvedPreset === 'custom' ? ' · CUSTOM' : ''}
          </p>
          <Segmented
            options={QUALITY_OPTIONS}
            value={resolvedPreset === 'custom' ? 'balanced' : resolvedPreset}
            onChange={applyPreset}
            disabled={!settings.enabled}
          />
          <div className="mt-1.5">
            <ToggleRow
              label="Auto quality"
              hint="Engine steps resolution/preset to hold the frame budget"
              checked={settings.autoQuality}
              onChange={(autoQuality) => patch({ autoQuality })}
            />
          </div>
          <div className="mt-1.5">
            <SliderRow
              label="Render scale"
              value={settings.renderScale}
              min={0.5}
              max={2}
              step={0.05}
              onChange={(renderScale) => patch({ renderScale })}
              format={(v) => `${Math.round(v * 100)}%`}
            />
          </div>
        </div>

        {/* ---- Display transform ------------------------------------------ */}
        <div>
          <p className="atem-group-label mb-1.5">Display transform</p>
          <div className="deck-duration-row">
            {TONE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => patch({ toneMapping: option.id })}
                className={cn(
                  'deck-pad-btn flex-1 px-1 py-1 text-[8px] uppercase',
                  settings.toneMapping === option.id && 'atem-toggle-on',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="mt-1.5 space-y-1.5">
            <SliderRow
              label="Exposure (EV)"
              value={settings.grade.exposure}
              min={-3}
              max={3}
              step={0.1}
              onChange={(exposure) => patch({ grade: { ...settings.grade, exposure } })}
              format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} EV`}
            />
            <SliderRow
              label="Contrast"
              value={settings.grade.contrast}
              min={-1}
              max={1}
              step={0.05}
              onChange={(contrast) => patch({ grade: { ...settings.grade, contrast } })}
            />
            <SliderRow
              label="Vibrance"
              value={settings.grade.vibrance}
              min={0}
              max={2}
              step={0.05}
              onChange={(vibrance) => patch({ grade: { ...settings.grade, vibrance } })}
            />
            <SliderRow
              label="Temperature"
              value={settings.grade.temperature}
              min={-1}
              max={1}
              step={0.05}
              onChange={(temperature) => patch({ grade: { ...settings.grade, temperature } })}
              format={(v) => (v < -0.02 ? `COOL ${v.toFixed(2)}` : v > 0.02 ? `WARM +${v.toFixed(2)}` : 'NEUTRAL')}
            />
          </div>
        </div>

        {/* ---- Anti-aliasing ---------------------------------------------- */}
        <div>
          <p className="atem-group-label mb-1.5">Anti-aliasing</p>
          <Segmented options={AA_OPTIONS} value={settings.antiAliasing} onChange={(antiAliasing) => patch({ antiAliasing })} />
          {settings.antiAliasing === 'msaa' && (
            <div className="mt-1.5">
              <Segmented
                options={[
                  { id: '2', label: '2×' },
                  { id: '4', label: '4×' },
                  { id: '8', label: '8×' },
                ]}
                value={String(settings.msaaSamples)}
                onChange={(value) => patch({ msaaSamples: Number(value) })}
              />
            </div>
          )}
        </div>

        {/* ---- Kernel features -------------------------------------------- */}
        <div>
          <p className="atem-group-label mb-1.5">Kernel features</p>
          <div className="space-y-2">
            <ToggleRow label="Ambient occlusion" hint="GTAO horizon-search kernel" checked={settings.gtao} onChange={(gtao) => patch({ gtao })} />
            <ToggleRow label="Bloom" hint="Progressive mip glow for lights & LED walls" checked={settings.bloom} onChange={(bloom) => patch({ bloom })} />
            <ToggleRow label="Depth of field" hint="Cinematic focus falloff on the beauty pass" checked={settings.depthOfField} onChange={(depthOfField) => patch({ depthOfField })} />
            <ToggleRow label="Sharpen" hint="Contrast-adaptive sharpen (CAS) on output" checked={settings.sharpen} onChange={(sharpen) => patch({ sharpen })} />
            <ToggleRow label="HDR output" hint="16-bit float pipeline where supported" checked={settings.hdrOutput} onChange={(hdrOutput) => patch({ hdrOutput })} />
            <ToggleRow label="Shadows" hint="High-quality shadow maps on the stages" checked={settings.shadows} onChange={(shadows) => patch({ shadows })} />
          </div>
          <div className="mt-2 space-y-1.5">
            <SliderRow label="Bloom intensity" value={settings.bloomIntensity} min={0} max={2} step={0.05} onChange={(bloomIntensity) => patch({ bloomIntensity })} />
            <SliderRow label="AO intensity" value={settings.gtaoIntensity} min={0} max={2} step={0.05} onChange={(gtaoIntensity) => patch({ gtaoIntensity })} />
            <SliderRow label="Vignette" value={settings.vignetteStrength} min={0} max={1} step={0.05} onChange={(vignetteStrength) => patch({ vignette: vignetteStrength > 0, vignetteStrength })} />
            <SliderRow label="Film grain" value={settings.filmGrainAmount} min={0} max={1} step={0.05} onChange={(filmGrainAmount) => patch({ filmGrain: filmGrainAmount > 0, filmGrainAmount })} />
            <SliderRow label="Chromatic aberration" value={settings.chromaticAberrationAmount} min={0} max={1} step={0.05} onChange={(chromaticAberrationAmount) => patch({ chromaticAberration: chromaticAberrationAmount > 0, chromaticAberrationAmount })} />
          </div>
        </div>

        {/* ---- Performance ------------------------------------------------ */}
        <div>
          <p className="atem-group-label mb-1.5">Performance</p>
          <Segmented
            options={[
              { id: 'performance' as PowerProfile, label: 'FULL' },
              { id: 'balanced' as PowerProfile, label: 'BAL' },
              { id: 'battery' as PowerProfile, label: 'ECO' },
            ]}
            value={settings.powerProfile}
            onChange={(powerProfile) => patch({ powerProfile })}
          />
          <div className="mt-1.5">
            <p className="atem-group-label mb-1.5">Background rendering</p>
            <Segmented
              options={[
                { id: 'off' as BackgroundRenderMode, label: 'PAUSE' },
                { id: 'throttled' as BackgroundRenderMode, label: 'THROTTLED' },
                { id: 'full' as BackgroundRenderMode, label: 'FULL' },
              ]}
              value={settings.backgroundRender}
              onChange={(backgroundRender) => patch({ backgroundRender })}
            />
            <p className="mt-1 text-[8px] leading-snug text-mixer-muted">
              What the engine keeps doing while the tab is hidden or consoles are off-screen.
            </p>
          </div>
          <div className="mt-1.5">
            <p className="atem-group-label mb-1.5">Frame cap</p>
            <Segmented
              options={[
                { id: '0', label: 'UNCAPPED' },
                { id: '30', label: '30' },
                { id: '60', label: '60' },
                { id: '120', label: '120' },
              ]}
              value={String(settings.maxFrameRate)}
              onChange={(value) => patch({ maxFrameRate: Number(value) })}
            />
          </div>
        </div>

        {/* ---- Cinematic renderer ----------------------------------------- */}
        <div>
          <p className="atem-group-label mb-1.5">Cinematic renderer (path traced)</p>
          <p className="mb-1.5 text-[8px] leading-snug text-mixer-muted">
            Progressive path tracer with BVH acceleration, MIS lighting and SVGF denoise — renders
            photoreal stills of the calibration studio through the engine grade.
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            <label className="block">
              <span className="mb-0.5 block text-[8px] font-bold tracking-wider text-mixer-muted">SAMPLES</span>
              <select
                value={settings.cinematic.samples}
                onChange={(e) => patch({ cinematic: { ...settings.cinematic, samples: Number(e.target.value) } })}
                className="w-full rounded border border-white/10 bg-black px-1 py-1 text-[9px] outline-none"
              >
                {[32, 64, 128, 256, 512].map((v) => (
                  <option key={v} value={v}>
                    {v} spp
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[8px] font-bold tracking-wider text-mixer-muted">BOUNCES</span>
              <select
                value={settings.cinematic.bounces}
                onChange={(e) => patch({ cinematic: { ...settings.cinematic, bounces: Number(e.target.value) } })}
                className="w-full rounded border border-white/10 bg-black px-1 py-1 text-[9px] outline-none"
              >
                {[2, 3, 4, 6, 8].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[8px] font-bold tracking-wider text-mixer-muted">DENOISE</span>
              <select
                value={settings.cinematic.denoise}
                onChange={(e) =>
                  patch({ cinematic: { ...settings.cinematic, denoise: e.target.value as DenoiserMode } })
                }
                className="w-full rounded border border-white/10 bg-black px-1 py-1 text-[9px] outline-none"
              >
                <option value="atrous">SVGF</option>
                <option value="off">Off</option>
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={() => void runCinematic()}
            disabled={status.webgpuAvailable === false && renderState.phase !== 'running'}
            className={cn(
              'deck-pad-btn deck-pad-btn-lg mt-2 flex w-full items-center justify-center gap-2',
              running && 'atem-toggle-on',
            )}
          >
            {running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {running ? 'STOP RENDER' : 'RENDER CINEMATIC STILL'}
          </button>

          {running && (
            <div className="mt-1.5">
              <div className="h-1.5 w-full overflow-hidden rounded bg-white/10">
                <div
                  className="h-full bg-mixer-red transition-all"
                  style={{ width: `${Math.round(renderState.progress * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[8px] tracking-wider text-mixer-muted">
                {Math.round(renderState.progress * 100)}% · {status.cinematicSamples}/{status.cinematicTargetSamples} SPP
              </p>
            </div>
          )}

          {renderState.phase === 'error' && renderState.error && (
            <p className="mt-1.5 rounded border border-mixer-red/30 bg-mixer-red/10 px-2 py-1 text-[8px] text-mixer-red">
              {renderState.error}
            </p>
          )}

          {renderState.phase === 'done' && renderState.url && (
            <div className="mt-1.5 rounded border border-white/10 bg-black/30 p-1.5">
              <img src={renderState.url} alt="Cinematic render preview" className="w-full rounded" />
              <a
                href={renderState.url}
                download="cloudcast-cinematic-still.png"
                className="deck-pad-btn mt-1.5 flex w-full items-center justify-center gap-2"
              >
                <Download className="h-3 w-3" /> DOWNLOAD PNG
              </a>
            </div>
          )}

          <div className="mt-2 flex items-center gap-1.5 text-[8px] text-mixer-muted">
            <Gauge className="h-3 w-3" />
            <span>
              Benchmark on next boot when auto quality is on. Hardware timing uses GPU timestamp
              queries when the adapter supports them.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
