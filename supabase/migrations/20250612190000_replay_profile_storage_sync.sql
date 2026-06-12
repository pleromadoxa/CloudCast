-- Replay profile entitlements, combined cloud storage quota, mobile instant_replay

CREATE OR REPLACE FUNCTION public.get_recording_storage_quota_bytes()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    CASE
      WHEN p.plan_id = 'universal'::plan_tier THEN 100::bigint * 1024 * 1024 * 1024
      WHEN GREATEST(
        CASE COALESCE(p.video_plan_id, p.plan_id) WHEN 'pro_master' THEN 3 WHEN 'pro' THEN 2 WHEN 'universal' THEN 3 ELSE 0 END,
        CASE COALESCE(p.replay_plan_id, p.plan_id) WHEN 'pro_master' THEN 3 WHEN 'pro' THEN 2 WHEN 'universal' THEN 3 ELSE 0 END
      ) >= 3 THEN 100::bigint * 1024 * 1024 * 1024
      WHEN GREATEST(
        CASE COALESCE(p.video_plan_id, p.plan_id) WHEN 'pro_master' THEN 3 WHEN 'pro' THEN 2 ELSE 0 END,
        CASE COALESCE(p.replay_plan_id, p.plan_id) WHEN 'pro_master' THEN 3 WHEN 'pro' THEN 2 ELSE 0 END
      ) >= 2 THEN 50::bigint * 1024 * 1024 * 1024
      ELSE 0::bigint
    END,
    0::bigint
  )
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_recording_storage_usage()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used bigint;
  v_quota bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(SUM(size_bytes), 0)
  INTO v_used
  FROM (
    SELECT size_bytes FROM public.mixer_recordings WHERE user_id = auth.uid()
    UNION ALL
    SELECT size_bytes FROM public.replay_clips WHERE user_id = auth.uid()
  ) combined;

  v_quota := public.get_recording_storage_quota_bytes();

  RETURN jsonb_build_object(
    'used_bytes', v_used,
    'quota_bytes', v_quota,
    'remaining_bytes', GREATEST(v_quota - v_used, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_replay_storage_usage()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_replay_used bigint;
  v_total_used bigint;
  v_quota bigint;
  v_count bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(SUM(size_bytes), 0), COUNT(*)
  INTO v_replay_used, v_count
  FROM public.replay_clips
  WHERE user_id = auth.uid();

  SELECT COALESCE(SUM(size_bytes), 0)
  INTO v_total_used
  FROM (
    SELECT size_bytes FROM public.mixer_recordings WHERE user_id = auth.uid()
    UNION ALL
    SELECT size_bytes FROM public.replay_clips WHERE user_id = auth.uid()
  ) combined;

  v_quota := public.get_recording_storage_quota_bytes();

  RETURN jsonb_build_object(
    'used_bytes', v_replay_used,
    'total_used_bytes', v_total_used,
    'quota_bytes', v_quota,
    'remaining_bytes', GREATEST(v_quota - v_total_used, 0),
    'clip_count', v_count
  );
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
    'is_universal', v_profile.plan_id = 'universal'::plan_tier
  );
END;
$$;

-- Allow instant_replay in mobile app releases (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'mobile_app_releases') THEN
    ALTER TABLE public.mobile_app_releases DROP CONSTRAINT IF EXISTS mobile_app_releases_product_id_check;
    ALTER TABLE public.mobile_app_releases ADD CONSTRAINT mobile_app_releases_product_id_check
      CHECK (product_id IN ('video_mixer', 'audio_mixer', 'symphony_studio', 'instant_replay'));
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;
