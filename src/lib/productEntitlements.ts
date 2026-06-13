import type { CloudCastProductId, ProductEntitlements, ProductSubscriptionSummary } from '../types/products';
import { CLOUDCAST_PRODUCTS, UNIVERSAL_TIER_BY_ID } from '../config/products';
import type { PlanTier, ProductPlanTier, UniversalPlanTier, UserProfile } from '../types/plans';
import { isUniversalPlanTier, PLAN_LABELS } from '../types/plans';

export function isUniversalPlan(planId: PlanTier | null | undefined): boolean {
  return isUniversalPlanTier(planId);
}

function resolveUniversalProductTier(
  universalPlan: UniversalPlanTier,
  product: CloudCastProductId,
): ProductPlanTier {
  const tiers = UNIVERSAL_TIER_BY_ID[universalPlan].productTiers;
  if (product === 'video_mixer' || product === 'instant_replay' || product === 'regal_display') {
    return tiers.video_mixer;
  }
  if (product === 'audio_mixer') return tiers.audio_mixer;
  if (product === 'symphony_studio') return tiers.symphony_studio;
  if (product === 'regal_prism') return tiers.regal_prism;
  return 'pro_master';
}

/** Effective feature tier for a product (Universal bundles map per-product levels). */
export function resolveProductPlan(
  profile: UserProfile | null | undefined,
  product: CloudCastProductId,
): ProductPlanTier {
  if (!profile) return 'free';

  const entitlements = profile.entitlements;

  if (isUniversalPlanTier(profile.plan_id)) {
    return resolveUniversalProductTier(profile.plan_id, product);
  }

  if (entitlements?.universal && entitlements.universal_tier) {
    return resolveUniversalProductTier(entitlements.universal_tier, product);
  }

  if (product === 'video_mixer') {
    const tier = entitlements?.video_plan_id ?? profile.plan_id;
    return isProductPlanTier(tier) ? tier : 'free';
  }
  if (product === 'audio_mixer') {
    const tier = entitlements?.audio_plan_id ?? profile.plan_id;
    return isProductPlanTier(tier) ? tier : 'free';
  }
  if (product === 'symphony_studio') {
    const tier = entitlements?.symphony_plan_id ?? profile.plan_id;
    return isProductPlanTier(tier) ? tier : 'free';
  }
  if (product === 'instant_replay') {
    const tier = entitlements?.video_plan_id ?? profile.plan_id;
    return isProductPlanTier(tier) ? tier : 'free';
  }
  if (product === 'regal_display') {
    const tier = entitlements?.video_plan_id ?? profile.plan_id;
    return isProductPlanTier(tier) ? tier : 'free';
  }
  if (product === 'regal_prism') {
    const tier = entitlements?.prism_plan_id ?? profile.plan_id;
    return isProductPlanTier(tier) ? tier : 'free';
  }
  const fallback = profile.plan_id;
  return isProductPlanTier(fallback) ? fallback : 'free';
}

function isProductPlanTier(value: PlanTier): value is ProductPlanTier {
  return value === 'free' || value === 'pro' || value === 'pro_master';
}

export function canAccessProduct(
  profile: UserProfile | null | undefined,
  product: CloudCastProductId,
): boolean {
  if (!profile) return false;
  if (isUniversalPlan(profile.plan_id) || profile.entitlements?.universal) return true;
  const tier = resolveProductPlan(profile, product);
  return tier === 'free' || tier === 'pro' || tier === 'pro_master';
}

/** Link audio PGM into the video mixer — included on all Universal bundles. */
export function canLinkAudioVideoMixers(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  return isUniversalPlan(profile.plan_id) || profile.entitlements?.universal === true;
}

export function universalTierLabel(planId: PlanTier | null | undefined): string {
  if (!planId || !isUniversalPlanTier(planId)) return PLAN_LABELS.universal;
  return PLAN_LABELS[planId];
}

export function buildEntitlementsFromProfile(raw: Record<string, unknown>): ProductEntitlements {
  const planId = (raw.plan_id as PlanTier) ?? 'free';
  const universal = isUniversalPlanTier(planId) || raw.is_universal === true;
  const universalTier = isUniversalPlanTier(planId) ? planId : undefined;

  if (universal && universalTier) {
    const tiers = UNIVERSAL_TIER_BY_ID[universalTier].productTiers;
    return {
      video_plan_id: tiers.video_mixer,
      audio_plan_id: tiers.audio_mixer,
      symphony_plan_id: tiers.symphony_studio,
      replay_plan_id: tiers.video_mixer,
      prism_plan_id: tiers.regal_prism,
      universal: true,
      universal_tier: universalTier,
    };
  }

  const videoPlan = (raw.video_plan_id as PlanTier | undefined) ?? planId;
  const audioPlan = (raw.audio_plan_id as PlanTier | undefined) ?? planId;
  const symphonyPlan = (raw.symphony_plan_id as PlanTier | undefined) ?? planId;
  const prismPlan = (raw.prism_plan_id as PlanTier | undefined) ?? planId;

  return {
    video_plan_id: videoPlan,
    audio_plan_id: audioPlan,
    symphony_plan_id: symphonyPlan,
    replay_plan_id: (raw.replay_plan_id as PlanTier | undefined) ?? videoPlan,
    prism_plan_id: prismPlan,
    universal: false,
  };
}

export function listProductSubscriptions(
  profile: UserProfile | null | undefined,
): ProductSubscriptionSummary[] {
  if (!profile) return [];

  const onUniversal = isUniversalPlan(profile.plan_id) || profile.entitlements?.universal;

  return CLOUDCAST_PRODUCTS.map((product) => {
    const plan_id = resolveProductPlan(profile, product.id);
    const viaVideo =
      (product.id === 'instant_replay' || product.id === 'regal_display') &&
      !onUniversal;
    return {
      product: product.id,
      plan_id,
      label: onUniversal
        ? `${universalTierLabel(profile.plan_id)} · ${PLAN_LABELS[plan_id as ProductPlanTier] ?? plan_id}`
        : viaVideo
          ? `${PLAN_LABELS[plan_id as ProductPlanTier] ?? plan_id} · via Video Mixer`
          : PLAN_LABELS[plan_id as ProductPlanTier] ?? plan_id,
      hasAccess: canAccessProduct(profile, product.id),
    };
  });
}
