import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNetworkOptional } from '../../context/NetworkContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isOnline } = useNetworkOptional();
  const location = useLocation();

  if (loading && isOnline) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-mixer-bg">
        <Loader2 className="h-8 w-8 animate-spin text-mixer-red" />
      </div>
    );
  }

  if (!user) {
    if (!isOnline && location.pathname === '/dashboard') {
      return <>{children}</>;
    }
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return children;
}
