import { useState } from 'react';
import { Headphones, Loader2, Shield, ShieldCheck, UserCog } from 'lucide-react';
import { AdminSection, StatCard, StatCardGrid } from './AdminShared';
import { adminGrantRoleByEmail, adminRevokeRole } from '../../lib/adminService';
import type { AdminMemberRow, AdminRole } from '../../types/admin';
export function AdminManualAdminPanel({
  admins,
  onRefresh,
  isSuperAdmin,
}: {
  admins: AdminMemberRow[];
  onRefresh: () => Promise<void>;
  isSuperAdmin: boolean;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('admin');
  const [granting, setGranting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleGrant = async () => {
    if (!email.trim()) return;
    setGranting(true);
    setError(null);
    setSuccess(null);
    try {
      await adminGrantRoleByEmail(email.trim(), role);
      setSuccess(`Granted ${role} to ${email.trim()}`);
      setEmail('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to grant admin.');
    } finally {
      setGranting(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <AdminSection title="Manual admin access">
        <p className="text-sm text-mixer-muted">Super admin required to grant or revoke admin roles by email.</p>
      </AdminSection>
    );
  }

  const superAdmins = admins.filter((a) => a.role === 'super_admin').length;
  const supportAdmins = admins.filter((a) => a.role === 'support').length;
  const standardAdmins = admins.filter((a) => a.role === 'admin').length;

  return (
    <div className="space-y-6">
      <StatCardGrid>
        <StatCard label="Total admins" value={admins.length} icon={ShieldCheck} tone="accent" />
        <StatCard label="Super admins" value={superAdmins} icon={Shield} tone="danger" />
        <StatCard label="Admins" value={standardAdmins} icon={UserCog} />
        <StatCard label="Support" value={supportAdmins} icon={Headphones} tone="success" />
      </StatCardGrid>

    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <AdminSection title="Grant admin by email" description="User must already have a CloudCast account.">
        <div className="space-y-3 text-xs">
          <label className="block">
            <span className="text-mixer-muted">User email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm outline-none focus:border-mixer-red/40"
            />
          </label>
          <label className="block">
            <span className="text-mixer-muted">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AdminRole)}
              className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm"
            >
              <option value="admin">Admin</option>
              <option value="support">Support</option>
              <option value="super_admin">Super admin</option>
            </select>
          </label>
          {error && <p className="text-mixer-red">{error}</p>}
          {success && <p className="text-mixer-green">{success}</p>}
          <button
            type="button"
            disabled={granting || !email.trim()}
            onClick={() => { void handleGrant(); }}
            className="w-full rounded bg-mixer-red py-2.5 text-[10px] font-bold tracking-wider text-white disabled:opacity-50"
          >
            {granting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'GRANT ADMIN ACCESS'}
          </button>
        </div>
      </AdminSection>

      <AdminSection title="Current admins" description={`${admins.length} active`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[10px] text-mixer-muted">
                <th className="px-2 py-2">USER</th>
                <th className="px-2 py-2">ROLE</th>
                <th className="px-2 py-2">GRANTED</th>
                <th className="px-2 py-2">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.user_id} className="border-b border-white/5">
                  <td className="px-2 py-3">
                    <p className="font-medium">{a.full_name || '—'}</p>
                    <p className="text-[10px] text-mixer-muted">{a.email}</p>
                  </td>
                  <td className="px-2 py-3">
                    <span className="rounded bg-mixer-red/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-mixer-red">
                      {a.role}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-mixer-muted">{new Date(a.granted_at).toLocaleString()}</td>
                  <td className="px-2 py-3">
                    {a.role !== 'super_admin' && (
                      <button
                        type="button"
                        onClick={() => { void adminRevokeRole(a.user_id).then(onRefresh); }}
                        className="text-[10px] text-mixer-red underline"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {admins.length === 0 && <p className="mt-4 text-sm text-mixer-muted">No admins yet.</p>}
      </AdminSection>
    </div>
    </div>
  );
}
