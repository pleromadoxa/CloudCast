import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { clearStoredSession } from '../lib/sessionStorage';
import { normalizeConnectionMode } from '../lib/branding';
import { fetchAdminAccess } from '../lib/adminService';
import { pingSupabase } from '../lib/supabaseHeartbeat';
import { clearCachedProfile, readCachedProfile, writeCachedProfile } from '../lib/profileCache';
import { clearRegalCloudBootSession } from '../lib/regalCloudBoot';
import type { AdminAccess } from '../types/admin';
import type { PlanTier, SubscriptionPlan, UserProfile } from '../types/plans';
import type { CloudCastProductId } from '../types/products';
import { buildEntitlementsFromProfile, isUniversalPlan } from '../lib/productEntitlements';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  adminAccess: AdminAccess | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  updatePlan: (planId: PlanTier) => Promise<void>;
  updateProductPlan: (product: CloudCastProductId | 'universal', planId: PlanTier) => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshAdminAccess: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapPlan(row: Record<string, unknown>): SubscriptionPlan {
  return {
    id: row.id as PlanTier,
    name: String(row.name),
    max_mobile_devices: Number(row.max_mobile_devices),
    max_usb_devices: Number(row.max_usb_devices),
    max_total_channels: Number(row.max_total_channels),
    connection_mode: normalizeConnectionMode(row.connection_mode as string),
    price_monthly_cents: Number(row.price_monthly_cents),
    features: Array.isArray(row.features) ? (row.features as string[]) : [],
  };
}

function mapProfileRow(p: Record<string, unknown>): UserProfile {
  return {
    id: String(p.id),
    email: p.email ? String(p.email) : null,
    full_name: p.full_name ? String(p.full_name) : null,
    plan_id: p.plan_id as PlanTier,
    plan: mapPlan(p.plan as Record<string, unknown>),
    entitlements: buildEntitlementsFromProfile(p),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [adminAccess, setAdminAccess] = useState<AdminAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const hydrateInflightRef = useRef<Promise<void> | null>(null);
  const hydratedUserIdRef = useRef<string | null>(null);

  const refreshAdminAccess = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setAdminAccess({ is_admin: false, role: null });
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    try {
      setAdminAccess(await fetchAdminAccess());
    } catch {
      setAdminAccess({ is_admin: false, role: null });
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    try {
      const { data, error } = await getSupabase().rpc('get_user_profile');
      if (error) throw error;
      const next = mapProfileRow(data as Record<string, unknown>);
      setProfile(next);
      writeCachedProfile(next.id, next);
    } catch {
      /* keep cached profile when refresh fails */
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    const supabase = getSupabase();

    const hydrateSession = async (nextSession: Session | null) => {
      if (hydrateInflightRef.current) {
        await hydrateInflightRef.current;
        return;
      }

      const run = (async () => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        if (!nextSession?.user) {
          hydratedUserIdRef.current = null;
          setProfile(null);
          setAdminAccess(null);
          clearCachedProfile();
          setLoading(false);
          return;
        }

        const userId = nextSession.user.id;
        const cached = readCachedProfile(userId);
        if (cached) {
          setProfile(cached);
          hydratedUserIdRef.current = userId;
          setLoading(false);
          void pingSupabase('auth-bootstrap');
          void refreshProfile();
          void refreshAdminAccess();
          return;
        }

        setLoading(true);
        try {
          void pingSupabase('auth-bootstrap');
          await refreshProfile();
          hydratedUserIdRef.current = userId;
        } finally {
          setLoading(false);
          void refreshAdminAccess();
        }
      })();

      hydrateInflightRef.current = run;
      try {
        await run;
      } finally {
        if (hydrateInflightRef.current === run) {
          hydrateInflightRef.current = null;
        }
      }
    };

    void supabase.auth.getSession().then(({ data }) => hydrateSession(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, nextSession) => {
      if (event === 'TOKEN_REFRESHED') {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        return;
      }
      if (event === 'INITIAL_SESSION' && hydratedUserIdRef.current === nextSession?.user?.id) {
        return;
      }
      void hydrateSession(nextSession);
    });

    return () => sub.subscription.unsubscribe();
  }, [refreshProfile, refreshAdminAccess]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { error } = await getSupabase().auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    clearStoredSession();
    clearCachedProfile();
    clearRegalCloudBootSession();
    hydratedUserIdRef.current = null;
    await getSupabase().auth.signOut();
    setProfile(null);
    setAdminAccess(null);
  }, []);

  const updateProductPlan = useCallback(
    async (product: CloudCastProductId | 'universal', planId: PlanTier) => {
      const effectiveProduct =
        product === 'instant_replay' || product === 'regal_display' ? 'video_mixer' : product;
      const { error } = await getSupabase().rpc('update_user_product_plan', {
        p_product: effectiveProduct,
        p_plan_id: planId,
      });
      if (error) {
        if (effectiveProduct === 'video_mixer' || product === 'universal' || isUniversalPlan(planId)) {
          const { error: legacyError } = await getSupabase().rpc('update_user_plan', {
            p_plan_id: isUniversalPlan(planId) ? 'pro_master' : planId,
          });
          if (legacyError) throw legacyError;
        } else {
          throw error;
        }
      }
      await refreshProfile();
    },
    [refreshProfile],
  );

  const updatePlan = useCallback(
    async (planId: PlanTier) => {
      await updateProductPlan('video_mixer', planId);
    },
    [updateProductPlan],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        adminAccess,
        loading,
        signIn,
        signUp,
        signOut,
        updatePlan,
        updateProductPlan,
        refreshProfile,
        refreshAdminAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
