-- CloudCast Universal — three bundle tiers (Essential, Studio, Master)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'plan_tier' AND e.enumlabel = 'universal_essential'
  ) THEN
    ALTER TYPE plan_tier ADD VALUE IF NOT EXISTS 'universal_essential';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'plan_tier' AND e.enumlabel = 'universal_studio'
  ) THEN
    ALTER TYPE plan_tier ADD VALUE IF NOT EXISTS 'universal_studio';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.universal_bundle_video_tier(p_plan plan_tier)
RETURNS plan_tier
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_plan
    WHEN 'universal_essential'::plan_tier THEN 'pro'::plan_tier
    WHEN 'universal_studio'::plan_tier THEN 'pro_master'::plan_tier
    WHEN 'universal'::plan_tier THEN 'pro_master'::plan_tier
    ELSE p_plan
  END;
$$;

CREATE OR REPLACE FUNCTION public.universal_bundle_audio_tier(p_plan plan_tier)
RETURNS plan_tier
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_plan
    WHEN 'universal_essential'::plan_tier THEN 'pro'::plan_tier
    WHEN 'universal_studio'::plan_tier THEN 'pro_master'::plan_tier
    WHEN 'universal'::plan_tier THEN 'pro_master'::plan_tier
    ELSE p_plan
  END;
$$;

CREATE OR REPLACE FUNCTION public.universal_bundle_symphony_tier(p_plan plan_tier)
RETURNS plan_tier
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_plan
    WHEN 'universal_essential'::plan_tier THEN 'pro'::plan_tier
    WHEN 'universal_studio'::plan_tier THEN 'pro'::plan_tier
    WHEN 'universal'::plan_tier THEN 'pro_master'::plan_tier
    ELSE p_plan
  END;
$$;

CREATE OR REPLACE FUNCTION public.universal_bundle_prism_tier(p_plan plan_tier)
RETURNS plan_tier
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_plan
    WHEN 'universal_essential'::plan_tier THEN 'pro'::plan_tier
    WHEN 'universal_studio'::plan_tier THEN 'pro'::plan_tier
    WHEN 'universal'::plan_tier THEN 'pro_master'::plan_tier
    ELSE p_plan
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_universal_bundle(p_plan plan_tier)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_plan IN (
    'universal_essential'::plan_tier,
    'universal_studio'::plan_tier,
    'universal'::plan_tier
  );
$$;

INSERT INTO public.subscription_plans (
  id,
  name,
  max_mobile_devices,
  max_usb_devices,
  max_total_channels,
  connection_mode,
  price_monthly_cents,
  features
)
VALUES
  (
    'universal_essential',
    'CloudCast Universal Essential',
    4,
    0,
    5,
    'regal',
    5900,
    ARRAY[
      'All six CloudCast products',
      'Pro tier on every product',
      'Audio ↔ Video bridge included',
      'Regal Cloud HD streaming',
      'Save vs buying each product separately'
    ]::text[]
  ),
  (
    'universal_studio',
    'CloudCast Universal Studio',
    8,
    2,
    11,
    'regal',
    9900,
    ARRAY[
      'All six CloudCast products',
      'Pro Master on Video, Audio & Replay',
      'Pro on Symphony & Regal Prism',
      'Audio ↔ Video bridge included',
      'Best balance of power and value'
    ]::text[]
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  features = EXCLUDED.features,
  max_mobile_devices = EXCLUDED.max_mobile_devices,
  max_usb_devices = EXCLUDED.max_usb_devices,
  max_total_channels = EXCLUDED.max_total_channels,
  connection_mode = EXCLUDED.connection_mode;

UPDATE public.subscription_plans
SET
  name = 'CloudCast Universal Master',
  price_monthly_cents = 14900,
  features = ARRAY[
    'All six CloudCast products',
    'Pro Master on every product',
    '16-channel audio · 11 video · 32-track DAW · 4K VP',
    'Regal Cloud UHD · multi-stream',
    '100GB cloud storage · priority support'
  ]::text[]
WHERE id = 'universal';

CREATE OR REPLACE FUNCTION public.set_user_product_plan(
  p_user_id uuid,
  p_product text,
  p_plan_id plan_tier,
  p_enqueue_emails boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old plan_tier;
  v_effective_product text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  IF p_plan_id NOT IN (
    'free', 'pro', 'pro_master',
    'universal_essential', 'universal_studio', 'universal'
  ) THEN
    RAISE EXCEPTION 'Invalid plan';
  END IF;

  IF p_product = 'universal' OR public.is_universal_bundle(p_plan_id) THEN
    SELECT plan_id INTO v_old FROM public.profiles WHERE id = p_user_id;
    UPDATE public.profiles
    SET
      plan_id = p_plan_id,
      video_plan_id = public.universal_bundle_video_tier(p_plan_id),
      audio_plan_id = public.universal_bundle_audio_tier(p_plan_id),
      symphony_plan_id = public.universal_bundle_symphony_tier(p_plan_id),
      replay_plan_id = public.universal_bundle_video_tier(p_plan_id),
      prism_plan_id = public.universal_bundle_prism_tier(p_plan_id),
      updated_at = now()
    WHERE id = p_user_id;
    IF p_enqueue_emails THEN
      PERFORM public.maybe_enqueue_plan_emails(
        p_user_id,
        'universal',
        COALESCE(v_old, 'free'::plan_tier),
        p_plan_id
      );
    END IF;
    RETURN;
  END IF;

  v_effective_product := CASE WHEN p_product = 'instant_replay' THEN 'video_mixer' ELSE p_product END;

  IF v_effective_product = 'video_mixer' THEN
    SELECT COALESCE(video_plan_id, plan_id, 'free'::plan_tier) INTO v_old FROM public.profiles WHERE id = p_user_id;
    UPDATE public.profiles
    SET
      plan_id = p_plan_id,
      video_plan_id = p_plan_id,
      replay_plan_id = p_plan_id,
      updated_at = now()
    WHERE id = p_user_id;
    IF p_enqueue_emails THEN
      PERFORM public.maybe_enqueue_plan_emails(p_user_id, 'video_mixer', v_old, p_plan_id);
    END IF;
    RETURN;
  END IF;

  IF v_effective_product = 'audio_mixer' THEN
    SELECT COALESCE(audio_plan_id, plan_id, 'free'::plan_tier) INTO v_old FROM public.profiles WHERE id = p_user_id;
    UPDATE public.profiles
    SET audio_plan_id = p_plan_id, updated_at = now()
    WHERE id = p_user_id;
    IF p_enqueue_emails THEN
      PERFORM public.maybe_enqueue_plan_emails(p_user_id, 'audio_mixer', v_old, p_plan_id);
    END IF;
    RETURN;
  END IF;

  IF v_effective_product = 'symphony_studio' THEN
    SELECT COALESCE(symphony_plan_id, plan_id, 'free'::plan_tier) INTO v_old FROM public.profiles WHERE id = p_user_id;
    UPDATE public.profiles
    SET symphony_plan_id = p_plan_id, updated_at = now()
    WHERE id = p_user_id;
    IF p_enqueue_emails THEN
      PERFORM public.maybe_enqueue_plan_emails(p_user_id, 'symphony_studio', v_old, p_plan_id);
    END IF;
    RETURN;
  END IF;

  IF v_effective_product = 'regal_prism' THEN
    SELECT COALESCE(prism_plan_id, plan_id, 'free'::plan_tier) INTO v_old FROM public.profiles WHERE id = p_user_id;
    UPDATE public.profiles
    SET prism_plan_id = p_plan_id, updated_at = now()
    WHERE id = p_user_id;
    IF p_enqueue_emails THEN
      PERFORM public.maybe_enqueue_plan_emails(p_user_id, 'regal_prism', v_old, p_plan_id);
    END IF;
    RETURN;
  END IF;

  RAISE EXCEPTION 'Unknown product: %', p_product;
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

  IF p_plan_id NOT IN (
    'free', 'pro', 'pro_master',
    'universal_essential', 'universal_studio', 'universal'
  ) THEN
    RAISE EXCEPTION 'Invalid plan';
  END IF;

  PERFORM public.set_user_product_plan(uid, p_product, p_plan_id, true);
END;
$$;

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
    'is_universal', public.is_universal_bundle(v_profile.plan_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.plan_price_cents(p_plan plan_tier)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_plan
    WHEN 'pro'::plan_tier THEN 2900
    WHEN 'pro_master'::plan_tier THEN 7900
    WHEN 'universal_essential'::plan_tier THEN 5900
    WHEN 'universal_studio'::plan_tier THEN 9900
    WHEN 'universal'::plan_tier THEN 14900
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.maybe_enqueue_plan_emails(
  p_user_id uuid,
  p_product text,
  p_from_plan plan_tier,
  p_to_plan plan_tier
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount int;
  v_receipt_id text;
BEGIN
  IF p_user_id IS NULL OR p_from_plan IS NOT DISTINCT FROM p_to_plan THEN
    RETURN;
  END IF;

  PERFORM public.enqueue_transactional_email(
    p_user_id,
    'plan_changed',
    jsonb_build_object(
      'product', p_product,
      'from_plan', p_from_plan,
      'to_plan', p_to_plan
    )
  );

  v_amount := public.plan_price_cents(p_to_plan);
  IF v_amount > 0 AND p_to_plan IN (
    'pro'::plan_tier,
    'pro_master'::plan_tier,
    'universal_essential'::plan_tier,
    'universal_studio'::plan_tier,
    'universal'::plan_tier
  ) THEN
    v_receipt_id := 'CC-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    PERFORM public.enqueue_transactional_email(
      p_user_id,
      'payment_receipt',
      jsonb_build_object(
        'amount_cents', v_amount,
        'receipt_id', v_receipt_id,
        'product', p_product,
        'plan', p_to_plan
      )
    );
  END IF;
END;
$$;
