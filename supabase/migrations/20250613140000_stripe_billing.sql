-- Stripe billing: customer linkage, per-product subscriptions, plan apply helpers

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_stripe_customer_id_idx
  ON public.profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.stripe_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product text NOT NULL CHECK (product IN ('video_mixer', 'audio_mixer', 'symphony_studio', 'universal')),
  stripe_subscription_id text UNIQUE,
  stripe_price_id text,
  plan_id plan_tier NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product)
);

CREATE INDEX IF NOT EXISTS stripe_subscriptions_user_idx
  ON public.stripe_subscriptions (user_id);

ALTER TABLE public.stripe_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY stripe_subscriptions_select_own
  ON public.stripe_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

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

  IF p_plan_id NOT IN ('free', 'pro', 'pro_master', 'universal') THEN
    RAISE EXCEPTION 'Invalid plan';
  END IF;

  IF p_product = 'universal' OR p_plan_id = 'universal' THEN
    SELECT plan_id INTO v_old FROM public.profiles WHERE id = p_user_id;
    UPDATE public.profiles
    SET
      plan_id = 'universal',
      video_plan_id = 'pro_master',
      audio_plan_id = 'pro_master',
      symphony_plan_id = 'pro_master',
      replay_plan_id = 'pro_master',
      updated_at = now()
    WHERE id = p_user_id;
    IF p_enqueue_emails THEN
      PERFORM public.maybe_enqueue_plan_emails(p_user_id, 'universal', COALESCE(v_old, 'free'::plan_tier), 'universal'::plan_tier);
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
  PERFORM public.set_user_product_plan(uid, p_product, p_plan_id, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_stripe_billing_update(
  p_user_id uuid,
  p_product text,
  p_plan_id plan_tier,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_stripe_price_id text,
  p_status text,
  p_period_end timestamptz,
  p_cancel_at_period_end boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan plan_tier;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  IF p_stripe_customer_id IS NOT NULL AND trim(p_stripe_customer_id) <> '' THEN
    UPDATE public.profiles
    SET stripe_customer_id = trim(p_stripe_customer_id), updated_at = now()
    WHERE id = p_user_id;
  END IF;

  v_plan := CASE
    WHEN p_status IN ('active', 'trialing', 'past_due') THEN p_plan_id
    WHEN p_status IN ('canceled', 'unpaid', 'incomplete_expired') THEN 'free'::plan_tier
    ELSE p_plan_id
  END;

  IF p_stripe_subscription_id IS NOT NULL THEN
    INSERT INTO public.stripe_subscriptions (
      user_id,
      product,
      stripe_subscription_id,
      stripe_price_id,
      plan_id,
      status,
      current_period_end,
      cancel_at_period_end,
      updated_at
    )
    VALUES (
      p_user_id,
      p_product,
      p_stripe_subscription_id,
      p_stripe_price_id,
      v_plan,
      coalesce(p_status, 'active'),
      p_period_end,
      coalesce(p_cancel_at_period_end, false),
      now()
    )
    ON CONFLICT (user_id, product) DO UPDATE SET
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      stripe_price_id = EXCLUDED.stripe_price_id,
      plan_id = EXCLUDED.plan_id,
      status = EXCLUDED.status,
      current_period_end = EXCLUDED.current_period_end,
      cancel_at_period_end = EXCLUDED.cancel_at_period_end,
      updated_at = now();
  END IF;

  PERFORM public.set_user_product_plan(p_user_id, p_product, v_plan, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_stripe_billing_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN jsonb_build_object(
    'stripe_customer_id', (SELECT stripe_customer_id FROM public.profiles WHERE id = uid),
    'subscriptions', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'product', s.product,
            'plan_id', s.plan_id,
            'status', s.status,
            'current_period_end', s.current_period_end,
            'cancel_at_period_end', s.cancel_at_period_end
          )
          ORDER BY s.product
        )
        FROM public.stripe_subscriptions s
        WHERE s.user_id = uid
      ),
      '[]'::jsonb
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_product_plan(uuid, text, plan_tier, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_stripe_billing_update(uuid, text, plan_tier, text, text, text, text, timestamptz, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_stripe_billing_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_product_plan(text, plan_tier) TO authenticated;
