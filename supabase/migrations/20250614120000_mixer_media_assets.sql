-- Video mixer media library (images + videos) in Regal Cloud

CREATE TABLE IF NOT EXISTS public.mixer_media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('image', 'video')),
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  natural_width integer NOT NULL DEFAULT 0,
  natural_height integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, storage_path)
);

CREATE INDEX IF NOT EXISTS mixer_media_assets_user_created_idx
  ON public.mixer_media_assets (user_id, created_at DESC);

ALTER TABLE public.mixer_media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY mixer_media_assets_select_own
  ON public.mixer_media_assets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY mixer_media_assets_insert_own
  ON public.mixer_media_assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY mixer_media_assets_delete_own
  ON public.mixer_media_assets FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.list_mixer_media_assets()
RETURNS SETOF public.mixer_media_assets
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.mixer_media_assets
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.register_mixer_media_asset(
  p_id uuid,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_kind text,
  p_size_bytes bigint,
  p_natural_width integer DEFAULT 0,
  p_natural_height integer DEFAULT 0
)
RETURNS public.mixer_media_assets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_used bigint;
  v_quota bigint;
  v_row public.mixer_media_assets;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_storage_path IS NULL OR trim(p_storage_path) = '' THEN
    RAISE EXCEPTION 'storage_path is required';
  END IF;

  IF p_kind NOT IN ('image', 'video') THEN
    RAISE EXCEPTION 'Invalid media kind';
  END IF;

  SELECT COALESCE(SUM(size_bytes), 0) INTO v_used
  FROM (
    SELECT size_bytes FROM public.mixer_recordings WHERE user_id = v_user_id
    UNION ALL SELECT size_bytes FROM public.replay_clips WHERE user_id = v_user_id
    UNION ALL SELECT size_bytes FROM public.mixer_media_assets WHERE user_id = v_user_id
  ) t;

  v_quota := public.get_recording_storage_quota_bytes();

  IF v_quota <= 0 THEN
    RAISE EXCEPTION 'Cloud storage is not included on your plan';
  END IF;

  IF p_size_bytes > GREATEST(v_quota - v_used, 0) THEN
    RAISE EXCEPTION 'Cloud storage quota exceeded';
  END IF;

  INSERT INTO public.mixer_media_assets (
    id, user_id, storage_path, file_name, mime_type, kind, size_bytes, natural_width, natural_height
  )
  VALUES (
    COALESCE(p_id, gen_random_uuid()),
    v_user_id,
    trim(p_storage_path),
    trim(p_file_name),
    trim(p_mime_type),
    p_kind,
    GREATEST(p_size_bytes, 0),
    GREATEST(p_natural_width, 0),
    GREATEST(p_natural_height, 0)
  )
  ON CONFLICT (user_id, storage_path) DO UPDATE
  SET
    file_name = EXCLUDED.file_name,
    mime_type = EXCLUDED.mime_type,
    kind = EXCLUDED.kind,
    size_bytes = EXCLUDED.size_bytes,
    natural_width = EXCLUDED.natural_width,
    natural_height = EXCLUDED.natural_height
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_mixer_media_asset(p_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_path text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.mixer_media_assets
  WHERE id = p_id AND user_id = v_user_id
  RETURNING storage_path INTO v_path;

  IF v_path IS NULL THEN
    RAISE EXCEPTION 'Media asset not found';
  END IF;

  RETURN v_path;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_mixer_media_assets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_mixer_media_asset(uuid, text, text, text, text, bigint, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_mixer_media_asset(uuid) TO authenticated;
