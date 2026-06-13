-- CloudCast Audio Mixer phase 5 — rundown library + cloud scene backups

ALTER TABLE public.audio_scene_rundown_templates
  ADD COLUMN IF NOT EXISTS is_library boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS library_category text;

CREATE INDEX IF NOT EXISTS audio_scene_rundown_library_idx
  ON public.audio_scene_rundown_templates (user_id, is_library, library_category, updated_at DESC)
  WHERE is_library = true;

CREATE TABLE IF NOT EXISTS public.audio_scene_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid,
  scene_id text NOT NULL CHECK (scene_id IN ('A', 'B', 'C', 'D')),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audio_scene_backups_scene_len CHECK (char_length(scene_id) = 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS audio_scene_backups_user_scene_uidx
  ON public.audio_scene_backups (user_id, scene_id);

CREATE INDEX IF NOT EXISTS audio_scene_backups_user_updated_idx
  ON public.audio_scene_backups (user_id, updated_at DESC);

ALTER TABLE public.audio_scene_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY audio_scene_backups_select_own
  ON public.audio_scene_backups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY audio_scene_backups_insert_own
  ON public.audio_scene_backups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY audio_scene_backups_update_own
  ON public.audio_scene_backups FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY audio_scene_backups_delete_own
  ON public.audio_scene_backups FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.promote_audio_scene_rundown_to_library(
  p_id uuid,
  p_category text DEFAULT 'General'
)
RETURNS public.audio_scene_rundown_templates
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.audio_scene_rundown_templates;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  UPDATE public.audio_scene_rundown_templates
  SET
    is_library = true,
    library_category = COALESCE(NULLIF(trim(p_category), ''), 'General'),
    session_id = NULL,
    updated_at = now()
  WHERE id = p_id AND user_id = v_user_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN RAISE EXCEPTION 'Rundown template not found'; END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_audio_scene_rundown_library(p_category text DEFAULT NULL)
RETURNS SETOF public.audio_scene_rundown_templates
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT *
  FROM public.audio_scene_rundown_templates
  WHERE user_id = auth.uid()
    AND is_library = true
    AND (p_category IS NULL OR library_category = trim(p_category))
  ORDER BY library_category, updated_at DESC
  LIMIT 100;
$$;

CREATE OR REPLACE FUNCTION public.upsert_audio_scene_backup(
  p_session_id uuid DEFAULT NULL,
  p_scene_id text DEFAULT 'A',
  p_snapshot jsonb DEFAULT '{}'::jsonb
)
RETURNS public.audio_scene_backups
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_scene text := upper(trim(p_scene_id));
  v_row public.audio_scene_backups;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_scene NOT IN ('A', 'B', 'C', 'D') THEN RAISE EXCEPTION 'Invalid scene id'; END IF;

  INSERT INTO public.audio_scene_backups (user_id, session_id, scene_id, snapshot, updated_at)
  VALUES (v_user_id, p_session_id, v_scene, COALESCE(p_snapshot, '{}'::jsonb), now())
  ON CONFLICT (user_id, scene_id)
  DO UPDATE SET
    session_id = EXCLUDED.session_id,
    snapshot = EXCLUDED.snapshot,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_audio_scene_backups(p_session_id uuid DEFAULT NULL)
RETURNS SETOF public.audio_scene_backups
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT *
  FROM public.audio_scene_backups
  WHERE user_id = auth.uid()
    AND (
      p_session_id IS NULL
      OR session_id IS NULL
      OR session_id = p_session_id
    )
  ORDER BY scene_id ASC, updated_at DESC
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION public.promote_audio_scene_rundown_to_library(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_audio_scene_rundown_library(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_audio_scene_backup(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_audio_scene_backups(uuid) TO authenticated;
