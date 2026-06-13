-- CloudCast Audio Mixer phase 4 — scene rundown share codes

ALTER TABLE public.audio_scene_rundown_templates
  ADD COLUMN IF NOT EXISTS share_code text,
  ADD COLUMN IF NOT EXISTS shared_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS audio_scene_rundown_share_code_uidx
  ON public.audio_scene_rundown_templates (share_code)
  WHERE share_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.publish_audio_scene_rundown_share(p_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_code text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  UPDATE public.audio_scene_rundown_templates
  SET share_code = v_code, shared_at = now(), updated_at = now()
  WHERE id = p_id AND user_id = v_user_id
  RETURNING share_code INTO v_code;

  IF v_code IS NULL THEN RAISE EXCEPTION 'Rundown template not found'; END IF;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.import_audio_scene_rundown_share(p_share_code text)
RETURNS public.audio_scene_rundown_templates
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_source public.audio_scene_rundown_templates;
  v_row public.audio_scene_rundown_templates;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_share_code IS NULL OR trim(p_share_code) = '' THEN RAISE EXCEPTION 'Share code is required'; END IF;

  SELECT * INTO v_source
  FROM public.audio_scene_rundown_templates
  WHERE share_code = upper(trim(p_share_code))
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'Share code not found'; END IF;

  INSERT INTO public.audio_scene_rundown_templates (user_id, session_id, name, items)
  VALUES (v_user_id, NULL, v_source.name || ' (shared)', v_source.items)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_audio_scene_rundown_share(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_audio_scene_rundown_share(text) TO authenticated;
