import { Link, Outlet, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { authReturnLabel, authReturnPath, readAuthReturnState } from '../../lib/authReturn';
import { AdminNavLink } from '../admin/AdminNavLink';
import { PlatformBroadcastBanner } from '../admin/PlatformBroadcastBanner';
import { CloudCastLogo } from '../brand/CloudCastLogo';
import { CLOUDCAST_NAV_LOGO } from '../../lib/branding';
import { cn } from '../../lib/utils';
import { CLOUDCAST_PRODUCTS } from '../../config/products';
import { productLandingPath } from '../../config/productLanding';
import { SOLUTION_PAGES, solutionPath } from '../../config/solutions';
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

      <footer className="border-t border-white/5 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <p className="text-xs font-bold tracking-wider text-white">Products</p>
              <div className="mt-3 flex flex-col gap-2">
                {CLOUDCAST_PRODUCTS.map((p) => (
                  <Link key={p.id} to={productLandingPath(p.id)} className="text-xs text-mixer-muted hover:text-white">
                    {p.name}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold tracking-wider text-white">Solutions</p>
              <div className="mt-3 flex flex-col gap-2">
                {SOLUTION_PAGES.map((s) => (
                  <Link key={s.slug} to={solutionPath(s.slug)} className="text-xs capitalize text-mixer-muted hover:text-white">
                    {s.slug.replace('-', ' ')}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold tracking-wider text-white">Company</p>
              <div className="mt-3 flex flex-col gap-2">
                <Link to="/pricing" className="text-xs text-mixer-muted hover:text-white">Pricing</Link>
                <Link to="/products/guide" className="text-xs text-mixer-muted hover:text-white">Product guide</Link>
                {user ? (
                  <Link to="/profile" className="text-xs text-mixer-muted hover:text-white">Profile</Link>
                ) : (
                  <Link to="/login" className="text-xs text-mixer-muted hover:text-white">Sign in</Link>
                )}
                {LEGAL_NAV.slice(0, 3).map(({ to, label }) => (
                  <Link key={to} to={to} className="text-xs text-mixer-muted hover:text-white">{label}</Link>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-10 text-center text-xs text-mixer-muted">
            © {new Date().getFullYear()} {SITE_LEGAL.brandLine}. {SITE_LEGAL.tagline}.
          </p>
        </div>
      </footer>
    </div>
  );
}
