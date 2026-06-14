import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNetworkOptional } from '../../context/NetworkContext';
import { RegalCloudBootScreen } from '../system/RegalCloudBootScreen';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const { isOnline } = useNetworkOptional();
  const location = useLocation();

  const waitingForAuth = Boolean((loading || (user && !profile && isOnline)) && isOnline);

  if (waitingForAuth) {
    return <RegalCloudBootScreen />;
  }

  if (!user) {
    if (!isOnline && location.pathname === '/dashboard') {
      return <>{children}</>;
    }
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return children;
}
