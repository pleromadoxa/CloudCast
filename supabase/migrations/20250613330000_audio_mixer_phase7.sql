-- CloudCast Audio Mixer phase 7 — auto lifecycle, compliance export presets

ALTER TABLE public.audio_lifecycle_prefs
  ADD COLUMN IF NOT EXISTS auto_apply_on_open boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_applied_at timestamptz;

DROP FUNCTION IF EXISTS public.upsert_audio_lifecycle_prefs(integer, integer);

CREATE TABLE IF NOT EXISTS public.audio_compliance_export_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  include_audit boolean NOT NULL DEFAULT true,
  include_channels boolean NOT NULL DEFAULT true,
  include_scenes boolean NOT NULL DEFAULT true,
  include_rundown boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audio_compliance_export_name_len CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 80)
);

CREATE INDEX IF NOT EXISTS audio_compliance_export_user_idx
  ON public.audio_compliance_export_presets (user_id, updated_at DESC);

ALTER TABLE public.audio_compliance_export_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY audio_compliance_export_select_own
  ON public.audio_compliance_export_presets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY audio_compliance_export_insert_own
  ON public.audio_compliance_export_presets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY audio_compliance_export_update_own
  ON public.audio_compliance_export_presets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY audio_compliance_export_delete_own
  ON public.audio_compliance_export_presets FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.upsert_audio_lifecycle_prefs(
  p_prune_snapshot_days integer DEFAULT NULL,
  p_prune_backup_days integer DEFAULT NULL,
  p_auto_apply_on_open boolean DEFAULT NULL
)
RETURNS public.audio_lifecycle_prefs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.audio_lifecycle_prefs;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  INSERT INTO public.audio_lifecycle_prefs (
    user_id, prune_snapshot_days, prune_backup_days, auto_apply_on_open, updated_at
  )
  VALUES (
    v_user_id,
    p_prune_snapshot_days,
    p_prune_backup_days,
    COALESCE(p_auto_apply_on_open, false),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    prune_snapshot_days = COALESCE(p_prune_snapshot_days, audio_lifecycle_prefs.prune_snapshot_days),
    prune_backup_days = COALESCE(p_prune_backup_days, audio_lifecycle_prefs.prune_backup_days),
    auto_apply_on_open = COALESCE(p_auto_apply_on_open, audio_lifecycle_prefs.auto_apply_on_open),
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.maybe_apply_audio_lifecycle_policy()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_prefs public.audio_lifecycle_prefs;
  v_pruned_snapshots integer := 0;
  v_pruned_backups integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_prefs FROM public.audio_lifecycle_prefs WHERE user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'no_prefs');
  END IF;

  IF NOT v_prefs.auto_apply_on_open THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'disabled');
  END IF;

  IF v_prefs.prune_snapshot_days IS NULL AND v_prefs.prune_backup_days IS NULL THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'no_policy');
  END IF;

  IF v_prefs.last_applied_at IS NOT NULL AND v_prefs.last_applied_at > now() - interval '24 hours' THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'rate_limited');
  END IF;

  IF v_prefs.prune_snapshot_days IS NOT NULL THEN
    DELETE FROM public.audio_console_snapshots
    WHERE user_id = v_user_id
      AND captured_at < now() - make_interval(days => v_prefs.prune_snapshot_days);
    GET DIAGNOSTICS v_pruned_snapshots = ROW_COUNT;
  END IF;

  IF v_prefs.prune_backup_days IS NOT NULL THEN
    DELETE FROM public.audio_scene_backups
    WHERE user_id = v_user_id
      AND updated_at < now() - make_interval(days => v_prefs.prune_backup_days);
    GET DIAGNOSTICS v_pruned_backups = ROW_COUNT;
  END IF;

  UPDATE public.audio_lifecycle_prefs
  SET last_applied_at = now(), updated_at = now()
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'applied', true,
    'pruned_snapshot_count', v_pruned_snapshots,
    'pruned_backup_count', v_pruned_backups
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_audio_compliance_export_presets()
RETURNS SETOF public.audio_compliance_export_presets
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT *
  FROM public.audio_compliance_export_presets
  WHERE user_id = auth.uid()
  ORDER BY is_default DESC, updated_at DESC
  LIMIT 20;
$$;

CREATE OR REPLACE FUNCTION public.upsert_audio_compliance_export_preset(
  p_id uuid DEFAULT NULL,
  p_name text DEFAULT 'Compliance bundle',
  p_include_audit boolean DEFAULT true,
  p_include_channels boolean DEFAULT true,
  p_include_scenes boolean DEFAULT true,
  p_include_rundown boolean DEFAULT false,
  p_is_default boolean DEFAULT false
)
RETURNS public.audio_compliance_export_presets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.audio_compliance_export_presets;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF p_is_default THEN
    UPDATE public.audio_compliance_export_presets
    SET is_default = false, updated_at = now()
    WHERE user_id = v_user_id AND is_default;
  END IF;

  IF p_id IS NOT NULL THEN
    UPDATE public.audio_compliance_export_presets
    SET
      name = COALESCE(NULLIF(trim(p_name), ''), name),
      include_audit = COALESCE(p_include_audit, include_audit),
      include_channels = COALESCE(p_include_channels, include_channels),
      include_scenes = COALESCE(p_include_scenes, include_scenes),
      include_rundown = COALESCE(p_include_rundown, include_rundown),
      is_default = COALESCE(p_is_default, is_default),
      updated_at = now()
    WHERE id = p_id AND user_id = v_user_id
    RETURNING * INTO v_row;

    IF NOT FOUND THEN RAISE EXCEPTION 'Preset not found'; END IF;
    RETURN v_row;
  END IF;

  INSERT INTO public.audio_compliance_export_presets (
    user_id, name, include_audit, include_channels, include_scenes, include_rundown, is_default
  )
  VALUES (
    v_user_id,
    COALESCE(NULLIF(trim(p_name), ''), 'Compliance bundle'),
    COALESCE(p_include_audit, true),
    COALESCE(p_include_channels, true),
    COALESCE(p_include_scenes, true),
    COALESCE(p_include_rundown, false),
    COALESCE(p_is_default, false)
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_audio_compliance_export_preset(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM public.audio_compliance_export_presets WHERE id = p_id AND user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_audio_lifecycle_prefs(integer, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.maybe_apply_audio_lifecycle_policy() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_audio_compliance_export_presets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_audio_compliance_export_preset(uuid, text, boolean, boolean, boolean, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_audio_compliance_export_preset(uuid) TO authenticated;
