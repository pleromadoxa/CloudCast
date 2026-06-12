-- Cloud storage for PGM mixer recordings (Pro: 50GB, Pro Master: 100GB)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.mixer_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.mixer_sessions(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'video/webm',
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  duration_sec numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, storage_path)
);

CREATE INDEX IF NOT EXISTS mixer_recordings_user_created_idx
  ON public.mixer_recordings (user_id, created_at DESC);

ALTER TABLE public.mixer_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY mixer_recordings_select_own
  ON public.mixer_recordings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY mixer_recordings_insert_own
  ON public.mixer_recordings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY mixer_recordings_delete_own
  ON public.mixer_recordings FOR DELETE
  USING (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('mixer-recordings', 'mixer-recordings', false, 524288000)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY mixer_recordings_storage_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'mixer-recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY mixer_recordings_storage_select
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'mixer-recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY mixer_recordings_storage_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'mixer-recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE OR REPLACE FUNCTION public.get_recording_storage_quota_bytes()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    CASE p.plan_id
      WHEN 'pro' THEN 50::bigint * 1024 * 1024 * 1024
      WHEN 'pro_master' THEN 100::bigint * 1024 * 1024 * 1024
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
  FROM public.mixer_recordings
  WHERE user_id = auth.uid();

  v_quota := public.get_recording_storage_quota_bytes();

  RETURN jsonb_build_object(
    'used_bytes', v_used,
    'quota_bytes', v_quota,
    'remaining_bytes', GREATEST(v_quota - v_used, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_user_recordings()
RETURNS SETOF public.mixer_recordings
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.mixer_recordings
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.register_mixer_recording(
  p_storage_path text,
  p_file_name text,
  p_mime_type text DEFAULT 'video/webm',
  p_size_bytes bigint DEFAULT 0,
  p_duration_sec numeric DEFAULT NULL,
  p_session_id uuid DEFAULT NULL
)
RETURNS public.mixer_recordings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_used bigint;
  v_quota bigint;
  v_row public.mixer_recordings;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_storage_path IS NULL OR p_storage_path = '' THEN
    RAISE EXCEPTION 'storage_path is required';
  END IF;

  IF NOT p_storage_path LIKE v_user_id::text || '/%' THEN
    RAISE EXCEPTION 'Invalid storage path for user';
  END IF;

  v_quota := public.get_recording_storage_quota_bytes();
  IF v_quota <= 0 THEN
    RAISE EXCEPTION 'Cloud recording storage is not included on your plan';
  END IF;

  SELECT COALESCE(SUM(size_bytes), 0)
  INTO v_used
  FROM public.mixer_recordings
  WHERE user_id = v_user_id;

  IF v_used + GREATEST(p_size_bytes, 0) > v_quota THEN
    RAISE EXCEPTION 'Cloud storage quota exceeded';
  END IF;

  INSERT INTO public.mixer_recordings (
    user_id,
    session_id,
    storage_path,
    file_name,
    mime_type,
    size_bytes,
    duration_sec
  )
  VALUES (
    v_user_id,
    p_session_id,
    p_storage_path,
    p_file_name,
    COALESCE(NULLIF(p_mime_type, ''), 'video/webm'),
    GREATEST(p_size_bytes, 0),
    p_duration_sec
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_mixer_recording(p_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_path text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.mixer_recordings
  WHERE id = p_id AND user_id = auth.uid()
  RETURNING storage_path INTO v_path;

  IF v_path IS NULL THEN
    RAISE EXCEPTION 'Recording not found';
  END IF;

  RETURN v_path;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_profile(p_full_name text DEFAULT NULL)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles
  SET
    full_name = COALESCE(NULLIF(trim(p_full_name), ''), full_name),
    updated_at = now()
  WHERE id = auth.uid()
  RETURNING * INTO v_row;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_recording_storage_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_user_recordings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_mixer_recording(text, text, text, bigint, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_mixer_recording(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_profile(text) TO authenticated;
