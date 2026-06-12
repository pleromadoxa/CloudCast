import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

export function AdminNavLink({ className }: { className?: string }) {
  const { adminAccess } = useAuth();
  const { pathname } = useLocation();

  if (adminAccess?.is_admin !== true) return null;

  return (
    <Link
      to="/admin"
      className={cn(
        'text-xs font-medium tracking-wide transition-colors',
        pathname === '/admin' ? 'text-white' : 'text-mixer-muted hover:text-white',
        className,
      )}
    >
      Admin
    </Link>
  );
}
