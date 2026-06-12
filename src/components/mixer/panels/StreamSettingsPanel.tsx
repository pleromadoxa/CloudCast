import { useCallback, useEffect, useState } from 'react';
import { Plus, Radio, Save, Trash2, Wifi } from 'lucide-react';
import type { PlanTier } from '../../../types/plans';
import type { StreamDestination, StreamDestinationInput, StreamPlatform } from '../../../types/streaming';
import {
  STREAM_PLATFORM_DEFAULTS,
  STREAM_PLATFORM_LABELS,
} from '../../../types/streaming';
import {
  countYouTubeDestinations,
  resolveStreamLimits,
  validateConcurrentStreamStart,
  validateDestinationSave,
} from '../../../lib/streamingLimits';
import {
  deleteStreamDestination,
  fetchStreamDestinations,
  saveStreamDestination,
} from '../../../lib/streamingService';
import { validateStreamConfigLocal } from '../../../lib/streamValidation';
import { PasswordInput } from '../../ui/PasswordInput';
import { cn } from '../../../lib/utils';

interface StreamSettingsPanelProps {
  planId: PlanTier;
  isOnAir: boolean;
  isValidating?: boolean;
  onGoLive: () => void;
  onTestConnection: (input: {
    name: string;
    streamUrl: string;
    streamKey: string;
    platform: StreamPlatform;
  }) => Promise<{ ok: boolean; message: string }>;
  externalNotice?: { type: 'error' | 'success' | 'info'; message: string } | null;
}

const PLATFORMS: StreamPlatform[] = ['youtube', 'twitch', 'facebook', 'custom'];

function emptyForm(sortOrder: number): StreamDestinationInput {
  return {
    name: '',
    platform: 'youtube',
    streamUrl: STREAM_PLATFORM_DEFAULTS.youtube.url,
    streamKey: '',
    isEnabled: false,
    sortOrder,
  };
}

export function StreamSettingsPanel({
  planId,
  isOnAir,
  isValidating,
  onGoLive,
  onTestConnection,
  externalNotice,
}: StreamSettingsPanelProps) {
  const limits = resolveStreamLimits(planId);
  const [destinations, setDestinations] = useState<StreamDestination[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StreamDestinationInput>(emptyForm(0));
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (externalNotice) {
      setError(externalNotice.type === 'error' ? externalNotice.message : null);
      setSuccess(externalNotice.type === 'success' ? externalNotice.message : null);
    }
  }, [externalNotice]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchStreamDestinations();
      setDestinations(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stream settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startNew = () => {
    setEditingId(null);
    setForm(emptyForm(destinations.length));
    setError(null);
    setSuccess(null);
  };

  const startEdit = (d: StreamDestination) => {
    setEditingId(d.id);
    setForm({
      id: d.id,
      name: d.name,
      platform: d.platform,
      streamUrl: d.streamUrl,
      streamKey: d.streamKey,
      isEnabled: d.isEnabled,
      sortOrder: d.sortOrder,
    });
    setError(null);
    setSuccess(null);
  };

  const handlePlatformChange = (platform: StreamPlatform) => {
    setForm((prev) => ({
      ...prev,
      platform,
      streamUrl: prev.streamUrl || STREAM_PLATFORM_DEFAULTS[platform].url,
    }));
  };

  const handleTestConnection = async () => {
    setError(null);
    setSuccess(null);

    const local = validateStreamConfigLocal(form.streamUrl, form.streamKey);
    if (!local.ok) {
      setError(local.message);
      return;
    }

    setTesting(true);
    try {
      const result = await onTestConnection({
        name: form.name.trim() || 'Stream',
        streamUrl: form.streamUrl.trim(),
        streamKey: form.streamKey.trim(),
        platform: form.platform,
      });
      if (result.ok) setSuccess(result.message);
      else setError(result.message);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    if (!form.name.trim()) {
      setError('Enter a destination name.');
      return;
    }

    const local = validateStreamConfigLocal(form.streamUrl, form.streamKey);
    if (!local.ok) {
      setError(local.message);
      return;
    }

    const validation = validateDestinationSave(form, destinations, limits);
    if (validation) {
      setError(validation);
      return;
    }

    const enabledCount =
      destinations.filter((d) => d.isEnabled && d.id !== form.id).length + (form.isEnabled ? 1 : 0);
    const concurrentErr = validateConcurrentStreamStart(enabledCount, limits);
    if (concurrentErr && form.isEnabled) {
      setError(concurrentErr);
      return;
    }

    setSaving(true);
    try {
      const testResult = await onTestConnection({
        name: form.name.trim(),
        streamUrl: form.streamUrl.trim(),
        streamKey: form.streamKey.trim(),
        platform: form.platform,
      });
      if (!testResult.ok) {
        setError(`Cannot save — ${testResult.message}`);
        return;
      }

      const saved = await saveStreamDestination({
        ...form,
        name: form.name.trim(),
        streamUrl: form.streamUrl.trim(),
        streamKey: form.streamKey.trim(),
      });
      setDestinations((prev) => {
        const idx = prev.findIndex((d) => d.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [...prev, saved];
      });
      setSuccess('Stream settings verified and saved to your account.');
      setEditingId(saved.id);
      setForm({
        id: saved.id,
        name: saved.name,
        platform: saved.platform,
        streamUrl: saved.streamUrl,
        streamKey: saved.streamKey,
        isEnabled: saved.isEnabled,
        sortOrder: saved.sortOrder,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await deleteStreamDestination(id);
      setDestinations((prev) => prev.filter((d) => d.id !== id));
      if (editingId === id) startNew();
      setSuccess('Destination removed.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const toggleEnabled = async (d: StreamDestination) => {
    const nextEnabled = !d.isEnabled;
    const enabledCount =
      destinations.filter((x) => x.isEnabled && x.id !== d.id).length + (nextEnabled ? 1 : 0);
    const concurrentErr = validateConcurrentStreamStart(enabledCount, limits);
    if (concurrentErr && nextEnabled) {
      setError(concurrentErr);
      return;
    }
    setSaving(true);
    try {
      const saved = await saveStreamDestination({ ...d, isEnabled: nextEnabled });
      setDestinations((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const youtubeCount = countYouTubeDestinations(destinations);

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
      <div className="rounded border border-mixer-border bg-mixer-surface px-2 py-1.5 text-[9px] text-mixer-muted">
        <p>
          <span className="font-bold text-mixer-text">{planId === 'free' ? 'Free' : planId === 'pro' ? 'Pro' : 'Pro Master'}</span>
          {' · '}
          {limits.maxConcurrentStreams === 1
            ? 'Stream to 1 destination at a time (YouTube or Custom).'
            : `Up to ${limits.maxConcurrentStreams} simultaneous streams · ${limits.maxYouTubeDestinations} YouTube accounts.`}
        </p>
        {!limits.allowsTwitch && (
          <p className="mt-0.5">Twitch & Facebook require Pro or Pro Master.</p>
        )}
      </div>

      {loading ? (
        <p className="text-[10px] text-mixer-muted">Loading saved destinations…</p>
      ) : (
        <>
          {destinations.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold tracking-wider text-mixer-muted">SAVED DESTINATIONS</span>
              {destinations.map((d) => (
                <div
                  key={d.id}
                  className={cn(
                    'flex items-center gap-2 rounded border px-2 py-1.5',
                    editingId === d.id ? 'border-mixer-red bg-mixer-red/5' : 'border-mixer-border bg-mixer-surface',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleEnabled(d)}
                    className={cn(
                      'h-2 w-2 shrink-0 rounded-full',
                      d.isEnabled ? 'bg-mixer-green' : 'bg-mixer-muted',
                    )}
                    title={d.isEnabled ? 'Enabled for streaming' : 'Disabled'}
                  />
                  <button type="button" onClick={() => startEdit(d)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-xs font-medium">{d.name}</p>
                    <p className="text-[9px] text-mixer-muted">
                      {STREAM_PLATFORM_LABELS[d.platform]}
                      {d.platform === 'youtube' && youtubeCount > 1 ? ' · multi-YouTube' : ''}
                    </p>
                  </button>
                  <button type="button" onClick={() => handleDelete(d.id)} className="mixer-btn p-1 text-mixer-red">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold tracking-wider text-mixer-muted">
              {editingId ? 'EDIT DESTINATION' : 'ADD DESTINATION'}
            </span>
            <button type="button" onClick={startNew} className="mixer-btn flex items-center gap-1 px-2 py-0.5 text-[9px]">
              <Plus className="h-3 w-3" /> NEW
            </button>
          </div>

          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] text-mixer-muted">NAME</span>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Main YouTube"
              className="rounded border border-mixer-border bg-black px-2 py-1 text-xs"
            />
          </label>

          <div>
            <span className="text-[9px] text-mixer-muted">PLATFORM</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {PLATFORMS.map((p) => {
                const allowed = p === 'youtube' || p === 'custom' || (p === 'twitch' && limits.allowsTwitch) || (p === 'facebook' && limits.allowsFacebook);
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={!allowed}
                    onClick={() => handlePlatformChange(p)}
                    className={cn(
                      'mixer-btn px-2 py-1 text-[10px]',
                      form.platform === p && 'mixer-btn-active',
                      !allowed && 'opacity-30',
                    )}
                  >
                    {STREAM_PLATFORM_LABELS[p]}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[8px] text-mixer-muted">{STREAM_PLATFORM_DEFAULTS[form.platform].hint}</p>
          </div>

          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] text-mixer-muted">STREAM URL / HOST</span>
            <input
              value={form.streamUrl}
              onChange={(e) => setForm((p) => ({ ...p, streamUrl: e.target.value }))}
              placeholder={STREAM_PLATFORM_DEFAULTS[form.platform].url}
              className="rounded border border-mixer-border bg-black px-2 py-1 font-mono text-[10px]"
            />
          </label>

          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] text-mixer-muted">STREAM KEY</span>
            <PasswordInput
              value={form.streamKey}
              onChange={(e) => setForm((p) => ({ ...p, streamKey: e.target.value }))}
              placeholder="••••••••••••"
              inputClassName="rounded border border-mixer-border bg-black px-2 py-1 font-mono text-[10px]"
            />
          </label>

          <label className="flex items-center gap-2 text-[10px]">
            <input
              type="checkbox"
              checked={form.isEnabled}
              onChange={(e) => setForm((p) => ({ ...p, isEnabled: e.target.checked }))}
            />
            Enable for live streaming
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || saving || isValidating}
              className="mixer-btn flex items-center gap-1 px-2 py-1.5 text-[10px]"
            >
              <Wifi className="h-3 w-3" /> {testing ? 'TESTING…' : 'TEST'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || testing || isValidating}
              className="mixer-btn flex flex-1 items-center justify-center gap-1 py-1.5 text-[10px] font-bold"
            >
              <Save className="h-3 w-3" /> {saving ? 'SAVING…' : 'SAVE'}
            </button>
            <button
              type="button"
              onClick={onGoLive}
              disabled={isValidating || testing || saving}
              className={cn(
                'mixer-btn flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold',
                isOnAir && 'mixer-btn-live',
              )}
            >
              <Radio className="h-3 w-3" /> {isValidating ? 'CHECKING…' : isOnAir ? 'LIVE' : 'GO LIVE'}
            </button>
          </div>
        </>
      )}

      {error && <p className="text-[10px] text-mixer-red">{error}</p>}
      {success && <p className="text-[10px] text-mixer-green">{success}</p>}

      <p className="text-[8px] leading-relaxed text-mixer-muted">
        TEST checks the stream server and key before save or GO LIVE. Invalid details are blocked with an error message.
      </p>
    </div>
  );
}
