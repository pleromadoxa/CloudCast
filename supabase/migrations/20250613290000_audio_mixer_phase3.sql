-- CloudCast Audio Mixer phase 3 — scene rundown templates + scheduled ops digest

CREATE TABLE IF NOT EXISTS public.audio_scene_rundown_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid,
  name text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audio_scene_rundown_name_len CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 120)
);

CREATE INDEX IF NOT EXISTS audio_scene_rundown_user_updated_idx
  ON public.audio_scene_rundown_templates (user_id, updated_at DESC);

ALTER TABLE public.audio_scene_rundown_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY audio_scene_rundown_select_own
  ON public.audio_scene_rundown_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY audio_scene_rundown_insert_own
  ON public.audio_scene_rundown_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY audio_scene_rundown_update_own
  ON public.audio_scene_rundown_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY audio_scene_rundown_delete_own
  ON public.audio_scene_rundown_templates FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.list_audio_scene_rundown_templates(p_session_id uuid DEFAULT NULL)
RETURNS SETOF public.audio_scene_rundown_templates
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT *
  FROM public.audio_scene_rundown_templates
  WHERE user_id = auth.uid()
    AND (p_session_id IS NULL OR session_id IS NULL OR session_id = p_session_id)
  ORDER BY updated_at DESC
  LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION public.upsert_audio_scene_rundown_template(
  p_id uuid DEFAULT NULL,
  p_session_id uuid DEFAULT NULL,
  p_name text DEFAULT 'Scene rundown',
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS public.audio_scene_rundown_templates
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.audio_scene_rundown_templates;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF p_id IS NOT NULL THEN
    UPDATE public.audio_scene_rundown_templates
    SET
      session_id = p_session_id,
      name = COALESCE(NULLIF(trim(p_name), ''), name),
      items = COALESCE(p_items, items),
      updated_at = now()
    WHERE id = p_id AND user_id = v_user_id
    RETURNING * INTO v_row;
    IF NOT FOUND THEN RAISE EXCEPTION 'Rundown template not found'; END IF;
    RETURN v_row;
  END IF;

  INSERT INTO public.audio_scene_rundown_templates (user_id, session_id, name, items)
  VALUES (v_user_id, p_session_id, COALESCE(NULLIF(trim(p_name), ''), 'Scene rundown'), COALESCE(p_items, '[]'::jsonb))
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_audio_scene_rundown_template(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM public.audio_scene_rundown_templates WHERE id = p_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Rundown template not found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.maybe_send_scheduled_audio_ops_digest()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_prefs public.audio_ops_digest_prefs;
  v_due boolean := false;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_prefs FROM public.audio_ops_digest_prefs WHERE user_id = v_user_id;

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

  v_result := public.enqueue_audio_ops_digest();
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_audio_scene_rundown_templates(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_audio_scene_rundown_template(uuid, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_audio_scene_rundown_template(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.maybe_send_scheduled_audio_ops_digest() TO authenticated;
