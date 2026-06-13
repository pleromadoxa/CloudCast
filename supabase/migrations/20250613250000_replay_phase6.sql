-- CloudCast Replay phase 6 — rundown sharing, buffer snapshots, quota email hook

ALTER TABLE public.replay_rundown_templates
  ADD COLUMN IF NOT EXISTS share_code text,
  ADD COLUMN IF NOT EXISTS shared_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS replay_rundown_templates_share_code_uidx
  ON public.replay_rundown_templates (share_code)
  WHERE share_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.replay_buffer_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  operator_key text,
  operator_label text,
  source_kind text,
  buffer_seconds numeric NOT NULL DEFAULT 0,
  chunk_count integer NOT NULL DEFAULT 0,
  mark_in_sec numeric,
  mark_out_sec numeric,
  mark_timecode_in text,
  mark_timecode_out text,
  house_clock_smpte text,
  is_recording boolean NOT NULL DEFAULT false,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS replay_buffer_snapshots_session_idx
  ON public.replay_buffer_snapshots (session_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS replay_buffer_snapshots_user_session_idx
  ON public.replay_buffer_snapshots (user_id, session_id, captured_at DESC);

ALTER TABLE public.replay_buffer_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY replay_buffer_snapshots_select_own
  ON public.replay_buffer_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY replay_buffer_snapshots_insert_own
  ON public.replay_buffer_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.publish_replay_rundown_share(p_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_code text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  UPDATE public.replay_rundown_templates
  SET share_code = v_code, shared_at = now(), updated_at = now()
  WHERE id = p_id AND user_id = v_user_id
  RETURNING share_code INTO v_code;

  IF v_code IS NULL THEN
    RAISE EXCEPTION 'Rundown template not found';
  END IF;

  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.import_replay_rundown_share(p_share_code text)
RETURNS public.replay_rundown_templates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_source public.replay_rundown_templates;
  v_row public.replay_rundown_templates;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_share_code IS NULL OR trim(p_share_code) = '' THEN
    RAISE EXCEPTION 'Share code is required';
  END IF;

  SELECT * INTO v_source
  FROM public.replay_rundown_templates
  WHERE share_code = upper(trim(p_share_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Share code not found or expired';
  END IF;

  INSERT INTO public.replay_rundown_templates (
    user_id,
    session_id,
    name,
    playback_rate,
    items
  )
  VALUES (
    v_user_id,
    NULL,
    v_source.name || ' (shared)',
    v_source.playback_rate,
    v_source.items
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_replay_buffer_snapshot(
  p_session_id uuid,
  p_operator_key text DEFAULT NULL,
  p_operator_label text DEFAULT NULL,
  p_source_kind text DEFAULT NULL,
  p_buffer_seconds numeric DEFAULT 0,
  p_chunk_count integer DEFAULT 0,
  p_mark_in_sec numeric DEFAULT NULL,
  p_mark_out_sec numeric DEFAULT NULL,
  p_mark_timecode_in text DEFAULT NULL,
  p_mark_timecode_out text DEFAULT NULL,
  p_house_clock_smpte text DEFAULT NULL,
  p_is_recording boolean DEFAULT false
)
RETURNS public.replay_buffer_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.replay_buffer_snapshots;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'session_id is required';
  END IF;

  INSERT INTO public.replay_buffer_snapshots (
    user_id,
    session_id,
    operator_key,
    operator_label,
    source_kind,
    buffer_seconds,
    chunk_count,
    mark_in_sec,
    mark_out_sec,
    mark_timecode_in,
    mark_timecode_out,
    house_clock_smpte,
    is_recording
  )
  VALUES (
    v_user_id,
    p_session_id,
    NULLIF(trim(p_operator_key), ''),
    NULLIF(trim(p_operator_label), ''),
    NULLIF(trim(p_source_kind), ''),
    GREATEST(COALESCE(p_buffer_seconds, 0), 0),
    GREATEST(COALESCE(p_chunk_count, 0), 0),
    p_mark_in_sec,
    p_mark_out_sec,
    NULLIF(trim(p_mark_timecode_in), ''),
    NULLIF(trim(p_mark_timecode_out), ''),
    NULLIF(trim(p_house_clock_smpte), ''),
    COALESCE(p_is_recording, false)
  )
  RETURNING * INTO v_row;

  DELETE FROM public.replay_buffer_snapshots
  WHERE user_id = v_user_id
    AND session_id = p_session_id
    AND id NOT IN (
      SELECT id FROM public.replay_buffer_snapshots
      WHERE user_id = v_user_id AND session_id = p_session_id
      ORDER BY captured_at DESC
      LIMIT 20
    );

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_latest_replay_buffer_snapshot(p_session_id uuid)
RETURNS public.replay_buffer_snapshots
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.replay_buffer_snapshots
  WHERE user_id = auth.uid()
    AND session_id = p_session_id
  ORDER BY captured_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.check_my_storage_email_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  PERFORM public.check_storage_email_alerts(auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_replay_rundown_share(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_replay_rundown_share(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_replay_buffer_snapshot(uuid, text, text, text, numeric, integer, numeric, numeric, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_latest_replay_buffer_snapshot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_my_storage_email_alerts() TO authenticated;
