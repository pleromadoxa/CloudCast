import { Link, Outlet, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { authReturnLabel, authReturnPath, readAuthReturnState } from '../../lib/authReturn';
import { AdminNavLink } from '../admin/AdminNavLink';
import { PlatformBroadcastBanner } from '../admin/PlatformBroadcastBanner';
import { CloudCastLogo } from '../brand/CloudCastLogo';
import { CLOUDCAST_NAV_LOGO } from '../../lib/branding';
import { cn } from '../../lib/utils';
import { LEGAL_NAV, SITE_LEGAL } from '../../config/siteLegal';
import { useAuth } from '../../context/AuthContext';

const nav = [
  { to: '/', label: 'Home' },
  { to: '/products', label: 'Products' },
  { to: '/products/guide', label: 'Guide' },
  { to: '/pricing', label: 'Pricing' },
];

export function MarketingLayout() {
  const location = useLocation();
  const { pathname } = location;
  const { user } = useAuth();
  const authReturn = readAuthReturnState(location.state);
  const backToAuth = authReturn ? authReturnPath(authReturn) : null;

  return (
    <div className="min-h-screen bg-[#060606] text-mixer-text">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#060606]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3 sm:py-4">
          <Link to="/" className="flex items-center">
            <CloudCastLogo variant={CLOUDCAST_NAV_LOGO.variant} className={CLOUDCAST_NAV_LOGO.className} />
          </Link>

          <nav className="flex items-center gap-6">
            {nav.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  'text-xs font-medium tracking-wide transition-colors',
                  pathname === to ? 'text-white' : 'text-mixer-muted hover:text-white',
                )}
              >
                {label}
              </Link>
            ))}
            {user ? (
              <>
                <AdminNavLink />
                <Link
                  to="/profile"
                  className={cn(
                    'text-xs font-medium tracking-wide transition-colors',
                    pathname === '/profile' ? 'text-white' : 'text-mixer-muted hover:text-white',
                  )}
                >
                  Profile
                </Link>
                <Link to="/hub" className="rounded bg-mixer-red px-4 py-2 text-xs font-bold tracking-wider text-white hover:bg-mixer-red-dim">
                  DASHBOARD
                </Link>
              </>
            ) : backToAuth ? (
              <Link
                to={backToAuth.pathname}
                state={backToAuth.state}
                className="inline-flex items-center gap-1.5 rounded bg-mixer-red px-4 py-2 text-xs font-bold tracking-wider text-white hover:bg-mixer-red-dim"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {authReturnLabel(authReturn).toUpperCase()}
              </Link>
            ) : (
              <Link to="/login" className="rounded border border-white/20 px-4 py-2 text-xs font-bold tracking-wider hover:border-white/40">
                SIGN IN
              </Link>
            )}
          </nav>
        </div>
      </header>

      <PlatformBroadcastBanner />

      <Outlet />

      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <p className="text-xs text-mixer-muted">
            © {new Date().getFullYear()} {SITE_LEGAL.brandLine}. {SITE_LEGAL.tagline}.
          </p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-mixer-muted sm:justify-end">
            <Link to="/pricing" className="hover:text-white">Pricing</Link>
            {user ? (
              <Link to="/profile" className="hover:text-white">Profile</Link>
            ) : (
              <Link to="/login" className="hover:text-white">Sign in</Link>
            )}
            {LEGAL_NAV.slice(0, 4).map(({ to, label }) => (
              <Link key={to} to={to} className="hover:text-white">{label}</Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
