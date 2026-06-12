import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Cloud,
  Cpu,
  Crown,
  Gift,
  HardDrive,
  LayoutDashboard,
  Loader2,
  Megaphone,
  MonitorSmartphone,
  Radio,
  RefreshCw,
  Shield,
  ShieldCheck,
  Ticket,
  Trash2,
  UserCheck,
  Users,
  Video,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import { AdminBroadcastingPanel } from '../components/admin/AdminBroadcastingPanel';
import { AdminCouponsPanel } from '../components/admin/AdminCouponsPanel';
import { AdminEmailQueuePanel } from '../components/admin/AdminEmailQueuePanel';
import { AdminUserDetailCards } from '../components/admin/AdminUserDetailCards';
import { AdminManualAdminPanel } from '../components/admin/AdminManualAdminPanel';
import { AdminPlanIssuingPanel } from '../components/admin/AdminPlanIssuingPanel';
import {
  AdminPagination,
  AdminSection,
  InsightCard,
  SeverityBadge,
  StatCard,
  StatCardGrid,
  StatusBadge,
} from '../components/admin/AdminShared';
import { useAuth } from '../context/AuthContext';
import {
  adminClearOldErrorLogs,
  adminDeactivateSession,
  adminDeleteErrorLog,
  adminGrantRole,
  adminRevokeRole,
  adminSetUserPlan,
  adminUpdatePlan,
  fetchActivityLogs,
  fetchAdminBroadcasts,
  fetchAdminCoupons,
  fetchAdminDevices,
  fetchAdminMembers,
  fetchAdminOverview,
  fetchAdminPlans,
  fetchAdminSessions,
  fetchAdminStreamDestinations,
  fetchAdminUserDetail,
  fetchAdminUsers,
  fetchAllRecordings,
  fetchEmailQueue,
  fetchErrorLogs,
  fetchPlanGrants,
  fetchSessionDetail,
  fetchSystemHealth,
} from '../lib/adminService';
import { formatBytes } from '../lib/formatBytes';
import type {
  ActivityLogRow,
  AdminDeviceRow,
  AdminMemberRow,
  AdminOverview,
  AdminPlanRow,
  AdminRecordingRow,
  AdminSessionDetail,
  AdminSessionRow,
  AdminStreamDestinationRow,
  AdminTab,
  AdminUserDetail,
  AdminUserRow,
  CouponRow,
  ErrorLogRow,
  PlanGrantRow,
  EmailQueueRow,
  PlatformBroadcastRow,
  SystemHealth,
} from '../types/admin';
import type { PlanTier } from '../types/plans';
import { PLAN_LABELS, formatPrice } from '../types/plans';
import { cn } from '../lib/utils';

const PAGE_SIZE = 50;

const TABS: { id: AdminTab; label: string; icon: typeof Users }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'plans', label: 'Plans', icon: HardDrive },
  { id: 'plan_grants', label: 'Plan issuing', icon: Gift },
  { id: 'coupons', label: 'Coupons', icon: Ticket },
  { id: 'broadcasting', label: 'Broadcasting', icon: Megaphone },
  { id: 'sessions', label: 'Mixer usage', icon: Radio },
  { id: 'devices', label: 'Devices', icon: MonitorSmartphone },
  { id: 'recordings', label: 'Recordings', icon: Video },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'errors', label: 'Errors', icon: AlertTriangle },
  { id: 'admins', label: 'Admins', icon: ShieldCheck },
  { id: 'system', label: 'System', icon: Cpu },
];

export function AdminPage() {
  const { adminAccess } = useAuth();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [userPage, setUserPage] = useState(0);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
  const [plans, setPlans] = useState<AdminPlanRow[]>([]);
  const [sessions, setSessions] = useState<AdminSessionRow[]>([]);
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const [sessionPage, setSessionPage] = useState(0);
  const [activeSessionsOnly, setActiveSessionsOnly] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<AdminSessionDetail | null>(null);
  const [devices, setDevices] = useState<AdminDeviceRow[]>([]);
  const [devicesTotal, setDevicesTotal] = useState(0);
  const [devicePage, setDevicePage] = useState(0);
  const [deviceStatus, setDeviceStatus] = useState('');
  const [deviceSearch, setDeviceSearch] = useState('');
  const [recordings, setRecordings] = useState<AdminRecordingRow[]>([]);
  const [recordingsTotal, setRecordingsTotal] = useState(0);
  const [recordingPage, setRecordingPage] = useState(0);
  const [recordingSearch, setRecordingSearch] = useState('');
  const [activityLogs, setActivityLogs] = useState<ActivityLogRow[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityPage, setActivityPage] = useState(0);
  const [activityAction, setActivityAction] = useState('');
  const [errorLogs, setErrorLogs] = useState<ErrorLogRow[]>([]);
  const [errorTotal, setErrorTotal] = useState(0);
  const [errorPage, setErrorPage] = useState(0);
  const [errorSeverity, setErrorSeverity] = useState('');
  const [admins, setAdmins] = useState<AdminMemberRow[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [planGrants, setPlanGrants] = useState<PlanGrantRow[]>([]);
  const [planGrantsTotal, setPlanGrantsTotal] = useState(0);
  const [grantPage, setGrantPage] = useState(0);
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [broadcasts, setBroadcasts] = useState<PlatformBroadcastRow[]>([]);
  const [streamDestinations, setStreamDestinations] = useState<AdminStreamDestinationRow[]>([]);
  const [streamDestinationsTotal, setStreamDestinationsTotal] = useState(0);
  const [destinationPage, setDestinationPage] = useState(0);
  const [destinationSearch, setDestinationSearch] = useState('');
  const [emailQueue, setEmailQueue] = useState<EmailQueueRow[]>([]);
  const [emailQueueTotal, setEmailQueueTotal] = useState(0);
  const [emailQueuePage, setEmailQueuePage] = useState(0);

  const loadTab = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'overview') {
        setOverview(await fetchAdminOverview());
      } else if (tab === 'users') {
        const data = await fetchAdminUsers(userSearch, PAGE_SIZE, userPage * PAGE_SIZE);
        setUsers(data.users);
        setUsersTotal(data.total);
      } else if (tab === 'plans') {
        setPlans(await fetchAdminPlans());
      } else if (tab === 'plan_grants') {
        const data = await fetchPlanGrants(PAGE_SIZE, grantPage * PAGE_SIZE);
        setPlanGrants(data.grants);
        setPlanGrantsTotal(data.total);
      } else if (tab === 'coupons') {
        setCoupons(await fetchAdminCoupons());
      } else if (tab === 'broadcasting') {
        const [broadcastRows, destinationData] = await Promise.all([
          fetchAdminBroadcasts(),
          fetchAdminStreamDestinations(
            PAGE_SIZE,
            destinationPage * PAGE_SIZE,
            destinationSearch || undefined,
          ),
        ]);
        setBroadcasts(broadcastRows);
        setStreamDestinations(destinationData.destinations);
        setStreamDestinationsTotal(destinationData.total);
      } else if (tab === 'sessions') {
        const data = await fetchAdminSessions(PAGE_SIZE, sessionPage * PAGE_SIZE, activeSessionsOnly);
        setSessions(data.sessions);
        setSessionsTotal(data.total);
      } else if (tab === 'devices') {
        const data = await fetchAdminDevices(
          PAGE_SIZE,
          devicePage * PAGE_SIZE,
          deviceStatus || undefined,
          deviceSearch || undefined,
        );
        setDevices(data.devices);
        setDevicesTotal(data.total);
      } else if (tab === 'recordings') {
        const data = await fetchAllRecordings(
          PAGE_SIZE,
          recordingPage * PAGE_SIZE,
          recordingSearch || undefined,
        );
        setRecordings(data.recordings);
        setRecordingsTotal(data.total);
      } else if (tab === 'activity') {
        const data = await fetchActivityLogs(
          PAGE_SIZE,
          activityPage * PAGE_SIZE,
          activityAction || undefined,
        );
        setActivityLogs(data.logs);
        setActivityTotal(data.total);
      } else if (tab === 'errors') {
        const data = await fetchErrorLogs(
          PAGE_SIZE,
          errorPage * PAGE_SIZE,
          errorSeverity || undefined,
        );
        setErrorLogs(data.logs);
        setErrorTotal(data.total);
      } else if (tab === 'admins') {
        setAdmins(await fetchAdminMembers());
      } else if (tab === 'system') {
        const [health, emails] = await Promise.all([
          fetchSystemHealth(),
          fetchEmailQueue(PAGE_SIZE, emailQueuePage * PAGE_SIZE),
        ]);
        setSystemHealth(health);
        setEmailQueue(emails.items);
        setEmailQueueTotal(emails.total);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  }, [
    tab,
    userSearch,
    userPage,
    grantPage,
    destinationPage,
    destinationSearch,
    activeSessionsOnly,
    sessionPage,
    deviceStatus,
    deviceSearch,
    devicePage,
    recordingSearch,
    recordingPage,
    activityAction,
    activityPage,
    errorSeverity,
    errorPage,
    emailQueuePage,
  ]);

  useEffect(() => {
    void loadTab();
  }, [loadTab]);

  useEffect(() => {
    if (!autoRefresh || (tab !== 'overview' && tab !== 'system')) return;
    const id = window.setInterval(() => { void loadTab(); }, 30_000);
    return () => window.clearInterval(id);
  }, [autoRefresh, tab, loadTab]);

  useEffect(() => {
    if (!selectedUserId) {
      setUserDetail(null);
      return;
    }
    void fetchAdminUserDetail(selectedUserId)
      .then(setUserDetail)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load user.'));
  }, [selectedUserId]);

  useEffect(() => {
    if (!selectedSessionId) {
      setSessionDetail(null);
      return;
    }
    void fetchSessionDetail(selectedSessionId)
      .then(setSessionDetail)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load session.'));
  }, [selectedSessionId]);

  const handleUserPlanChange = async (userId: string, planId: PlanTier) => {
    try {
      await adminSetUserPlan(userId, planId);
      await loadTab();
      if (selectedUserId === userId) {
        setUserDetail(await fetchAdminUserDetail(userId));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Plan update failed.');
    }
  };

  const handlePlanSave = async (plan: AdminPlanRow) => {
    try {
      await adminUpdatePlan({
        planId: plan.id,
        name: plan.name,
        maxMobileDevices: plan.max_mobile_devices,
        maxUsbDevices: plan.max_usb_devices,
        maxTotalChannels: plan.max_total_channels,
        connectionMode: plan.connection_mode,
        priceMonthlyCents: plan.price_monthly_cents,
        features: plan.features,
      });
      setPlans(await fetchAdminPlans());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Plan save failed.');
    }
  };

  const handleDeactivateSession = async (sessionId: string) => {
    try {
      await adminDeactivateSession(sessionId);
      setSelectedSessionId(null);
      await loadTab();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate session.');
    }
  };

  const handleDeleteError = async (id: string) => {
    try {
      await adminDeleteErrorLog(id);
      await loadTab();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete error log.');
    }
  };

  const handleClearOldErrors = async () => {
    try {
      const count = await adminClearOldErrorLogs(30);
      setError(null);
      await loadTab();
      alert(`Cleared ${count} error logs older than 30 days.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear old errors.');
    }
  };

  const isSuperAdmin = adminAccess?.role === 'super_admin';

  return (
    <main className="min-h-screen bg-[#060606] text-mixer-text">
      <div className="border-b border-white/10 bg-[#0a0a0a]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-mixer-red" />
            <div>
              <h1 className="text-lg font-bold tracking-wide">CloudCast Admin</h1>
              <p className="text-[10px] text-mixer-muted">
                Role: {adminAccess?.role ?? 'admin'} · Manage users, plans, mixer usage & logs
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-[10px] text-mixer-muted">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh (30s)
            </label>
            <button
              type="button"
              onClick={() => { void loadTab(); }}
              className="inline-flex items-center gap-1 rounded border border-white/10 px-3 py-1.5 text-[10px] font-bold tracking-wider hover:border-white/30"
            >
              <RefreshCw className="h-3 w-3" />
              REFRESH
            </button>
            <Link to="/dashboard" className="rounded border border-white/10 px-3 py-1.5 text-[10px] font-bold tracking-wider hover:border-white/30">
              MIXER
            </Link>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6 pb-3">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded px-3 py-1.5 text-[10px] font-bold tracking-wider transition-colors',
                tab === id ? 'bg-mixer-red/20 text-mixer-red' : 'text-mixer-muted hover:text-white',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {error && (
          <div className="mb-4 rounded-lg border border-mixer-red/30 bg-mixer-red/10 px-4 py-3 text-sm text-mixer-red">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-mixer-red" />
          </div>
        ) : tab === 'overview' && overview ? (
          <div className="space-y-6">
            <StatCardGrid>
              <StatCard label="Total users" value={overview.total_users} icon={Users} tone="accent" />
              <StatCard label="Active sessions" value={overview.active_sessions} icon={Radio} tone="success" hint={`${overview.total_sessions} total`} />
              <StatCard label="Live devices" value={overview.live_devices} icon={Wifi} hint={`${overview.paired_devices} paired`} />
              <StatCard label="Cloud recordings" value={overview.recordings_count} icon={Cloud} hint={formatBytes(overview.recordings_bytes)} />
            </StatCardGrid>
            <StatCardGrid>
              <StatCard label="Activity (24h)" value={overview.activity_24h} icon={Activity} />
              <StatCard
                label="Errors (24h)"
                value={overview.errors_24h}
                icon={AlertTriangle}
                tone={overview.errors_24h > 0 ? 'warning' : 'default'}
                hint={`${overview.errors_open} total logged`}
              />
              {overview.stream_destinations != null && (
                <StatCard label="Stream destinations" value={overview.stream_destinations} icon={Zap} />
              )}
              {overview.admin_count != null && (
                <StatCard label="Admin users" value={overview.admin_count} icon={ShieldCheck} tone="danger" />
              )}
            </StatCardGrid>
            <div>
              <p className="mb-3 text-[10px] font-bold tracking-wider text-mixer-muted">USERS BY PLAN</p>
              <StatCardGrid cols={3}>
                {Object.entries(overview.users_by_plan).map(([plan, count]) => (
                  <InsightCard
                    key={plan}
                    title={PLAN_LABELS[plan as PlanTier] ?? plan}
                    value={count}
                    description="registered accounts"
                    icon={plan === 'pro_master' ? Crown : plan === 'pro' ? Zap : Users}
                    tone={plan === 'pro_master' ? 'accent' : plan === 'pro' ? 'success' : 'default'}
                  />
                ))}
              </StatCardGrid>
            </div>
          </div>
        ) : tab === 'users' ? (
          <div className="space-y-6">
            <StatCardGrid>
              <StatCard label="Registered users" value={usersTotal} icon={Users} tone="accent" />
              <StatCard label="Admins (page)" value={users.filter((u) => u.is_admin).length} icon={ShieldCheck} tone="danger" />
              <StatCard
                label="Paid plans (page)"
                value={users.filter((u) => u.plan_id !== 'free').length}
                icon={Crown}
                tone="success"
              />
              <StatCard
                label="With recordings (page)"
                value={users.filter((u) => u.recording_count > 0).length}
                icon={HardDrive}
              />
            </StatCardGrid>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <AdminSection title="Users" description={`${usersTotal} registered accounts`}>
              <div className="mb-4 flex gap-2">
                <input
                  type="search"
                  value={userSearch}
                  onChange={(e) => { setUserSearch(e.target.value); setUserPage(0); }}
                  placeholder="Search email or name…"
                  className="flex-1 rounded border border-white/10 bg-black px-3 py-2 text-sm outline-none focus:border-mixer-red/40"
                />
                <button type="button" onClick={() => { void loadTab(); }} className="rounded border border-white/10 px-3 text-xs font-bold">
                  SEARCH
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] text-mixer-muted">
                      <th className="px-2 py-2">USER</th>
                      <th className="px-2 py-2">PLAN</th>
                      <th className="px-2 py-2">SESSIONS</th>
                      <th className="px-2 py-2">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className={cn('border-b border-white/5', selectedUserId === u.id && 'bg-white/5')}>
                        <td className="px-2 py-3">
                          <button type="button" onClick={() => setSelectedUserId(u.id)} className="text-left hover:text-mixer-red">
                            <p className="font-medium">{u.full_name || '—'}</p>
                            <p className="text-[10px] text-mixer-muted">{u.email}</p>
                          </button>
                        </td>
                        <td className="px-2 py-3">
                          <select
                            value={u.plan_id}
                            onChange={(e) => { void handleUserPlanChange(u.id, e.target.value as PlanTier); }}
                            className="rounded border border-white/10 bg-black px-2 py-1 text-[10px]"
                          >
                            {(['free', 'pro', 'pro_master'] as PlanTier[]).map((p) => (
                              <option key={p} value={p}>{PLAN_LABELS[p]}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-3 text-mixer-muted">{u.session_count} / {u.recording_count} rec</td>
                        <td className="px-2 py-3">
                          {isSuperAdmin && (
                            u.is_admin ? (
                              <button type="button" onClick={() => { void adminRevokeRole(u.id).then(loadTab); }} className="text-[10px] text-mixer-red underline">
                                Revoke admin
                              </button>
                            ) : (
                              <button type="button" onClick={() => { void adminGrantRole(u.id, 'admin').then(loadTab); }} className="text-[10px] text-mixer-green underline">
                                Make admin
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <AdminPagination page={userPage} pageSize={PAGE_SIZE} total={usersTotal} onPageChange={setUserPage} />
            </AdminSection>

            <AdminSection title="User detail">
              {!userDetail?.profile ? (
                <p className="text-sm text-mixer-muted">Select a user to inspect sessions, recordings, and activity.</p>
              ) : (
                <div className="space-y-4 text-xs">
                  <AdminUserDetailCards detail={userDetail} />
                  <div>
                    <p className="font-bold">{userDetail.profile.full_name || '—'}</p>
                    <p className="text-mixer-muted">{userDetail.profile.email}</p>
                    <p className="mt-1">Plan: {userDetail.profile.plan_name}</p>
                    <p>Signed up: {new Date(userDetail.profile.signed_up_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="mb-1 font-bold text-mixer-muted">SESSIONS ({userDetail.sessions.length})</p>
                    {userDetail.sessions.map((s) => (
                      <div key={s.id} className="mb-2 rounded border border-white/5 p-2">
                        <p>{s.access_code} · {s.plan_id} · {s.is_active ? 'active' : 'inactive'}</p>
                        <p className="text-[10px] text-mixer-muted">{s.connection_mode} · max {s.max_devices} inputs</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="mb-1 font-bold text-mixer-muted">RECORDINGS ({userDetail.recordings.length})</p>
                    {userDetail.recordings.map((r) => (
                      <p key={r.id} className="text-[10px] text-mixer-muted">{r.file_name} · {formatBytes(r.size_bytes)}</p>
                    ))}
                  </div>
                  <div>
                    <p className="mb-1 font-bold text-mixer-muted">STREAM DESTINATIONS ({userDetail.destinations.length})</p>
                    {userDetail.destinations.map((d) => (
                      <p key={d.id} className="text-[10px] text-mixer-muted">
                        {d.name} · {d.platform} · {d.is_enabled ? 'enabled' : 'disabled'}
                      </p>
                    ))}
                  </div>
                  <div>
                    <p className="mb-1 font-bold text-mixer-muted">RECENT ACTIVITY</p>
                    {userDetail.recent_activity.slice(0, 8).map((a) => (
                      <p key={a.id} className="text-[10px] text-mixer-muted">{a.action} · {new Date(a.created_at).toLocaleString()}</p>
                    ))}
                  </div>
                </div>
              )}
            </AdminSection>
          </div>
          </div>
        ) : tab === 'plans' ? (
          <div className="space-y-6">
            <StatCardGrid cols={3}>
              {plans.map((plan) => (
                <InsightCard
                  key={plan.id}
                  title={plan.name}
                  value={formatPrice(plan.price_monthly_cents)}
                  description={`${plan.max_total_channels} channels · ${plan.connection_mode}`}
                  icon={plan.id === 'pro_master' ? Crown : plan.id === 'pro' ? Zap : Users}
                  tone={plan.id === 'pro_master' ? 'accent' : plan.id === 'pro' ? 'success' : 'default'}
                />
              ))}
            </StatCardGrid>
          <div className="grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => (
              <PlanEditor
                key={plan.id}
                plan={plan}
                canEdit={isSuperAdmin}
                onSave={handlePlanSave}
                onChange={setPlans}
              />
            ))}
          </div>
          </div>
        ) : tab === 'plan_grants' ? (
          <AdminPlanIssuingPanel
            grants={planGrants}
            grantsTotal={planGrantsTotal}
            grantPage={grantPage}
            onGrantPageChange={setGrantPage}
            onRefresh={loadTab}
          />
        ) : tab === 'coupons' ? (
          <AdminCouponsPanel coupons={coupons} onRefresh={loadTab} />
        ) : tab === 'broadcasting' ? (
          <AdminBroadcastingPanel
            broadcasts={broadcasts}
            destinations={streamDestinations}
            destinationsTotal={streamDestinationsTotal}
            destinationPage={destinationPage}
            destinationSearch={destinationSearch}
            onDestinationPageChange={setDestinationPage}
            onDestinationSearchChange={(value) => { setDestinationSearch(value); setDestinationPage(0); }}
            onDestinationSearch={() => { void loadTab(); }}
            onRefresh={loadTab}
          />
        ) : tab === 'sessions' ? (
          <div className="space-y-6">
            <StatCardGrid>
              <StatCard label="Total sessions" value={sessionsTotal} icon={Radio} tone="accent" />
              <StatCard
                label="Active (page)"
                value={sessions.filter((s) => s.is_active).length}
                icon={Zap}
                tone="success"
              />
              <StatCard
                label="Paired devices"
                value={sessions.reduce((n, s) => n + s.device_count, 0)}
                icon={MonitorSmartphone}
                hint="On this page"
              />
              <StatCard
                label="Live inputs"
                value={sessions.reduce((n, s) => n + s.live_device_count, 0)}
                icon={Wifi}
                tone="warning"
                hint="On this page"
              />
            </StatCardGrid>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <AdminSection
              title="Mixer sessions"
              description={`${sessionsTotal} sessions`}
              actions={
                <label className="inline-flex items-center gap-2 text-xs text-mixer-muted">
                  <input
                    type="checkbox"
                    checked={activeSessionsOnly}
                    onChange={(e) => { setActiveSessionsOnly(e.target.checked); setSessionPage(0); }}
                  />
                  Active only
                </label>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] text-mixer-muted">
                      <th className="px-2 py-2">CODE</th>
                      <th className="px-2 py-2">OWNER</th>
                      <th className="px-2 py-2">PLAN</th>
                      <th className="px-2 py-2">DEVICES</th>
                      <th className="px-2 py-2">STATUS</th>
                      <th className="px-2 py-2">UPDATED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr
                        key={s.id}
                        className={cn('border-b border-white/5 cursor-pointer hover:bg-white/5', selectedSessionId === s.id && 'bg-white/5')}
                        onClick={() => setSelectedSessionId(s.id)}
                      >
                        <td className="px-2 py-3 font-mono font-bold">{s.access_code}</td>
                        <td className="px-2 py-3">
                          <p>{s.owner_name || '—'}</p>
                          <p className="text-[10px] text-mixer-muted">{s.owner_email}</p>
                        </td>
                        <td className="px-2 py-3">{s.plan_id} · {s.connection_mode}</td>
                        <td className="px-2 py-3">{s.live_device_count} live / {s.device_count}</td>
                        <td className="px-2 py-3">
                          <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold', s.is_active ? 'bg-mixer-green/20 text-mixer-green' : 'bg-white/10 text-mixer-muted')}>
                            {s.is_active ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-mixer-muted">
                          {s.updated_at ? new Date(s.updated_at).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <AdminPagination page={sessionPage} pageSize={PAGE_SIZE} total={sessionsTotal} onPageChange={setSessionPage} />
            </AdminSection>

            <AdminSection
              title="Session detail"
              actions={
                selectedSessionId && sessionDetail?.session && (
                  <button
                    type="button"
                    onClick={() => { void handleDeactivateSession(selectedSessionId); }}
                    className="rounded border border-mixer-red/30 px-2 py-1 text-[10px] font-bold text-mixer-red"
                  >
                    DEACTIVATE
                  </button>
                )
              }
            >
              {!sessionDetail?.session ? (
                <p className="text-sm text-mixer-muted">Select a session to view paired devices.</p>
              ) : (
                <div className="space-y-4 text-xs">
                  <StatCardGrid cols={2}>
                    <InsightCard
                      title="Paired devices"
                      value={sessionDetail.devices.length}
                      icon={MonitorSmartphone}
                    />
                    <InsightCard
                      title="Live now"
                      value={sessionDetail.devices.filter((d) => d.status === 'live').length}
                      icon={Wifi}
                      tone="success"
                    />
                  </StatCardGrid>
                  <div>
                    <p className="font-mono text-lg font-bold">{String((sessionDetail.session as Record<string, unknown>).access_code ?? '')}</p>
                    <p className="text-mixer-muted">
                      {String((sessionDetail.session as Record<string, unknown>).owner_email ?? '')} ·{' '}
                      {String((sessionDetail.session as Record<string, unknown>).owner_name ?? '')}
                    </p>
                    <p className="mt-1">
                      Plan: {String((sessionDetail.session as Record<string, unknown>).plan_id ?? '')} ·{' '}
                      {String((sessionDetail.session as Record<string, unknown>).connection_mode ?? '')}
                    </p>
                    <p>
                      Status: {(sessionDetail.session as Record<string, unknown>).is_active ? 'active' : 'inactive'}
                    </p>
                  </div>
                  <div>
                    <p className="mb-2 font-bold text-mixer-muted">PAIRED DEVICES ({sessionDetail.devices.length})</p>
                    {sessionDetail.devices.map((d) => (
                      <div key={d.id} className="mb-2 rounded border border-white/5 p-2">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">Slot {d.slot_number}: {d.label || d.device_id}</p>
                          <StatusBadge status={d.status} />
                        </div>
                        <p className="text-[10px] text-mixer-muted">
                          {d.device_type} · {d.platform} · {d.device_role}
                          {d.battery_level != null && ` · ${d.battery_level}%`}
                        </p>
                        {d.last_seen_at && (
                          <p className="text-[10px] text-mixer-muted">Last seen: {new Date(d.last_seen_at).toLocaleString()}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </AdminSection>
          </div>
          </div>
        ) : tab === 'devices' ? (
          <div className="space-y-6">
            <StatCardGrid>
              <StatCard label="All devices" value={devicesTotal} icon={MonitorSmartphone} tone="accent" />
              <StatCard label="Live" value={devices.filter((d) => d.status === 'live').length} icon={Wifi} tone="success" hint="This page" />
              <StatCard label="Offline" value={devices.filter((d) => d.status === 'offline').length} icon={Radio} hint="This page" />
              <StatCard label="Errors" value={devices.filter((d) => d.status === 'error').length} icon={AlertTriangle} tone="danger" hint="This page" />
            </StatCardGrid>
          <AdminSection title="Paired devices" description={`${devicesTotal} devices across all sessions`}>
            <div className="mb-4 flex flex-wrap gap-2">
              <input
                type="search"
                value={deviceSearch}
                onChange={(e) => { setDeviceSearch(e.target.value); setDevicePage(0); }}
                placeholder="Search label, device ID, owner…"
                className="flex-1 min-w-[200px] rounded border border-white/10 bg-black px-3 py-2 text-sm outline-none focus:border-mixer-red/40"
              />
              {['', 'live', 'paired', 'offline', 'error'].map((st) => (
                <button
                  key={st || 'all'}
                  type="button"
                  onClick={() => { setDeviceStatus(st); setDevicePage(0); }}
                  className={cn(
                    'rounded px-3 py-1 text-[10px] font-bold',
                    deviceStatus === st ? 'bg-mixer-red/20 text-mixer-red' : 'border border-white/10 text-mixer-muted',
                  )}
                >
                  {st || 'ALL'}
                </button>
              ))}
              <button type="button" onClick={() => { void loadTab(); }} className="rounded border border-white/10 px-3 text-xs font-bold">
                SEARCH
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] text-mixer-muted">
                    <th className="px-2 py-2">SLOT</th>
                    <th className="px-2 py-2">DEVICE</th>
                    <th className="px-2 py-2">SESSION</th>
                    <th className="px-2 py-2">OWNER</th>
                    <th className="px-2 py-2">STATUS</th>
                    <th className="px-2 py-2">LAST SEEN</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d) => (
                    <tr key={d.id} className="border-b border-white/5">
                      <td className="px-2 py-3">{d.slot_number}</td>
                      <td className="px-2 py-3">
                        <p className="font-medium">{d.label || d.device_id}</p>
                        <p className="text-[10px] text-mixer-muted">{d.device_type} · {d.platform}</p>
                      </td>
                      <td className="px-2 py-3 font-mono">{d.access_code}</td>
                      <td className="px-2 py-3">
                        <p>{d.owner_name || '—'}</p>
                        <p className="text-[10px] text-mixer-muted">{d.owner_email}</p>
                      </td>
                      <td className="px-2 py-3"><StatusBadge status={d.status} /></td>
                      <td className="px-2 py-3 text-mixer-muted">
                        {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <AdminPagination page={devicePage} pageSize={PAGE_SIZE} total={devicesTotal} onPageChange={setDevicePage} />
          </AdminSection>
          </div>
        ) : tab === 'recordings' ? (
          <div className="space-y-6">
            <StatCardGrid>
              <StatCard label="Total files" value={recordingsTotal} icon={Video} tone="accent" />
              <StatCard
                label="Page size"
                value={formatBytes(recordings.reduce((n, r) => n + r.size_bytes, 0))}
                icon={HardDrive}
                hint="Sum on this page"
              />
              <StatCard
                label="Unique users"
                value={new Set(recordings.map((r) => r.user_id)).size}
                icon={UserCheck}
                hint="This page"
              />
              <StatCard
                label="WebM files"
                value={recordings.filter((r) => r.mime_type.includes('webm')).length}
                icon={Cloud}
                hint="This page"
              />
            </StatCardGrid>
          <AdminSection title="Cloud recordings" description={`${recordingsTotal} files`}>
            <div className="mb-4 flex gap-2">
              <input
                type="search"
                value={recordingSearch}
                onChange={(e) => { setRecordingSearch(e.target.value); setRecordingPage(0); }}
                placeholder="Search file name, user email…"
                className="flex-1 rounded border border-white/10 bg-black px-3 py-2 text-sm outline-none focus:border-mixer-red/40"
              />
              <button type="button" onClick={() => { void loadTab(); }} className="rounded border border-white/10 px-3 text-xs font-bold">
                SEARCH
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] text-mixer-muted">
                    <th className="px-2 py-2">FILE</th>
                    <th className="px-2 py-2">USER</th>
                    <th className="px-2 py-2">SIZE</th>
                    <th className="px-2 py-2">CREATED</th>
                  </tr>
                </thead>
                <tbody>
                  {recordings.map((r) => (
                    <tr key={r.id} className="border-b border-white/5">
                      <td className="px-2 py-3">
                        <p className="font-medium">{r.file_name}</p>
                        <p className="text-[10px] text-mixer-muted">{r.mime_type}</p>
                      </td>
                      <td className="px-2 py-3">
                        <p>{r.user_name || '—'}</p>
                        <p className="text-[10px] text-mixer-muted">{r.user_email}</p>
                      </td>
                      <td className="px-2 py-3">{formatBytes(r.size_bytes)}</td>
                      <td className="px-2 py-3 text-mixer-muted">{new Date(r.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <AdminPagination page={recordingPage} pageSize={PAGE_SIZE} total={recordingsTotal} onPageChange={setRecordingPage} />
          </AdminSection>
          </div>
        ) : tab === 'activity' ? (
          <div className="space-y-6">
            <StatCardGrid>
              <StatCard label="Total events" value={activityTotal} icon={Activity} tone="accent" />
              <StatCard
                label="Unique actors"
                value={new Set(activityLogs.map((l) => l.actor_email ?? 'system')).size}
                icon={Users}
                hint="This page"
              />
              <StatCard
                label="Admin actions"
                value={activityLogs.filter((l) => l.action.startsWith('admin.')).length}
                icon={ShieldCheck}
                tone="warning"
                hint="This page"
              />
              <StatCard
                label="Plan changes"
                value={activityLogs.filter((l) => l.action.includes('plan')).length}
                icon={Gift}
                hint="This page"
              />
            </StatCardGrid>
          <AdminSection title={`Activity logs (${activityTotal})`}>
            <div className="mb-4 flex gap-2">
              <input
                type="search"
                value={activityAction}
                onChange={(e) => { setActivityAction(e.target.value); setActivityPage(0); }}
                placeholder="Filter by action…"
                className="flex-1 rounded border border-white/10 bg-black px-3 py-2 text-sm outline-none focus:border-mixer-red/40"
              />
              <button type="button" onClick={() => { void loadTab(); }} className="rounded border border-white/10 px-3 text-xs font-bold">
                FILTER
              </button>
            </div>
            <div className="space-y-2">
              {activityLogs.map((l) => (
                <div key={l.id} className="rounded border border-white/5 px-3 py-2 text-xs">
                  <p className="font-medium">{l.action}</p>
                  <p className="text-[10px] text-mixer-muted">
                    {l.actor_email ?? 'system'} · {l.resource_type ?? ''} {l.resource_id ?? ''}
                  </p>
                  <p className="text-[10px] text-mixer-muted">{new Date(l.created_at).toLocaleString()}</p>
                </div>
              ))}
              {activityLogs.length === 0 && <p className="text-sm text-mixer-muted">No logs yet.</p>}
            </div>
            <AdminPagination page={activityPage} pageSize={PAGE_SIZE} total={activityTotal} onPageChange={setActivityPage} />
          </AdminSection>
          </div>
        ) : tab === 'errors' ? (
          <div className="space-y-6">
            <StatCardGrid>
              <StatCard label="Total logged" value={errorTotal} icon={AlertTriangle} tone="accent" />
              <StatCard label="Fatal" value={errorLogs.filter((l) => l.severity === 'fatal').length} icon={AlertTriangle} tone="danger" hint="This page" />
              <StatCard label="Warnings" value={errorLogs.filter((l) => l.severity === 'warn').length} icon={AlertTriangle} tone="warning" hint="This page" />
              <StatCard label="Errors" value={errorLogs.filter((l) => l.severity === 'error').length} icon={AlertTriangle} hint="This page" />
            </StatCardGrid>
            <div className="flex flex-wrap items-center gap-2">
              {['', 'warn', 'error', 'fatal'].map((sev) => (
                <button
                  key={sev || 'all'}
                  type="button"
                  onClick={() => { setErrorSeverity(sev); setErrorPage(0); }}
                  className={cn(
                    'rounded px-3 py-1 text-[10px] font-bold',
                    errorSeverity === sev ? 'bg-mixer-red/20 text-mixer-red' : 'border border-white/10 text-mixer-muted',
                  )}
                >
                  {sev || 'ALL'}
                </button>
              ))}
              <button
                type="button"
                onClick={() => { void handleClearOldErrors(); }}
                className="ml-auto inline-flex items-center gap-1 rounded border border-white/10 px-3 py-1 text-[10px] font-bold text-mixer-muted hover:text-white"
              >
                <Trash2 className="h-3 w-3" />
                CLEAR 30D+
              </button>
            </div>
            <div className="space-y-2">
              {errorLogs.map((log) => (
                <details key={log.id} className="group rounded-lg border border-white/10 bg-[#0a0a0a] p-3 text-xs">
                  <summary className="cursor-pointer list-none">
                    <span className="mr-2"><SeverityBadge severity={log.severity} /></span>
                    <span className="font-medium">{log.message}</span>
                    <span className="ml-2 text-[10px] text-mixer-muted">{new Date(log.created_at).toLocaleString()}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); void handleDeleteError(log.id); }}
                      className="ml-2 inline-flex opacity-0 group-hover:opacity-100 text-mixer-red"
                      title="Delete"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </summary>
                  <div className="mt-2 space-y-1 text-[10px] text-mixer-muted">
                    <p>Source: {log.source} · User: {log.user_email ?? 'anonymous'}</p>
                    {log.stack && <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-black/50 p-2">{log.stack}</pre>}
                    {Object.keys(log.context).length > 0 && (
                      <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-black/50 p-2">{JSON.stringify(log.context, null, 2)}</pre>
                    )}
                  </div>
                </details>
              ))}
              {errorLogs.length === 0 && <p className="text-sm text-mixer-muted">No error logs match this filter.</p>}
              <p className="text-[10px] text-mixer-muted">{errorTotal} total errors logged</p>
            </div>
            <AdminPagination page={errorPage} pageSize={PAGE_SIZE} total={errorTotal} onPageChange={setErrorPage} />
          </div>
        ) : tab === 'admins' ? (
          <AdminManualAdminPanel admins={admins} onRefresh={loadTab} isSuperAdmin={isSuperAdmin} />
        ) : tab === 'system' && systemHealth ? (
          <div className="space-y-6">
            <StatCardGrid>
              <StatCard label="Admins" value={systemHealth.admin_count} icon={ShieldCheck} tone="danger" />
              <StatCard label="Stream destinations" value={systemHealth.stream_destinations} icon={Zap} hint={`${systemHealth.enabled_destinations} enabled`} />
              <StatCard label="Activity (7d)" value={systemHealth.activity_7d} icon={Activity} tone="success" />
              <StatCard
                label="Errors (7d)"
                value={systemHealth.errors_7d}
                icon={AlertTriangle}
                tone={systemHealth.errors_7d > 0 ? 'warning' : 'default'}
              />
            </StatCardGrid>
            <StatCardGrid cols={3}>
              <StatCard label="New users (7d)" value={systemHealth.new_users_7d} icon={Users} tone="accent" />
              <StatCard
                label="Emails queued"
                value={emailQueueTotal}
                icon={Megaphone}
                hint={`${emailQueue.filter((e) => e.status === 'pending').length} pending on page`}
              />
              {systemHealth.heartbeat && (
                <StatCard
                  label="Last heartbeat"
                  value={new Date(systemHealth.heartbeat.last_ping_at).toLocaleTimeString()}
                  icon={Cpu}
                  tone="success"
                  hint={`${systemHealth.heartbeat.ping_count} pings · ${systemHealth.heartbeat.last_source}`}
                />
              )}
            </StatCardGrid>

            <div className="grid gap-6 lg:grid-cols-2">
              <AdminSection title="Recent activity">
                <div className="space-y-2">
                  {systemHealth.recent_activity.map((a) => (
                    <div key={a.id} className="rounded border border-white/5 px-3 py-2 text-xs">
                      <p className="font-medium">{a.action}</p>
                      <p className="text-[10px] text-mixer-muted">{a.actor_email ?? 'system'} · {new Date(a.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                  {systemHealth.recent_activity.length === 0 && <p className="text-sm text-mixer-muted">No recent activity.</p>}
                </div>
              </AdminSection>

              <AdminSection title="Recent errors">
                <div className="space-y-2">
                  {systemHealth.recent_errors.map((e) => (
                    <div key={e.id} className="rounded border border-white/5 px-3 py-2 text-xs">
                      <p>
                        <SeverityBadge severity={e.severity} />
                        <span className="ml-2 font-medium">{e.message}</span>
                      </p>
                      <p className="text-[10px] text-mixer-muted">{e.source} · {new Date(e.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                  {systemHealth.recent_errors.length === 0 && <p className="text-sm text-mixer-muted">No recent errors.</p>}
                </div>
              </AdminSection>
            </div>

            <AdminEmailQueuePanel
              items={emailQueue}
              total={emailQueueTotal}
              page={emailQueuePage}
              pageSize={PAGE_SIZE}
              onPageChange={setEmailQueuePage}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}

function PlanEditor({
  plan,
  canEdit,
  onSave,
  onChange,
}: {
  plan: AdminPlanRow;
  canEdit: boolean;
  onSave: (plan: AdminPlanRow) => Promise<void>;
  onChange: Dispatch<SetStateAction<AdminPlanRow[]>>;
}) {
  const [saving, setSaving] = useState(false);

  const patch = (partial: Partial<AdminPlanRow>) => {
    onChange((prev) => prev.map((p) => (p.id === plan.id ? { ...p, ...partial } : p)));
  };

  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-4">
      <h3 className="text-lg font-bold">{plan.name}</h3>
      <p className="text-xs text-mixer-muted">{plan.id}</p>
      <div className="mt-4 space-y-3 text-xs">
        <label className="block">
          <span className="text-mixer-muted">Display name</span>
          <input disabled={!canEdit} value={plan.name} onChange={(e) => patch({ name: e.target.value })} className="mt-1 w-full rounded border border-white/10 bg-black px-2 py-1.5 disabled:opacity-60" />
        </label>
        <label className="block">
          <span className="text-mixer-muted">Price (cents/mo)</span>
          <input disabled={!canEdit} type="number" value={plan.price_monthly_cents} onChange={(e) => patch({ price_monthly_cents: Number(e.target.value) })} className="mt-1 w-full rounded border border-white/10 bg-black px-2 py-1.5 disabled:opacity-60" />
          <span className="text-[10px] text-mixer-muted">{formatPrice(plan.price_monthly_cents)}</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="text-mixer-muted">Mobile</span>
            <input disabled={!canEdit} type="number" value={plan.max_mobile_devices} onChange={(e) => patch({ max_mobile_devices: Number(e.target.value) })} className="mt-1 w-full rounded border border-white/10 bg-black px-2 py-1.5 disabled:opacity-60" />
          </label>
          <label className="block">
            <span className="text-mixer-muted">USB</span>
            <input disabled={!canEdit} type="number" value={plan.max_usb_devices} onChange={(e) => patch({ max_usb_devices: Number(e.target.value) })} className="mt-1 w-full rounded border border-white/10 bg-black px-2 py-1.5 disabled:opacity-60" />
          </label>
          <label className="block">
            <span className="text-mixer-muted">Total</span>
            <input disabled={!canEdit} type="number" value={plan.max_total_channels} onChange={(e) => patch({ max_total_channels: Number(e.target.value) })} className="mt-1 w-full rounded border border-white/10 bg-black px-2 py-1.5 disabled:opacity-60" />
          </label>
        </div>
        <label className="block">
          <span className="text-mixer-muted">Connection mode</span>
          <select disabled={!canEdit} value={plan.connection_mode} onChange={(e) => patch({ connection_mode: e.target.value })} className="mt-1 w-full rounded border border-white/10 bg-black px-2 py-1.5 disabled:opacity-60">
            <option value="mesh">mesh</option>
            <option value="regal">regal</option>
          </select>
        </label>
        <label className="block">
          <span className="text-mixer-muted">Features (one per line)</span>
          <textarea
            disabled={!canEdit}
            value={plan.features.join('\n')}
            onChange={(e) => patch({ features: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
            rows={5}
            className="mt-1 w-full rounded border border-white/10 bg-black px-2 py-1.5 disabled:opacity-60"
          />
        </label>
        {canEdit ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setSaving(true);
              void onSave(plan).finally(() => setSaving(false));
            }}
            className="w-full rounded bg-mixer-red py-2 text-[10px] font-bold tracking-wider text-white disabled:opacity-50"
          >
            {saving ? 'SAVING…' : 'SAVE PLAN'}
          </button>
        ) : (
          <p className="text-[10px] text-mixer-muted">Super admin required to edit plan tiers.</p>
        )}
      </div>
    </div>
  );
}
