import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthStreamingBackground } from '../components/auth/AuthStreamingBackground';
import { CloudCastLogo } from '../components/brand/CloudCastLogo';
import { PasswordInput } from '../components/ui/PasswordInput';
import { CLOUDCAST_NAV_LOGO } from '../lib/branding';
import { useAuth } from '../context/AuthContext';
import { authReturnState, readAuthReturnState } from '../lib/authReturn';
import { cn } from '../lib/utils';

export function AuthPage() {
  const location = useLocation();
  const initialAuthMode = readAuthReturnState(location.state)?.authMode;
  const [mode, setMode] = useState<'login' | 'signup'>(() =>
    initialAuthMode === 'signup' ? 'signup' : 'login',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const from = (location.state as { from?: string })?.from ?? '/dashboard';
  const legalReturnState = authReturnState(mode);

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
        navigate(from, { replace: true });
      } else if (!acceptedTerms) {
        setError('Please accept the Terms of Service and Privacy Policy.');
        setSubmitting(false);
        return;
      } else {
        await signUp(email, password, fullName);
        setConfirmEmail(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <AuthStreamingBackground />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center justify-center">
            <CloudCastLogo
              variant={CLOUDCAST_NAV_LOGO.variant}
              className="h-[2.6rem] w-auto sm:h-[2.95rem]"
            />
          </Link>
          <p className="mt-2 text-xs text-mixer-muted">Sign in to your production dashboard</p>
        </div>

        <div className="rounded-lg border border-white/10 bg-mixer-panel/90 p-8 shadow-2xl shadow-black/50 backdrop-blur-md">
          <div className="mb-6 flex rounded border border-white/10 p-1">
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null); setConfirmEmail(false); }}
                className={cn(
                  'flex-1 rounded py-2 text-xs font-bold tracking-wider transition-colors',
                  mode === m ? 'bg-mixer-red text-white' : 'text-mixer-muted hover:text-white',
                )}
              >
                {m === 'login' ? 'SIGN IN' : 'SIGN UP'}
              </button>
            ))}
          </div>

          {confirmEmail ? (
            <div className="text-center">
              <p className="text-sm text-mixer-text">Check your email to confirm your account.</p>
              <button type="button" onClick={() => setMode('login')} className="mt-4 text-xs text-mixer-red underline">
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="mb-1 block text-[10px] font-bold tracking-wider text-mixer-muted">FULL NAME</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded border border-white/10 bg-black px-3 py-2.5 text-sm outline-none focus:border-mixer-red"
                    placeholder="Your name"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-[10px] font-bold tracking-wider text-mixer-muted">EMAIL</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded border border-white/10 bg-black px-3 py-2.5 text-sm outline-none focus:border-mixer-red"
                  placeholder="you@studio.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold tracking-wider text-mixer-muted">PASSWORD</label>
                <PasswordInput
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  inputClassName="rounded border border-white/10 bg-black px-3 py-2.5 text-sm outline-none focus:border-mixer-red"
                />
              </div>

              {mode === 'signup' && (
                <label className="flex items-start gap-2 text-[10px] leading-relaxed text-mixer-muted">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    I agree to the{' '}
                    <Link to="/legal/terms" state={legalReturnState} className="text-mixer-red hover:underline">Terms of Service</Link>
                    ,{' '}
                    <Link to="/legal/privacy" state={legalReturnState} className="text-mixer-red hover:underline">Privacy Policy</Link>
                    , and{' '}
                    <Link to="/legal/acceptable-use" state={legalReturnState} className="text-mixer-red hover:underline">Acceptable Use Policy</Link>.
                  </span>
                </label>
              )}

              {error && <p className="text-xs text-mixer-red">{error}</p>}

              <button
                type="submit"
                disabled={submitting || (mode === 'signup' && !acceptedTerms)}
                className="flex w-full items-center justify-center gap-2 rounded bg-mixer-red py-3 text-sm font-bold tracking-wider text-white hover:bg-mixer-red-dim disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === 'login' ? 'SIGN IN TO DASHBOARD' : 'CREATE ACCOUNT'}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-[10px] text-mixer-muted">
            Mobile cameras pair with an access code — no account needed on device.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-mixer-muted">
          <Link to="/" className="hover:text-white">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
