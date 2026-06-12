/** Router state when opening legal pages from sign-in / sign-up. */
export type AuthReturnState = {
  returnTo?: string;
  authMode?: 'login' | 'signup';
};

export function authReturnState(authMode: 'login' | 'signup'): AuthReturnState {
  return { returnTo: '/login', authMode };
}

export function readAuthReturnState(state: unknown): AuthReturnState | null {
  if (!state || typeof state !== 'object') return null;
  const s = state as AuthReturnState;
  if (s.authMode !== 'login' && s.authMode !== 'signup') return null;
  return { returnTo: s.returnTo ?? '/login', authMode: s.authMode };
}

export function authReturnPath(state: AuthReturnState | null): {
  pathname: string;
  state?: AuthReturnState;
} {
  if (!state?.authMode) return { pathname: '/login' };
  return {
    pathname: state.returnTo ?? '/login',
    state: { authMode: state.authMode },
  };
}

export function authReturnLabel(state: AuthReturnState | null): string {
  if (state?.authMode === 'signup') return 'Back to sign up';
  if (state?.authMode === 'login') return 'Back to sign in';
  return 'Back to sign in';
}
