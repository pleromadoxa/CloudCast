import { useMemo, useState } from 'react';
import { Download, FileAudio, X } from 'lucide-react';
import type { ExportFormat, ExportSettings, SymphonyProject } from '../../types/symphony';
import { defaultExportSettings } from '../../types/symphony';
import { downloadBlob, estimateFileSizeBytes, exportProjectAudio, exportStemsZip, projectEndBeat, renderWindowBeats, stemTracks } from '../../lib/symphony/exportAudio';
import { SymphonyButton } from './SymphonyButton';
import { ToggleSwitch } from './hardware/LcdPanel';
import { cn } from '../../lib/utils';

export interface ExportDialogProps {
  project: SymphonyProject;
  initialSettings?: Partial<ExportSettings>;
  onClose: () => void;
  onExported?: (fileName: string) => void;
}

const FORMAT_INFO: Record<ExportFormat, { title: string; sub: string }> = {
  wav: { title: 'WAV', sub: 'PCM · uncompressed' },
  aiff: { title: 'AIFF', sub: 'PCM · Apple/SGI' },
  mp3: { title: 'MP3', sub: 'MPEG · compressed' },
};

type Stage = 'idle' | 'rendering' | 'encoding' | 'done' | 'error';

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="sym-settings__row">
      <span>{label}</span>
      {children}
    </div>
  );
}

export function ExportDialog({ project, initialSettings, onClose, onExported }: ExportDialogProps) {
  const [settings, setSettings] = useState<ExportSettings>(() => ({
    ...defaultExportSettings(project.name),
    ...initialSettings,
    fileName: initialSettings?.fileName ?? project.name,
  }));
  const [stage, setStage] = useState<Stage>('idle');
  const [status, setStatus] = useState<string | null>(null);
  const [stemProgress, setStemProgress] = useState<{ stemIndex: number; stemCount: number; trackName: string } | null>(null);
  const [scope, setScope] = useState<'mixdown' | 'stems'>('mixdown');

  const patch = (p: Partial<ExportSettings>) => setSettings((s) => ({ ...s, ...p }));

  const stemCount = useMemo(() => stemTracks(project).length, [project]);
  const stemsMode = scope === 'stems';

  const durationSec = useMemo(() => {
    const { startBeat, endBeat } = renderWindowBeats(project, {
      sampleRate: settings.sampleRate,
      range: settings.range,
      includeTail: settings.includeTail,
    });
    return ((endBeat - startBeat) * 60) / project.tempo + (settings.includeTail ? 2.5 : 0);
  }, [project, settings.range, settings.includeTail, settings.sampleRate]);

  const estimatedBytes = useMemo(() => {
    const spec = stemsMode ? { ...settings, format: 'wav' as ExportFormat } : settings;
    const per = estimateFileSizeBytes(spec, durationSec);
    return stemsMode ? per * Math.max(1, stemCount) : per;
  }, [settings, durationSec, stemsMode, stemCount]);

  const busy = stage === 'rendering' || stage === 'encoding';

  const handleExport = async () => {
    setStage('rendering');
    setStatus(null);
    setStemProgress(null);
    try {
      if (stemsMode) {
        const { blob, fileName } = await exportStemsZip(
          project,
          { ...settings, format: 'wav' },
          (s, info) => { setStage(s); setStemProgress(info ?? null); },
        );
        downloadBlob(blob, fileName);
        setStage('done');
        setStatus(`Exported ${stemCount} stems → ${fileName} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
        onExported?.(fileName);
        return;
      }
      const { blob, fileName } = await exportProjectAudio(project, settings, (s) => setStage(s));
      downloadBlob(blob, fileName);
      setStage('done');
      setStatus(`Exported ${fileName} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
      onExported?.(fileName);
    } catch (err) {
      setStage('error');
      setStatus(err instanceof Error ? err.message : 'Export failed');
    }
  };

  return (
    <div className="sym-dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sym-dialog sym-grain relative" role="dialog" aria-label="Export mixdown">
        <div className="sym-dialog__title">
          <span className="flex items-center gap-2">
            <FileAudio className="h-4 w-4 text-violet-300" /> Export Mixdown
          </span>
          <button type="button" onClick={onClose} aria-label="Close" className="text-white/50 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="sym-format-tabs">
          <button
            type="button"
            className={cn('sym-format-tab', !stemsMode && 'sym-format-tab--active')}
            onClick={() => setScope('mixdown')}
          >
            <div>MIXDOWN</div>
            <div className="mt-0.5 text-[7px] font-semibold tracking-widest opacity-70">Single stereo file</div>
          </button>
          <button
            type="button"
            className={cn('sym-format-tab', stemsMode && 'sym-format-tab--active')}
            onClick={() => setScope('stems')}
          >
            <div>STEMS</div>
            <div className="mt-0.5 text-[7px] font-semibold tracking-widest opacity-70">Per-track WAV · ZIP</div>
          </button>
        </div>

        {!stemsMode && (
          <div className="sym-format-tabs">
            {(Object.keys(FORMAT_INFO) as ExportFormat[]).map((fmt) => (
              <button
                key={fmt}
                type="button"
                className={cn('sym-format-tab', settings.format === fmt && 'sym-format-tab--active')}
                onClick={() => patch({ format: fmt })}
              >
                <div>{FORMAT_INFO[fmt].title}</div>
                <div className="mt-0.5 text-[7px] font-semibold tracking-widest opacity-70">{FORMAT_INFO[fmt].sub}</div>
              </button>
            ))}
          </div>
        )}

        <div className="sym-settings__group">
          <div className="flex flex-col gap-2">
            <SettingRow label="File name">
              <input
                type="text"
                className="sym-settings__number"
                style={{ width: 180 }}
                value={settings.fileName}
                onChange={(e) => patch({ fileName: e.target.value })}
              />
            </SettingRow>
            <SettingRow label="Sample rate">
              <select
                className="sym-settings__select"
                value={settings.sampleRate}
                onChange={(e) => patch({ sampleRate: Number(e.target.value) })}
              >
                <option value={44100}>44.1 kHz</option>
                <option value={48000}>48 kHz</option>
                <option value={96000}>96 kHz</option>
              </select>
            </SettingRow>
            {(stemsMode || settings.format !== 'mp3') && (
              <SettingRow label="Bit depth">
                <select
                  className="sym-settings__select"
                  value={settings.bitDepth}
                  onChange={(e) => patch({ bitDepth: Number(e.target.value) as 16 | 24 })}
                >
                  <option value={16}>16-bit (dithered)</option>
                  <option value={24}>24-bit</option>
                </select>
              </SettingRow>
            )}
            {!stemsMode && settings.format === 'mp3' && (
              <SettingRow label="Bitrate">
                <select
                  className="sym-settings__select"
                  value={settings.mp3BitrateKbps}
                  onChange={(e) => patch({ mp3BitrateKbps: Number(e.target.value) as ExportSettings['mp3BitrateKbps'] })}
                >
                  <option value={128}>128 kbps</option>
                  <option value={192}>192 kbps</option>
                  <option value={256}>256 kbps</option>
                  <option value={320}>320 kbps</option>
                </select>
              </SettingRow>
            )}
            <SettingRow label="Export range">
              <select
                className="sym-settings__select"
                value={settings.range}
                onChange={(e) => patch({ range: e.target.value as ExportSettings['range'] })}
              >
                <option value="project">Entire project</option>
                <option value="cycle" disabled={!project.useCycleRegion}>
                  Cycle region{!project.useCycleRegion ? ' (enable cycle first)' : ''}
                </option>
              </select>
            </SettingRow>
            <SettingRow label="Normalize to −1 dBFS">
              <ToggleSwitch
                label="Normalize"
                checked={settings.normalize}
                onChange={(normalize) => patch({ normalize })}
              />
            </SettingRow>
            <SettingRow label="Include effect tail">
              <ToggleSwitch
                label="Include effect tail"
                checked={settings.includeTail}
                onChange={(includeTail) => patch({ includeTail })}
              />
            </SettingRow>
          </div>
        </div>

        <div className="sym-lcd-pro mt-3 flex items-center justify-between px-3 py-2">
          <div>
            <div className="sym-lcd-pro__label">Estimated</div>
            <div className="sym-lcd-pro__value sym-lcd-pro__value--sm">
              {stemsMode ? `${stemCount} stems · ` : ''}{(estimatedBytes / 1024 / 1024).toFixed(2)} MB · {durationSec.toFixed(1)}s
            </div>
          </div>
          <div className="text-right">
            <div className="sym-lcd-pro__label">Range</div>
            <div className="sym-lcd-pro__value sym-lcd-pro__value--sm">
              {settings.range === 'cycle' ? `CYCLE ${project.cycleStartBar ?? 0}–${project.cycleEndBar ?? 0}` : `0–${Math.ceil(projectEndBeat(project) / 4)} BARS`}
            </div>
          </div>
        </div>

        {(busy || status) && (
          <div className="mt-3">
            <div className="sym-progress">
              <div
                className="sym-progress__bar"
                style={{
                  width: stage === 'rendering' ? '45%' : stage === 'encoding' ? '85%' : stage === 'done' ? '100%' : stage === 'error' ? '100%' : '0%',
                  background: stage === 'error'
                    ? 'linear-gradient(90deg,#b91c1c,#ef4444)'
                    : undefined,
                }}
              />
            </div>
            <p className={cn('mt-1.5 text-[10px]', stage === 'error' ? 'text-red-300' : 'text-white/55')}>
              {status ?? (stemProgress && (stage === 'rendering' || stage === 'encoding')
                ? `${stage === 'rendering' ? 'Rendering' : 'Encoding'} stem ${stemProgress.stemIndex + 1}/${stemProgress.stemCount} · ${stemProgress.trackName}…`
                : stage === 'rendering' ? 'Rendering mix through console graph…' : 'Encoding audio…')}
            </p>
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <SymphonyButton variant="default" accent="neutral" onClick={onClose} disabled={busy}>
            CANCEL
          </SymphonyButton>
          <SymphonyButton variant="default" accent="violet" onClick={() => void handleExport()} disabled={busy || (stemsMode && stemCount === 0)}>
            <Download className="h-3 w-3" /> {stemsMode ? `EXPORT ${stemCount} STEMS (ZIP)` : `EXPORT ${settings.format.toUpperCase()}`}
          </SymphonyButton>
        </div>
      </div>
    </div>
  );
}
