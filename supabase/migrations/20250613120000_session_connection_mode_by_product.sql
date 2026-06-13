-- Product-aware session plans: mesh for free video + all audio; Regal Cloud for paid video.

CREATE OR REPLACE FUNCTION resolve_product_plan_id(
  p_profile profiles,
  p_product text
)
RETURNS plan_tier
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_product, 'video') = 'audio' THEN
      COALESCE(
        p_profile.audio_plan_id,
        CASE
          WHEN p_profile.plan_id = 'universal'::plan_tier THEN 'pro_master'::plan_tier
          ELSE p_profile.plan_id
        END
      )
    ELSE
      COALESCE(
        p_profile.video_plan_id,
        CASE
          WHEN p_profile.plan_id = 'universal'::plan_tier THEN 'pro_master'::plan_tier
          ELSE p_profile.plan_id
        END
      )
  END;
$$;

CREATE OR REPLACE FUNCTION resolve_session_connection_mode(
  p_plan_id plan_tier,
  p_product text
)
RETURNS connection_mode
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_product, 'video') = 'audio' THEN 'mesh'::connection_mode
    WHEN p_plan_id = 'free'::plan_tier THEN 'mesh'::connection_mode
    ELSE COALESCE(
      (SELECT connection_mode FROM subscription_plans WHERE id = p_plan_id),
      'regal'::connection_mode
    )
  END;
$$;

CREATE OR REPLACE FUNCTION resolve_session_max_devices(
  p_plan_id plan_tier,
  p_product text
)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_product, 'video') = 'audio' THEN 16
    ELSE COALESCE(
      (SELECT max_total_channels FROM subscription_plans WHERE id = p_plan_id),
      2
    )
  END;
$$;

CREATE OR REPLACE FUNCTION resolve_session_max_mobile(
  p_plan_id plan_tier,
  p_product text
)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_product, 'video') = 'audio' THEN
      CASE p_plan_id
        WHEN 'free'::plan_tier THEN 4
        WHEN 'pro'::plan_tier THEN 8
        ELSE 16
      END
    ELSE COALESCE(
      (SELECT max_mobile_devices FROM subscription_plans WHERE id = p_plan_id),
      2
    )
  END;
$$;

CREATE OR REPLACE FUNCTION resolve_session_max_usb(
  p_plan_id plan_tier,
  p_product text
)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_product, 'video') = 'audio' THEN 0
    ELSE COALESCE(
      (SELECT max_usb_devices FROM subscription_plans WHERE id = p_plan_id),
      0
    )
  END;
$$;

CREATE OR REPLACE FUNCTION mixer_session_to_jsonb(p_row mixer_sessions)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN jsonb_build_object(
    'session_id', p_row.id,
    'access_code', p_row.access_code,
    'max_devices', p_row.max_devices,
    'max_mobile_devices', p_row.max_mobile_devices,
    'max_usb_devices', p_row.max_usb_devices,
    'plan_id', p_row.plan_id,
    'plan_name', (SELECT name FROM subscription_plans WHERE id = p_row.plan_id),
    'connection_mode', resolve_session_connection_mode(p_row.plan_id, coalesce(p_row.product_type, 'video')),
    'realtime_channel', p_row.realtime_channel,
    'device_count', (SELECT count(*) FROM paired_devices pd WHERE pd.session_id = p_row.id),
    'product_type', p_row.product_type,
    'bridge_code', p_row.bridge_code
  );
END;
$$;

CREATE OR REPLACE FUNCTION sync_mixer_session_plan(
  p_session_id uuid,
  p_access_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  prof profiles%ROWTYPE;
  row mixer_sessions%ROWTYPE;
  effective_plan plan_tier;
  product text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO row
  FROM mixer_sessions
  WHERE id = p_session_id
    AND upper(access_code) = upper(trim(p_access_code))
    AND owner_id = uid
    AND is_active = true;

  IF row.id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  SELECT * INTO prof FROM profiles WHERE id = uid;
  product := coalesce(row.product_type, 'video');
  effective_plan := resolve_product_plan_id(prof, product);

  UPDATE mixer_sessions
  SET
    plan_id = effective_plan,
    connection_mode = resolve_session_connection_mode(effective_plan, product),
    max_devices = resolve_session_max_devices(effective_plan, product),
    max_mobile_devices = resolve_session_max_mobile(effective_plan, product),
    max_usb_devices = resolve_session_max_usb(effective_plan, product),
    updated_at = now()
  WHERE id = row.id
  RETURNING * INTO row;

  RETURN mixer_session_to_jsonb(row);
END;
$$;

CREATE OR REPLACE FUNCTION get_or_create_owner_session_with_product(p_product text DEFAULT 'video')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  prof profiles%ROWTYPE;
  effective_plan plan_tier;
  new_code text;
  new_row mixer_sessions%ROWTYPE;
  product text := coalesce(p_product, 'video');
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO prof FROM profiles WHERE id = uid;
  effective_plan := resolve_product_plan_id(prof, product);

  new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO mixer_sessions (
    owner_id,
    access_code,
    plan_id,
    connection_mode,
    max_devices,
    max_mobile_devices,
    max_usb_devices,
    product_type,
    is_active
  )
  VALUES (
    uid,
    new_code,
    effective_plan,
    resolve_session_connection_mode(effective_plan, product),
    resolve_session_max_devices(effective_plan, product),
    resolve_session_max_mobile(effective_plan, product),
    resolve_session_max_usb(effective_plan, product),
    product,
    true
  )
  RETURNING * INTO new_row;

  RETURN mixer_session_to_jsonb(new_row);
END;
$$;

CREATE OR REPLACE FUNCTION get_or_create_owner_session()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  row mixer_sessions%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO row
  FROM mixer_sessions
  WHERE owner_id = uid
    AND is_active = true
    AND coalesce(product_type, 'video') = 'video'
  ORDER BY created_at DESC
  LIMIT 1;

  IF row.id IS NULL THEN
    RETURN get_or_create_owner_session_with_product('video');
  END IF;

  RETURN sync_mixer_session_plan(row.id, row.access_code);
END;
$$;

CREATE OR REPLACE FUNCTION get_or_create_audio_owner_session()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  row mixer_sessions%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO row
  FROM mixer_sessions
  WHERE owner_id = uid
    AND is_active = true
    AND product_type = 'audio'
  ORDER BY created_at DESC
  LIMIT 1;

  IF row.id IS NULL THEN
    RETURN get_or_create_owner_session_with_product('audio');
  END IF;

  RETURN sync_mixer_session_plan(row.id, row.access_code);
END;
$$;

-- Backfill existing sessions to the correct connection mode and limits.
UPDATE mixer_sessions ms
SET
  plan_id = resolve_product_plan_id(p, coalesce(ms.product_type, 'video')),
  connection_mode = resolve_session_connection_mode(
    resolve_product_plan_id(p, coalesce(ms.product_type, 'video')),
    coalesce(ms.product_type, 'video')
  ),
  max_devices = resolve_session_max_devices(
    resolve_product_plan_id(p, coalesce(ms.product_type, 'video')),
    coalesce(ms.product_type, 'video')
  ),
  max_mobile_devices = resolve_session_max_mobile(
    resolve_product_plan_id(p, coalesce(ms.product_type, 'video')),
    coalesce(ms.product_type, 'video')
  ),
  max_usb_devices = resolve_session_max_usb(
    resolve_product_plan_id(p, coalesce(ms.product_type, 'video')),
    coalesce(ms.product_type, 'video')
  ),
  updated_at = now()
FROM profiles p
WHERE p.id = ms.owner_id
  AND ms.is_active = true;

GRANT EXECUTE ON FUNCTION resolve_product_plan_id(profiles, text) TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_session_connection_mode(plan_tier, text) TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_session_max_devices(plan_tier, text) TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_session_max_mobile(plan_tier, text) TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_session_max_usb(plan_tier, text) TO authenticated;
GRANT EXECUTE ON FUNCTION mixer_session_to_jsonb(mixer_sessions) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_mixer_session_plan(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_owner_session_with_product(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_owner_session() TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_audio_owner_session() TO authenticated;

CREATE OR REPLACE FUNCTION get_mixer_session(p_access_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row mixer_sessions%ROWTYPE;
  product text;
BEGIN
  SELECT * INTO row
  FROM mixer_sessions
  WHERE upper(access_code) = upper(trim(p_access_code))
    AND is_active = true
  LIMIT 1;

  IF row.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired access code';
  END IF;

  IF to_regclass('public.revoked_mixer_access_codes') IS NOT NULL AND EXISTS (
    SELECT 1
    FROM revoked_mixer_access_codes
    WHERE upper(access_code) = upper(trim(p_access_code))
  ) THEN
    RAISE EXCEPTION 'Access code has been revoked';
  END IF;

  IF row.expires_at IS NOT NULL AND row.expires_at < now() THEN
    RAISE EXCEPTION 'Session expired';
  END IF;

  product := coalesce(row.product_type, 'video');

  RETURN jsonb_build_object(
    'session_id', row.id,
    'access_code', row.access_code,
    'max_devices', row.max_devices,
    'max_mobile_devices', row.max_mobile_devices,
    'max_usb_devices', row.max_usb_devices,
    'plan_id', row.plan_id,
    'plan_name', (SELECT name FROM subscription_plans WHERE id = row.plan_id),
    'connection_mode', resolve_session_connection_mode(row.plan_id, product),
    'realtime_channel', row.realtime_channel,
    'device_count', (SELECT count(*) FROM paired_devices pd WHERE pd.session_id = row.id),
    'product_type', product
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_mixer_session_by_id(
  p_session_id uuid,
  p_access_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row mixer_sessions%ROWTYPE;
BEGIN
  SELECT * INTO row
  FROM mixer_sessions
  WHERE id = p_session_id
    AND upper(access_code) = upper(trim(p_access_code))
    AND is_active = true;

  IF row.id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  RETURN mixer_session_to_jsonb(row);
END;
$$;

GRANT EXECUTE ON FUNCTION get_mixer_session(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_mixer_session_by_id(uuid, text) TO authenticated;
