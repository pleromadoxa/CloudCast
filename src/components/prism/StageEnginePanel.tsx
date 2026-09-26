/**
 * Prism Stage Engine panel — the operator's engine rack.
 *
 * Chooses which renderer draws the virtual set and tunes it: the reference
 * three.js engine, the Babylon.js engine, or a live Unreal Engine render over
 * Pixel Streaming. The raw WGSL kernel is listed for reference because it is
 * what powers the cinematic renderer and the post chain.
 */
import {
  Boxes,
  Cpu,
  Radio,
  RotateCcw,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useStageEngine } from '../../hooks/useStageEngine';
import type {
  BabylonStageSettings,
  StageEngineAvailability,
  StageEngineDescriptor,
  StageEngineId,
  UnrealStreamSettings,
} from '../../lib/stageEngines';
import { PanelField, PanelHeader, PanelNote, PanelSection, PanelToggle, panelInputClass } from './PanelChrome';

function capabilityLabel(capability: string): string {
  switch (capability) {
    case 'webgpu':
      return 'WebGPU';
    case 'webgl2':
      return 'WebGL2';
    case 'pbr':
      return 'PBR';
    case 'ibl-hdr':
      return 'HDR IBL';
    case 'realtime-shadows':
      return 'Soft shadows';
    case 'path-tracing':
      return 'Path traced';
    case 'compute-post':
      return 'Compute post';
    case 'webrtc':
      return 'WebRTC';
    case 'xr':
      return 'XR ready';
    case 'ar-key':
      return 'AR key';
    case 'gltf':
      return 'glTF';
    case 'custom-shaders':
      return 'Custom WGSL/GLSL';
    default:
      return capability;
  }
}

const ENGINE_ICON: Record<StageEngineId, LucideIcon> = {
  'prism-three': Sparkles,
  'prism-babylon': Boxes,
  'unreal-pixelstream': Radio,
  'wgsl-native': Cpu,
};

function EngineCard({
  engine,
  availability,
  active,
  onSelect,
}: {
  engine: StageEngineDescriptor;
  availability: StageEngineAvailability | undefined;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = ENGINE_ICON[engine.id];
  const unavailable = availability ? !availability.available : false;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={unavailable}
      className={cn(
        'w-full rounded-lg border p-3 text-left transition-colors',
        active
          ? 'border-amber-500/60 bg-amber-500/10'
          : unavailable
            ? 'cursor-not-allowed border-white/5 bg-black/30 opacity-55'
            : 'border-white/10 bg-black/40 hover:border-white/25',
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="mt-0.5 shrink-0 rounded border p-1.5"
          style={{
            borderColor: `${engine.accent}44`,
            backgroundColor: `${engine.accent}18`,
            color: engine.accent,
          }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[11px] font-bold text-white">{engine.name}</span>
            {availability?.recommended ? (
              <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-300">
                Recommended
              </span>
            ) : null}
            {active ? (
              <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-300">
                On air
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[9px] uppercase tracking-wider text-mixer-muted">{engine.vendor}</p>
          <p className="mt-1 text-[10px] leading-snug text-slate-300">{engine.tagline}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {engine.capabilities.map((capability) => (
              <span
                key={capability}
                className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[8px] font-medium text-slate-400"
              >
                {capabilityLabel(capability)}
              </span>
            ))}
          </div>
          {availability && (
            <p
              className={cn(
                'mt-2 text-[9px] leading-snug',
                availability.available ? 'text-emerald-300/80' : 'text-rose-300/80',
              )}
            >
              {availability.reason}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (next: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-[10px] font-bold tracking-wider text-mixer-muted">
        {label}
        <span className="tabular-nums text-white/80">
          {value.toFixed(step < 1 ? 2 : 0)}
          {suffix ?? ''}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full accent-amber-500"
      />
    </label>
  );
}

function BabylonTuning({
  settings,
  patch,
}: {
  settings: BabylonStageSettings;
  patch: (partial: Partial<BabylonStageSettings>) => void;
}) {
  return (
    <>
      <PanelField label="Display transform">
        <select
          className={panelInputClass}
          value={settings.toneMapping}
          onChange={(event) => patch({ toneMapping: event.target.value as BabylonStageSettings['toneMapping'] })}
        >
          <option value="aces">ACES</option>
          <option value="neutral">KHR Neutral</option>
          <option value="agx">AgX</option>
          <option value="filmic">Filmic</option>
          <option value="reinhard">Reinhard</option>
        </select>
      </PanelField>

      <PanelField label="Anti-aliasing">
        <select
          className={panelInputClass}
          value={settings.antiAliasing}
          onChange={(event) => patch({ antiAliasing: event.target.value as BabylonStageSettings['antiAliasing'] })}
        >
          <option value="msaa">MSAA (multisample)</option>
          <option value="fxaa">FXAA (post)</option>
          <option value="none">Off</option>
        </select>
      </PanelField>

      <PanelField label="Shadow filter">
        <select
          className={panelInputClass}
          value={settings.shadowFilter}
          onChange={(event) => patch({ shadowFilter: event.target.value as BabylonStageSettings['shadowFilter'] })}
        >
          <option value="pcss">PCSS — contact hardening</option>
          <option value="blur">ESM blur</option>
          <option value="pcf">PCF</option>
        </select>
      </PanelField>

      <RangeControl
        label="Environment intensity"
        value={settings.environmentIntensity}
        min={0}
        max={3}
        step={0.05}
        onChange={(next) => patch({ environmentIntensity: next })}
      />
      <RangeControl
        label="Exposure"
        value={settings.exposure}
        min={0.1}
        max={3}
        step={0.05}
        onChange={(next) => patch({ exposure: next })}
      />
      <RangeControl
        label="Contrast"
        value={settings.contrast}
        min={0.5}
        max={2}
        step={0.02}
        onChange={(next) => patch({ contrast: next })}
      />
      <RangeControl
        label="Bloom intensity"
        value={settings.bloomIntensity}
        min={0}
        max={2}
        step={0.05}
        onChange={(next) => patch({ bloomIntensity: next })}
      />

      <PanelToggle
        label="Physically correct falloff"
        description="Inverse-square light decay — required for a true metal response"
        checked={settings.physicallyCorrectLights}
        onChange={(next) => patch({ physicallyCorrectLights: next })}
      />
      <PanelToggle label="Bloom" checked={settings.bloom} onChange={(next) => patch({ bloom: next })} />
      <PanelToggle
        label="Depth of field"
        checked={settings.depthOfField}
        onChange={(next) => patch({ depthOfField: next })}
      />
      <PanelToggle label="Vignette" checked={settings.vignette} onChange={(next) => patch({ vignette: next })} />
      <PanelToggle label="Film grain" checked={settings.grain} onChange={(next) => patch({ grain: next })} />
      <PanelToggle label="Screen-space AO" checked={settings.ssao} onChange={(next) => patch({ ssao: next })} />
      <PanelToggle
        label="Screen-space reflections"
        checked={settings.ssr}
        onChange={(next) => patch({ ssr: next })}
      />
      <PanelToggle
        label="Image processing"
        description="Tone mapping, exposure and vignette stage"
        checked={settings.imageProcessing}
        onChange={(next) => patch({ imageProcessing: next })}
      />
    </>
  );
}

function UnrealTuning({
  settings,
  patch,
}: {
  settings: UnrealStreamSettings;
  patch: (partial: Partial<UnrealStreamSettings>) => void;
}) {
  return (
    <>
      <PanelField label="Signalling URL">
        <input
          className={panelInputClass}
          value={settings.signallingUrl}
          placeholder="ws://localhost:8888 — or wss://stream.example.com"
          onChange={(event) => patch({ signallingUrl: event.target.value })}
        />
      </PanelField>
      <PanelToggle
        label="Connect automatically"
        checked={settings.autoConnect}
        onChange={(next) => patch({ autoConnect: next })}
      />
      <PanelField label="Quality">
        <select
          className={panelInputClass}
          value={settings.quality}
          onChange={(event) => patch({ quality: event.target.value as UnrealStreamSettings['quality'] })}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="epic">Epic</option>
          <option value="cinematic">Cinematic</option>
        </select>
      </PanelField>
      <PanelField label="Resolution">
        <select
          className={panelInputClass}
          value={settings.resolution}
          onChange={(event) => patch({ resolution: event.target.value as UnrealStreamSettings['resolution'] })}
        >
          <option value="1280x720">1280 × 720</option>
          <option value="1920x1080">1920 × 1080</option>
          <option value="2560x1440">2560 × 1440</option>
          <option value="3840x2160">3840 × 2160</option>
        </select>
      </PanelField>

      <PanelToggle
        label="Forward mouse"
        description="Hover, click and wheel reach the Unreal viewport"
        checked={settings.hoverMouse}
        onChange={(next) => patch({ hoverMouse: next })}
      />
      <PanelToggle
        label="Forward keyboard"
        checked={settings.keyboardInput}
        onChange={(next) => patch({ keyboardInput: next })}
      />
      <PanelToggle
        label="Forward touch"
        checked={settings.touchInput}
        onChange={(next) => patch({ touchInput: next })}
      />
      <PanelToggle
        label="Force TURN relay"
        description="Route media through a TURN server even when host candidates exist"
        checked={settings.forceTURN}
        onChange={(next) => patch({ forceTURN: next })}
      />
      {settings.forceTURN ? (
        <>
          <PanelField label="TURN URL">
            <input
              className={panelInputClass}
              value={settings.turnUrl}
              placeholder="turn:turn.example.com:3478"
              onChange={(event) => patch({ turnUrl: event.target.value })}
            />
          </PanelField>
          <PanelField label="TURN username">
            <input
              className={panelInputClass}
              value={settings.turnUsername}
              onChange={(event) => patch({ turnUsername: event.target.value })}
            />
          </PanelField>
          <PanelField label="TURN credential">
            <input
              className={panelInputClass}
              type="password"
              value={settings.turnCredential}
              onChange={(event) => patch({ turnCredential: event.target.value })}
            />
          </PanelField>
        </>
      ) : null}

      <PanelNote tone="amber">
        Unreal Engine has no in-browser scene renderer — CloudCast drives it through Epic's Pixel
        Streaming (WebRTC). Run a Pixel Streaming host, expose its signalling URL above, and the
        stage mounts the live Unreal render with input forwarded from this console.
      </PanelNote>
    </>
  );
}

export function StageEnginePanel() {
  const {
    settings,
    availability,
    probing,
    activeEngine,
    fellBack,
    engines,
    setEngine,
    patchBabylon,
    patchUnreal,
    patchSettings,
    reset,
    reprobe,
  } = useStageEngine();

  const availabilityFor = (id: StageEngineId) => availability.find((entry) => entry.id === id);

  return (
    <div className="space-y-3">
      <PanelHeader
        icon={Cpu}
        title="Render Engines"
        subtitle="Pick the renderer behind the virtual stage and tune its material, lighting and stream"
        action={
          <button
            type="button"
            onClick={reprobe}
            className="rounded border border-white/10 bg-black/40 p-1.5 text-mixer-muted transition-colors hover:border-amber-500/40 hover:text-amber-300"
            title="Re-probe this device"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        }
      />

      {fellBack ? (
        <PanelNote tone="amber">
          Your first choice could not start on this device, so the stage is running on the fallback
          engine. Everything else in the pipeline is unaffected.
        </PanelNote>
      ) : null}

      <PanelSection title="Stage engine" accent hint={probing ? 'Probing this device…' : undefined}>
        <div className="space-y-2">
          {engines.map((engine) => (
            <EngineCard
              key={engine.id}
              engine={engine}
              availability={availabilityFor(engine.id)}
              active={engine.id === activeEngine}
              onSelect={() => setEngine(engine.id)}
            />
          ))}
        </div>
        <PanelNote>
          <span className="font-semibold text-slate-300">WGSL Kernel</span> — the CloudCast Render
          Engine's raw WebGPU compute path powers the cinematic path tracer and the real-time post
          chain used by both local engines. It is configured in the mixer's Render Engine settings.
        </PanelNote>
      </PanelSection>

      {activeEngine === 'prism-babylon' ? (
        <PanelSection title="Babylon tuning">
          <BabylonTuning settings={settings.babylon} patch={patchBabylon} />
        </PanelSection>
      ) : null}

      {activeEngine === 'unreal-pixelstream' ? (
        <PanelSection title="Unreal Pixel Streaming">
          <UnrealTuning settings={settings.unreal} patch={patchUnreal} />
        </PanelSection>
      ) : null}

      <PanelSection title="Engine policy">
        <PanelToggle
          label="Automatic fallback"
          description="Drop to the other browser engine if the first one cannot start"
          checked={settings.autoFallback}
          onChange={(next) => patchSettings({ autoFallback: next })}
        />
        <PanelField label="Fallback engine">
          <select
            className={panelInputClass}
            value={settings.fallbackEngine}
            onChange={(event) =>
              patchSettings({ fallbackEngine: event.target.value as StageEngineId })
            }
          >
            {engines.map((engine) => (
              <option key={engine.id} value={engine.id}>
                {engine.name}
              </option>
            ))}
          </select>
        </PanelField>
        <button
          type="button"
          onClick={reset}
          className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-mixer-muted transition-colors hover:border-rose-500/40 hover:text-rose-300"
        >
          Reset engine settings
        </button>
      </PanelSection>
    </div>
  );
}

export default StageEnginePanel;
