import { getSupabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export type StripeCheckoutProduct = 'video_mixer' | 'audio_mixer' | 'symphony_studio' | 'regal_prism' | 'universal';
export type StripeCheckoutPlan = 'pro' | 'pro_master' | 'universal' | 'universal_essential' | 'universal_studio';

export interface StripeBillingSummary {
  stripe_customer_id: string | null;
  subscriptions: Array<{
    product: string;
    plan_id: string;
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  }>;
}

async function invokeStripeCheckout(body: Record<string, unknown>): Promise<{ url?: string; enabled?: boolean; error?: string }> {
  const { data, error } = await getSupabase().functions.invoke('stripe-checkout', { body });
  if (error) {
    throw new Error(error.message || 'Stripe checkout failed');
  }
  return (data ?? {}) as { url?: string; enabled?: boolean; error?: string };
}

/** Public status check — works without login (edge function allows anonymous GET). */
async function fetchStripeStatusPublic(): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-checkout`, {
      headers: { apikey: SUPABASE_ANON_KEY },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { enabled?: boolean };
    return Boolean(data.enabled);
  } catch {
    return false;
  }
}

export async function fetchStripeBillingEnabled(): Promise<boolean> {
  if (import.meta.env.VITE_STRIPE_ENABLED === 'true') return true;
  return fetchStripeStatusPublic();
}

export async function startStripeCheckout(product: StripeCheckoutProduct, planId: StripeCheckoutPlan): Promise<void> {
  const result = await invokeStripeCheckout({ action: 'checkout', product, plan_id: planId });
  if (result.error) throw new Error(result.error);
  if (!result.url) throw new Error('No checkout URL returned');
  window.location.href = result.url;
}

export async function openStripeBillingPortal(): Promise<void> {
  const result = await invokeStripeCheckout({ action: 'portal' });
  if (result.error) throw new Error(result.error);
  if (!result.url) throw new Error('No billing portal URL returned');
  window.location.href = result.url;
}

export async function fetchStripeBillingSummary(): Promise<StripeBillingSummary | null> {
  const { data, error } = await getSupabase().rpc('get_stripe_billing_summary');
  if (error) return null;
  return data as StripeBillingSummary;
}
