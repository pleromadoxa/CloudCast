-- Fix session init: one active pairing session per owner; reuse legacy audio sessions.

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

  -- One active session per owner — retire stale sessions before insert.
  UPDATE mixer_sessions
  SET is_active = false, updated_at = now()
  WHERE owner_id = uid AND is_active = true;

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

  -- Prefer an active video session; fall back to legacy audio-only sessions.
  SELECT * INTO row
  FROM mixer_sessions
  WHERE owner_id = uid
    AND is_active = true
  ORDER BY
    CASE coalesce(product_type, 'video') WHEN 'video' THEN 0 ELSE 1 END,
    created_at DESC
  LIMIT 1;

  IF row.id IS NULL THEN
    RETURN get_or_create_owner_session_with_product('video');
  END IF;

  -- Promote legacy audio-only sessions to the shared video pairing session.
  IF coalesce(row.product_type, 'video') = 'audio' THEN
    UPDATE mixer_sessions
    SET product_type = 'video', updated_at = now()
    WHERE id = row.id
    RETURNING * INTO row;
  END IF;

  RETURN sync_mixer_session_plan(row.id, row.access_code);
END;
$$;

GRANT EXECUTE ON FUNCTION get_or_create_owner_session_with_product(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_owner_session() TO authenticated;

CREATE OR REPLACE FUNCTION get_or_create_audio_owner_session()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN get_or_create_owner_session();
END;
$$;

GRANT EXECUTE ON FUNCTION get_or_create_audio_owner_session() TO authenticated;
