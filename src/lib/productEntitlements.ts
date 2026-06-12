import type { CloudCastProductId, ProductEntitlements, ProductSubscriptionSummary } from '../types/products';
import { CLOUDCAST_PRODUCTS } from '../config/products';
import type { PlanTier, UserProfile } from '../types/plans';
import { PLAN_LABELS } from '../types/plans';

export function isUniversalPlan(planId: PlanTier | null | undefined): boolean {
  return planId === 'universal';
}

/** Effective feature tier for a product (Universal → Pro Master on all products). */
export function resolveProductPlan(
  profile: UserProfile | null | undefined,
  product: CloudCastProductId,
): PlanTier {
  if (!profile) return 'free';
  const entitlements = profile.entitlements;
  if (entitlements?.universal || isUniversalPlan(profile.plan_id)) {
    return 'pro_master';
  }
  if (product === 'video_mixer') {
    return entitlements?.video_plan_id ?? profile.plan_id;
  }
  if (product === 'audio_mixer') {
    return entitlements?.audio_plan_id ?? profile.plan_id;
  }
  if (product === 'symphony_studio') {
    return entitlements?.symphony_plan_id ?? profile.plan_id;
  }
  // CloudCast Replay is included with Video Mixer — same tier as video_plan_id
  if (product === 'instant_replay') {
    return entitlements?.video_plan_id ?? profile.plan_id;
  }
  return profile.plan_id;
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

/** Link audio PGM into the video mixer — requires CloudCast Universal. */
export function canLinkAudioVideoMixers(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  return isUniversalPlan(profile.plan_id) || profile.entitlements?.universal === true;
}

export function buildEntitlementsFromProfile(raw: Record<string, unknown>): ProductEntitlements {
  const planId = (raw.plan_id as PlanTier) ?? 'free';
  const universal = planId === 'universal' || raw.is_universal === true;
  const videoPlan = (raw.video_plan_id as PlanTier | undefined) ?? (universal ? 'pro_master' : planId);
  const audioPlan = (raw.audio_plan_id as PlanTier | undefined) ?? (universal ? 'pro_master' : planId);
  const symphonyPlan = (raw.symphony_plan_id as PlanTier | undefined) ?? (universal ? 'pro_master' : planId);

  return {
    video_plan_id: universal ? 'pro_master' : videoPlan,
    audio_plan_id: universal ? 'pro_master' : audioPlan,
    symphony_plan_id: universal ? 'pro_master' : symphonyPlan,
    replay_plan_id: universal ? 'pro_master' : videoPlan,
    universal,
  };
}

export function listProductSubscriptions(
  profile: UserProfile | null | undefined,
): ProductSubscriptionSummary[] {
  if (!profile) return [];

  return CLOUDCAST_PRODUCTS.map((product) => {
    const plan_id = resolveProductPlan(profile, product.id);
    const viaVideo = product.id === 'instant_replay' && !isUniversalPlan(profile.plan_id) && !profile.entitlements?.universal;
    return {
      product: product.id,
      plan_id,
      label: isUniversalPlan(profile.plan_id) || profile.entitlements?.universal
        ? `Universal (${PLAN_LABELS.pro_master} access)`
        : viaVideo
          ? `${PLAN_LABELS[plan_id] ?? plan_id} · via Video Mixer`
          : PLAN_LABELS[plan_id] ?? plan_id,
      hasAccess: canAccessProduct(profile, product.id),
    };
  });
}
