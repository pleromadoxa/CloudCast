import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Cloud,
  Download,
  FolderOpen,
  Layers,
  LayoutGrid,
  Loader2,
  LogOut,
  MonitorPlay,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Save,
  Scissors,
  Search,
  Send,
  Tag,
  Trash2,
  Video,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCloudCastOptional } from '../../context/CloudCastContext';
import { useProduction } from '../../context/ProductionContext';
import { REPLAY_BANKS, REPLAY_BUFFER_SECONDS } from '../../config/products';
import { resolveProductPlan } from '../../lib/productEntitlements';
import { useReplayBuffer } from '../../hooks/useReplayBuffer';
import { useReplayBanks } from '../../hooks/useReplayBanks';
import { useReplayPreviewPlayback, useReplaySource } from '../../hooks/useReplaySource';
import { useReplayWhepIngress } from '../../hooks/useReplayWhepIngress';
import { useReplayKeyboard } from '../../hooks/useReplayKeyboard';
import {
  deleteReplayClip,
  downloadBlobLocally,
  downloadReplayClipBlob,
  fetchReplayStorageUsage,
  fetchUserReplayClips,
  uploadReplayClip,
} from '../../lib/replayClipService';
import { exportClipAtPlaybackRate } from '../../lib/replayExport';
import { exportPreciseClipSegment, isPreciseExportSupported } from '../../lib/replayPreciseExport';
import { logReplayAudit } from '../../lib/replayAuditService';
import { DEFAULT_REPLAY_FPS } from '../../lib/replayTimecode';
import { loadReplayBanksFromLocal, persistReplayBanks } from '../../lib/replayLocalStore';
import { captureMultiAngleClips, createReplayStreamResolver, multiAngleDuration } from '../../lib/replayMultiAngle';
import type { ReplayCloudClip, ReplayClipLocal, ReplayRundownItem, ReplaySourceKind } from '../../types/replay';
import { formatBytes } from '../../lib/formatBytes';
import { cn } from '../../lib/utils';
import { AccessCodePanel } from '../session/AccessCodePanel';
import { ReplayAuditPanel } from './ReplayAuditPanel';
import { ReplayDebugPanel } from './ReplayDebugPanel';
import { ReplayExportPresetsPanel } from './ReplayExportPresetsPanel';
import { ReplayOperatorLockBanner } from './ReplayOperatorLockBanner';
import { ReplayQuotaBanner } from './ReplayQuotaBanner';
import { ReplayRundownPanel } from './ReplayRundownPanel';
import { ReplaySessionSyncPanel } from './ReplaySessionSyncPanel';
import { ReplayBufferSnapshotPanel, ReplayRundownSharePanel } from './ReplayPhase6Panels';
import { ReplayLifecyclePanel, ReplayOpsDigestPanel, ReplayShowLibraryPanel } from './ReplayPhase7Panels';
import { useReplayBufferResilience } from '../../hooks/useReplayBufferResilience';
import { useReplayBufferSnapshotPublisher } from '../../hooks/useReplayBufferSnapshot';
import { useReplayOperatorLocks } from '../../hooks/useReplayOperatorLocks';
import { useReplaySessionSyncPublisher, useReplaySessionSyncSubscriber } from '../../hooks/useReplaySessionSync';
import { searchReplayClips } from '../../lib/replayClipSearch';
import { type ReplaySessionSyncPayload } from '../../lib/replaySessionSync';
import { evaluateReplayQuotaAlert } from '../../lib/replayQuotaAlerts';
import {
  buildTemplateItemsFromDraft,
  deleteReplayRundownTemplate,
  fetchReplayRundownTemplates,
  resolveTemplateBankIndices,
  saveReplayRundownTemplate,
  type ReplayRundownTemplate,
} from '../../lib/replayRundownTemplates';
import { fetchReplayExportPresets, resolveDefaultPreset, type ReplayExportPreset } from '../../lib/replayExportPresets';
import {
  fetchLatestReplayBufferSnapshot,
  requestStorageQuotaEmailCheck,
  snapshotAgeMinutes,
  type ReplayBufferSnapshot,
} from '../../lib/replayBufferSnapshot';
import { importRundownByShareCode, publishRundownShareCode } from '../../lib/replayRundownShare';
import { fetchReplayShowLibrary, promoteRundownToLibrary, type ReplayShowLibraryEntry } from '../../lib/replayRundownLibrary';
import {
  enqueueReplayOpsDigest,
  fetchReplayOpsDigestPrefs,
  saveReplayOpsDigestPrefs,
  type ReplayOpsDigestPrefs,
} from '../../lib/replayOpsDigest';
import {
  applyReplayLifecyclePolicy,
  fetchReplayClipsByLifecycle,
  fetchReplayLifecyclePrefs,
  saveReplayLifecyclePrefs,
  type ReplayLifecyclePrefs,
} from '../../lib/replayClipLifecycle';
import { PRODUCTION_OFFSCREEN_STYLE, productionShellClass } from '../../lib/productionShell';

const PLAYBACK_RATES = [0.25, 0.5, 1, 1.5, 2] as const;

interface ReplayLayoutProps {
  /** Off-screen render while replay buffer stays alive on another route */
  hidden?: boolean;
}

export function ReplayLayout({ hidden = false }: ReplayLayoutProps) {
  const { profile, signOut } = useAuth();
  const cloudcast = useCloudCastOptional();
  const { pushReplayToPgm, playReplayRundown, isOnAir, replayPush, replayRundownRemaining, setReplayConsoleActive } = useProduction();

  const connectionMode = cloudcast?.connectionMode ?? 'mesh';

  const { getWhepStream } = useReplayWhepIngress(
    cloudcast?.devices ?? [],
    connectionMode,
    Boolean(cloudcast),
  );

  const plan = resolveProductPlan(profile, 'instant_replay');
  const maxBanks = REPLAY_BANKS[plan];
  const maxBuffer = REPLAY_BUFFER_SECONDS[plan];
  const canMultiAngle = plan === 'pro_master';
  const canCloud = plan !== 'free';

  const devices = useMemo(
    () =>
      (cloudcast?.devices ?? []).filter(
        (d) => d.deviceId && (d.status === 'live' || d.status === 'connecting'),
      ),
    [cloudcast?.devices],
  );

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [sourceKind, setSourceKind] = useState<ReplaySourceKind>('pgm-program');
  const [clipTag, setClipTag] = useState('');
  const [autoCloudSync, setAutoCloudSync] = useState(true);
  const [frameAccurateSave, setFrameAccurateSave] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [cloudClips, setCloudClips] = useState<ReplayCloudClip[]>([]);
  const [cloudUsage, setCloudUsage] = useState<{ used: number; quota: number; totalUsed: number; remaining: number } | null>(null);
  const loadedLocalRef = useRef(false);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudQuery, setCloudQuery] = useState('');
  const [cloudTagFilter, setCloudTagFilter] = useState('');
  const [panel, setPanel] = useState<'banks' | 'cloud'>('banks');
  const [rundownDraft, setRundownDraft] = useState<number[]>([]);
  const [remoteSync, setRemoteSync] = useState<ReplaySessionSyncPayload | null>(null);
  const [rundownTemplates, setRundownTemplates] = useState<ReplayRundownTemplate[]>([]);
  const [bufferSnapshot, setBufferSnapshot] = useState<ReplayBufferSnapshot | null>(null);
  const [showLibrary, setShowLibrary] = useState<ReplayShowLibraryEntry[]>([]);
  const [opsDigestPrefs, setOpsDigestPrefs] = useState<ReplayOpsDigestPrefs | null>(null);
  const [lifecyclePrefs, setLifecyclePrefs] = useState<ReplayLifecyclePrefs | null>(null);
  const [archivedClipCount, setArchivedClipCount] = useState(0);
  const quotaEmailRequestedRef = useRef(false);

  useEffect(() => {
    if (sourceKind !== 'camera') return;
    if (!selectedDeviceId && devices[0]?.deviceId) {
      setSelectedDeviceId(devices[0].deviceId);
    }
  }, [devices, selectedDeviceId, sourceKind]);

  const { activeStream, pgmStream, error: sourceError, startScreenShare, stopScreen } = useReplaySource(
    cloudcast?.getMeshStream ?? (() => null),
    selectedDeviceId,
    sourceKind,
    setSourceKind,
    {
      getWhepStream,
      sessionId: cloudcast?.session?.sessionId,
      realtimeChannel: cloudcast?.session?.realtimeChannel,
    },
  );

  const houseAnchorMs = useMemo(() => Date.now(), []);
  const sessionId = cloudcast?.session?.sessionId ?? null;
  const operatorLabel = profile?.full_name ?? profile?.email ?? 'Replay operator';
  const operatorLocks = useReplayOperatorLocks({
    sessionId,
    operatorLabel,
    enabled: Boolean(sessionId) && !hidden,
  });

  const buffer = useReplayBuffer(maxBuffer, activeStream, {
    fps: DEFAULT_REPLAY_FPS,
    houseAnchorMs,
  });
  const banks = useReplayBanks(maxBanks);

  useReplayBufferResilience({
    enabled: buffer.isRecording,
    isRecording: buffer.isRecording,
    chunkCount: buffer.chunkCount,
    hasSource: Boolean(activeStream),
    sessionId,
    onRecover: buffer.restartRecorder,
  });

  useReplayBufferSnapshotPublisher({
    enabled: canCloud && Boolean(sessionId) && !hidden,
    sessionId,
    operatorKey: operatorLocks.operatorKey,
    operatorLabel,
    sourceKind,
    isRecording: buffer.isRecording,
    bufferSeconds: buffer.bufferSeconds,
    chunkCount: buffer.chunkCount,
    markInSec: buffer.markInSec,
    markOutSec: buffer.markOutSec,
    markTimecodeIn: buffer.markTimecodeIn,
    markTimecodeOut: buffer.markTimecodeOut,
    houseClockSmpte: buffer.houseClockSmpte,
  });

  const rundownLabels = useMemo(
    () =>
      rundownDraft
        .map((bankIndex) => banks.banks[bankIndex]?.clip?.sourceLabel)
        .filter((label): label is string => Boolean(label)),
    [rundownDraft, banks.banks],
  );

  useReplaySessionSyncPublisher(
    sessionId,
    cloudcast?.session?.realtimeChannel,
    operatorLocks.readOnly
      ? null
      : {
          operatorKey: operatorLocks.operatorKey,
          operatorLabel,
          activeBankIndex: banks.activeBankIndex,
          markInSec: buffer.markInSec,
          markOutSec: buffer.markOutSec,
          markTimecodeIn: buffer.markTimecodeIn,
          markTimecodeOut: buffer.markTimecodeOut,
          houseClockSmpte: buffer.houseClockSmpte,
          rundownLabels,
          pgmLabel: replayPush?.label ?? null,
        },
    Boolean(sessionId) && !hidden && !operatorLocks.readOnly,
  );

  useReplaySessionSyncSubscriber(
    sessionId,
    cloudcast?.session?.realtimeChannel,
    operatorLocks.operatorKey,
    setRemoteSync,
    Boolean(sessionId) && !hidden && operatorLocks.readOnly,
  );

  useEffect(() => {
    banks.resizeBanks(maxBanks);
  }, [maxBanks, banks.resizeBanks]);

  const preview = useReplayPreviewPlayback();

  useEffect(() => {
    preview.loadUrl(banks.activeBank?.clip?.blobUrl ?? null);
  }, [banks.activeBank?.clip?.blobUrl, preview.loadUrl]);

  const refreshCloud = useCallback(async () => {
    try {
      const [clips, usage] = await Promise.all([
        fetchUserReplayClips(),
        fetchReplayStorageUsage(),
      ]);
      setCloudClips(clips);
      setCloudUsage({
        used: usage.usedBytes,
        quota: usage.quotaBytes,
        totalUsed: usage.totalUsedBytes ?? usage.usedBytes,
        remaining: usage.remainingBytes,
      });
    } catch {
      /* offline or free tier */
    }
  }, []);

  useEffect(() => {
    void refreshCloud();
  }, [refreshCloud]);

  const refreshRundownTemplates = useCallback(async () => {
    try {
      setRundownTemplates(await fetchReplayRundownTemplates(sessionId));
    } catch {
      /* offline */
    }
  }, [sessionId]);

  useEffect(() => {
    void refreshRundownTemplates();
  }, [refreshRundownTemplates]);

  useEffect(() => {
    if (!sessionId || !canCloud) {
      setBufferSnapshot(null);
      return;
    }
    void fetchLatestReplayBufferSnapshot(sessionId).then(setBufferSnapshot);
  }, [sessionId, canCloud, buffer.isRecording, buffer.chunkCount]);

  const refreshShowLibrary = useCallback(async () => {
    if (!canCloud) {
      setShowLibrary([]);
      return;
    }
    try {
      setShowLibrary(await fetchReplayShowLibrary());
    } catch {
      /* offline */
    }
  }, [canCloud]);

  const refreshEnterprisePrefs = useCallback(async () => {
    if (!canCloud) return;
    try {
      const [digest, lifecycle, archived] = await Promise.all([
        fetchReplayOpsDigestPrefs(),
        fetchReplayLifecyclePrefs(),
        fetchReplayClipsByLifecycle('archived'),
      ]);
      setOpsDigestPrefs(digest);
      setLifecyclePrefs(lifecycle);
      setArchivedClipCount(archived.length);
    } catch {
      /* offline */
    }
  }, [canCloud]);

  useEffect(() => {
    void refreshShowLibrary();
    void refreshEnterprisePrefs();
  }, [refreshShowLibrary, refreshEnterprisePrefs]);

  const quotaAlert = useMemo(
    () =>
      evaluateReplayQuotaAlert(
        cloudUsage && cloudUsage.quota > 0
          ? {
              usedBytes: cloudUsage.used,
              quotaBytes: cloudUsage.quota,
              remainingBytes: cloudUsage.remaining,
              clipCount: cloudClips.length,
              totalUsedBytes: cloudUsage.totalUsed,
            }
          : null,
      ),
    [cloudUsage, cloudClips.length],
  );

  useEffect(() => {
    if (!canCloud || !quotaAlert || quotaAlert.level === 'ok') return;
    if (quotaEmailRequestedRef.current) return;
    quotaEmailRequestedRef.current = true;
    void requestStorageQuotaEmailCheck().then(() =>
      logReplayAudit({
        eventType: 'quota_email_requested',
        sessionId,
        meta: { level: quotaAlert.level, percentUsed: quotaAlert.percentUsed },
      }),
    );
  }, [canCloud, quotaAlert, sessionId]);

  const handleSaveRundownTemplate = useCallback(
    async (name: string) => {
      if (rundownDraft.length === 0) return;
      const items = buildTemplateItemsFromDraft(banks.banks, rundownDraft);
      await saveReplayRundownTemplate({
        sessionId,
        name,
        playbackRate: preview.playbackRate,
        items,
      });
      void logReplayAudit({
        eventType: 'rundown_template_saved',
        sessionId,
        label: name,
        meta: { count: items.length },
      });
      await refreshRundownTemplates();
    },
    [rundownDraft, banks.banks, sessionId, preview.playbackRate, refreshRundownTemplates],
  );

  const handleLoadRundownTemplate = useCallback(
    (templateId: string) => {
      const template = rundownTemplates.find((t) => t.id === templateId);
      if (!template) return;
      const indices = resolveTemplateBankIndices(banks.banks, template);
      setRundownDraft(indices);
      preview.setPlaybackRate(template.playbackRate);
    },
    [rundownTemplates, banks.banks, preview.setPlaybackRate],
  );

  const handleDeleteRundownTemplate = useCallback(
    async (templateId: string) => {
      await deleteReplayRundownTemplate(templateId);
      await refreshRundownTemplates();
    },
    [refreshRundownTemplates],
  );

  const handlePublishRundownShare = useCallback(
    async (templateId: string) => {
      const code = await publishRundownShareCode(templateId);
      void logReplayAudit({
        eventType: 'rundown_shared',
        sessionId,
        label: code,
        meta: { templateId },
      });
      return code;
    },
    [sessionId],
  );

  const handleImportRundownShare = useCallback(
    async (code: string) => {
      const imported = await importRundownByShareCode(code);
      void logReplayAudit({
        eventType: 'rundown_imported',
        sessionId,
        label: imported.name,
        meta: { shareCode: code },
      });
      await refreshRundownTemplates();
    },
    [sessionId, refreshRundownTemplates],
  );

  const handlePromoteToShowLibrary = useCallback(
    async (templateId: string, category: string) => {
      const promoted = await promoteRundownToLibrary(templateId, category);
      void logReplayAudit({
        eventType: 'rundown_library_promoted',
        sessionId,
        label: promoted.name,
        meta: { category, templateId },
      });
      await Promise.all([refreshRundownTemplates(), refreshShowLibrary()]);
    },
    [sessionId, refreshRundownTemplates, refreshShowLibrary],
  );

  const handleLoadLibraryEntry = useCallback(
    (templateId: string) => {
      const entry =
        showLibrary.find((t) => t.id === templateId) ??
        rundownTemplates.find((t) => t.id === templateId);
      if (!entry) return;
      const indices = resolveTemplateBankIndices(banks.banks, entry);
      setRundownDraft(indices);
      preview.setPlaybackRate(entry.playbackRate);
      setStatus(`Loaded show library rundown "${entry.name}".`);
    },
    [showLibrary, rundownTemplates, banks.banks, preview.setPlaybackRate],
  );

  const handleSaveOpsDigestPrefs = useCallback(
    async (enabled: boolean, frequency: ReplayOpsDigestPrefs['frequency']) => {
      const saved = await saveReplayOpsDigestPrefs(enabled, frequency);
      setOpsDigestPrefs(saved);
    },
    [],
  );

  const handleSendOpsDigest = useCallback(async () => {
    const result = await enqueueReplayOpsDigest();
    if (!result.queued && result.reason === 'rate_limited') {
      setStatus('Ops digest was sent recently — try again in an hour.');
      return;
    }
    void logReplayAudit({ eventType: 'ops_digest_sent', sessionId });
    const prefs = await fetchReplayOpsDigestPrefs();
    setOpsDigestPrefs(prefs);
    setStatus('Ops digest email queued.');
  }, [sessionId]);

  const handleSaveLifecyclePrefs = useCallback(async (prefs: ReplayLifecyclePrefs) => {
    const saved = await saveReplayLifecyclePrefs(prefs);
    setLifecyclePrefs(saved);
  }, []);

  const handleApplyLifecyclePolicy = useCallback(async () => {
    const result = await applyReplayLifecyclePolicy();
    void logReplayAudit({
      eventType: 'lifecycle_policy_applied',
      sessionId,
      meta: {
        archivedCount: result.archivedCount,
        deleteCandidates: result.deleteCandidateIds.length,
      },
    });
    await Promise.all([refreshCloud(), refreshEnterprisePrefs()]);
    return result;
  }, [sessionId, refreshCloud, refreshEnterprisePrefs]);

  const handlePurgeLifecycleCandidates = useCallback(
    async (ids: string[]) => {
      for (const id of ids) {
        await deleteReplayClip(id);
        void logReplayAudit({ eventType: 'clip_purged', sessionId, clipId: id });
      }
      await Promise.all([refreshCloud(), refreshEnterprisePrefs()]);
    },
    [sessionId, refreshCloud, refreshEnterprisePrefs],
  );

  useEffect(() => {
    void fetchReplayExportPresets().then((presets) => {
      const preset = resolveDefaultPreset(presets);
      preview.setPlaybackRate(preset.playbackRate);
      setFrameAccurateSave(preset.frameAccurate);
      setAutoCloudSync(preset.autoCloudSync);
    });
  }, [preview.setPlaybackRate]);

  const applyExportPreset = useCallback((preset: ReplayExportPreset) => {
    preview.setPlaybackRate(preset.playbackRate);
    setFrameAccurateSave(preset.frameAccurate);
    setAutoCloudSync(preset.autoCloudSync);
    setStatus(`Applied export preset "${preset.name}".`);
  }, [preview.setPlaybackRate]);

  const runCloudSearch = useCallback(async () => {
    if (!canCloud) return;
    setCloudLoading(true);
    try {
      const clips =
        cloudQuery.trim() || cloudTagFilter.trim()
          ? await searchReplayClips(cloudQuery, cloudTagFilter)
          : await fetchUserReplayClips();
      setCloudClips(clips);
      setStatus(clips.length > 0 ? `Found ${clips.length} clip(s).` : 'No clips match your search.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Cloud search failed.');
    } finally {
      setCloudLoading(false);
    }
  }, [canCloud, cloudQuery, cloudTagFilter]);

  useEffect(() => {
    if (loadedLocalRef.current) return;
    loadedLocalRef.current = true;
    void loadReplayBanksFromLocal().then((loaded) => {
      if (loaded.length > 0) banks.restoreBanks(loaded, maxBanks);
    });
  }, [maxBanks, banks.restoreBanks]);

  useEffect(() => {
    setReplayConsoleActive(true);
    return () => setReplayConsoleActive(false);
  }, [setReplayConsoleActive]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void persistReplayBanks(banks.banks).catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(t);
  }, [banks.banks]);

  const syncClipToCloud = useCallback(
    async (clip: ReplayClipLocal, bankIndex: number, tags: string[]) => {
      if (!canCloud || clip.synced) return null;

      const uploadAlert = evaluateReplayQuotaAlert(
        cloudUsage && cloudUsage.quota > 0
          ? {
              usedBytes: cloudUsage.used,
              quotaBytes: cloudUsage.quota,
              remainingBytes: cloudUsage.remaining,
              clipCount: cloudClips.length,
              totalUsedBytes: cloudUsage.totalUsed,
            }
          : null,
        clip.blob.size,
      );
      if (uploadAlert.blocksUpload) {
        void logReplayAudit({
          eventType: 'quota_warning',
          sessionId,
          meta: { message: uploadAlert.message, level: uploadAlert.level },
        });
        throw new Error(uploadAlert.message);
      }

      const fileName = `replay-${clip.sourceLabel.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.webm`;
      const cloud = await uploadReplayClip(clip.blob, fileName, clip.mimeType, {
        durationSec: clip.durationSec,
        inSec: clip.inSec,
        outSec: clip.outSec,
        sourceDeviceId: clip.sourceDeviceId,
        bankIndex,
        label: clipTag.trim() || clip.sourceLabel,
        tags,
        timecodeIn: clip.timecodeIn,
        timecodeOut: clip.timecodeOut,
        frameRate: clip.frameRate,
      });
      banks.markBankSynced(bankIndex, cloud.id, cloud.storagePath);
      void logReplayAudit({
        eventType: 'cloud_sync',
        sessionId,
        clipId: cloud.id,
        bankIndex,
        label: clip.sourceLabel,
        meta: { sizeBytes: cloud.sizeBytes },
      });
      await refreshCloud();
      return cloud;
    },
    [canCloud, clipTag, banks, refreshCloud, sessionId, cloudUsage, cloudClips.length],
  );

  const handleMarkIn = useCallback(() => {
    if (operatorLocks.readOnly) {
      setStatus('Read-only — another operator holds the replay console lock.');
      return;
    }
    const sec = buffer.markIn();
    if (sec == null) return;
    const { in: timecode } = buffer.getMarkTimecodes();
    void logReplayAudit({
      eventType: 'mark_in',
      sessionId,
      meta: { sec, timecode },
    });
  }, [buffer, sessionId, operatorLocks.readOnly]);

  const handleMarkOut = useCallback(() => {
    if (operatorLocks.readOnly) {
      setStatus('Read-only — another operator holds the replay console lock.');
      return;
    }
    const sec = buffer.markOut();
    if (sec == null) return;
    const { out: timecode } = buffer.getMarkTimecodes();
    void logReplayAudit({
      eventType: 'mark_out',
      sessionId,
      meta: { sec, timecode },
    });
  }, [buffer, sessionId, operatorLocks.readOnly]);

  const buildTags = useCallback((): string[] => {
    const tags = ['instant-replay'];
    if (clipTag.trim()) tags.push(clipTag.trim());
    if (selectedDeviceId) tags.push(`cam:${selectedDeviceId}`);
    return tags;
  }, [clipTag, selectedDeviceId]);

  const handleSaveToBank = useCallback(async () => {
    if (operatorLocks.readOnly) {
      setStatus('Read-only — another operator holds the replay console lock.');
      return;
    }
    const extracted = buffer.extractClip();
    if (!extracted) {
      setStatus('Mark in/out or wait for buffer content before saving.');
      return;
    }
    const sourceLabel =
      clipTag.trim() ||
      (sourceKind === 'pgm-program'
        ? 'Program feed'
        : sourceKind === 'screen'
          ? 'Screen share'
          : devices.find((d) => d.deviceId === selectedDeviceId)?.label ?? 'Camera');

    const tags = buildTags();
    const timecodeIn = buffer.markTimecodeIn ?? undefined;
    const timecodeOut = buffer.markTimecodeOut ?? undefined;
    let blob = extracted.blob;
    let inSec = extracted.inSec;
    let outSec = extracted.outSec;

    const usePreciseExport =
      frameAccurateSave && plan !== 'free' && isPreciseExportSupported();

    if (usePreciseExport) {
      setCloudLoading(true);
      try {
        blob = await exportPreciseClipSegment(blob, inSec, outSec, DEFAULT_REPLAY_FPS);
        void logReplayAudit({
          eventType: 'precise_export',
          sessionId,
          meta: { inSec, outSec, frameRate: DEFAULT_REPLAY_FPS },
        });
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Frame-accurate export failed — saved chunk mux instead.');
      } finally {
        setCloudLoading(false);
      }
    }

    const local = banks.saveToBank(banks.activeBankIndex, {
      blob,
      mimeType: extracted.mimeType,
      durationSec: extracted.durationSec,
      inSec,
      outSec,
      sourceLabel,
      sourceDeviceId: selectedDeviceId ?? undefined,
      tags,
      timecodeIn,
      timecodeOut,
      frameRate: DEFAULT_REPLAY_FPS,
    });
    buffer.clearMarks();
    void logReplayAudit({
      eventType: 'clip_saved',
      sessionId,
      clipId: local.id,
      bankIndex: banks.activeBankIndex,
      label: sourceLabel,
      meta: {
        durationSec: extracted.durationSec,
        timecodeIn,
        timecodeOut,
        frameAccurate: usePreciseExport,
      },
    });
    setStatus(`Saved ${extracted.durationSec.toFixed(1)}s clip to bank ${banks.activeBankIndex + 1}.`);

    if (canCloud && autoCloudSync) {
      setCloudLoading(true);
      try {
        const cloud = await syncClipToCloud(local, banks.activeBankIndex, tags);
        if (cloud) setStatus(`Saved & synced to Regal Cloud (${formatBytes(cloud.sizeBytes)}).`);
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Local save ok — cloud sync failed.');
      } finally {
        setCloudLoading(false);
      }
    }
  }, [
    buffer,
    banks,
    sourceKind,
    devices,
    selectedDeviceId,
    clipTag,
    buildTags,
    canCloud,
    autoCloudSync,
    syncClipToCloud,
    frameAccurateSave,
    plan,
    sessionId,
    operatorLocks.readOnly,
  ]);

  const handlePushPgm = useCallback(async () => {
    if (operatorLocks.readOnly) {
      setStatus('Read-only — another operator holds the replay console lock.');
      return;
    }
    const clip = banks.activeBank?.clip;
    if (!clip) {
      setStatus('Load a clip into the active bank first.');
      return;
    }

    if (sessionId) {
      const lockResult = await operatorLocks.tryAcquireScope('pgm');
      if (!lockResult.ok) {
        setStatus(
          `${lockResult.holder?.operatorLabel ?? 'Another operator'} holds the PGM replay lock.`,
        );
        return;
      }
    }

    pushReplayToPgm({
      url: clip.blobUrl,
      label: clip.sourceLabel,
      clipId: clip.id,
      playbackRate: preview.playbackRate,
      busTake: true,
    });
    void logReplayAudit({
      eventType: 'pgm_push',
      sessionId,
      clipId: clip.id,
      bankIndex: banks.activeBankIndex,
      label: clip.sourceLabel,
      meta: { playbackRate: preview.playbackRate },
    });
    setStatus(
      isOnAir
        ? 'Clip on PGM program bus — airs on stream destinations.'
        : 'Clip on PGM bus — open Video Mixer and go ON AIR to reach stream destinations.',
    );
  }, [banks.activeBank, banks.activeBankIndex, pushReplayToPgm, preview.playbackRate, isOnAir, sessionId, operatorLocks]);

  const toggleRundownBank = useCallback((bankIndex: number) => {
    setRundownDraft((prev) =>
      prev.includes(bankIndex) ? prev.filter((i) => i !== bankIndex) : [...prev, bankIndex],
    );
  }, []);

  const handlePlayRundown = useCallback(
    async (items: ReplayRundownItem[]) => {
      if (operatorLocks.readOnly) {
        setStatus('Read-only — another operator holds the replay console lock.');
        return;
      }
      if (items.length === 0) return;

      if (sessionId) {
        const lockResult = await operatorLocks.tryAcquireScope('pgm');
        if (!lockResult.ok) {
          setStatus(
            `${lockResult.holder?.operatorLabel ?? 'Another operator'} holds the PGM replay lock.`,
          );
          return;
        }
      }

      playReplayRundown(items);
      void logReplayAudit({
        eventType: 'rundown_start',
        sessionId,
        clipId: items[0]?.clipId,
        label: items[0]?.label,
        meta: { count: items.length, banks: items.map((item) => item.bankIndex) },
      });
      void logReplayAudit({
        eventType: 'pgm_push',
        sessionId,
        clipId: items[0]?.clipId,
        bankIndex: items[0]?.bankIndex ?? null,
        label: items[0]?.label,
        meta: { source: 'rundown' },
      });
      setRundownDraft([]);
      setStatus(`Rundown live — ${items.length} clip(s) on PGM program bus.`);
    },
    [operatorLocks, sessionId, playReplayRundown],
  );

  const handleSaveCloud = useCallback(async () => {
    const clip = banks.activeBank?.clip;
    if (!clip) {
      setStatus('Save a clip to the active bank before cloud sync.');
      return;
    }
    if (!canCloud) {
      setStatus('Cloud clip storage requires Video Mixer Pro or Universal.');
      return;
    }
    setCloudLoading(true);
    setStatus(null);
    try {
      const cloud = await syncClipToCloud(clip, banks.activeBankIndex, clip.tags ?? buildTags());
      if (cloud) setStatus(`Synced to Regal Cloud Clips (${formatBytes(cloud.sizeBytes)}).`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Cloud sync failed.');
    } finally {
      setCloudLoading(false);
    }
  }, [banks, canCloud, syncClipToCloud, buildTags]);

  const handleSlowMoExport = useCallback(async () => {
    const clip = banks.activeBank?.clip;
    if (!clip) {
      setStatus('Load a clip before exporting.');
      return;
    }
    if (plan === 'free') {
      setStatus('Slow-mo export requires Video Mixer Pro or higher.');
      return;
    }
    setCloudLoading(true);
    try {
      const exported = await exportClipAtPlaybackRate(clip.blob, clip.mimeType, preview.playbackRate);
      downloadBlobLocally(exported, `replay-slowmo-${preview.playbackRate}x-bank-${banks.activeBankIndex + 1}.webm`);
      setStatus(`Exported at ${preview.playbackRate}x playback.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setCloudLoading(false);
    }
  }, [banks.activeBank, banks.activeBankIndex, plan, preview.playbackRate]);

  const handleMultiAngleSync = useCallback(async () => {
    if (!canMultiAngle || !cloudcast?.getMeshStream) {
      setStatus('Multi-angle sync requires Video Mixer Pro Master.');
      return;
    }
    if (devices.length < 2) {
      setStatus('Connect at least two cameras for multi-angle sync.');
      return;
    }
    const dur = multiAngleDuration(buffer.markInSec, buffer.markOutSec);
    setCloudLoading(true);
    try {
      const resolveStream = createReplayStreamResolver(
        cloudcast.getMeshStream,
        getWhepStream,
      );
      const angles = await captureMultiAngleClips(
        devices.map((d) => ({ deviceId: d.deviceId!, label: d.label })),
        resolveStream,
        dur,
        Math.min(4, maxBanks),
        { houseAnchorMs, syncGroupId: crypto.randomUUID() },
      );
      if (angles.length === 0) {
        setStatus('No live camera streams available for multi-angle capture.');
        return;
      }
      let bankIdx = banks.activeBankIndex;
      for (const angle of angles) {
        if (bankIdx >= maxBanks) break;
        banks.saveToBank(bankIdx, {
          blob: angle.blob,
          mimeType: angle.mimeType,
          durationSec: angle.durationSec,
          inSec: 0,
          outSec: angle.durationSec,
          sourceLabel: angle.label,
          sourceDeviceId: angle.deviceId,
          tags: [
            'multi-angle',
            angle.deviceId,
            `sync:${angle.syncGroupId}`,
            ...(clipTag.trim() ? [clipTag.trim()] : []),
          ],
          timecodeIn: buffer.markTimecodeIn ?? undefined,
          timecodeOut: buffer.markTimecodeOut ?? undefined,
          frameRate: DEFAULT_REPLAY_FPS,
        });
        bankIdx += 1;
      }
      setStatus(`Multi-angle sync — ${angles.length} clip(s) saved to banks.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Multi-angle capture failed.');
    } finally {
      setCloudLoading(false);
    }
  }, [canMultiAngle, cloudcast, devices, buffer.markInSec, buffer.markOutSec, buffer.markTimecodeIn, buffer.markTimecodeOut, maxBanks, banks, clipTag, getWhepStream, houseAnchorMs]);

  const handleLoadFromCloud = useCallback(
    async (cloud: ReplayCloudClip) => {
      setCloudLoading(true);
      try {
        const blob = await downloadReplayClipBlob(cloud);
        const blobUrl = URL.createObjectURL(blob);
        banks.loadClipIntoBank(banks.activeBankIndex, {
          id: cloud.id,
          blob,
          blobUrl,
          mimeType: cloud.mimeType,
          durationSec: cloud.durationSec ?? 0,
          inSec: cloud.inSec ?? 0,
          outSec: cloud.outSec ?? cloud.durationSec ?? 0,
          sourceLabel: cloud.label ?? cloud.fileName,
          sourceDeviceId: cloud.sourceDeviceId ?? undefined,
          tags: cloud.tags,
          timecodeIn: cloud.timecodeIn ?? undefined,
          timecodeOut: cloud.timecodeOut ?? undefined,
          frameRate: cloud.frameRate ?? undefined,
          createdAt: cloud.createdAt,
          synced: true,
          cloudId: cloud.id,
          storagePath: cloud.storagePath,
        });
        setStatus(`Loaded "${cloud.label ?? cloud.fileName}" from cloud.`);
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Could not load cloud clip.');
      } finally {
        setCloudLoading(false);
      }
    },
    [banks],
  );

  const handleDeleteCloud = useCallback(
    async (cloud: ReplayCloudClip) => {
      setCloudLoading(true);
      try {
        await deleteReplayClip(cloud.id);
        await refreshCloud();
        setStatus('Deleted cloud clip.');
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Delete failed.');
      } finally {
        setCloudLoading(false);
      }
    },
    [refreshCloud],
  );

  const bufferPct = Math.min(100, (buffer.bufferSeconds / maxBuffer) * 100);

  useReplayKeyboard(
    {
      onMarkIn: handleMarkIn,
      onMarkOut: handleMarkOut,
      onSaveBank: () => { void handleSaveToBank(); },
      onPushPgm: handlePushPgm,
      onTogglePlay: preview.togglePlay,
      onSelectBank: banks.setActiveBankIndex,
      onStepFrame: preview.stepFrame,
    },
    true,
  );

  return (
    <div
      className={cn(
        productionShellClass(hidden, 'replay-shell flex h-full min-h-0 flex-col overflow-hidden bg-[#040806] text-white'),
      )}
      style={hidden ? PRODUCTION_OFFSCREEN_STYLE : undefined}
      aria-hidden={hidden}
    >
      {!hidden && (
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-emerald-500/20 bg-[#06100c] px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold tracking-[0.25em] text-emerald-400">CLOUDCAST REPLAY</span>
          <span className="rounded border border-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-mixer-muted">
            {plan.replace('_', ' ')} · {maxBanks} banks · {maxBuffer}s buffer
          </span>
          {buffer.isRecording && (
            <span className="animate-pulse text-[10px] font-bold text-emerald-400">● BUFFER LIVE</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cloudcast && (
            <AccessCodePanel
              session={cloudcast.session}
              isLoading={cloudcast.sessionLoading}
              onRegenerate={() => { void cloudcast.regenerateCode(); }}
              isRegenerating={cloudcast.isRegenerating}
              className="hidden md:flex"
            />
          )}
          <Link to="/dashboard" className="hidden items-center gap-1 text-[10px] font-bold tracking-wider text-mixer-muted hover:text-white sm:inline-flex">
            <Video className="h-3.5 w-3.5" /> VIDEO MIXER
          </Link>
          <Link to="/hub" className="hidden items-center gap-1 text-[10px] font-bold tracking-wider text-mixer-muted hover:text-white sm:inline-flex">
            <LayoutGrid className="h-3.5 w-3.5" /> HUB
          </Link>
          <button type="button" onClick={() => { void signOut(); }} className="text-mixer-muted hover:text-white" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>
      )}

      <ReplayOperatorLockBanner
        active={Boolean(sessionId) && !hidden}
        readOnly={operatorLocks.readOnly}
        blockingHolder={operatorLocks.blockingHolder}
        operatorLabel={operatorLabel}
      />

      {canCloud && <ReplayQuotaBanner alert={quotaAlert} />}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="flex min-h-0 flex-1 flex-col border-b border-white/5 lg:border-b-0 lg:border-r">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-3 py-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-mixer-muted">Source</label>
            <select
              value={
                sourceKind === 'screen'
                  ? '__screen__'
                  : sourceKind === 'pgm-program'
                    ? '__pgm__'
                    : selectedDeviceId ?? ''
              }
              onChange={(e) => {
                const v = e.target.value;
                if (v === '__screen__') void startScreenShare();
                else if (v === '__pgm__') {
                  stopScreen();
                  setSourceKind('pgm-program');
                } else {
                  stopScreen();
                  setSourceKind('camera');
                  setSelectedDeviceId(v || null);
                }
              }}
              className="rounded border border-white/10 bg-black px-2 py-1 text-xs outline-none focus:border-emerald-500/40"
            >
              <option value="__pgm__">Program feed (PGM)</option>
              <option value="">Select camera…</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId!}>{d.label}</option>
              ))}
              <option value="__screen__">Screen share</option>
            </select>
            <button
              type="button"
              onClick={() => { void buffer.toggleRecording(); }}
              className={cn(
                'rounded px-2 py-1 text-[10px] font-bold tracking-wider',
                buffer.isRecording ? 'bg-emerald-600 text-white' : 'border border-white/20 text-mixer-muted',
              )}
            >
              {buffer.isRecording ? 'BUFFER ON' : 'BUFFER OFF'}
            </button>
            <input
              type="text"
              value={clipTag}
              onChange={(e) => setClipTag(e.target.value)}
              placeholder="Clip tag / label"
              className="min-w-[120px] rounded border border-white/10 bg-black px-2 py-1 text-xs outline-none focus:border-emerald-500/40"
            />
            {canCloud && (
              <label className="flex items-center gap-1 text-[9px] font-bold tracking-wider text-mixer-muted">
                <input
                  type="checkbox"
                  checked={autoCloudSync}
                  onChange={(e) => setAutoCloudSync(e.target.checked)}
                  className="accent-emerald-500"
                />
                AUTO CLOUD
              </label>
            )}
            {plan !== 'free' && isPreciseExportSupported() && (
              <label className="flex items-center gap-1 text-[9px] font-bold tracking-wider text-mixer-muted">
                <input
                  type="checkbox"
                  checked={frameAccurateSave}
                  onChange={(e) => setFrameAccurateSave(e.target.checked)}
                  className="accent-emerald-500"
                />
                FRAME ACCURATE
              </label>
            )}
            {canMultiAngle && (
              <button
                type="button"
                disabled={cloudLoading}
                onClick={() => { void handleMultiAngleSync(); }}
                className="replay-btn"
              >
                <Layers className="h-3.5 w-3.5" /> SYNC ANGLES
              </button>
            )}
            {!cloudcast && (
              <span className="text-[10px] text-amber-400/90">Pair cameras on Video Mixer for live feeds</span>
            )}
          </div>

          {(sourceError || status) && (
            <p className={cn('px-3 py-1 text-[11px]', sourceError ? 'text-mixer-red' : 'text-emerald-300/90')}>
              {sourceError ?? status}
            </p>
          )}

          <div className="relative min-h-[200px] flex-1 bg-black">
            <video
              ref={(el) => {
                if (!el) return;
                if (activeStream) {
                  el.srcObject = activeStream;
                  void el.play().catch(() => undefined);
                } else {
                  el.srcObject = null;
                }
              }}
              className="h-full w-full object-contain"
              playsInline
              muted
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-3 py-2">
              <div className="mb-1 flex justify-between text-[9px] uppercase tracking-wider text-mixer-muted">
                <span>Rolling buffer · TC {buffer.houseClockSmpte}</span>
                <span>{buffer.bufferSeconds.toFixed(1)}s / {maxBuffer}s</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${bufferPct}%` }} />
              </div>
              {(buffer.markInSec != null || buffer.markOutSec != null) && (
                <p className="mt-1 text-[9px] text-emerald-300">
                  {buffer.markInSec != null && (
                    <span>IN {buffer.markInSec.toFixed(2)}s{buffer.markTimecodeIn ? ` · ${buffer.markTimecodeIn}` : ''}</span>
                  )}
                  {buffer.markInSec != null && buffer.markOutSec != null && ' → '}
                  {buffer.markOutSec != null && (
                    <span>OUT {buffer.markOutSec.toFixed(2)}s{buffer.markTimecodeOut ? ` · ${buffer.markTimecodeOut}` : ''}</span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-white/5 px-3 py-2">
            <button type="button" onClick={handleMarkIn} disabled={operatorLocks.readOnly} className="replay-btn">
              <Scissors className="h-3.5 w-3.5" /> MARK IN
            </button>
            <button type="button" onClick={handleMarkOut} disabled={operatorLocks.readOnly} className="replay-btn">
              <Scissors className="h-3.5 w-3.5" /> MARK OUT
            </button>
            <button type="button" onClick={buffer.clearMarks} disabled={operatorLocks.readOnly} className="replay-btn">
              <RotateCcw className="h-3.5 w-3.5" /> CLEAR
            </button>
            <button type="button" disabled={operatorLocks.readOnly} onClick={() => { void handleSaveToBank(); }} className="replay-btn replay-btn--primary">
              <Save className="h-3.5 w-3.5" /> TO BANK
            </button>
          </div>
          <p className="border-t border-white/5 px-3 py-1 text-[9px] text-mixer-muted">
            Shortcuts: I mark in · O mark out · Enter save · P push PGM · Space play · 1–9 banks
          </p>
        </section>

        <aside className="flex w-full shrink-0 flex-col lg:w-96">
          <div className="flex border-b border-white/5">
            {(['banks', 'cloud'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setPanel(tab)}
                className={cn(
                  'flex-1 py-2 text-[10px] font-bold tracking-wider',
                  panel === tab ? 'border-b-2 border-emerald-500 text-white' : 'text-mixer-muted',
                )}
              >
                {tab === 'banks' ? 'REPLAY BANKS' : 'REGAL CLOUD CLIPS'}
              </button>
            ))}
          </div>

          {panel === 'banks' ? (
            <>
              <div className="grid grid-cols-4 gap-1 p-2 sm:grid-cols-4">
                {banks.banks.map((bank, i) => (
                  <button
                    key={bank.id}
                    type="button"
                    onClick={() => banks.setActiveBankIndex(i)}
                    className={cn(
                      'rounded border px-1 py-2 text-[9px] font-bold tracking-wider transition-colors',
                      banks.activeBankIndex === i
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200'
                        : 'border-white/10 text-mixer-muted hover:border-white/25',
                      bank.clip && 'text-white',
                    )}
                  >
                    {i + 1}
                    {bank.clip && <span className="mt-0.5 block text-[8px] font-normal opacity-70">{bank.clip.durationSec.toFixed(1)}s</span>}
                  </button>
                ))}
              </div>

              <div className="min-h-0 flex-1 border-t border-white/5 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-mixer-muted">
                  {banks.activeBank?.label ?? 'Bank'} preview
                </p>
                <div className="mt-2 aspect-video overflow-hidden rounded border border-white/10 bg-black">
                  <video ref={preview.videoRef} className="h-full w-full object-contain" playsInline />
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <button type="button" onClick={preview.togglePlay} className="replay-btn">
                    {preview.isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => preview.stepFrame(-1)} className="replay-btn">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => preview.stepFrame(1)} className="replay-btn">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  {PLAYBACK_RATES.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => preview.setPlaybackRate(rate)}
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[9px] font-bold',
                        preview.playbackRate === rate ? 'bg-emerald-600 text-white' : 'border border-white/15 text-mixer-muted',
                      )}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>

                {banks.activeBank?.clip?.tags && banks.activeBank.clip.tags.length > 0 && (
                  <p className="mt-2 flex flex-wrap gap-1 text-[9px] text-emerald-300/80">
                    <Tag className="h-3 w-3" />
                    {banks.activeBank.clip.tags.join(' · ')}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={operatorLocks.readOnly} onClick={() => { void handlePushPgm(); }} className="replay-btn replay-btn--primary flex-1">
                    <Send className="h-3.5 w-3.5" /> PUSH PGM
                  </button>
                  <button
                    type="button"
                    disabled={cloudLoading || !canCloud}
                    onClick={() => { void handleSaveCloud(); }}
                    className="replay-btn flex-1"
                  >
                    {cloudLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cloud className="h-3.5 w-3.5" />}
                    CLOUD
                  </button>
                  <button
                    type="button"
                    disabled={cloudLoading || plan === 'free'}
                    onClick={() => { void handleSlowMoExport(); }}
                    className="replay-btn"
                    title="Export at current playback rate"
                  >
                    <Download className="h-3.5 w-3.5" /> {preview.playbackRate}x
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const clip = banks.activeBank?.clip;
                      if (clip) downloadBlobLocally(clip.blob, `replay-bank-${banks.activeBankIndex + 1}.webm`);
                    }}
                    className="replay-btn"
                    title="Download original clip"
                  >
                    RAW
                  </button>
                  <button
                    type="button"
                    onClick={() => banks.clearBank(banks.activeBankIndex)}
                    className="replay-btn text-mixer-red"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {banks.activeBank?.clip?.synced && (
                  <p className="mt-2 flex items-center gap-1 text-[10px] text-emerald-400">
                    <Cloud className="h-3 w-3" /> Synced to Regal Cloud
                  </p>
                )}

                <ReplayExportPresetsPanel
                  playbackRate={preview.playbackRate}
                  frameAccurate={frameAccurateSave}
                  autoCloudSync={autoCloudSync}
                  onApply={applyExportPreset}
                  canEdit={!operatorLocks.readOnly && plan !== 'free'}
                  className="mt-3"
                />

                <ReplayRundownPanel
                  banks={banks.banks}
                  activeBankIndex={banks.activeBankIndex}
                  playbackRate={preview.playbackRate}
                  rundownDraft={rundownDraft}
                  onToggleBank={toggleRundownBank}
                  onClearDraft={() => setRundownDraft([])}
                  onPlayRundown={(items) => { void handlePlayRundown(items); }}
                  remainingCount={replayRundownRemaining.length}
                  readOnly={operatorLocks.readOnly}
                  canSaveTemplates={canCloud}
                  templates={rundownTemplates.map((t) => ({
                    id: t.id,
                    name: t.name,
                    itemCount: t.items.length,
                  }))}
                  onSaveTemplate={(name) => { void handleSaveRundownTemplate(name); }}
                  onLoadTemplate={handleLoadRundownTemplate}
                  onDeleteTemplate={(id) => { void handleDeleteRundownTemplate(id); }}
                  className="mt-1"
                />
                <ReplayRundownSharePanel
                  canShare={canCloud}
                  readOnly={operatorLocks.readOnly}
                  templates={rundownTemplates.map((t) => ({ id: t.id, name: t.name }))}
                  onPublishShare={handlePublishRundownShare}
                  onImportShare={handleImportRundownShare}
                />
                <ReplayBufferSnapshotPanel
                  snapshot={bufferSnapshot}
                  ageMinutes={bufferSnapshot ? snapshotAgeMinutes(bufferSnapshot.capturedAt) : 0}
                />
                <ReplayShowLibraryPanel
                  canUse={canCloud}
                  readOnly={operatorLocks.readOnly}
                  templates={rundownTemplates.map((t) => ({ id: t.id, name: t.name }))}
                  libraryEntries={showLibrary.map((t) => ({
                    id: t.id,
                    name: t.name,
                    category: t.libraryCategory,
                    itemCount: t.items.length,
                  }))}
                  onPromote={handlePromoteToShowLibrary}
                  onLoadLibrary={handleLoadLibraryEntry}
                />
                <ReplayOpsDigestPanel
                  canUse={canCloud}
                  prefs={opsDigestPrefs}
                  onSavePrefs={handleSaveOpsDigestPrefs}
                  onSendNow={handleSendOpsDigest}
                />
                <ReplayLifecyclePanel
                  canUse={canCloud}
                  readOnly={operatorLocks.readOnly}
                  prefs={lifecyclePrefs}
                  archivedCount={archivedClipCount}
                  onSavePrefs={handleSaveLifecyclePrefs}
                  onApplyPolicy={handleApplyLifecyclePolicy}
                  onPurgeCandidates={handlePurgeLifecycleCandidates}
                />
              </div>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col p-3">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-200">
                <FolderOpen className="h-4 w-4" /> Regal Cloud Clips
              </div>
              {canCloud && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <input
                    type="search"
                    value={cloudQuery}
                    onChange={(e) => setCloudQuery(e.target.value)}
                    placeholder="Search label, file, device, timecode…"
                    className="min-w-0 flex-1 rounded border border-white/10 bg-black px-2 py-1 text-[10px] outline-none focus:border-emerald-500/40"
                  />
                  <input
                    type="text"
                    value={cloudTagFilter}
                    onChange={(e) => setCloudTagFilter(e.target.value)}
                    placeholder="Tag filter"
                    className="w-24 rounded border border-white/10 bg-black px-2 py-1 text-[10px] outline-none focus:border-emerald-500/40"
                  />
                  <button type="button" className="replay-btn text-[9px]" disabled={cloudLoading} onClick={() => { void runCloudSearch(); }}>
                    <Search className="h-3 w-3" /> SEARCH
                  </button>
                </div>
              )}
              {cloudUsage && cloudUsage.quota > 0 && (
                <p className="mt-1 text-[10px] text-mixer-muted">
                  Replay {formatBytes(cloudUsage.used)} · Total {formatBytes(cloudUsage.totalUsed)} / {formatBytes(cloudUsage.quota)} · {formatBytes(cloudUsage.remaining)} free
                </p>
              )}
              {plan === 'free' && (
                <p className="mt-2 text-[11px] text-amber-400/90">
                  Upgrade to Video Mixer Pro for cloud clip storage and sync.
                </p>
              )}
              <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
                {cloudClips.length === 0 ? (
                  <p className="text-[11px] text-white/30">No cloud clips yet. Save a bank clip to Regal Cloud.</p>
                ) : (
                  cloudClips.map((clip) => (
                    <div key={clip.id} className="mb-2 rounded border border-white/10 bg-black/40 p-2">
                      <p className="text-xs font-medium">{clip.label ?? clip.fileName}</p>
                      <p className="text-[9px] text-mixer-muted">
                        {clip.durationSec?.toFixed(1) ?? '?'}s · {formatBytes(clip.sizeBytes)}
                        {clip.bankIndex != null ? ` · Bank ${clip.bankIndex + 1}` : ''}
                        {clip.timecodeIn ? ` · ${clip.timecodeIn}` : ''}
                      </p>
                      <div className="mt-2 flex gap-1">
                        <button type="button" className="replay-btn text-[9px]" onClick={() => { void handleLoadFromCloud(clip); }}>
                          OPEN
                        </button>
                        <button type="button" className="replay-btn text-[9px] text-mixer-red" onClick={() => { void handleDeleteCloud(clip); }}>
                          DELETE
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <button type="button" className="replay-btn mt-2 w-full" onClick={() => { void refreshCloud(); }}>
                <MonitorPlay className="h-3.5 w-3.5" /> REFRESH LIBRARY
              </button>
            </div>
          )}
        </aside>
      </div>

      <ReplayDebugPanel
        connectionMode={connectionMode}
        sourceKind={sourceKind}
        selectedDeviceId={selectedDeviceId}
        activeStream={activeStream}
        pgmStream={pgmStream}
        sourceError={sourceError}
        buffer={{
          isRecording: buffer.isRecording,
          bufferSeconds: buffer.bufferSeconds,
          maxSeconds: buffer.maxSeconds,
          markInSec: buffer.markInSec,
          markOutSec: buffer.markOutSec,
          markTimecodeIn: buffer.markTimecodeIn,
          markTimecodeOut: buffer.markTimecodeOut,
          houseClockSmpte: buffer.houseClockSmpte,
          chunkCount: buffer.chunkCount,
          mimeType: buffer.mimeType,
        }}
        devices={cloudcast?.devices ?? []}
        getMeshStream={cloudcast?.getMeshStream ?? (() => null)}
        getWhepStream={getWhepStream}
        replayOnPgm={Boolean(replayPush)}
        replayOnPgmLabel={replayPush?.label ?? null}
        cloudClipCount={cloudClips.length}
        className="border-t border-emerald-500/15"
      />

      {operatorLocks.readOnly && (
        <ReplaySessionSyncPanel remoteState={remoteSync} className="border-t border-emerald-500/15" />
      )}

      <ReplayAuditPanel sessionId={sessionId} cloudClips={cloudClips} className="border-t border-emerald-500/15" />

      <footer className="flex shrink-0 items-center justify-between border-t border-emerald-500/15 bg-[#06100c] px-4 py-1.5 text-[9px] text-mixer-muted">
        <span className="flex items-center gap-1">
          <Radio className={cn('h-3 w-3', isOnAir ? 'text-mixer-red' : 'opacity-40')} />
          {replayPush
            ? replayRundownRemaining.length > 0
              ? `Replay on PGM — ${replayRundownRemaining.length} more in rundown`
              : 'Replay on PGM program bus — use RETURN TO LIVE on Video Mixer'
            : isOnAir
              ? 'Video Mixer ON AIR — push sends clip through PGM to stream destinations'
              : 'Video Mixer off-air — PGM bus preview works; go ON AIR for stream output'}
        </span>
        <span>{devices.length} paired camera{devices.length === 1 ? '' : 's'}</span>
      </footer>
    </div>
  );
}
