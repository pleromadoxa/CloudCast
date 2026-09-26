-- Dashboard preferences, paid-plan pause, and non-owner Free normalization.
-- Owner account (pleromadoxa@gmail.com) is preserved untouched.

DO $$
DECLARE
  v_owner_id uuid;
  v_owner_count int;
BEGIN
  SELECT COUNT(*) INTO v_owner_count
  FROM auth.users
  WHERE lower(email) = lower('pleromadoxa@gmail.com');

  IF v_owner_count <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly one owner user for pleromadoxa@gmail.com, found %',
      v_owner_count;
  END IF;

  SELECT id INTO v_owner_id
  FROM auth.users
  WHERE lower(email) = lower('pleromadoxa@gmail.com')
  LIMIT 1;

  -- Persist owner id for later statements in this migration via a temp table.
  CREATE TEMP TABLE _cloudcast_migration_owner (
    owner_id uuid PRIMARY KEY
  ) ON COMMIT DROP;

  INSERT INTO _cloudcast_migration_owner (owner_id) VALUES (v_owner_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. Dashboard preference columns (Audio on, Prism/Replay off by default)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS audio_dashboard_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS prism_dashboard_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS replay_dashboard_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.audio_dashboard_enabled IS
  'When false, Audio Mixer dashboard is hidden and blocked for this account.';
COMMENT ON COLUMN public.profiles.prism_dashboard_enabled IS
  'When false, Regal Prism dashboard is hidden and blocked for this account.';
COMMENT ON COLUMN public.profiles.replay_dashboard_enabled IS
  'When false, Instant Replay dashboard is hidden and blocked for this account.';

-- ---------------------------------------------------------------------------
-- 2. Profile RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
  v_plan public.subscription_plans;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = v_profile.plan_id;

  RETURN jsonb_build_object(
    'id', v_profile.id,
    'email', v_profile.email,
    'full_name', v_profile.full_name,
    'plan_id', v_profile.plan_id,
    'plan', to_jsonb(v_plan),
    'video_plan_id', v_profile.video_plan_id,
    'audio_plan_id', v_profile.audio_plan_id,
    'symphony_plan_id', v_profile.symphony_plan_id,
    'replay_plan_id', v_profile.replay_plan_id,
    'prism_plan_id', v_profile.prism_plan_id,
    'is_universal', public.is_universal_bundle(v_profile.plan_id),
    'audio_dashboard_enabled', COALESCE(v_profile.audio_dashboard_enabled, true),
    'prism_dashboard_enabled', COALESCE(v_profile.prism_dashboard_enabled, false),
    'replay_dashboard_enabled', COALESCE(v_profile.replay_dashboard_enabled, false)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_dashboard_preferences(
  p_audio_dashboard_enabled boolean DEFAULT NULL,
  p_prism_dashboard_enabled boolean DEFAULT NULL,
  p_replay_dashboard_enabled boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.profiles
  SET
    audio_dashboard_enabled = COALESCE(p_audio_dashboard_enabled, audio_dashboard_enabled),
    prism_dashboard_enabled = COALESCE(p_prism_dashboard_enabled, prism_dashboard_enabled),
    replay_dashboard_enabled = COALESCE(p_replay_dashboard_enabled, replay_dashboard_enabled),
    updated_at = now()
  WHERE id = auth.uid()
  RETURNING * INTO v_profile;

  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  RETURN jsonb_build_object(
    'audio_dashboard_enabled', v_profile.audio_dashboard_enabled,
    'prism_dashboard_enabled', v_profile.prism_dashboard_enabled,
    'replay_dashboard_enabled', v_profile.replay_dashboard_enabled
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_user_dashboard_preferences(boolean, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_user_dashboard_preferences(boolean, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_dashboard_preferences(boolean, boolean, boolean) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Pause paid self-serve upgrades (Free still allowed)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_user_plan(p_plan_id plan_tier)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.subscription_plans;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_plan_id IS DISTINCT FROM 'free'::plan_tier THEN
    RAISE EXCEPTION 'Paid plans are coming soon. Free tier remains available.';
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid plan';
  END IF;

  UPDATE public.profiles
  SET
    plan_id = 'free'::plan_tier,
    video_plan_id = 'free'::plan_tier,
    audio_plan_id = 'free'::plan_tier,
    symphony_plan_id = 'free'::plan_tier,
    replay_plan_id = 'free'::plan_tier,
    prism_plan_id = 'free'::plan_tier,
    updated_at = now()
  WHERE id = auth.uid();

  RETURN to_jsonb(v_plan);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_product_plan(
  p_product text,
  p_plan_id plan_tier
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_plan_id IS DISTINCT FROM 'free'::plan_tier THEN
    RAISE EXCEPTION 'Paid plans are coming soon. Free tier remains available.';
  END IF;

  -- Only Free self-serve changes while billing is paused.
  PERFORM public.set_user_product_plan(uid, p_product, 'free'::plan_tier, false);
END;
$$;

-- Restrict privileged plan/billing helpers to service_role only.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'set_user_product_plan',
        'apply_stripe_billing_update',
        'admin_set_user_plan',
        'admin_issue_plan'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.update_user_plan(plan_tier) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_user_plan(plan_tier) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_user_plan(plan_tier) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_plan(plan_tier) TO service_role;

REVOKE ALL ON FUNCTION public.update_user_product_plan(text, plan_tier) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_user_product_plan(text, plan_tier) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_user_product_plan(text, plan_tier) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_product_plan(text, plan_tier) TO service_role;

-- Soft-disable plan-upgrade coupons while payment gateway is not ready.
UPDATE public.coupons
SET is_active = false
WHERE kind = 'plan_upgrade'
  AND is_active = true;

CREATE OR REPLACE FUNCTION public.redeem_coupon(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon public.coupons%ROWTYPE;
  v_user_id uuid;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to redeem a coupon';
  END IF;

  v_user_id := auth.uid();
  PERFORM public.sync_expired_plan_grants(v_user_id);

  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE upper(code) = upper(trim(p_code))
  FOR UPDATE;

  IF v_coupon.id IS NULL THEN
    RAISE EXCEPTION 'Invalid coupon code';
  END IF;

  IF NOT v_coupon.is_active THEN
    RAISE EXCEPTION 'This coupon is no longer active';
  END IF;

  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at <= now() THEN
    RAISE EXCEPTION 'This coupon has expired';
  END IF;

  IF v_coupon.max_uses IS NOT NULL AND v_coupon.use_count >= v_coupon.max_uses THEN
    RAISE EXCEPTION 'This coupon has reached its usage limit';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.coupon_redemptions
    WHERE coupon_id = v_coupon.id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'You have already redeemed this coupon';
  END IF;

  IF v_coupon.kind = 'plan_upgrade' THEN
    RAISE EXCEPTION 'Paid plans are coming soon. Plan upgrade coupons are temporarily unavailable.';
  END IF;

  UPDATE public.coupons SET use_count = use_count + 1 WHERE id = v_coupon.id;

  INSERT INTO public.coupon_redemptions (coupon_id, user_id, metadata)
  VALUES (
    v_coupon.id,
    v_user_id,
    jsonb_build_object('kind', v_coupon.kind, 'plan_id', v_coupon.plan_id)
  );

  PERFORM public.log_activity(
    'coupon.redeem',
    'coupon',
    v_coupon.id::text,
    jsonb_build_object('code', v_coupon.code, 'kind', v_coupon.kind)
  );

  v_result := jsonb_build_object(
    'code', v_coupon.code,
    'kind', v_coupon.kind,
    'plan_id', v_coupon.plan_id,
    'percent_off', v_coupon.percent_off,
    'amount_off_cents', v_coupon.amount_off_cents,
    'message', CASE
      WHEN v_coupon.kind = 'percent_off' THEN format('%s%% discount saved for checkout', v_coupon.percent_off)
      ELSE format('$%s discount saved for checkout', round(v_coupon.amount_off_cents / 100.0, 2))
    END
  );

  PERFORM public.enqueue_transactional_email(
    v_user_id,
    'coupon_redeemed',
    jsonb_build_object('code', v_coupon.code, 'kind', v_coupon.kind, 'plan_id', v_coupon.plan_id)
  );

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Lock down direct profile plan writes from clients
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.profiles FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.profiles FROM authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

-- subscription_plans: read-only catalog for clients
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_plans_select ON public.subscription_plans;
CREATE POLICY subscription_plans_select
  ON public.subscription_plans
  FOR SELECT
  TO authenticated, anon
  USING (true);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.subscription_plans FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.subscription_plans FROM authenticated;
GRANT SELECT ON public.subscription_plans TO anon;
GRANT SELECT ON public.subscription_plans TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Normalize every non-owner account to Free (preserve owner)
-- ---------------------------------------------------------------------------
UPDATE public.plan_grants pg
SET revoked_at = COALESCE(pg.revoked_at, now())
FROM _cloudcast_migration_owner o
WHERE pg.user_id <> o.owner_id
  AND pg.revoked_at IS NULL;

UPDATE public.profiles p
SET
  plan_id = 'free'::plan_tier,
  video_plan_id = 'free'::plan_tier,
  audio_plan_id = 'free'::plan_tier,
  symphony_plan_id = 'free'::plan_tier,
  replay_plan_id = 'free'::plan_tier,
  prism_plan_id = 'free'::plan_tier,
  updated_at = now()
FROM _cloudcast_migration_owner o
WHERE p.id <> o.owner_id
  AND (
    p.plan_id IS DISTINCT FROM 'free'::plan_tier
    OR p.video_plan_id IS DISTINCT FROM 'free'::plan_tier
    OR p.audio_plan_id IS DISTINCT FROM 'free'::plan_tier
    OR p.symphony_plan_id IS DISTINCT FROM 'free'::plan_tier
    OR p.replay_plan_id IS DISTINCT FROM 'free'::plan_tier
    OR p.prism_plan_id IS DISTINCT FROM 'free'::plan_tier
    OR p.video_plan_id IS NULL
    OR p.audio_plan_id IS NULL
    OR p.symphony_plan_id IS NULL
    OR p.replay_plan_id IS NULL
    OR p.prism_plan_id IS NULL
  );

-- Snap non-owner mixer sessions to Free plan limits / mesh mode.
UPDATE public.mixer_sessions ms
SET
  plan_id = 'free'::plan_tier,
  connection_mode = 'mesh',
  max_mobile_devices = 2,
  max_usb_devices = 0,
  max_devices = 2,
  updated_at = now()
FROM _cloudcast_migration_owner o
WHERE ms.owner_id IS DISTINCT FROM o.owner_id
  AND (
    ms.plan_id IS DISTINCT FROM 'free'::plan_tier
    OR ms.connection_mode IS DISTINCT FROM 'mesh'
    OR COALESCE(ms.max_mobile_devices, -1) <> 2
    OR COALESCE(ms.max_usb_devices, -1) <> 0
    OR COALESCE(ms.max_devices, -1) <> 2
  );
