-- CloudCast Replay — clip storage in Regal Cloud (shares recording quota)

CREATE TABLE IF NOT EXISTS public.replay_clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'video/webm',
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  duration_sec numeric,
  in_sec numeric,
  out_sec numeric,
  source_device_id text,
  bank_index integer,
  label text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, storage_path)
);

CREATE INDEX IF NOT EXISTS replay_clips_user_created_idx
  ON public.replay_clips (user_id, created_at DESC);

ALTER TABLE public.replay_clips ENABLE ROW LEVEL SECURITY;

CREATE POLICY replay_clips_select_own
  ON public.replay_clips FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY replay_clips_insert_own
  ON public.replay_clips FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY replay_clips_delete_own
  ON public.replay_clips FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.get_replay_storage_usage()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used bigint;
  v_quota bigint;
  v_count bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(SUM(size_bytes), 0), COUNT(*)
  INTO v_used, v_count
  FROM public.replay_clips
  WHERE user_id = auth.uid();

  v_quota := public.get_recording_storage_quota_bytes();

  RETURN jsonb_build_object(
    'used_bytes', v_used,
    'quota_bytes', v_quota,
    'remaining_bytes', GREATEST(v_quota - v_used, 0),
    'clip_count', v_count,
    'total_used_bytes', (
      SELECT COALESCE(SUM(size_bytes), 0) FROM (
        SELECT size_bytes FROM public.mixer_recordings WHERE user_id = auth.uid()
        UNION ALL SELECT size_bytes FROM public.replay_clips WHERE user_id = auth.uid()
      ) t
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_user_replay_clips()
RETURNS SETOF public.replay_clips
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.replay_clips
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.register_replay_clip(
  p_storage_path text,
  p_file_name text,
  p_mime_type text DEFAULT 'video/webm',
  p_size_bytes bigint DEFAULT 0,
  p_duration_sec numeric DEFAULT NULL,
  p_in_sec numeric DEFAULT NULL,
  p_out_sec numeric DEFAULT NULL,
  p_source_device_id text DEFAULT NULL,
  p_bank_index integer DEFAULT NULL,
  p_label text DEFAULT NULL,
  p_tags jsonb DEFAULT '[]'::jsonb
)
RETURNS public.replay_clips
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_used bigint;
  v_quota bigint;
  v_row public.replay_clips;
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
    RAISE EXCEPTION 'Cloud replay storage requires Pro or Pro Master on Replay or Universal';
  END IF;

  SELECT COALESCE(SUM(size_bytes), 0)
  INTO v_used
  FROM (
    SELECT size_bytes FROM public.replay_clips WHERE user_id = v_user_id
    UNION ALL
    SELECT size_bytes FROM public.mixer_recordings WHERE user_id = v_user_id
  ) combined;

  IF v_used + GREATEST(p_size_bytes, 0) > v_quota THEN
    RAISE EXCEPTION 'Cloud storage quota exceeded';
  END IF;

  INSERT INTO public.replay_clips (
    user_id,
    storage_path,
    file_name,
    mime_type,
    size_bytes,
    duration_sec,
    in_sec,
    out_sec,
    source_device_id,
    bank_index,
    label,
    tags
  )
  VALUES (
    v_user_id,
    p_storage_path,
    p_file_name,
    COALESCE(NULLIF(p_mime_type, ''), 'video/webm'),
    GREATEST(p_size_bytes, 0),
    p_duration_sec,
    p_in_sec,
    p_out_sec,
    p_source_device_id,
    p_bank_index,
    p_label,
    COALESCE(p_tags, '[]'::jsonb)
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_replay_clip(p_id uuid)
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

  DELETE FROM public.replay_clips
  WHERE id = p_id AND user_id = auth.uid()
  RETURNING storage_path INTO v_path;

  IF v_path IS NULL THEN
    RAISE EXCEPTION 'Replay clip not found';
  END IF;

  RETURN v_path;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_replay_storage_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_user_replay_clips() TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_replay_clip(text, text, text, bigint, numeric, numeric, numeric, text, integer, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_replay_clip(uuid) TO authenticated;
