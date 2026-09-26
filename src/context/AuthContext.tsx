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
import { withTimeout } from '../lib/asyncTimeout';
import { buildBootstrapFallbackProfile } from '../lib/bootstrapProfile';
import { clearCachedProfile, readCachedProfile, writeCachedProfile } from '../lib/profileCache';
import { clearRegalCloudBootSession } from '../lib/regalCloudBoot';
import type { AdminAccess } from '../types/admin';
import type { DashboardPreferences, PlanTier, SubscriptionPlan, UserProfile } from '../types/plans';
import type { CloudCastProductId } from '../types/products';
import { normalizeDashboardPreferences } from '../lib/dashboardPreferences';
import { buildEntitlementsFromProfile, isUniversalPlan } from '../lib/productEntitlements';
import {
  defaultPlatformProductServiceMap,
  fetchPlatformProductServices,
  type PlatformProductServiceMap,
} from '../lib/platformProductServices';
import { updateUserDashboardPreferences } from '../lib/profileService';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  adminAccess: AdminAccess | null;
  /** Platform-wide product enable flags (admin Services tab). */
  platformServices: PlatformProductServiceMap;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  updatePlan: (planId: PlanTier) => Promise<void>;
  updateProductPlan: (product: CloudCastProductId | 'universal', planId: PlanTier) => Promise<void>;
  updateDashboardPreferences: (prefs: Partial<DashboardPreferences>) => Promise<void>;
  refreshProfile: () => Promise<boolean>;
  refreshAdminAccess: () => Promise<void>;
  refreshPlatformServices: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_SESSION_TIMEOUT_MS = 8_000;
const PROFILE_BOOTSTRAP_TIMEOUT_MS = 10_000;

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
    dashboard_preferences: normalizeDashboardPreferences({
      audio_dashboard_enabled:
        typeof p.audio_dashboard_enabled === 'boolean' ? p.audio_dashboard_enabled : undefined,
      prism_dashboard_enabled:
        typeof p.prism_dashboard_enabled === 'boolean' ? p.prism_dashboard_enabled : undefined,
      replay_dashboard_enabled:
        typeof p.replay_dashboard_enabled === 'boolean' ? p.replay_dashboard_enabled : undefined,
    }),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [adminAccess, setAdminAccess] = useState<AdminAccess | null>(null);
  const [platformServices, setPlatformServices] = useState<PlatformProductServiceMap>(
    () => defaultPlatformProductServiceMap(),
  );
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

  const refreshPlatformServices = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setPlatformServices(defaultPlatformProductServiceMap());
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    try {
      setPlatformServices(await fetchPlatformProductServices());
    } catch {
      // Keep last known / defaults — fail open for availability.
    }
  }, []);

  // Keep the platform service flags live so admin toggles take effect in open
  // sessions — service off = off, service on = resumes — without a reload.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const refresh = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      void refreshPlatformServices();
    };
    const onVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [refreshPlatformServices]);

  const refreshProfile = useCallback(async (): Promise<boolean> => {
    if (!isSupabaseConfigured()) return false;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
    try {
      const { data, error } = await getSupabase().rpc('get_user_profile');
      if (error) throw error;
      const next = mapProfileRow(data as Record<string, unknown>);
      setProfile(next);
      writeCachedProfile(next.id, next);
      return true;
    } catch {
      return false;
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
          void refreshPlatformServices();
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
          void refreshPlatformServices();
          return;
        }

        setLoading(true);
        try {
          void pingSupabase('auth-bootstrap');
          const profileOk = await withTimeout(refreshProfile(), PROFILE_BOOTSTRAP_TIMEOUT_MS, false);
          if (!profileOk) {
            setProfile(buildBootstrapFallbackProfile(nextSession.user));
            void refreshProfile();
          }
          hydratedUserIdRef.current = userId;
        } finally {
          setLoading(false);
          void refreshAdminAccess();
          void refreshPlatformServices();
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

    void withTimeout(
      supabase.auth.getSession(),
      AUTH_SESSION_TIMEOUT_MS,
      { data: { session: null }, error: null },
    )
      .then(({ data }) => hydrateSession(data.session))
      .catch(() => {
        setLoading(false);
      });

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
  }, [refreshProfile, refreshAdminAccess, refreshPlatformServices]);

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

  const updateDashboardPreferences = useCallback(
    async (prefs: Partial<DashboardPreferences>) => {
      const next = await updateUserDashboardPreferences(prefs);
      setProfile((prev) => {
        if (!prev) return prev;
        const merged: UserProfile = {
          ...prev,
          dashboard_preferences: normalizeDashboardPreferences({
            ...prev.dashboard_preferences,
            ...next,
          }),
        };
        writeCachedProfile(merged.id, merged);
        return merged;
      });
      await refreshProfile();
    },
    [refreshProfile],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        adminAccess,
        platformServices,
        loading,
        signIn,
        signUp,
        signOut,
        updatePlan,
        updateProductPlan,
        updateDashboardPreferences,
        refreshProfile,
        refreshAdminAccess,
        refreshPlatformServices,
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
