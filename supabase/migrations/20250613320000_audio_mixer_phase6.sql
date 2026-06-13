-- CloudCast Audio Mixer phase 6 — console metadata lifecycle

CREATE TABLE IF NOT EXISTS public.audio_lifecycle_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  prune_snapshot_days integer,
  prune_backup_days integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audio_lifecycle_snapshot_days_check
    CHECK (prune_snapshot_days IS NULL OR prune_snapshot_days >= 7),
  CONSTRAINT audio_lifecycle_backup_days_check
    CHECK (prune_backup_days IS NULL OR prune_backup_days >= 7)
);

ALTER TABLE public.audio_lifecycle_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audio_lifecycle_prefs_all_own
  ON public.audio_lifecycle_prefs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.get_audio_lifecycle_prefs()
RETURNS public.audio_lifecycle_prefs
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.audio_lifecycle_prefs WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.upsert_audio_lifecycle_prefs(
  p_prune_snapshot_days integer DEFAULT NULL,
  p_prune_backup_days integer DEFAULT NULL
)
RETURNS public.audio_lifecycle_prefs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.audio_lifecycle_prefs;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  INSERT INTO public.audio_lifecycle_prefs (user_id, prune_snapshot_days, prune_backup_days, updated_at)
  VALUES (v_user_id, p_prune_snapshot_days, p_prune_backup_days, now())
  ON CONFLICT (user_id) DO UPDATE SET
    prune_snapshot_days = EXCLUDED.prune_snapshot_days,
    prune_backup_days = EXCLUDED.prune_backup_days,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_audio_lifecycle_policy()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_prefs public.audio_lifecycle_prefs;
  v_pruned_snapshots integer := 0;
  v_pruned_backups integer := 0;
  v_stale_backup_ids uuid[];
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_prefs FROM public.audio_lifecycle_prefs WHERE user_id = v_user_id;

  IF v_prefs.prune_snapshot_days IS NOT NULL THEN
    DELETE FROM public.audio_console_snapshots
    WHERE user_id = v_user_id
      AND captured_at < now() - make_interval(days => v_prefs.prune_snapshot_days);
    GET DIAGNOSTICS v_pruned_snapshots = ROW_COUNT;
  END IF;

  IF v_prefs.prune_backup_days IS NOT NULL THEN
    WITH stale AS (
      SELECT id
      FROM public.audio_scene_backups
      WHERE user_id = v_user_id
        AND updated_at < now() - make_interval(days => v_prefs.prune_backup_days)
    )
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_stale_backup_ids
    FROM stale;

    DELETE FROM public.audio_scene_backups
    WHERE id = ANY(v_stale_backup_ids);
    GET DIAGNOSTICS v_pruned_backups = ROW_COUNT;
  ELSE
    v_stale_backup_ids := ARRAY[]::uuid[];
  END IF;

  RETURN jsonb_build_object(
    'pruned_snapshot_count', v_pruned_snapshots,
    'pruned_backup_count', v_pruned_backups,
    'stale_backup_ids', to_jsonb(v_stale_backup_ids)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_audio_lifecycle_prefs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_audio_lifecycle_prefs(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_audio_lifecycle_policy() TO authenticated;
