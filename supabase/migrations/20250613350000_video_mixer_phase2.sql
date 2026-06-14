-- CloudCast Video Mixer phase 2 — program preset share/library, PGM snapshots, ops digest

ALTER TABLE public.program_presets
  ADD COLUMN IF NOT EXISTS is_library boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS library_category text,
  ADD COLUMN IF NOT EXISTS share_code text,
  ADD COLUMN IF NOT EXISTS shared_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS program_presets_share_code_uidx
  ON public.program_presets (share_code)
  WHERE share_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS program_presets_library_idx
  ON public.program_presets (user_id, is_library, library_category, updated_at DESC)
  WHERE is_library = true;

CREATE TABLE IF NOT EXISTS public.video_program_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  operator_key text,
  operator_label text,
  pst_device_id text,
  pst_device_label text,
  pgm_device_id text,
  pgm_device_label text,
  is_on_air boolean NOT NULL DEFAULT false,
  is_recording boolean NOT NULL DEFAULT false,
  transition_type text,
  output_mode text,
  live_input_count integer NOT NULL DEFAULT 0,
  replay_on_pgm boolean NOT NULL DEFAULT false,
  replay_label text,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS video_program_snapshots_session_idx
  ON public.video_program_snapshots (session_id, captured_at DESC);

ALTER TABLE public.video_program_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY video_program_snapshots_select_own
  ON public.video_program_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY video_program_snapshots_insert_own
  ON public.video_program_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.video_ops_digest_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  frequency text NOT NULL DEFAULT 'manual',
  last_sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_ops_digest_frequency_check CHECK (frequency IN ('manual', 'daily', 'weekly'))
);

ALTER TABLE public.video_ops_digest_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY video_ops_digest_prefs_all_own
  ON public.video_ops_digest_prefs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.promote_program_preset_to_library(
  p_id uuid,
  p_category text DEFAULT 'General'
)
RETURNS public.program_presets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.program_presets;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  UPDATE public.program_presets
  SET
    is_library = true,
    library_category = COALESCE(NULLIF(trim(p_category), ''), 'General'),
    updated_at = now()
  WHERE id = p_id AND user_id = v_user_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN RAISE EXCEPTION 'Program preset not found'; END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_program_preset_library(p_category text DEFAULT NULL)
RETURNS SETOF public.program_presets
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.program_presets
  WHERE user_id = auth.uid()
    AND is_library = true
    AND (p_category IS NULL OR library_category = trim(p_category))
  ORDER BY library_category, updated_at DESC
  LIMIT 100;
$$;

CREATE OR REPLACE FUNCTION public.publish_program_preset_share(p_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_code text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  UPDATE public.program_presets
  SET share_code = v_code, shared_at = now(), updated_at = now()
  WHERE id = p_id AND user_id = v_user_id
  RETURNING share_code INTO v_code;

  IF v_code IS NULL THEN RAISE EXCEPTION 'Program preset not found'; END IF;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.import_program_preset_share(p_share_code text)
RETURNS public.program_presets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_source public.program_presets;
  v_row public.program_presets;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_share_code IS NULL OR trim(p_share_code) = '' THEN RAISE EXCEPTION 'Share code is required'; END IF;

  SELECT * INTO v_source
  FROM public.program_presets
  WHERE share_code = upper(trim(p_share_code))
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'Share code not found'; END IF;

  INSERT INTO public.program_presets (user_id, name, description, config)
  VALUES (v_user_id, v_source.name || ' (shared)', v_source.description, v_source.config)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_video_program_snapshot(
  p_session_id uuid,
  p_operator_key text DEFAULT NULL,
  p_operator_label text DEFAULT NULL,
  p_pst_device_id text DEFAULT NULL,
  p_pst_device_label text DEFAULT NULL,
  p_pgm_device_id text DEFAULT NULL,
  p_pgm_device_label text DEFAULT NULL,
  p_is_on_air boolean DEFAULT false,
  p_is_recording boolean DEFAULT false,
  p_transition_type text DEFAULT NULL,
  p_output_mode text DEFAULT NULL,
  p_live_input_count integer DEFAULT 0,
  p_replay_on_pgm boolean DEFAULT false,
  p_replay_label text DEFAULT NULL
)
RETURNS public.video_program_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.video_program_snapshots;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_session_id IS NULL THEN RAISE EXCEPTION 'session_id is required'; END IF;

  INSERT INTO public.video_program_snapshots (
    user_id, session_id, operator_key, operator_label,
    pst_device_id, pst_device_label, pgm_device_id, pgm_device_label,
    is_on_air, is_recording, transition_type, output_mode,
    live_input_count, replay_on_pgm, replay_label
  )
  VALUES (
    v_user_id, p_session_id,
    NULLIF(trim(p_operator_key), ''),
    NULLIF(trim(p_operator_label), ''),
    NULLIF(trim(p_pst_device_id), ''),
    NULLIF(trim(p_pst_device_label), ''),
    NULLIF(trim(p_pgm_device_id), ''),
    NULLIF(trim(p_pgm_device_label), ''),
    COALESCE(p_is_on_air, false),
    COALESCE(p_is_recording, false),
    NULLIF(trim(p_transition_type), ''),
    NULLIF(trim(p_output_mode), ''),
    GREATEST(COALESCE(p_live_input_count, 0), 0),
    COALESCE(p_replay_on_pgm, false),
    NULLIF(trim(p_replay_label), '')
  )
  RETURNING * INTO v_row;

  DELETE FROM public.video_program_snapshots
  WHERE user_id = v_user_id AND session_id = p_session_id
    AND id NOT IN (
      SELECT id FROM public.video_program_snapshots
      WHERE user_id = v_user_id AND session_id = p_session_id
      ORDER BY captured_at DESC LIMIT 20
    );

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_latest_video_program_snapshot(p_session_id uuid)
RETURNS public.video_program_snapshots
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.video_program_snapshots
  WHERE user_id = auth.uid() AND session_id = p_session_id
  ORDER BY captured_at DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_video_ops_digest_prefs()
RETURNS public.video_ops_digest_prefs
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.video_ops_digest_prefs WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.upsert_video_ops_digest_prefs(
  p_enabled boolean DEFAULT false,
  p_frequency text DEFAULT 'manual'
)
RETURNS public.video_ops_digest_prefs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.video_ops_digest_prefs;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_frequency NOT IN ('manual', 'daily', 'weekly') THEN RAISE EXCEPTION 'Invalid frequency'; END IF;

  INSERT INTO public.video_ops_digest_prefs (user_id, enabled, frequency, updated_at)
  VALUES (v_user_id, COALESCE(p_enabled, false), p_frequency, now())
  ON CONFLICT (user_id) DO UPDATE
  SET enabled = EXCLUDED.enabled, frequency = EXCLUDED.frequency, updated_at = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_video_ops_digest()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_prefs public.video_ops_digest_prefs;
  v_snapshot_count integer;
  v_audit_count integer;
  v_latest public.video_program_snapshots;
  v_recent_audit jsonb;
  v_payload jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_prefs FROM public.video_ops_digest_prefs WHERE user_id = v_user_id;

  IF v_prefs.last_sent_at IS NOT NULL AND v_prefs.last_sent_at > now() - interval '1 hour' THEN
    RETURN jsonb_build_object('queued', false, 'reason', 'rate_limited');
  END IF;

  SELECT COUNT(*) INTO v_snapshot_count
  FROM public.video_program_snapshots
  WHERE user_id = v_user_id AND captured_at > now() - interval '7 days';

  SELECT COUNT(*) INTO v_audit_count
  FROM public.video_audit_log
  WHERE user_id = v_user_id AND created_at > now() - interval '7 days';

  SELECT * INTO v_latest
  FROM public.video_program_snapshots
  WHERE user_id = v_user_id
  ORDER BY captured_at DESC LIMIT 1;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_recent_audit
  FROM (
    SELECT event_type, label, device_id, created_at
    FROM public.video_audit_log
    WHERE user_id = v_user_id
    ORDER BY created_at DESC LIMIT 8
  ) t;

  v_payload := jsonb_build_object(
    'snapshot_count_7d', v_snapshot_count,
    'audit_count_7d', v_audit_count,
    'latest_operator', v_latest.operator_label,
    'latest_pst', v_latest.pst_device_label,
    'latest_pgm', v_latest.pgm_device_label,
    'latest_on_air', v_latest.is_on_air,
    'latest_captured_at', v_latest.captured_at,
    'recent_audit', v_recent_audit
  );

  PERFORM public.enqueue_transactional_email(v_user_id, 'video_ops_digest', v_payload);

  INSERT INTO public.video_ops_digest_prefs (user_id, enabled, frequency, last_sent_at, updated_at)
  VALUES (v_user_id, COALESCE(v_prefs.enabled, false), COALESCE(v_prefs.frequency, 'manual'), now(), now())
  ON CONFLICT (user_id) DO UPDATE SET last_sent_at = now(), updated_at = now();

  RETURN jsonb_build_object('queued', true, 'payload', v_payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.maybe_send_scheduled_video_ops_digest()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_prefs public.video_ops_digest_prefs;
  v_due boolean := false;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_prefs FROM public.video_ops_digest_prefs WHERE user_id = v_user_id;

  IF NOT FOUND OR NOT v_prefs.enabled OR v_prefs.frequency = 'manual' THEN
    RETURN jsonb_build_object('queued', false, 'reason', 'not_scheduled');
  END IF;

  IF v_prefs.frequency = 'daily' THEN
    v_due := v_prefs.last_sent_at IS NULL OR v_prefs.last_sent_at < now() - interval '23 hours';
  ELSIF v_prefs.frequency = 'weekly' THEN
    v_due := v_prefs.last_sent_at IS NULL OR v_prefs.last_sent_at < now() - interval '6 days 23 hours';
  END IF;

  IF NOT v_due THEN
    RETURN jsonb_build_object('queued', false, 'reason', 'not_due');
  END IF;

  v_result := public.enqueue_video_ops_digest();
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_program_preset_to_library(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_program_preset_library(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_program_preset_share(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_program_preset_share(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_video_program_snapshot(uuid, text, text, text, text, text, text, boolean, boolean, text, text, integer, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_latest_video_program_snapshot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_video_ops_digest_prefs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_video_ops_digest_prefs(boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_video_ops_digest() TO authenticated;
GRANT EXECUTE ON FUNCTION public.maybe_send_scheduled_video_ops_digest() TO authenticated;
