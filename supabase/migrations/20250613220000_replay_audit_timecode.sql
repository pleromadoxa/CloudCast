-- CloudCast Replay phase 2 — SMPTE timecode metadata + operator audit trail

ALTER TABLE public.replay_clips
  ADD COLUMN IF NOT EXISTS timecode_in text,
  ADD COLUMN IF NOT EXISTS timecode_out text,
  ADD COLUMN IF NOT EXISTS frame_rate numeric DEFAULT 30;

CREATE TABLE IF NOT EXISTS public.replay_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid,
  event_type text NOT NULL,
  clip_id text,
  bank_index integer,
  label text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS replay_audit_log_user_created_idx
  ON public.replay_audit_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS replay_audit_log_session_idx
  ON public.replay_audit_log (session_id, created_at DESC)
  WHERE session_id IS NOT NULL;

ALTER TABLE public.replay_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY replay_audit_log_select_own
  ON public.replay_audit_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY replay_audit_log_insert_own
  ON public.replay_audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.log_replay_audit_event(
  p_event_type text,
  p_session_id uuid DEFAULT NULL,
  p_clip_id text DEFAULT NULL,
  p_bank_index integer DEFAULT NULL,
  p_label text DEFAULT NULL,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS public.replay_audit_log
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.replay_audit_log;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_event_type IS NULL OR trim(p_event_type) = '' THEN
    RAISE EXCEPTION 'event_type is required';
  END IF;

  INSERT INTO public.replay_audit_log (
    user_id,
    session_id,
    event_type,
    clip_id,
    bank_index,
    label,
    meta
  )
  VALUES (
    v_user_id,
    p_session_id,
    trim(p_event_type),
    NULLIF(trim(p_clip_id), ''),
    p_bank_index,
    NULLIF(trim(p_label), ''),
    COALESCE(p_meta, '{}'::jsonb)
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_replay_audit_events(p_limit integer DEFAULT 100)
RETURNS SETOF public.replay_audit_log
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.replay_audit_log
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500));
$$;

-- Extend register_replay_clip with optional SMPTE fields
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
  p_tags jsonb DEFAULT '[]'::jsonb,
  p_timecode_in text DEFAULT NULL,
  p_timecode_out text DEFAULT NULL,
  p_frame_rate numeric DEFAULT 30
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
    tags,
    timecode_in,
    timecode_out,
    frame_rate
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
    COALESCE(p_tags, '[]'::jsonb),
    NULLIF(trim(p_timecode_in), ''),
    NULLIF(trim(p_timecode_out), ''),
    COALESCE(NULLIF(p_frame_rate, 0), 30)
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_replay_audit_event(text, uuid, text, integer, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_replay_audit_events(integer) TO authenticated;
