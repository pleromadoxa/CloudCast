import { useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import type { IpCameraConfig } from '../../../types/ipCamera';
import { validateIpCameraUrl } from '../../../lib/ipCameraUrl';
import { cn } from '../../../lib/utils';

interface IpCameraPanelProps {
  allowed: boolean;
  config: IpCameraConfig | null;
  slotNumber: number;
  onSave: (input: { label: string; url: string; enabled: boolean }) => { ok: boolean; message: string };
  onRemove: () => void;
}

export function IpCameraPanel({ allowed, config, slotNumber, onSave, onRemove }: IpCameraPanelProps) {
  const [label, setLabel] = useState(config?.label ?? 'IP Camera');
  const [url, setUrl] = useState(config?.url ?? '');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!allowed) {
    return (
      <div className="rounded border border-dashed border-mixer-border bg-mixer-surface px-2 py-1.5">
        <p className="text-[9px] text-mixer-muted">IP camera URL inputs are available on Pro and Pro Master plans.</p>
      </div>
    );
  }

  const handleSave = () => {
    setError(null);
    setNotice(null);
    const check = validateIpCameraUrl(url);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    const result = onSave({ label, url, enabled: true });
    if (result.ok) setNotice(result.message);
    else setError(result.message);
  };

  const handleRemove = () => {
    onRemove();
    setUrl('');
    setLabel('IP Camera');
    setNotice('IP camera removed.');
    setError(null);
  };

  return (
    <div className="rounded border border-mixer-green/30 bg-mixer-surface px-2 py-2">
      <div className="flex items-center gap-1.5 text-[10px] font-bold">
        <Camera className="h-3.5 w-3.5 text-mixer-green" />
        IP CAMERA URL
        <span className="ml-auto text-[8px] font-normal text-mixer-muted">Input {slotNumber}</span>
      </div>
      <p className="mt-1 text-[9px] leading-relaxed text-mixer-muted">
        Add one network camera via HLS (.m3u8), Regal Cloud WebRTC, MJPEG, or direct HTTP video. RTSP requires an on-prem relay.
      </p>

      <div className="mt-2 grid gap-1.5">
        <input
          className="layer-field-input text-[10px]"
          placeholder="Label (e.g. Lobby Cam)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <input
          className="layer-field-input text-[10px]"
          placeholder="https://camera.example.com/stream.m3u8"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>

      {error && <p className="mt-1.5 text-[9px] text-mixer-red">{error}</p>}
      {notice && <p className="mt-1.5 text-[9px] text-mixer-green">{notice}</p>}

      <div className="mt-2 flex gap-1">
        <button type="button" onClick={handleSave} className={cn('mixer-btn flex-1 py-1 text-[9px]', config?.enabled && 'mixer-btn-active')}>
          {config?.enabled ? 'Update stream' : 'Add to mixer'}
        </button>
        {config?.enabled && (
          <button type="button" onClick={handleRemove} className="mixer-btn px-2 py-1 text-mixer-red" title="Remove IP camera">
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
