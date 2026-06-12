import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { bootstrapSuperAdmin } from '../../lib/adminService';

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, adminAccess, refreshAdminAccess } = useAuth();
  const location = useLocation();
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    if (user && !loading) {
      void refreshAdminAccess();
    }
  }, [user, loading, refreshAdminAccess]);

  if (loading || (user && adminAccess === null)) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-mixer-bg">
        <Loader2 className="h-8 w-8 animate-spin text-mixer-red" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!adminAccess?.is_admin) {
    const handleBootstrap = async () => {
      setBootstrapping(true);
      setBootstrapError(null);
      try {
        const created = await bootstrapSuperAdmin();
        if (created) {
          await refreshAdminAccess();
        } else {
          setBootstrapError('An admin account already exists. Contact your super admin for access.');
        }
      } catch (err) {
        setBootstrapError(err instanceof Error ? err.message : 'Bootstrap failed.');
      } finally {
        setBootstrapping(false);
      }
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#060606] px-6">
        <div className="max-w-md rounded-xl border border-white/10 bg-[#0a0a0a] p-8 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-mixer-yellow" />
          <h1 className="mt-4 text-lg font-bold">Admin access required</h1>
          <p className="mt-2 text-sm text-mixer-muted">
            This area is restricted to CloudCast administrators.
          </p>
          {bootstrapError && (
            <p className="mt-3 text-xs text-mixer-red">{bootstrapError}</p>
          )}
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              disabled={bootstrapping}
              onClick={() => { void handleBootstrap(); }}
              className="rounded bg-mixer-red px-4 py-2 text-xs font-bold tracking-wider text-white hover:bg-mixer-red-dim disabled:opacity-50"
            >
              {bootstrapping ? 'CHECKING…' : 'INITIALIZE FIRST SUPER ADMIN'}
            </button>
            <Link to="/dashboard" className="text-xs text-mixer-muted underline hover:text-white">
              Back to mixer
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
