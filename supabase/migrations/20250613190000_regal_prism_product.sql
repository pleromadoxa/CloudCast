-- Regal Prism — virtual production & AR studio (6th product)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS prism_plan_id plan_tier;

UPDATE public.profiles
SET prism_plan_id = COALESCE(
  prism_plan_id,
  CASE WHEN plan_id = 'universal'::plan_tier THEN 'pro_master'::plan_tier ELSE plan_id END
)
WHERE prism_plan_id IS NULL;

UPDATE public.subscription_plans
SET features = jsonb_build_array(
  'Video Mixer + Audio Mixer + Symphony + Replay + Regal Prism',
  'Pro Master on all products',
  '16-channel audio · 11 video inputs · 32-track DAW · 4K virtual production',
  'Regal Cloud UHD + Regal Cloud Archive',
  'Multi-stream destinations'
)
WHERE id = 'universal';

-- Extend stripe_subscriptions product constraint
ALTER TABLE public.stripe_subscriptions DROP CONSTRAINT IF EXISTS stripe_subscriptions_product_check;
ALTER TABLE public.stripe_subscriptions ADD CONSTRAINT stripe_subscriptions_product_check
  CHECK (product IN ('video_mixer', 'audio_mixer', 'symphony_studio', 'regal_prism', 'universal'));

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
      prism_plan_id = 'pro_master',
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

  IF p_plan_id NOT IN ('free', 'pro', 'pro_master', 'universal') THEN
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
    'is_universal', v_profile.plan_id = 'universal'::plan_tier
  );
END;
$$;

-- VP scene presets stored per user
CREATE TABLE IF NOT EXISTS public.prism_scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  virtual_set_id text NOT NULL DEFAULT 'news_studio',
  key_color jsonb NOT NULL DEFAULT '{"r":0,"g":177,"b":64}'::jsonb,
  key_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  camera_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  lighting jsonb NOT NULL DEFAULT '{}'::jsonb,
  mode text NOT NULL DEFAULT 'virtual_studio' CHECK (mode IN ('virtual_studio', 'augmented_reality', 'xr_extension')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prism_scenes_user_idx ON public.prism_scenes (user_id);

ALTER TABLE public.prism_scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY prism_scenes_select_own ON public.prism_scenes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY prism_scenes_insert_own ON public.prism_scenes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY prism_scenes_update_own ON public.prism_scenes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY prism_scenes_delete_own ON public.prism_scenes FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prism_scenes TO authenticated;
