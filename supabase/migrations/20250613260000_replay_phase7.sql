-- CloudCast Replay phase 7 — show library, ops digest email, clip lifecycle

ALTER TABLE public.replay_rundown_templates
  ADD COLUMN IF NOT EXISTS is_library boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS library_category text;

CREATE INDEX IF NOT EXISTS replay_rundown_templates_library_idx
  ON public.replay_rundown_templates (user_id, is_library, library_category, updated_at DESC)
  WHERE is_library = true;

ALTER TABLE public.replay_clips
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.replay_clips
  DROP CONSTRAINT IF EXISTS replay_clips_lifecycle_status_check;

ALTER TABLE public.replay_clips
  ADD CONSTRAINT replay_clips_lifecycle_status_check
  CHECK (lifecycle_status IN ('active', 'archived'));

CREATE INDEX IF NOT EXISTS replay_clips_user_lifecycle_idx
  ON public.replay_clips (user_id, lifecycle_status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.replay_lifecycle_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  auto_archive_days integer,
  auto_delete_archived_days integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT replay_lifecycle_archive_days_check
    CHECK (auto_archive_days IS NULL OR auto_archive_days >= 7),
  CONSTRAINT replay_lifecycle_delete_days_check
    CHECK (auto_delete_archived_days IS NULL OR auto_delete_archived_days >= 30)
);

ALTER TABLE public.replay_lifecycle_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY replay_lifecycle_prefs_select_own
  ON public.replay_lifecycle_prefs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY replay_lifecycle_prefs_upsert_own
  ON public.replay_lifecycle_prefs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.replay_ops_digest_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  frequency text NOT NULL DEFAULT 'manual',
  last_sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT replay_ops_digest_frequency_check
    CHECK (frequency IN ('manual', 'daily', 'weekly'))
);

ALTER TABLE public.replay_ops_digest_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY replay_ops_digest_prefs_select_own
  ON public.replay_ops_digest_prefs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY replay_ops_digest_prefs_upsert_own
  ON public.replay_ops_digest_prefs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.promote_replay_rundown_to_library(
  p_id uuid,
  p_category text DEFAULT 'General'
)
RETURNS public.replay_rundown_templates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.replay_rundown_templates;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.replay_rundown_templates
  SET
    is_library = true,
    library_category = COALESCE(NULLIF(trim(p_category), ''), 'General'),
    session_id = NULL,
    updated_at = now()
  WHERE id = p_id AND user_id = v_user_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rundown template not found';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_replay_show_library(p_category text DEFAULT NULL)
RETURNS SETOF public.replay_rundown_templates
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.replay_rundown_templates
  WHERE user_id = auth.uid()
    AND is_library = true
    AND (p_category IS NULL OR library_category = trim(p_category))
  ORDER BY library_category, updated_at DESC
  LIMIT 100;
$$;

CREATE OR REPLACE FUNCTION public.get_replay_lifecycle_prefs()
RETURNS public.replay_lifecycle_prefs
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.replay_lifecycle_prefs
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.upsert_replay_lifecycle_prefs(
  p_auto_archive_days integer DEFAULT NULL,
  p_auto_delete_archived_days integer DEFAULT NULL
)
RETURNS public.replay_lifecycle_prefs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.replay_lifecycle_prefs;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.replay_lifecycle_prefs (
    user_id,
    auto_archive_days,
    auto_delete_archived_days,
    updated_at
  )
  VALUES (
    v_user_id,
    p_auto_archive_days,
    p_auto_delete_archived_days,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    auto_archive_days = EXCLUDED.auto_archive_days,
    auto_delete_archived_days = EXCLUDED.auto_delete_archived_days,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_replay_clip_lifecycle(
  p_id uuid,
  p_status text
)
RETURNS public.replay_clips
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.replay_clips;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_status NOT IN ('active', 'archived') THEN
    RAISE EXCEPTION 'Invalid lifecycle status';
  END IF;

  UPDATE public.replay_clips
  SET
    lifecycle_status = p_status,
    archived_at = CASE WHEN p_status = 'archived' THEN now() ELSE NULL END
  WHERE id = p_id AND user_id = v_user_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Clip not found';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_replay_lifecycle_policy()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_prefs public.replay_lifecycle_prefs;
  v_archived integer := 0;
  v_delete_candidates uuid[];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_prefs FROM public.replay_lifecycle_prefs WHERE user_id = v_user_id;

  IF v_prefs.auto_archive_days IS NOT NULL THEN
    UPDATE public.replay_clips
    SET lifecycle_status = 'archived', archived_at = now()
    WHERE user_id = v_user_id
      AND lifecycle_status = 'active'
      AND created_at < now() - make_interval(days => v_prefs.auto_archive_days);
    GET DIAGNOSTICS v_archived = ROW_COUNT;
  END IF;

  IF v_prefs.auto_delete_archived_days IS NOT NULL THEN
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_delete_candidates
    FROM public.replay_clips
    WHERE user_id = v_user_id
      AND lifecycle_status = 'archived'
      AND archived_at IS NOT NULL
      AND archived_at < now() - make_interval(days => v_prefs.auto_delete_archived_days);
  ELSE
    v_delete_candidates := ARRAY[]::uuid[];
  END IF;

  RETURN jsonb_build_object(
    'archived_count', v_archived,
    'delete_candidate_ids', to_jsonb(v_delete_candidates)
  );
END;
$$;

DROP FUNCTION IF EXISTS public.list_user_replay_clips();

CREATE OR REPLACE FUNCTION public.list_user_replay_clips(p_lifecycle_status text DEFAULT 'active')
RETURNS SETOF public.replay_clips
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.replay_clips
  WHERE user_id = auth.uid()
    AND (
      p_lifecycle_status IS NULL
      OR lifecycle_status = p_lifecycle_status
    )
  ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_replay_ops_digest_prefs()
RETURNS public.replay_ops_digest_prefs
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.replay_ops_digest_prefs
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.upsert_replay_ops_digest_prefs(
  p_enabled boolean DEFAULT false,
  p_frequency text DEFAULT 'manual'
)
RETURNS public.replay_ops_digest_prefs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.replay_ops_digest_prefs;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_frequency NOT IN ('manual', 'daily', 'weekly') THEN
    RAISE EXCEPTION 'Invalid digest frequency';
  END IF;

  INSERT INTO public.replay_ops_digest_prefs (user_id, enabled, frequency, updated_at)
  VALUES (v_user_id, COALESCE(p_enabled, false), p_frequency, now())
  ON CONFLICT (user_id) DO UPDATE
  SET
    enabled = EXCLUDED.enabled,
    frequency = EXCLUDED.frequency,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_replay_ops_digest()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_prefs public.replay_ops_digest_prefs;
  v_snapshot_count integer;
  v_audit_count integer;
  v_latest_snapshot public.replay_buffer_snapshots;
  v_recent_audit jsonb;
  v_payload jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_prefs FROM public.replay_ops_digest_prefs WHERE user_id = v_user_id;

  IF v_prefs.last_sent_at IS NOT NULL AND v_prefs.last_sent_at > now() - interval '1 hour' THEN
    RETURN jsonb_build_object('queued', false, 'reason', 'rate_limited');
  END IF;

  SELECT COUNT(*) INTO v_snapshot_count
  FROM public.replay_buffer_snapshots
  WHERE user_id = v_user_id
    AND captured_at > now() - interval '7 days';

  SELECT COUNT(*) INTO v_audit_count
  FROM public.replay_audit_log
  WHERE user_id = v_user_id
    AND created_at > now() - interval '7 days';

  SELECT * INTO v_latest_snapshot
  FROM public.replay_buffer_snapshots
  WHERE user_id = v_user_id
  ORDER BY captured_at DESC
  LIMIT 1;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_recent_audit
  FROM (
    SELECT event_type, label, created_at
    FROM public.replay_audit_log
    WHERE user_id = v_user_id
    ORDER BY created_at DESC
    LIMIT 8
  ) t;

  v_payload := jsonb_build_object(
    'snapshot_count_7d', v_snapshot_count,
    'audit_count_7d', v_audit_count,
    'latest_operator', v_latest_snapshot.operator_label,
    'latest_house_clock', v_latest_snapshot.house_clock_smpte,
    'latest_buffer_seconds', v_latest_snapshot.buffer_seconds,
    'latest_captured_at', v_latest_snapshot.captured_at,
    'recent_audit', v_recent_audit
  );

  PERFORM public.enqueue_transactional_email(v_user_id, 'replay_ops_digest', v_payload);

  INSERT INTO public.replay_ops_digest_prefs (user_id, enabled, frequency, last_sent_at, updated_at)
  VALUES (v_user_id, COALESCE(v_prefs.enabled, false), COALESCE(v_prefs.frequency, 'manual'), now(), now())
  ON CONFLICT (user_id) DO UPDATE
  SET last_sent_at = now(), updated_at = now();

  RETURN jsonb_build_object('queued', true, 'payload', v_payload);
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_replay_rundown_to_library(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_replay_show_library(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_replay_lifecycle_prefs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_replay_lifecycle_prefs(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_replay_clip_lifecycle(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_replay_lifecycle_policy() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_user_replay_clips(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_replay_ops_digest_prefs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_replay_ops_digest_prefs(boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_replay_ops_digest() TO authenticated;
