-- CloudCast Replay phase 3 — operator locks, clip search, export presets

CREATE TABLE IF NOT EXISTS public.replay_operator_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operator_key text NOT NULL,
  operator_label text,
  lock_scope text NOT NULL CHECK (lock_scope IN ('console', 'pgm', 'bank')),
  bank_index integer,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '45 seconds'),
  CONSTRAINT replay_operator_locks_bank_check CHECK (
    (lock_scope = 'bank' AND bank_index IS NOT NULL)
    OR (lock_scope <> 'bank' AND bank_index IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS replay_operator_locks_session_scope_uidx
  ON public.replay_operator_locks (session_id, lock_scope, COALESCE(bank_index, -1));

CREATE INDEX IF NOT EXISTS replay_operator_locks_session_expires_idx
  ON public.replay_operator_locks (session_id, expires_at);

ALTER TABLE public.replay_operator_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY replay_operator_locks_select_session
  ON public.replay_operator_locks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY replay_operator_locks_insert_own
  ON public.replay_operator_locks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY replay_operator_locks_update_own
  ON public.replay_operator_locks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY replay_operator_locks_delete_own
  ON public.replay_operator_locks FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.cleanup_expired_replay_locks()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.replay_operator_locks WHERE expires_at < now();
$$;

CREATE OR REPLACE FUNCTION public.acquire_replay_operator_lock(
  p_session_id uuid,
  p_operator_key text,
  p_operator_label text DEFAULT NULL,
  p_lock_scope text DEFAULT 'console',
  p_bank_index integer DEFAULT NULL,
  p_ttl_seconds integer DEFAULT 45
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing public.replay_operator_locks;
  v_row public.replay_operator_locks;
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
  IF p_lock_scope NOT IN ('console', 'pgm', 'bank') THEN
    RAISE EXCEPTION 'Invalid lock scope';
  END IF;
  IF p_lock_scope = 'bank' AND p_bank_index IS NULL THEN
    RAISE EXCEPTION 'bank_index required for bank lock';
  END IF;

  PERFORM public.cleanup_expired_replay_locks();

  SELECT * INTO v_existing
  FROM public.replay_operator_locks
  WHERE session_id = p_session_id
    AND lock_scope = p_lock_scope
    AND COALESCE(bank_index, -1) = COALESCE(p_bank_index, -1)
    AND expires_at > now()
  LIMIT 1;

  IF FOUND AND v_existing.operator_key <> trim(p_operator_key) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'locked',
      'lock', to_jsonb(v_existing)
    );
  END IF;

  IF FOUND THEN
    UPDATE public.replay_operator_locks
    SET
      operator_label = NULLIF(trim(p_operator_label), ''),
      acquired_at = now(),
      expires_at = now() + make_interval(secs => v_ttl)
    WHERE id = v_existing.id
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.replay_operator_locks (
      session_id,
      user_id,
      operator_key,
      operator_label,
      lock_scope,
      bank_index,
      expires_at
    )
    VALUES (
      p_session_id,
      v_user_id,
      trim(p_operator_key),
      NULLIF(trim(p_operator_label), ''),
      p_lock_scope,
      p_bank_index,
      now() + make_interval(secs => v_ttl)
    )
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object('ok', true, 'lock', to_jsonb(v_row));
END;
$$;

CREATE OR REPLACE FUNCTION public.renew_replay_operator_lock(
  p_session_id uuid,
  p_operator_key text,
  p_lock_scope text DEFAULT 'console',
  p_bank_index integer DEFAULT NULL,
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
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.replay_operator_locks
  SET expires_at = now() + make_interval(secs => v_ttl)
  WHERE session_id = p_session_id
    AND operator_key = trim(p_operator_key)
    AND lock_scope = p_lock_scope
    AND COALESCE(bank_index, -1) = COALESCE(p_bank_index, -1)
    AND user_id = v_user_id
    AND expires_at > now();

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_replay_operator_lock(
  p_session_id uuid,
  p_operator_key text,
  p_lock_scope text DEFAULT NULL,
  p_bank_index integer DEFAULT NULL
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
  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  DELETE FROM public.replay_operator_locks
  WHERE session_id = p_session_id
    AND operator_key = trim(p_operator_key)
    AND user_id = v_user_id
    AND (p_lock_scope IS NULL OR lock_scope = p_lock_scope)
    AND (p_bank_index IS NULL OR bank_index = p_bank_index);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_replay_operator_locks(p_session_id uuid)
RETURNS SETOF public.replay_operator_locks
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.replay_operator_locks
  WHERE session_id = p_session_id
    AND user_id = auth.uid()
    AND expires_at > now()
  ORDER BY acquired_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.search_replay_clips(
  p_query text DEFAULT NULL,
  p_tag text DEFAULT NULL,
  p_limit integer DEFAULT 50
)
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
      p_query IS NULL
      OR trim(p_query) = ''
      OR label ILIKE '%' || trim(p_query) || '%'
      OR file_name ILIKE '%' || trim(p_query) || '%'
      OR source_device_id ILIKE '%' || trim(p_query) || '%'
      OR timecode_in ILIKE '%' || trim(p_query) || '%'
      OR timecode_out ILIKE '%' || trim(p_query) || '%'
    )
    AND (
      p_tag IS NULL
      OR trim(p_tag) = ''
      OR tags @> jsonb_build_array(trim(p_tag))
    )
  ORDER BY created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
$$;

CREATE TABLE IF NOT EXISTS public.replay_export_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  playback_rate numeric NOT NULL DEFAULT 1 CHECK (playback_rate > 0),
  frame_accurate boolean NOT NULL DEFAULT false,
  auto_cloud_sync boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS replay_export_presets_user_idx
  ON public.replay_export_presets (user_id, updated_at DESC);

ALTER TABLE public.replay_export_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY replay_export_presets_select_own
  ON public.replay_export_presets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY replay_export_presets_insert_own
  ON public.replay_export_presets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY replay_export_presets_update_own
  ON public.replay_export_presets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY replay_export_presets_delete_own
  ON public.replay_export_presets FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.list_replay_export_presets()
RETURNS SETOF public.replay_export_presets
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.replay_export_presets
  WHERE user_id = auth.uid()
  ORDER BY is_default DESC, updated_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.upsert_replay_export_preset(
  p_id uuid DEFAULT NULL,
  p_name text DEFAULT 'Default',
  p_playback_rate numeric DEFAULT 1,
  p_frame_accurate boolean DEFAULT false,
  p_auto_cloud_sync boolean DEFAULT true,
  p_is_default boolean DEFAULT false
)
RETURNS public.replay_export_presets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.replay_export_presets;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_is_default THEN
    UPDATE public.replay_export_presets
    SET is_default = false, updated_at = now()
    WHERE user_id = v_user_id AND is_default;
  END IF;

  IF p_id IS NOT NULL THEN
    UPDATE public.replay_export_presets
    SET
      name = COALESCE(NULLIF(trim(p_name), ''), name),
      playback_rate = GREATEST(COALESCE(p_playback_rate, playback_rate), 0.1),
      frame_accurate = COALESCE(p_frame_accurate, frame_accurate),
      auto_cloud_sync = COALESCE(p_auto_cloud_sync, auto_cloud_sync),
      is_default = COALESCE(p_is_default, is_default),
      updated_at = now()
    WHERE id = p_id AND user_id = v_user_id
    RETURNING * INTO v_row;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Preset not found';
    END IF;
    RETURN v_row;
  END IF;

  INSERT INTO public.replay_export_presets (
    user_id,
    name,
    playback_rate,
    frame_accurate,
    auto_cloud_sync,
    is_default
  )
  VALUES (
    v_user_id,
    COALESCE(NULLIF(trim(p_name), ''), 'Preset'),
    GREATEST(COALESCE(p_playback_rate, 1), 0.1),
    COALESCE(p_frame_accurate, false),
    COALESCE(p_auto_cloud_sync, true),
    COALESCE(p_is_default, false)
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_replay_export_preset(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.replay_export_presets
  WHERE id = p_id AND user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.acquire_replay_operator_lock(uuid, text, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.renew_replay_operator_lock(uuid, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_replay_operator_lock(uuid, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_replay_operator_locks(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_replay_clips(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_replay_export_presets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_replay_export_preset(uuid, text, numeric, boolean, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_replay_export_preset(uuid) TO authenticated;
