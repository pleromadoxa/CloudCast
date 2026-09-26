-- Platform-wide enable/disable flags for CloudCast product dashboards (admin kill switches).

CREATE TABLE IF NOT EXISTS public.platform_product_services (
  product_id text PRIMARY KEY
    CHECK (product_id IN (
      'video_mixer',
      'audio_mixer',
      'symphony_studio',
      'instant_replay',
      'regal_display',
      'regal_prism'
    )),
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.platform_product_services ENABLE ROW LEVEL SECURITY;

INSERT INTO public.platform_product_services (product_id, is_enabled)
VALUES
  ('video_mixer', true),
  ('audio_mixer', true),
  ('symphony_studio', true),
  ('instant_replay', true),
  ('regal_display', true),
  ('regal_prism', true)
ON CONFLICT (product_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_platform_product_services()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'product_id', s.product_id,
          'is_enabled', s.is_enabled,
          'updated_at', s.updated_at
        )
        ORDER BY s.product_id
      )
      FROM public.platform_product_services s
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_platform_product_services()
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
      SELECT jsonb_agg(
        jsonb_build_object(
          'product_id', s.product_id,
          'is_enabled', s.is_enabled,
          'updated_at', s.updated_at,
          'updated_by', s.updated_by,
          'updated_by_email', u.email
        )
        ORDER BY s.product_id
      )
      FROM public.platform_product_services s
      LEFT JOIN auth.users u ON u.id = s.updated_by
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_platform_product_service(
  p_product_id text,
  p_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.platform_product_services%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_product_id NOT IN (
    'video_mixer',
    'audio_mixer',
    'symphony_studio',
    'instant_replay',
    'regal_display',
    'regal_prism'
  ) THEN
    RAISE EXCEPTION 'Unknown product: %', p_product_id;
  END IF;

  INSERT INTO public.platform_product_services (product_id, is_enabled, updated_at, updated_by)
  VALUES (p_product_id, p_enabled, now(), auth.uid())
  ON CONFLICT (product_id) DO UPDATE
    SET is_enabled = EXCLUDED.is_enabled,
        updated_at = now(),
        updated_by = auth.uid()
  RETURNING * INTO v_row;

  PERFORM public.log_activity(
    CASE WHEN p_enabled THEN 'admin.service.enable' ELSE 'admin.service.disable' END,
    'platform_product_service',
    p_product_id,
    jsonb_build_object('is_enabled', p_enabled)
  );

  RETURN jsonb_build_object(
    'product_id', v_row.product_id,
    'is_enabled', v_row.is_enabled,
    'updated_at', v_row.updated_at,
    'updated_by', v_row.updated_by
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_product_services() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_platform_product_services() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_platform_product_service(text, boolean) TO authenticated;
