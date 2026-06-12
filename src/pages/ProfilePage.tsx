import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminNavLink } from '../components/admin/AdminNavLink';
import { StatCard, StatCardGrid } from '../components/admin/AdminShared';
import {
  Activity,
  Check,
  Cloud,
  Download,
  HardDrive,
  KeyRound,
  Loader2,
  LogOut,
  Radio,
  Shield,
  Tag,
  Trash2,
  User,
  Video,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  connectionModeLabel,
  displayFeaturesForPlan,
  streamQualityForPlan,
} from '../lib/branding';
import { redeemCoupon } from '../lib/couponService';
import {
  PLAN_IP_CAMERA_SLOTS,
  PLAN_RECORDING_STORAGE_GB,
  PLAN_TOTAL_CHANNELS,
} from '../lib/planLimits';
import { formatBytes, formatGbFromBytes } from '../lib/formatBytes';
import {
  fetchAccountDashboard,
  formatActivityAction,
  maskStreamKey,
  requestPasswordReset,
  storageWarningLevel,
  storageWarningMessage,
  updateUserProfile,
} from '../lib/profileService';
import {
  deleteMixerRecording,
  fetchRecordingStorageUsage,
  fetchUserRecordings,
  getRecordingDownloadUrl,
} from '../lib/recordingService';
import { fetchStreamDestinations } from '../lib/streamingService';
import { resolveStreamLimits } from '../lib/streamingLimits';
import { LEGAL_NAV, SITE_LEGAL } from '../config/siteLegal';
import type { MixerRecording, RecordingStorageUsage } from '../types/recording';
import type { UserAccountDashboard } from '../types/profile';
import type { StreamDestination } from '../types/streaming';
import { STREAM_PLATFORM_LABELS } from '../types/streaming';
import { PLAN_LABELS, formatPrice } from '../types/plans';
import { cn } from '../lib/utils';

export function ProfilePage() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [usage, setUsage] = useState<RecordingStorageUsage | null>(null);
  const [recordings, setRecordings] = useState<MixerRecording[]>([]);
  const [dashboard, setDashboard] = useState<UserAccountDashboard | null>(null);
  const [destinations, setDestinations] = useState<StreamDestination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [sendingReset, setSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const planId = profile?.plan_id ?? 'free';
  const quotaGb = PLAN_RECORDING_STORAGE_GB[planId];
  const hasCloudStorage = quotaGb > 0;
  const streamLimits = resolveStreamLimits(planId);

  const loadAccountData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usageData, recordingRows, destinationRows, dashboardResult] = await Promise.all([
        fetchRecordingStorageUsage(),
        fetchUserRecordings(),
        fetchStreamDestinations(),
        fetchAccountDashboard().catch(() => null),
      ]);
      setUsage(usageData);
      setRecordings(recordingRows);
      setDestinations(destinationRows);
      setDashboard(dashboardResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load account data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
  }, [profile?.full_name]);

  useEffect(() => {
    void loadAccountData();
  }, [loadAccountData]);

  const handleSaveName = async () => {
    if (!fullName.trim()) return;
    setSavingName(true);
    setNameSaved(false);
    try {
      await updateUserProfile(fullName);
      await refreshProfile();
      setNameSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update profile.');
    } finally {
      setSavingName(false);
    }
  };

  const handleRedeemCoupon = async () => {
    if (!couponCode.trim()) return;
    setRedeeming(true);
    setCouponError(null);
    setCouponMessage(null);
    try {
      const result = await redeemCoupon(couponCode.trim());
      setCouponMessage(result.message);
      setCouponCode('');
      if (result.kind === 'plan_upgrade') {
        await refreshProfile();
      }
      await loadAccountData();
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : 'Could not redeem coupon.');
    } finally {
      setRedeeming(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setSendingReset(true);
    setResetSent(false);
    try {
      await requestPasswordReset(user.email);
      setResetSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email.');
    } finally {
      setSendingReset(false);
    }
  };

  const handleDownload = async (recording: MixerRecording) => {
    setDownloadingId(recording.id);
    try {
      const url = await getRecordingDownloadUrl(recording.storagePath);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = recording.fileName;
      anchor.rel = 'noopener';
      anchor.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (recording: MixerRecording) => {
    if (!window.confirm(`Delete "${recording.fileName}" from cloud storage?`)) return;
    setDeletingId(recording.id);
    try {
      await deleteMixerRecording(recording.id);
      await loadAccountData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setDeletingId(null);
    }
  };

  const usagePercent =
    usage && usage.quotaBytes > 0
      ? Math.min(100, (usage.usedBytes / usage.quotaBytes) * 100)
      : 0;
  const storageLevel = storageWarningLevel(usagePercent);
  const storageWarning = storageWarningMessage(storageLevel);

  const enabledDestinations = destinations.filter((d) => d.isEnabled);

  return (
    <main className="px-6 py-12 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] text-mixer-red">ACCOUNT</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Profile dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-mixer-muted">
              Manage your plan, streaming destinations, cloud storage, and mixer sessions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminNavLink className="rounded border border-white/10 px-4 py-2 text-xs font-bold tracking-wider" />
            <Link
              to="/dashboard"
              className="rounded border border-white/20 px-4 py-2 text-xs font-bold tracking-wider hover:border-white/40"
            >
              OPEN MIXER
            </Link>
            <button
              type="button"
              onClick={() => signOut()}
              className="inline-flex items-center gap-2 rounded border border-white/10 px-4 py-2 text-xs font-bold tracking-wider text-mixer-muted hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
              SIGN OUT
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-mixer-red/30 bg-mixer-red/10 px-4 py-3 text-sm text-mixer-red">
            {error}
          </div>
        )}

        <StatCardGrid className="mb-6">
          <StatCard
            label="CURRENT PLAN"
            value={PLAN_LABELS[planId]}
            hint={profile?.plan.name}
            icon={HardDrive}
            tone={planId === 'free' ? 'default' : 'accent'}
          />
          <StatCard
            label="CLOUD STORAGE"
            value={hasCloudStorage ? `${Math.round(usagePercent)}%` : 'N/A'}
            hint={
              hasCloudStorage && usage
                ? `${formatGbFromBytes(usage.usedBytes)} of ${quotaGb} GB`
                : 'Upgrade for cloud recordings'
            }
            icon={Cloud}
            tone={
              storageLevel === 'full' || storageLevel === 'danger'
                ? 'danger'
                : storageLevel === 'warning'
                  ? 'warning'
                  : 'success'
            }
          />
          <StatCard
            label="RECORDINGS"
            value={recordings.length}
            hint={hasCloudStorage ? 'PGM files in cloud' : 'Pro plans only'}
            icon={Video}
          />
          <StatCard
            label="STREAM DESTINATIONS"
            value={dashboard ? `${enabledDestinations.length}/${destinations.length}` : '—'}
            hint={
              dashboard
                ? `${dashboard.active_session_count} active session${dashboard.active_session_count === 1 ? '' : 's'}`
                : 'Loading…'
            }
            icon={Radio}
          />
        </StatCardGrid>

        {storageWarning && (
          <div
            className={cn(
              'mb-6 rounded-lg border px-4 py-3 text-sm',
              storageLevel === 'full' || storageLevel === 'danger'
                ? 'border-mixer-red/30 bg-mixer-red/10 text-mixer-red'
                : storageLevel === 'warning'
                  ? 'border-mixer-yellow/30 bg-mixer-yellow/10 text-mixer-yellow'
                  : 'border-white/10 bg-white/5 text-mixer-muted',
            )}
          >
            {storageWarning}
          </div>
        )}

        {dashboard?.active_plan_grant && (
          <div className="mb-6 rounded-lg border border-mixer-green/25 bg-mixer-green/5 px-4 py-3 text-sm">
            <p className="font-bold text-mixer-green">Active plan grant</p>
            <p className="mt-1 text-mixer-muted">
              {PLAN_LABELS[dashboard.active_plan_grant.plan_id]} via{' '}
              {dashboard.active_plan_grant.reason ?? 'manual grant'}
              {dashboard.active_plan_grant.expires_at
                ? ` · expires ${new Date(dashboard.active_plan_grant.expires_at).toLocaleDateString()}`
                : ' · no expiry'}
            </p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <section className="rounded-xl border border-white/10 bg-[#0a0a0a] p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-mixer-red/20 text-mixer-red">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Account</h2>
                <p className="text-xs text-mixer-muted">{user?.email ?? profile?.email}</p>
                {dashboard?.member_since && (
                  <p className="mt-0.5 text-[10px] text-mixer-muted">
                    Member since {new Date(dashboard.member_since).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="text-[10px] font-bold tracking-wider text-mixer-muted">FULL NAME</span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1.5 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm outline-none focus:border-mixer-red/50"
                  placeholder="Your name"
                />
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={savingName || !fullName.trim()}
                  onClick={() => { void handleSaveName(); }}
                  className="rounded bg-mixer-red px-4 py-2 text-xs font-bold tracking-wider text-white hover:bg-mixer-red-dim disabled:opacity-50"
                >
                  {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : 'SAVE NAME'}
                </button>
                {nameSaved && (
                  <span className="inline-flex items-center gap-1 text-xs text-mixer-green">
                    <Check className="h-3.5 w-3.5" />
                    Saved
                  </span>
                )}
              </div>
            </div>

            <div className="mt-8 border-t border-white/10 pt-6">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-mixer-muted" />
                <h3 className="text-sm font-bold">Security</h3>
              </div>
              <p className="mt-2 text-xs text-mixer-muted">
                Send a password reset link to your email address.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={sendingReset || !user?.email}
                  onClick={() => { void handlePasswordReset(); }}
                  className="inline-flex items-center gap-2 rounded border border-white/20 px-4 py-2 text-xs font-bold tracking-wider hover:border-white/40 disabled:opacity-50"
                >
                  {sendingReset ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <KeyRound className="h-3.5 w-3.5" />
                  )}
                  RESET PASSWORD
                </button>
                {resetSent && (
                  <span className="text-xs text-mixer-green">Reset email sent — check your inbox.</span>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-[#0a0a0a] p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                <HardDrive className="h-5 w-5 text-mixer-muted" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Current plan</h2>
                <p className="text-xs text-mixer-muted">{PLAN_LABELS[planId]}</p>
              </div>
            </div>

            {profile && (
              <div className="mt-5 space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-2xl font-bold">{profile.plan.name}</p>
                  <p className="text-sm text-mixer-muted">{formatPrice(profile.plan.price_monthly_cents)}</p>
                </div>
                <p className="text-xs text-mixer-muted">
                  {profile.plan.max_mobile_devices} mobile
                  {profile.plan.max_usb_devices > 0 && ` + ${profile.plan.max_usb_devices} USB`}
                  {' · '}
                  {connectionModeLabel(profile.plan.connection_mode)}
                  {planId !== 'free' && ` · ${streamQualityForPlan(planId)}`}
                </p>
                <ul className="space-y-2">
                  {displayFeaturesForPlan(planId, profile.plan.features).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs text-mixer-muted">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mixer-green" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/pricing"
                  className="inline-flex rounded border border-white/20 px-4 py-2 text-xs font-bold tracking-wider hover:border-white/40"
                >
                  {planId === 'pro_master' ? 'VIEW PLANS' : 'CHANGE PLAN'}
                </Link>
              </div>
            )}
          </section>
        </div>

        <section className="mt-6 rounded-xl border border-white/10 bg-[#0a0a0a] p-6">
          <h2 className="text-lg font-bold">Plan limits</h2>
          <p className="mt-1 text-xs text-mixer-muted">What your current plan includes for mixing and streaming.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-black/40 p-4">
              <p className="text-[10px] font-bold tracking-wider text-mixer-muted">VIDEO INPUTS</p>
              <p className="mt-1 text-xl font-bold">{PLAN_TOTAL_CHANNELS[planId]}</p>
              <p className="mt-1 text-[10px] text-mixer-muted">
                {PLAN_IP_CAMERA_SLOTS[planId] > 0 ? 'Includes IP camera URL' : 'Mobile cameras only'}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/40 p-4">
              <p className="text-[10px] font-bold tracking-wider text-mixer-muted">CONCURRENT STREAMS</p>
              <p className="mt-1 text-xl font-bold">{streamLimits.maxConcurrentStreams}</p>
              <p className="mt-1 text-[10px] text-mixer-muted">
                {streamLimits.allowsMultiplePlatforms ? 'Multi-platform' : 'YouTube or Custom'}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/40 p-4">
              <p className="text-[10px] font-bold tracking-wider text-mixer-muted">YOUTUBE DESTINATIONS</p>
              <p className="mt-1 text-xl font-bold">{streamLimits.maxYouTubeDestinations}</p>
              <p className="mt-1 text-[10px] text-mixer-muted">
                {destinations.filter((d) => d.platform === 'youtube').length} saved
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/40 p-4">
              <p className="text-[10px] font-bold tracking-wider text-mixer-muted">CLOUD STORAGE</p>
              <p className="mt-1 text-xl font-bold">{quotaGb > 0 ? `${quotaGb} GB` : '—'}</p>
              <p className="mt-1 text-[10px] text-mixer-muted">PGM recordings</p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-white/10 bg-[#0a0a0a] p-6">
          <div className="flex items-center gap-3">
            <Tag className="h-5 w-5 text-mixer-muted" />
            <div>
              <h2 className="text-lg font-bold">Redeem coupon</h2>
              <p className="text-xs text-mixer-muted">
                Have a promo code? Apply it here or on the pricing page.
                {dashboard && dashboard.coupon_redemptions_count > 0 && (
                  <> · {dashboard.coupon_redemptions_count} redeemed</>
                )}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="COUPON CODE"
              className="min-w-[180px] flex-1 rounded border border-white/10 bg-black px-3 py-2 font-mono text-sm uppercase outline-none focus:border-mixer-red/40"
            />
            <button
              type="button"
              disabled={redeeming || !couponCode.trim()}
              onClick={() => { void handleRedeemCoupon(); }}
              className="rounded bg-mixer-red px-4 py-2 text-xs font-bold tracking-wider text-white hover:bg-mixer-red-dim disabled:opacity-50"
            >
              {redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : 'APPLY'}
            </button>
          </div>
          {couponMessage && <p className="mt-2 text-sm text-mixer-green">{couponMessage}</p>}
          {couponError && <p className="mt-2 text-sm text-mixer-red">{couponError}</p>}
        </section>

        <section className="mt-6 rounded-xl border border-white/10 bg-[#0a0a0a] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">Mixer sessions</h2>
              <p className="text-xs text-mixer-muted">
                Access codes for pairing mobile cameras and USB devices.
              </p>
            </div>
            <Link
              to="/dashboard"
              className="rounded border border-white/10 px-3 py-1.5 text-[10px] font-bold tracking-wider text-mixer-muted hover:text-white"
            >
              OPEN MIXER
            </Link>
          </div>

          {loading ? (
            <div className="mt-8 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-mixer-red" />
            </div>
          ) : !dashboard?.mixer_sessions.length ? (
            <div className="mt-6 rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-sm text-mixer-muted">
              No mixer sessions yet. Open the dashboard to create your first session.
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] tracking-wider text-mixer-muted">
                    <th className="px-2 py-2 font-bold">CODE</th>
                    <th className="px-2 py-2 font-bold">STATUS</th>
                    <th className="px-2 py-2 font-bold">DEVICES</th>
                    <th className="px-2 py-2 font-bold">CREATED</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.mixer_sessions.map((session) => (
                    <tr key={session.session_id} className="border-b border-white/5">
                      <td className="px-2 py-3 font-mono font-bold text-white">{session.access_code}</td>
                      <td className="px-2 py-3">
                        <span
                          className={cn(
                            'rounded px-2 py-0.5 text-[10px] font-bold tracking-wider',
                            session.is_active
                              ? 'bg-mixer-green/15 text-mixer-green'
                              : 'bg-white/5 text-mixer-muted',
                          )}
                        >
                          {session.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-mixer-muted">
                        {session.live_device_count} live / {session.device_count} paired
                      </td>
                      <td className="px-2 py-3 text-mixer-muted">
                        {new Date(session.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-xl border border-white/10 bg-[#0a0a0a] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">Stream destinations</h2>
              <p className="text-xs text-mixer-muted">
                Saved RTMP outputs for GO LIVE. Manage destinations in the mixer Stream panel.
              </p>
            </div>
            <Link
              to="/dashboard"
              className="rounded border border-white/10 px-3 py-1.5 text-[10px] font-bold tracking-wider text-mixer-muted hover:text-white"
            >
              MANAGE IN MIXER
            </Link>
          </div>

          {loading ? (
            <div className="mt-8 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-mixer-red" />
            </div>
          ) : destinations.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-sm text-mixer-muted">
              No stream destinations saved. Add YouTube, Twitch, or custom RTMP in the mixer.
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] tracking-wider text-mixer-muted">
                    <th className="px-2 py-2 font-bold">NAME</th>
                    <th className="px-2 py-2 font-bold">PLATFORM</th>
                    <th className="px-2 py-2 font-bold">KEY</th>
                    <th className="px-2 py-2 font-bold">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {destinations.map((dest) => (
                    <tr key={dest.id} className="border-b border-white/5">
                      <td className="px-2 py-3 font-medium text-white">{dest.name}</td>
                      <td className="px-2 py-3 text-mixer-muted">
                        {STREAM_PLATFORM_LABELS[dest.platform]}
                      </td>
                      <td className="px-2 py-3 font-mono text-mixer-muted">
                        {maskStreamKey(dest.streamKey)}
                      </td>
                      <td className="px-2 py-3">
                        <span
                          className={cn(
                            'rounded px-2 py-0.5 text-[10px] font-bold tracking-wider',
                            dest.isEnabled
                              ? 'bg-mixer-green/15 text-mixer-green'
                              : 'bg-white/5 text-mixer-muted',
                          )}
                        >
                          {dest.isEnabled ? 'ENABLED' : 'OFF'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-xl border border-white/10 bg-[#0a0a0a] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-mixer-green/15 text-mixer-green">
                <Cloud className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Cloud storage</h2>
                <p className="text-xs text-mixer-muted">
                  PGM recordings from your mixer are saved here on Pro and Pro Master plans.
                </p>
              </div>
            </div>
            {hasCloudStorage && usage && (
              <div className="text-right text-xs text-mixer-muted">
                <p className="font-bold text-white">{formatGbFromBytes(usage.usedBytes)} used</p>
                <p>{quotaGb} GB included</p>
              </div>
            )}
          </div>

          {!hasCloudStorage ? (
            <div className="mt-6 rounded-lg border border-white/10 bg-black/40 px-4 py-5 text-sm text-mixer-muted">
              The Free plan does not include cloud recording storage. Upgrade to Pro for 50GB or Pro Master for 100GB.
              {' '}
              <Link to="/pricing" className="text-mixer-red underline">
                View plans
              </Link>
            </div>
          ) : (
            <div className="mt-6">
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    usagePercent >= 90 ? 'bg-mixer-red' : usagePercent >= 75 ? 'bg-mixer-yellow' : 'bg-mixer-green',
                  )}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-mixer-muted">
                <span>{usage ? formatBytes(usage.usedBytes) : '0 B'} used</span>
                <span>{usage ? formatBytes(usage.remainingBytes) : `${quotaGb} GB`} remaining</span>
              </div>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-xl border border-white/10 bg-[#0a0a0a] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Mixer recordings</h2>
              <p className="text-xs text-mixer-muted">
                Files recorded from PGM OUT in the dashboard.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { void loadAccountData(); }}
              className="rounded border border-white/10 px-3 py-1.5 text-[10px] font-bold tracking-wider text-mixer-muted hover:text-white"
            >
              REFRESH
            </button>
          </div>

          {loading ? (
            <div className="mt-10 flex justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-mixer-red" />
            </div>
          ) : recordings.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-white/10 px-4 py-10 text-center text-sm text-mixer-muted">
              {hasCloudStorage
                ? 'No cloud recordings yet. Press REC on the mixer to save PGM output to your account.'
                : 'Cloud recordings are available on Pro and Pro Master plans.'}
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] tracking-wider text-mixer-muted">
                    <th className="px-2 py-2 font-bold">FILE</th>
                    <th className="px-2 py-2 font-bold">SIZE</th>
                    <th className="px-2 py-2 font-bold">RECORDED</th>
                    <th className="px-2 py-2 text-right font-bold">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {recordings.map((recording) => (
                    <tr key={recording.id} className="border-b border-white/5">
                      <td className="px-2 py-3">
                        <p className="font-medium text-white">{recording.fileName}</p>
                        <p className="text-[10px] text-mixer-muted">{recording.mimeType}</p>
                      </td>
                      <td className="px-2 py-3 text-mixer-muted">{formatBytes(recording.sizeBytes)}</td>
                      <td className="px-2 py-3 text-mixer-muted">
                        {new Date(recording.createdAt).toLocaleString()}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={downloadingId === recording.id}
                            onClick={() => { void handleDownload(recording); }}
                            className="inline-flex items-center gap-1 rounded border border-white/10 px-2.5 py-1.5 text-[10px] font-bold tracking-wider hover:border-white/30 disabled:opacity-50"
                          >
                            {downloadingId === recording.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Download className="h-3 w-3" />
                            )}
                            DOWNLOAD
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === recording.id}
                            onClick={() => { void handleDelete(recording); }}
                            className="inline-flex items-center gap-1 rounded border border-mixer-red/30 px-2.5 py-1.5 text-[10px] font-bold tracking-wider text-mixer-red hover:bg-mixer-red/10 disabled:opacity-50"
                          >
                            {deletingId === recording.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                            DELETE
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-xl border border-white/10 bg-[#0a0a0a] p-6">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-mixer-muted" />
            <div>
              <h2 className="text-lg font-bold">Recent activity</h2>
              <p className="text-xs text-mixer-muted">Account events tied to your user.</p>
            </div>
          </div>

          {loading ? (
            <div className="mt-8 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-mixer-red" />
            </div>
          ) : !dashboard?.recent_activity.length ? (
            <div className="mt-6 rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-sm text-mixer-muted">
              No activity logged yet. Plan changes, coupon redemptions, and recordings will appear here.
            </div>
          ) : (
            <ul className="mt-6 divide-y divide-white/5">
              {dashboard.recent_activity.map((item) => (
                <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-xs">
                  <span className="font-medium text-white">{formatActivityAction(item.action)}</span>
                  <span className="text-mixer-muted">
                    {new Date(item.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6 rounded-xl border border-white/10 bg-[#0a0a0a] p-6">
          <h2 className="text-lg font-bold">Support & legal</h2>
          <p className="mt-1 text-xs text-mixer-muted">
            Questions about your account or billing? Contact{' '}
            <a href={`mailto:${SITE_LEGAL.supportEmail}`} className="text-mixer-red underline">
              {SITE_LEGAL.supportEmail}
            </a>
          </p>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
            {LEGAL_NAV.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-xs text-mixer-muted underline hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
