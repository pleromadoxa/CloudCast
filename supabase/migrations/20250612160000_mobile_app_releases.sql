-- Mobile app releases (APK distribution per CloudCast product)

CREATE TABLE IF NOT EXISTS public.mobile_app_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL CHECK (product_id IN ('video_mixer', 'audio_mixer', 'symphony_studio')),
  platform text NOT NULL DEFAULT 'android' CHECK (platform IN ('android', 'ios')),
  version_name text NOT NULL,
  version_code int CHECK (version_code IS NULL OR version_code > 0),
  description text,
  storage_path text,
  file_name text,
  size_bytes bigint NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  ios_app_store_url text,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mobile_app_releases_android_file_chk CHECK (
    platform <> 'android' OR (storage_path IS NOT NULL AND file_name IS NOT NULL)
  ),
  CONSTRAINT mobile_app_releases_ios_url_chk CHECK (
    platform <> 'ios' OR ios_app_store_url IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS mobile_app_releases_product_idx
  ON public.mobile_app_releases (product_id, platform, is_published, created_at DESC);

ALTER TABLE public.mobile_app_releases ENABLE ROW LEVEL SECURITY;

-- User-facing: latest published release per product (Android APK + optional iOS store link)
CREATE OR REPLACE FUNCTION public.list_published_mobile_apps()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.product_id)
      FROM (
        SELECT DISTINCT ON (mar.product_id)
          mar.id,
          mar.product_id,
          mar.platform,
          mar.version_name,
          mar.version_code,
          mar.description,
          mar.file_name,
          mar.size_bytes,
          mar.ios_app_store_url,
          mar.published_at,
          mar.created_at
        FROM public.mobile_app_releases mar
        WHERE mar.is_published = true
          AND mar.platform = 'android'
        ORDER BY mar.product_id, mar.published_at DESC NULLS LAST, mar.created_at DESC
      ) r
    ),
    '[]'::jsonb
  );
END;
$$;

-- Edge function: resolve download for a published Android release
CREATE OR REPLACE FUNCTION public.get_mobile_app_download(p_release_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.mobile_app_releases;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_row
  FROM public.mobile_app_releases
  WHERE id = p_release_id
    AND is_published = true
    AND platform = 'android'
    AND storage_path IS NOT NULL
    AND file_name IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Release not found or not available';
  END IF;

  RETURN jsonb_build_object(
    'storage_path', v_row.storage_path,
    'file_name', v_row.file_name,
    'product_id', v_row.product_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_mobile_app_releases(
  p_product_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC)
      FROM (
        SELECT
          mar.id,
          mar.product_id,
          mar.platform,
          mar.version_name,
          mar.version_code,
          mar.description,
          mar.storage_path,
          mar.file_name,
          mar.size_bytes,
          mar.ios_app_store_url,
          mar.is_published,
          mar.published_at,
          mar.created_at,
          mar.updated_at,
          cb.email AS created_by_email
        FROM public.mobile_app_releases mar
        LEFT JOIN auth.users cb ON cb.id = mar.created_by
        WHERE p_product_id IS NULL OR mar.product_id = p_product_id
        ORDER BY mar.created_at DESC
      ) r
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_mobile_app_release(
  p_product_id text,
  p_version_name text,
  p_storage_path text,
  p_file_name text,
  p_size_bytes bigint,
  p_description text DEFAULT NULL,
  p_version_code int DEFAULT NULL,
  p_publish boolean DEFAULT false
)
RETURNS public.mobile_app_releases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.mobile_app_releases;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_product_id NOT IN ('video_mixer', 'audio_mixer', 'symphony_studio') THEN
    RAISE EXCEPTION 'Invalid product';
  END IF;

  IF coalesce(trim(p_version_name), '') = '' THEN
    RAISE EXCEPTION 'Version name is required';
  END IF;

  IF coalesce(trim(p_storage_path), '') = '' OR coalesce(trim(p_file_name), '') = '' THEN
    RAISE EXCEPTION 'Storage path and file name are required';
  END IF;

  IF p_publish THEN
    UPDATE public.mobile_app_releases
    SET is_published = false, updated_at = now()
    WHERE product_id = p_product_id
      AND platform = 'android'
      AND is_published = true;
  END IF;

  INSERT INTO public.mobile_app_releases (
    product_id,
    platform,
    version_name,
    version_code,
    description,
    storage_path,
    file_name,
    size_bytes,
    is_published,
    published_at,
    created_by
  )
  VALUES (
    p_product_id,
    'android',
    trim(p_version_name),
    p_version_code,
    nullif(trim(p_description), ''),
    trim(p_storage_path),
    trim(p_file_name),
    greatest(coalesce(p_size_bytes, 0), 0),
    coalesce(p_publish, false),
    CASE WHEN coalesce(p_publish, false) THEN now() ELSE NULL END,
    auth.uid()
  )
  RETURNING * INTO v_row;

  PERFORM public.log_activity(
    'admin.mobile_app.create',
    'mobile_app_release',
    v_row.id::text,
    jsonb_build_object(
      'product_id', v_row.product_id,
      'version_name', v_row.version_name,
      'published', v_row.is_published
    )
  );

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_mobile_app_release(
  p_id uuid,
  p_description text DEFAULT NULL,
  p_version_name text DEFAULT NULL,
  p_version_code int DEFAULT NULL,
  p_ios_app_store_url text DEFAULT NULL
)
RETURNS public.mobile_app_releases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.mobile_app_releases;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.mobile_app_releases
  SET
    description = CASE WHEN p_description IS NOT NULL THEN nullif(trim(p_description), '') ELSE description END,
    version_name = CASE WHEN p_version_name IS NOT NULL THEN trim(p_version_name) ELSE version_name END,
    version_code = COALESCE(p_version_code, version_code),
    ios_app_store_url = CASE WHEN p_ios_app_store_url IS NOT NULL THEN nullif(trim(p_ios_app_store_url), '') ELSE ios_app_store_url END,
    updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Release not found';
  END IF;

  PERFORM public.log_activity(
    'admin.mobile_app.update',
    'mobile_app_release',
    v_row.id::text,
    jsonb_build_object('product_id', v_row.product_id)
  );

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_publish_mobile_app_release(p_id uuid)
RETURNS public.mobile_app_releases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.mobile_app_releases;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_row FROM public.mobile_app_releases WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Release not found';
  END IF;

  IF v_row.platform = 'android' AND (v_row.storage_path IS NULL OR v_row.file_name IS NULL) THEN
    RAISE EXCEPTION 'Android release requires an uploaded APK';
  END IF;

  UPDATE public.mobile_app_releases
  SET is_published = false, updated_at = now()
  WHERE product_id = v_row.product_id
    AND platform = v_row.platform
    AND is_published = true
    AND id <> p_id;

  UPDATE public.mobile_app_releases
  SET is_published = true, published_at = now(), updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_row;

  PERFORM public.log_activity(
    'admin.mobile_app.publish',
    'mobile_app_release',
    v_row.id::text,
    jsonb_build_object('product_id', v_row.product_id, 'version_name', v_row.version_name)
  );

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unpublish_mobile_app_release(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.mobile_app_releases
  SET is_published = false, updated_at = now()
  WHERE id = p_id;

  PERFORM public.log_activity('admin.mobile_app.unpublish', 'mobile_app_release', p_id::text, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_mobile_app_release(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.mobile_app_releases;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_row FROM public.mobile_app_releases WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Release not found';
  END IF;

  DELETE FROM public.mobile_app_releases WHERE id = p_id;

  PERFORM public.log_activity(
    'admin.mobile_app.delete',
    'mobile_app_release',
    p_id::text,
    jsonb_build_object('product_id', v_row.product_id, 'storage_path', v_row.storage_path)
  );

  RETURN jsonb_build_object(
    'storage_path', v_row.storage_path,
    'product_id', v_row.product_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_published_mobile_apps() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mobile_app_download(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_mobile_app_releases(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_mobile_app_release(text, text, text, text, bigint, text, int, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_mobile_app_release(uuid, text, text, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_publish_mobile_app_release(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unpublish_mobile_app_release(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_mobile_app_release(uuid) TO authenticated;
