import { useRef, useState } from 'react';
import { Move3D, Upload } from 'lucide-react';
import { validateGltfFile, type ImportedModelEntry } from './ImportedModelGroup';
import { cn } from '../../lib/utils';

interface ImportModelPanelProps {
  models: ImportedModelEntry[];
  onAdd: (entry: ImportedModelEntry) => void;
  onUpdate: (id: string, patch: Partial<ImportedModelEntry>) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

function TransformSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-[10px]">
      <span className="text-mixer-muted">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-0.5 w-full accent-amber-500"
      />
      <span className="text-[9px] text-amber-300/80">{value.toFixed(2)}</span>
    </label>
  );
}

export function ImportModelPanel({ models, onAdd, onUpdate, onRemove, disabled }: ImportModelPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = models.find((m) => m.id === selectedId) ?? null;

  const handleFile = (file: File) => {
    if (!validateGltfFile(file)) return;
    const url = URL.createObjectURL(file);
    const entry: ImportedModelEntry = {
      id: crypto.randomUUID(),
      name: file.name.replace(/\.(glb|gltf)$/i, ''),
      url,
      position: [0.8, 0, -0.5],
      rotation: [0, 0, 0],
      scale: 0.5,
    };
    onAdd(entry);
    setSelectedId(entry.id);
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded border border-dashed border-amber-500/40 py-3 text-[10px] font-bold tracking-wider text-amber-300 hover:bg-amber-500/10 disabled:opacity-40"
      >
        <Upload className="h-3.5 w-3.5" />
        IMPORT GLTF / GLB
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
      {models.length === 0 ? (
        <p className="text-[10px] text-mixer-muted">Add 3D props to your virtual set (Pro Master).</p>
      ) : (
        <ul className="space-y-1">
          {models.map((m) => (
            <li key={m.id} className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-xs">
              <button
                type="button"
                onClick={() => setSelectedId(m.id === selectedId ? null : m.id)}
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-1 truncate text-left',
                  selectedId === m.id ? 'text-amber-300' : 'hover:text-white',
                )}
              >
                <Move3D className="h-3 w-3 shrink-0" />
                {m.name}
              </button>
              <button type="button" onClick={() => onRemove(m.id)} className="text-[10px] text-mixer-red hover:underline">
                REMOVE
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <div className="space-y-2 rounded border border-amber-500/25 bg-black/40 p-2">
          <p className="text-[10px] font-bold tracking-wider text-amber-300">TRANSFORM · {selected.name}</p>
          <TransformSlider
            label="Pos X"
            value={selected.position[0]}
            min={-3}
            max={3}
            step={0.05}
            onChange={(v) => onUpdate(selected.id, { position: [v, selected.position[1], selected.position[2]] })}
          />
          <TransformSlider
            label="Pos Y"
            value={selected.position[1]}
            min={-2}
            max={3}
            step={0.05}
            onChange={(v) => onUpdate(selected.id, { position: [selected.position[0], v, selected.position[2]] })}
          />
          <TransformSlider
            label="Pos Z"
            value={selected.position[2]}
            min={-4}
            max={2}
            step={0.05}
            onChange={(v) => onUpdate(selected.id, { position: [selected.position[0], selected.position[1], v] })}
          />
          <TransformSlider
            label="Rotate Y"
            value={selected.rotation[1]}
            min={-Math.PI}
            max={Math.PI}
            step={0.05}
            onChange={(v) => onUpdate(selected.id, { rotation: [selected.rotation[0], v, selected.rotation[2]] })}
          />
          <TransformSlider
            label="Scale"
            value={selected.scale}
            min={0.1}
            max={3}
            step={0.05}
            onChange={(v) => onUpdate(selected.id, { scale: v })}
          />
        </div>
      )}
    </div>
  );
}
