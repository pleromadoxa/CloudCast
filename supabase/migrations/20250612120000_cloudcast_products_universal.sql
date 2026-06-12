-- CloudCast multi-product subscriptions + Universal plan
-- Adds per-product plan columns and universal tier.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'plan_tier' AND e.enumlabel = 'universal'
  ) THEN
    ALTER TYPE plan_tier ADD VALUE IF NOT EXISTS 'universal';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS video_plan_id plan_tier,
  ADD COLUMN IF NOT EXISTS audio_plan_id plan_tier;

UPDATE profiles
SET
  video_plan_id = COALESCE(video_plan_id, CASE WHEN plan_id = 'universal'::plan_tier THEN 'pro_master'::plan_tier ELSE plan_id END),
  audio_plan_id = COALESCE(audio_plan_id, CASE WHEN plan_id = 'universal'::plan_tier THEN 'pro_master'::plan_tier ELSE plan_id END)
WHERE video_plan_id IS NULL OR audio_plan_id IS NULL;

INSERT INTO subscription_plans (
  id,
  name,
  max_mobile_devices,
  max_usb_devices,
  max_total_channels,
  connection_mode,
  price_monthly_cents,
  features
)
VALUES (
  'universal',
  'CloudCast Universal',
  8,
  2,
  11,
  'regal',
  9900,
  ARRAY[
    'Video Mixer + Audio Mixer',
    'Pro Master on all products',
    '16-channel audio · 11 video inputs',
    'Regal Cloud UHD',
    'Multi-stream destinations'
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

  RAISE EXCEPTION 'Unknown product: %', p_product;
END;
$$;

GRANT EXECUTE ON FUNCTION update_user_product_plan(text, plan_tier) TO authenticated;
