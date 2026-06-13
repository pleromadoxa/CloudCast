import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { clearStoredSession } from '../lib/sessionStorage';
import { normalizeConnectionMode } from '../lib/branding';
import { fetchAdminAccess } from '../lib/adminService';
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [adminAccess, setAdminAccess] = useState<AdminAccess | null>(null);
  const [loading, setLoading] = useState(true);

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
      const p = data as Record<string, unknown>;
      setProfile({
        id: String(p.id),
        email: p.email ? String(p.email) : null,
        full_name: p.full_name ? String(p.full_name) : null,
        plan_id: p.plan_id as PlanTier,
        plan: mapPlan(p.plan as Record<string, unknown>),
        entitlements: buildEntitlementsFromProfile(p),
      });
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    const supabase = getSupabase();

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      void refreshProfile();
      void refreshAdminAccess();
    } else {
      setProfile(null);
      setAdminAccess(null);
    }
  }, [user, refreshProfile, refreshAdminAccess]);

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
