-- CloudCast Audio Mixer enterprise — audit, operator locks, show presets

CREATE TABLE IF NOT EXISTS public.audio_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid,
  event_type text NOT NULL,
  channel_index integer,
  scene_id text,
  label text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audio_audit_log_user_created_idx
  ON public.audio_audit_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audio_audit_log_session_idx
  ON public.audio_audit_log (session_id, created_at DESC)
  WHERE session_id IS NOT NULL;

ALTER TABLE public.audio_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audio_audit_log_select_own
  ON public.audio_audit_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY audio_audit_log_insert_own
  ON public.audio_audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.log_audio_audit_event(
  p_event_type text,
  p_session_id uuid DEFAULT NULL,
  p_channel_index integer DEFAULT NULL,
  p_scene_id text DEFAULT NULL,
  p_label text DEFAULT NULL,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS public.audio_audit_log
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.audio_audit_log;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_event_type IS NULL OR trim(p_event_type) = '' THEN
    RAISE EXCEPTION 'event_type is required';
  END IF;

  INSERT INTO public.audio_audit_log (
    user_id,
    session_id,
    event_type,
    channel_index,
    scene_id,
    label,
    meta
  )
  VALUES (
    v_user_id,
    p_session_id,
    trim(p_event_type),
    p_channel_index,
    NULLIF(trim(p_scene_id), ''),
    NULLIF(trim(p_label), ''),
    COALESCE(p_meta, '{}'::jsonb)
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_audio_audit_events(p_limit integer DEFAULT 100)
RETURNS SETOF public.audio_audit_log
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.audio_audit_log
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500));
$$;

CREATE TABLE IF NOT EXISTS public.audio_operator_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operator_key text NOT NULL,
  operator_label text,
  lock_scope text NOT NULL CHECK (lock_scope IN ('console', 'pgm', 'scene')),
  scene_id text,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '45 seconds'),
  CONSTRAINT audio_operator_locks_scene_check CHECK (
    (lock_scope = 'scene' AND scene_id IS NOT NULL)
    OR (lock_scope <> 'scene' AND scene_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS audio_operator_locks_session_scope_uidx
  ON public.audio_operator_locks (session_id, lock_scope, COALESCE(scene_id, ''));

CREATE INDEX IF NOT EXISTS audio_operator_locks_session_expires_idx
  ON public.audio_operator_locks (session_id, expires_at);

ALTER TABLE public.audio_operator_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY audio_operator_locks_select_session
  ON public.audio_operator_locks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY audio_operator_locks_insert_own
  ON public.audio_operator_locks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY audio_operator_locks_update_own
  ON public.audio_operator_locks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY audio_operator_locks_delete_own
  ON public.audio_operator_locks FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.cleanup_expired_audio_locks()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.audio_operator_locks WHERE expires_at < now();
$$;

CREATE OR REPLACE FUNCTION public.acquire_audio_operator_lock(
  p_session_id uuid,
  p_operator_key text,
  p_operator_label text DEFAULT NULL,
  p_lock_scope text DEFAULT 'console',
  p_scene_id text DEFAULT NULL,
  p_ttl_seconds integer DEFAULT 45
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing public.audio_operator_locks;
  v_row public.audio_operator_locks;
  v_ttl integer := GREATEST(15, LEAST(COALESCE(p_ttl_seconds, 45), 120));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'session_id is required';
  END IF;
  IF p_operator_key IS NULL OR trim(p_operator_key) = '' THEN
    RAISE EXCEPTION 'operator_key is required';
  END IF;
  IF p_lock_scope NOT IN ('console', 'pgm', 'scene') THEN
    RAISE EXCEPTION 'Invalid lock scope';
  END IF;
  IF p_lock_scope = 'scene' AND p_scene_id IS NULL THEN
    RAISE EXCEPTION 'scene_id required for scene lock';
  END IF;

  PERFORM public.cleanup_expired_audio_locks();

  SELECT * INTO v_existing
  FROM public.audio_operator_locks
  WHERE session_id = p_session_id
    AND lock_scope = p_lock_scope
    AND COALESCE(scene_id, '') = COALESCE(p_scene_id, '')
    AND expires_at > now()
  LIMIT 1;

  IF FOUND AND v_existing.operator_key <> trim(p_operator_key) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'locked', 'lock', to_jsonb(v_existing));
  END IF;

  IF FOUND THEN
    UPDATE public.audio_operator_locks
    SET
      operator_label = NULLIF(trim(p_operator_label), ''),
      acquired_at = now(),
      expires_at = now() + make_interval(secs => v_ttl)
    WHERE id = v_existing.id
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.audio_operator_locks (
      session_id, user_id, operator_key, operator_label, lock_scope, scene_id, expires_at
    )
    VALUES (
      p_session_id,
      v_user_id,
      trim(p_operator_key),
      NULLIF(trim(p_operator_label), ''),
      p_lock_scope,
      p_scene_id,
      now() + make_interval(secs => v_ttl)
    )
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object('ok', true, 'lock', to_jsonb(v_row));
END;
$$;

CREATE OR REPLACE FUNCTION public.renew_audio_operator_lock(
  p_session_id uuid,
  p_operator_key text,
  p_lock_scope text DEFAULT 'console',
  p_scene_id text DEFAULT NULL,
  p_ttl_seconds integer DEFAULT 45
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_ttl integer := GREATEST(15, LEAST(COALESCE(p_ttl_seconds, 45), 120));
BEGIN
  IF v_user_id IS NULL THEN RETURN false; END IF;

  UPDATE public.audio_operator_locks
  SET expires_at = now() + make_interval(secs => v_ttl)
  WHERE session_id = p_session_id
    AND operator_key = trim(p_operator_key)
    AND lock_scope = p_lock_scope
    AND COALESCE(scene_id, '') = COALESCE(p_scene_id, '')
    AND user_id = v_user_id
    AND expires_at > now();

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_audio_operator_lock(
  p_session_id uuid,
  p_operator_key text,
  p_lock_scope text DEFAULT NULL,
  p_scene_id text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_user_id IS NULL THEN RETURN 0; END IF;

  DELETE FROM public.audio_operator_locks
  WHERE session_id = p_session_id
    AND operator_key = trim(p_operator_key)
    AND user_id = v_user_id
    AND (p_lock_scope IS NULL OR lock_scope = p_lock_scope)
    AND (p_scene_id IS NULL OR scene_id = p_scene_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_audio_operator_locks(p_session_id uuid)
RETURNS SETOF public.audio_operator_locks
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.audio_operator_locks
  WHERE session_id = p_session_id
    AND user_id = auth.uid()
    AND expires_at > now()
  ORDER BY acquired_at DESC;
$$;

CREATE TABLE IF NOT EXISTS public.audio_show_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid,
  name text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audio_show_presets_name_len CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 120)
);

CREATE INDEX IF NOT EXISTS audio_show_presets_user_updated_idx
  ON public.audio_show_presets (user_id, updated_at DESC);

ALTER TABLE public.audio_show_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY audio_show_presets_select_own
  ON public.audio_show_presets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY audio_show_presets_insert_own
  ON public.audio_show_presets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY audio_show_presets_update_own
  ON public.audio_show_presets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY audio_show_presets_delete_own
  ON public.audio_show_presets FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.list_audio_show_presets(p_session_id uuid DEFAULT NULL)
RETURNS SETOF public.audio_show_presets
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.audio_show_presets
  WHERE user_id = auth.uid()
    AND (p_session_id IS NULL OR session_id IS NULL OR session_id = p_session_id)
  ORDER BY updated_at DESC
  LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION public.upsert_audio_show_preset(
  p_id uuid DEFAULT NULL,
  p_session_id uuid DEFAULT NULL,
  p_name text DEFAULT 'Show file',
  p_config jsonb DEFAULT '{}'::jsonb
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

  IF p_id IS NOT NULL THEN
    UPDATE public.audio_show_presets
    SET
      session_id = p_session_id,
      name = COALESCE(NULLIF(trim(p_name), ''), name),
      config = COALESCE(p_config, config),
      updated_at = now()
    WHERE id = p_id AND user_id = v_user_id
    RETURNING * INTO v_row;
    IF NOT FOUND THEN RAISE EXCEPTION 'Preset not found'; END IF;
    RETURN v_row;
  END IF;

  INSERT INTO public.audio_show_presets (user_id, session_id, name, config)
  VALUES (v_user_id, p_session_id, COALESCE(NULLIF(trim(p_name), ''), 'Show file'), COALESCE(p_config, '{}'::jsonb))
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_audio_show_preset(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM public.audio_show_presets WHERE id = p_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Preset not found'; END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audio_audit_event(text, uuid, integer, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_audio_audit_events(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_audio_operator_lock(uuid, text, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.renew_audio_operator_lock(uuid, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_audio_operator_lock(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_audio_operator_locks(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_audio_show_presets(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_audio_show_preset(uuid, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_audio_show_preset(uuid) TO authenticated;
