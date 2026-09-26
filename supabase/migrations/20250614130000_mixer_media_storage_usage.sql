-- Include mixer media assets in combined cloud storage usage (recordings + replay + media).

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
    UNION ALL
    SELECT size_bytes FROM public.mixer_media_assets WHERE user_id = auth.uid()
  ) combined;

  v_quota := public.get_recording_storage_quota_bytes();

  RETURN jsonb_build_object(
    'used_bytes', v_used,
    'quota_bytes', v_quota,
    'remaining_bytes', GREATEST(v_quota - v_used, 0)
  );
END;
$$;
