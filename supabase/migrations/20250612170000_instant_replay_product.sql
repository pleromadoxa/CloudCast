-- CloudCast Replay — fourth broadcast product plan column

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS replay_plan_id plan_tier;

UPDATE profiles
SET replay_plan_id = COALESCE(
  replay_plan_id,
  CASE WHEN plan_id = 'universal'::plan_tier THEN 'pro_master'::plan_tier ELSE plan_id END
)
WHERE replay_plan_id IS NULL;

UPDATE subscription_plans
SET
  price_monthly_cents = 11900,
  features = ARRAY[
    'Video Mixer + Audio Mixer + Symphony + Replay',
    'Pro Master on all products',
    '16-channel audio · 11 video inputs · 32-track DAW · 16 replay banks',
    'Regal Cloud UHD + Regal Cloud Archive',
    'Multi-stream destinations'
  ]::text[]
WHERE id = 'universal';

CREATE OR REPLACE FUNCTION update_user_product_plan(
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

  IF p_product = 'universal' OR p_plan_id = 'universal' THEN
    UPDATE profiles
    SET
      plan_id = 'universal',
      video_plan_id = 'pro_master',
      audio_plan_id = 'pro_master',
      symphony_plan_id = 'pro_master',
      replay_plan_id = 'pro_master',
      updated_at = now()
    WHERE id = uid;
    RETURN;
  END IF;

  IF p_product = 'video_mixer' THEN
    UPDATE profiles
    SET
      plan_id = p_plan_id,
      video_plan_id = p_plan_id,
      updated_at = now()
    WHERE id = uid;
    RETURN;
  END IF;

  IF p_product = 'audio_mixer' THEN
    UPDATE profiles
    SET
      audio_plan_id = p_plan_id,
      updated_at = now()
    WHERE id = uid;
    RETURN;
  END IF;

  IF p_product = 'symphony_studio' THEN
    UPDATE profiles
    SET
      symphony_plan_id = p_plan_id,
      updated_at = now()
    WHERE id = uid;
    RETURN;
  END IF;

  IF p_product = 'instant_replay' THEN
    UPDATE profiles
    SET
      replay_plan_id = p_plan_id,
      updated_at = now()
    WHERE id = uid;
    RETURN;
  END IF;

  RAISE EXCEPTION 'Unknown product: %', p_product;
END;
$$;

GRANT EXECUTE ON FUNCTION update_user_product_plan(text, plan_tier) TO authenticated;
