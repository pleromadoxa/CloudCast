-- Program presets: saved broadcast configurations synced to user account

CREATE TABLE IF NOT EXISTS public.program_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT program_presets_name_len CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 120)
);

CREATE INDEX IF NOT EXISTS program_presets_user_updated_idx
  ON public.program_presets (user_id, updated_at DESC);

ALTER TABLE public.program_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY program_presets_select_own ON public.program_presets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY program_presets_insert_own ON public.program_presets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY program_presets_update_own ON public.program_presets
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY program_presets_delete_own ON public.program_presets
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.list_program_presets()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', pp.id,
          'name', pp.name,
          'description', pp.description,
          'updated_at', pp.updated_at,
          'created_at', pp.created_at
        )
        ORDER BY pp.updated_at DESC
      )
      FROM public.program_presets pp
      WHERE pp.user_id = v_user_id
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_program_preset(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.program_presets%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_row
  FROM public.program_presets
  WHERE id = p_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Program preset not found';
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'name', v_row.name,
    'description', v_row.description,
    'config', v_row.config,
    'updated_at', v_row.updated_at,
    'created_at', v_row.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_program_preset(
  p_id uuid,
  p_name text,
  p_description text,
  p_config jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_row public.program_presets%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF trim(p_name) = '' THEN
    RAISE EXCEPTION 'Preset name is required';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.program_presets (user_id, name, description, config)
    VALUES (v_user_id, trim(p_name), nullif(trim(coalesce(p_description, '')), ''), coalesce(p_config, '{}'::jsonb))
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.program_presets
    SET
      name = trim(p_name),
      description = nullif(trim(coalesce(p_description, '')), ''),
      config = coalesce(p_config, '{}'::jsonb),
      updated_at = now()
    WHERE id = p_id AND user_id = v_user_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Program preset not found';
    END IF;
  END IF;

  SELECT * INTO v_row FROM public.program_presets WHERE id = v_id;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'name', v_row.name,
    'description', v_row.description,
    'config', v_row.config,
    'updated_at', v_row.updated_at,
    'created_at', v_row.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_program_preset(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  DELETE FROM public.program_presets
  WHERE id = p_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Program preset not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_program_presets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_program_preset(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_program_preset(uuid, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_program_preset(uuid) TO authenticated;
