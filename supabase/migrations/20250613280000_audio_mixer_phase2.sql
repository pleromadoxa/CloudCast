-- CloudCast Audio Mixer phase 2 — show share/library, console snapshots, ops digest

ALTER TABLE public.audio_show_presets
  ADD COLUMN IF NOT EXISTS is_library boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS library_category text,
  ADD COLUMN IF NOT EXISTS share_code text,
  ADD COLUMN IF NOT EXISTS shared_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS audio_show_presets_share_code_uidx
  ON public.audio_show_presets (share_code)
  WHERE share_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS audio_show_presets_library_idx
  ON public.audio_show_presets (user_id, is_library, library_category, updated_at DESC)
  WHERE is_library = true;

CREATE TABLE IF NOT EXISTS public.audio_console_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  operator_key text,
  operator_label text,
  master_volume numeric NOT NULL DEFAULT 0,
  master_muted boolean NOT NULL DEFAULT false,
  monitor_muted boolean NOT NULL DEFAULT false,
  console_enabled boolean NOT NULL DEFAULT true,
  active_scene text,
  selected_channel integer,
  live_input_count integer NOT NULL DEFAULT 0,
  muted_channel_count integer NOT NULL DEFAULT 0,
  bridge_connected boolean NOT NULL DEFAULT false,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audio_console_snapshots_session_idx
  ON public.audio_console_snapshots (session_id, captured_at DESC);

ALTER TABLE public.audio_console_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY audio_console_snapshots_select_own
  ON public.audio_console_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY audio_console_snapshots_insert_own
  ON public.audio_console_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.audio_ops_digest_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  frequency text NOT NULL DEFAULT 'manual',
  last_sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audio_ops_digest_frequency_check CHECK (frequency IN ('manual', 'daily', 'weekly'))
);

ALTER TABLE public.audio_ops_digest_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audio_ops_digest_prefs_all_own
  ON public.audio_ops_digest_prefs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.promote_audio_show_to_library(
  p_id uuid,
  p_category text DEFAULT 'General'
)
RETURNS public.audio_show_presets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.audio_show_presets;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  UPDATE public.audio_show_presets
  SET
    is_library = true,
    library_category = COALESCE(NULLIF(trim(p_category), ''), 'General'),
    session_id = NULL,
    updated_at = now()
  WHERE id = p_id AND user_id = v_user_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN RAISE EXCEPTION 'Show preset not found'; END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_audio_show_library(p_category text DEFAULT NULL)
RETURNS SETOF public.audio_show_presets
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.audio_show_presets
  WHERE user_id = auth.uid()
    AND is_library = true
    AND (p_category IS NULL OR library_category = trim(p_category))
  ORDER BY library_category, updated_at DESC
  LIMIT 100;
$$;

CREATE OR REPLACE FUNCTION public.publish_audio_show_share(p_id uuid)
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

  UPDATE public.audio_show_presets
  SET share_code = v_code, shared_at = now(), updated_at = now()
  WHERE id = p_id AND user_id = v_user_id
  RETURNING share_code INTO v_code;

  IF v_code IS NULL THEN RAISE EXCEPTION 'Show preset not found'; END IF;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.import_audio_show_share(p_share_code text)
RETURNS public.audio_show_presets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_source public.audio_show_presets;
  v_row public.audio_show_presets;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_share_code IS NULL OR trim(p_share_code) = '' THEN RAISE EXCEPTION 'Share code is required'; END IF;

  SELECT * INTO v_source
  FROM public.audio_show_presets
  WHERE share_code = upper(trim(p_share_code))
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'Share code not found'; END IF;

  INSERT INTO public.audio_show_presets (user_id, session_id, name, config)
  VALUES (v_user_id, NULL, v_source.name || ' (shared)', v_source.config)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_audio_console_snapshot(
  p_session_id uuid,
  p_operator_key text DEFAULT NULL,
  p_operator_label text DEFAULT NULL,
  p_master_volume numeric DEFAULT 0,
  p_master_muted boolean DEFAULT false,
  p_monitor_muted boolean DEFAULT false,
  p_console_enabled boolean DEFAULT true,
  p_active_scene text DEFAULT NULL,
  p_selected_channel integer DEFAULT NULL,
  p_live_input_count integer DEFAULT 0,
  p_muted_channel_count integer DEFAULT 0,
  p_bridge_connected boolean DEFAULT false
)
RETURNS public.audio_console_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.audio_console_snapshots;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_session_id IS NULL THEN RAISE EXCEPTION 'session_id is required'; END IF;

  INSERT INTO public.audio_console_snapshots (
    user_id, session_id, operator_key, operator_label,
    master_volume, master_muted, monitor_muted, console_enabled,
    active_scene, selected_channel, live_input_count, muted_channel_count, bridge_connected
  )
  VALUES (
    v_user_id, p_session_id,
    NULLIF(trim(p_operator_key), ''),
    NULLIF(trim(p_operator_label), ''),
    GREATEST(COALESCE(p_master_volume, 0), 0),
    COALESCE(p_master_muted, false),
    COALESCE(p_monitor_muted, false),
    COALESCE(p_console_enabled, true),
    NULLIF(trim(p_active_scene), ''),
    p_selected_channel,
    GREATEST(COALESCE(p_live_input_count, 0), 0),
    GREATEST(COALESCE(p_muted_channel_count, 0), 0),
    COALESCE(p_bridge_connected, false)
  )
  RETURNING * INTO v_row;

  DELETE FROM public.audio_console_snapshots
  WHERE user_id = v_user_id AND session_id = p_session_id
    AND id NOT IN (
      SELECT id FROM public.audio_console_snapshots
      WHERE user_id = v_user_id AND session_id = p_session_id
      ORDER BY captured_at DESC LIMIT 20
    );

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_latest_audio_console_snapshot(p_session_id uuid)
RETURNS public.audio_console_snapshots
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.audio_console_snapshots
  WHERE user_id = auth.uid() AND session_id = p_session_id
  ORDER BY captured_at DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_audio_ops_digest_prefs()
RETURNS public.audio_ops_digest_prefs
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.audio_ops_digest_prefs WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.upsert_audio_ops_digest_prefs(
  p_enabled boolean DEFAULT false,
  p_frequency text DEFAULT 'manual'
)
RETURNS public.audio_ops_digest_prefs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.audio_ops_digest_prefs;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_frequency NOT IN ('manual', 'daily', 'weekly') THEN RAISE EXCEPTION 'Invalid frequency'; END IF;

  INSERT INTO public.audio_ops_digest_prefs (user_id, enabled, frequency, updated_at)
  VALUES (v_user_id, COALESCE(p_enabled, false), p_frequency, now())
  ON CONFLICT (user_id) DO UPDATE
  SET enabled = EXCLUDED.enabled, frequency = EXCLUDED.frequency, updated_at = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_audio_ops_digest()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_prefs public.audio_ops_digest_prefs;
  v_snapshot_count integer;
  v_audit_count integer;
  v_latest public.audio_console_snapshots;
  v_recent_audit jsonb;
  v_payload jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_prefs FROM public.audio_ops_digest_prefs WHERE user_id = v_user_id;

  IF v_prefs.last_sent_at IS NOT NULL AND v_prefs.last_sent_at > now() - interval '1 hour' THEN
    RETURN jsonb_build_object('queued', false, 'reason', 'rate_limited');
  END IF;

  SELECT COUNT(*) INTO v_snapshot_count
  FROM public.audio_console_snapshots
  WHERE user_id = v_user_id AND captured_at > now() - interval '7 days';

  SELECT COUNT(*) INTO v_audit_count
  FROM public.audio_audit_log
  WHERE user_id = v_user_id AND created_at > now() - interval '7 days';

  SELECT * INTO v_latest
  FROM public.audio_console_snapshots
  WHERE user_id = v_user_id
  ORDER BY captured_at DESC LIMIT 1;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_recent_audit
  FROM (
    SELECT event_type, label, scene_id, created_at
    FROM public.audio_audit_log
    WHERE user_id = v_user_id
    ORDER BY created_at DESC LIMIT 8
  ) t;

  v_payload := jsonb_build_object(
    'snapshot_count_7d', v_snapshot_count,
    'audit_count_7d', v_audit_count,
    'latest_operator', v_latest.operator_label,
    'latest_master_volume', v_latest.master_volume,
    'latest_scene', v_latest.active_scene,
    'latest_captured_at', v_latest.captured_at,
    'recent_audit', v_recent_audit
  );

  PERFORM public.enqueue_transactional_email(v_user_id, 'audio_ops_digest', v_payload);

  INSERT INTO public.audio_ops_digest_prefs (user_id, enabled, frequency, last_sent_at, updated_at)
  VALUES (v_user_id, COALESCE(v_prefs.enabled, false), COALESCE(v_prefs.frequency, 'manual'), now(), now())
  ON CONFLICT (user_id) DO UPDATE SET last_sent_at = now(), updated_at = now();

  RETURN jsonb_build_object('queued', true, 'payload', v_payload);
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_audio_show_to_library(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_audio_show_library(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_audio_show_share(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_audio_show_share(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_audio_console_snapshot(uuid, text, text, numeric, boolean, boolean, boolean, text, integer, integer, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_latest_audio_console_snapshot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_audio_ops_digest_prefs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_audio_ops_digest_prefs(boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_audio_ops_digest() TO authenticated;
