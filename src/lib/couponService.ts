import { getSupabase } from './supabase';
import type { CouponKind } from '../types/admin';
import type { PlanTier } from '../types/plans';

export interface RedeemCouponResult {
  code: string;
  kind: CouponKind;
  plan_id: PlanTier | null;
  percent_off: number | null;
  amount_off_cents: number | null;
  message: string;
}

export async function redeemCoupon(code: string): Promise<RedeemCouponResult> {
  const { data, error } = await getSupabase().rpc('redeem_coupon', { p_code: code });
  if (error) throw new Error(error.message);
  return data as RedeemCouponResult;
}
