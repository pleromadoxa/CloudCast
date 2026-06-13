/** Stripe price lookup — keys match tools/setup-stripe.mjs catalog */

export type StripeBillableProduct =
  | "video_mixer"
  | "audio_mixer"
  | "symphony_studio"
  | "regal_prism"
  | "universal";

export type StripeBillablePlan =
  | "pro"
  | "pro_master"
  | "universal"
  | "universal_essential"
  | "universal_studio";

const UNIVERSAL_PLANS = new Set(["universal", "universal_essential", "universal_studio"]);

export function stripePriceEnvKey(product: string, planId: string): string {
  return `STRIPE_PRICE_${product}_${planId}`.toUpperCase();
}

export function resolveStripePriceId(product: string, planId: string): string | null {
  const key = stripePriceEnvKey(product, planId);
  const id = Deno.env.get(key)?.trim();
  return id || null;
}

export function isStripeConfigured(): boolean {
  if (!Deno.env.get("STRIPE_SECRET_KEY")?.trim()) return false;
  return Boolean(resolveStripePriceId("video_mixer", "pro"));
}

export function planFromPriceMetadata(product: string, planId: string): StripeBillablePlan | null {
  if (product === "universal" && UNIVERSAL_PLANS.has(planId)) {
    return planId as StripeBillablePlan;
  }
  if (UNIVERSAL_PLANS.has(planId)) return planId as StripeBillablePlan;
  if (planId === "pro" || planId === "pro_master") return planId;
  return null;
}

export function appPublicUrl(): string {
  return (Deno.env.get("APP_PUBLIC_URL") ?? "https://cloudcast.pleromadoxa.workers.dev").replace(/\/$/, "");
}

export const STRIPE_PRODUCT_LABELS: Record<string, string> = {
  video_mixer: "CloudCast Video Mixer",
  audio_mixer: "CloudCast Audio Mixer",
  symphony_studio: "CloudCast Symphony",
  regal_prism: "Regal Prism",
  universal: "CloudCast Universal",
};

export const STRIPE_UNIVERSAL_PLAN_LABELS: Record<string, string> = {
  universal_essential: "CloudCast Universal Essential",
  universal_studio: "CloudCast Universal Studio",
  universal: "CloudCast Universal Master",
};
