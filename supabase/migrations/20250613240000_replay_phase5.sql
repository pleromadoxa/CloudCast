-- CloudCast Replay phase 5 — rundown templates + quota snapshot helpers

CREATE TABLE IF NOT EXISTS public.replay_rundown_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid,
  name text NOT NULL,
  playback_rate numeric NOT NULL DEFAULT 1 CHECK (playback_rate > 0),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT replay_rundown_templates_name_len CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 120)
);

CREATE INDEX IF NOT EXISTS replay_rundown_templates_user_updated_idx
  ON public.replay_rundown_templates (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS replay_rundown_templates_session_idx
  ON public.replay_rundown_templates (session_id, updated_at DESC)
  WHERE session_id IS NOT NULL;

ALTER TABLE public.replay_rundown_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY replay_rundown_templates_select_own
  ON public.replay_rundown_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY replay_rundown_templates_insert_own
  ON public.replay_rundown_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY replay_rundown_templates_update_own
  ON public.replay_rundown_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY replay_rundown_templates_delete_own
  ON public.replay_rundown_templates FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.list_replay_rundown_templates(p_session_id uuid DEFAULT NULL)
RETURNS SETOF public.replay_rundown_templates
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.replay_rundown_templates
  WHERE user_id = auth.uid()
    AND (p_session_id IS NULL OR session_id IS NULL OR session_id = p_session_id)
  ORDER BY updated_at DESC
  LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION public.upsert_replay_rundown_template(
  p_id uuid DEFAULT NULL,
  p_session_id uuid DEFAULT NULL,
  p_name text DEFAULT 'Rundown',
  p_playback_rate numeric DEFAULT 1,
  p_items jsonb DEFAULT '[]'::jsonb
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

  IF p_id IS NOT NULL THEN
    UPDATE public.replay_rundown_templates
    SET
      session_id = p_session_id,
      name = COALESCE(NULLIF(trim(p_name), ''), name),
      playback_rate = GREATEST(COALESCE(p_playback_rate, playback_rate), 0.1),
      items = COALESCE(p_items, items),
      updated_at = now()
    WHERE id = p_id AND user_id = v_user_id
    RETURNING * INTO v_row;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Rundown template not found';
    END IF;
    RETURN v_row;
  END IF;

  INSERT INTO public.replay_rundown_templates (
    user_id,
    session_id,
    name,
    playback_rate,
    items
  )
  VALUES (
    v_user_id,
    p_session_id,
    COALESCE(NULLIF(trim(p_name), ''), 'Rundown'),
    GREATEST(COALESCE(p_playback_rate, 1), 0.1),
    COALESCE(p_items, '[]'::jsonb)
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_replay_rundown_template(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.replay_rundown_templates
  WHERE id = p_id AND user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_replay_rundown_templates(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_replay_rundown_template(uuid, uuid, text, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_replay_rundown_template(uuid) TO authenticated;
